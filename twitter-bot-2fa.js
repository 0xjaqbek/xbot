// twitter-bot-2fa.js - Simplified version with excellent 2FA support
const { chromium } = require('playwright');

class TwitterBot2FA {
    constructor() {
        this.browser = null;
        this.page = null;
        this.isLoggedIn = false;
    }

    async init() {
        console.log('🚀 Initializing browser...');
        
        this.browser = await chromium.launch({ 
            headless: false, // Keep visible for 2FA
            slowMo: 300
        });
        
        const context = await this.browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 720 }
        });
        
        this.page = await context.newPage();
        console.log('✅ Browser initialized');
    }

    async loginWith2FA(username, password) {
        try {
            console.log('🔐 Starting login process...');
            
            // Check if already logged in
            await this.page.goto('https://twitter.com/home');
            await this.page.waitForTimeout(2000);
            
            if (await this.checkIfLoggedIn()) {
                console.log('✅ Already logged in!');
                return true;
            }

            // Go to login page
            console.log('🔐 Going to login page...');
            await this.page.goto('https://twitter.com/i/flow/login');
            await this.page.waitForTimeout(3000);

            // Step 1: Enter username
            console.log('📝 Step 1: Entering username...');
            await this.enterUsername(username);

            // Step 2: Check for unusual activity / phone verification
            await this.page.waitForTimeout(3000);
            if (await this.handlePhoneVerification()) {
                console.log('📱 Phone verification handled, continuing...');
            }

            // Step 3: Enter password
            console.log('🔑 Step 2: Entering password...');
            await this.enterPassword(password);

            // Step 4: Handle 2FA if required
            await this.page.waitForTimeout(3000);
            const requires2FA = await this.detect2FA();
            
            if (requires2FA) {
                console.log('🔐 Step 3: 2FA detected!');
                console.log('📱 Please open your authenticator app and enter the 6-digit code in the browser');
                console.log('⏳ I will wait for you to complete this...');
                
                await this.waitFor2FACompletion();
                console.log('✅ 2FA completed successfully!');
            }

            // Step 5: Verify login
            console.log('🔍 Verifying login...');
            await this.page.waitForTimeout(3000);
            
            if (await this.checkIfLoggedIn()) {
                console.log('🎉 Login successful!');
                this.isLoggedIn = true;
                return true;
            } else {
                console.log('❌ Login verification failed');
                return false;
            }

        } catch (error) {
            console.error('❌ Login error:', error.message);
            return false;
        }
    }

    async checkIfLoggedIn() {
        const indicators = [
            '[data-testid="SideNav_AccountSwitcher_Button"]',
            '[data-testid="AppTabBar_Home_Link"]',
            '[aria-label="Home timeline"]'
        ];
        
        for (const indicator of indicators) {
            if (await this.page.locator(indicator).isVisible().catch(() => false)) {
                return true;
            }
        }
        
        const url = this.page.url();
        return url.includes('/home') || url.includes('/timeline');
    }

    async enterUsername(username) {
        const selectors = [
            'input[autocomplete="username"]',
            'input[name="text"]',
            'input[data-testid="ocfEnterTextTextInput"]'
        ];
        
        for (const selector of selectors) {
            try {
                const input = await this.page.waitForSelector(selector, { timeout: 3000 });
                await input.fill(username);
                console.log(`✅ Username entered with: ${selector}`);
                
                // Click Next or press Enter
                try {
                    await this.page.click('text=Next', { timeout: 2000 });
                } catch {
                    await input.press('Enter');
                }
                
                return true;
            } catch (e) {
                console.log(`⚠️ Username selector ${selector} failed, trying next...`);
            }
        }
        
        throw new Error('Could not find username input');
    }

    async handlePhoneVerification() {
        // Sometimes Twitter asks for phone verification before password
        const phoneSelectors = [
            'input[name="text"]',
            'input[placeholder*="phone"]',
            'text="Enter your phone number"'
        ];
        
        for (const selector of phoneSelectors) {
            if (await this.page.locator(selector).isVisible().catch(() => false)) {
                console.log('📱 Phone verification detected!');
                console.log('⚠️ Please handle this manually in the browser - enter your phone number');
                console.log('⏳ Waiting for you to continue...');
                
                // Wait for phone verification to be completed
                let completed = false;
                let attempts = 0;
                
                while (!completed && attempts < 60) { // 5 minutes
                    await this.page.waitForTimeout(5000);
                    
                    // Check if we moved past phone verification
                    const stillOnPhone = await this.page.locator(selector).isVisible().catch(() => false);
                    if (!stillOnPhone) {
                        completed = true;
                        break;
                    }
                    
                    attempts++;
                    if (attempts % 12 === 0) {
                        console.log(`⏳ Still waiting for phone verification... (${Math.floor(attempts / 12)} minutes)`);
                    }
                }
                
                return completed;
            }
        }
        
        return false; // No phone verification needed
    }

    async enterPassword(password) {
        const selectors = [
            'input[type="password"]',
            'input[name="password"]',
            'input[autocomplete="current-password"]'
        ];
        
        for (const selector of selectors) {
            try {
                const input = await this.page.waitForSelector(selector, { timeout: 5000 });
                await input.fill(password);
                console.log(`✅ Password entered with: ${selector}`);
                
                // Click Log in or press Enter
                try {
                    await this.page.click('text=Log in', { timeout: 2000 });
                } catch {
                    await input.press('Enter');
                }
                
                return true;
            } catch (e) {
                console.log(`⚠️ Password selector ${selector} failed, trying next...`);
            }
        }
        
        throw new Error('Could not find password input');
    }

    async detect2FA() {
        const twoFASelectors = [
            'input[data-testid="ocfEnterTextTextInput"]',
            'input[placeholder*="verification"]',
            'input[placeholder*="code"]',
            'text="Enter your verification code"',
            'text="We sent you a code"',
            'text="Check your authenticator app"'
        ];
        
        for (const selector of twoFASelectors) {
            if (await this.page.locator(selector).isVisible().catch(() => false)) {
                console.log(`✅ 2FA detected with: ${selector}`);
                return true;
            }
        }
        
        return false;
    }

    async waitFor2FACompletion() {
        console.log('⏳ Waiting for 2FA completion...');
        console.log('💡 INSTRUCTIONS:');
        console.log('   1. Open your authenticator app (Google Authenticator, Authy, etc.)');
        console.log('   2. Find the 6-digit code for Twitter');
        console.log('   3. Enter it in the browser window');
        console.log('   4. Click "Next" or press Enter');
        console.log('');
        
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes
        
        while (attempts < maxAttempts) {
            await this.page.waitForTimeout(5000);
            
            // Check if we're past 2FA
            if (await this.checkIfLoggedIn()) {
                console.log('✅ 2FA completed - logged in successfully!');
                return true;
            }
            
            // Check if still on 2FA page
            const still2FA = await this.detect2FA();
            if (!still2FA) {
                console.log('✅ 2FA page passed!');
                return true;
            }
            
            attempts++;
            if (attempts % 6 === 0) { // Every 30 seconds
                const minutes = Math.floor(attempts / 12);
                console.log(`⏳ Still waiting for 2FA... (${minutes} minutes elapsed)`);
                console.log('💡 Please enter your 6-digit authenticator code in the browser');
            }
        }
        
        throw new Error('2FA timeout - please complete within 5 minutes');
    }

    async getMyTweets(limit = 5) {
        if (!this.isLoggedIn) {
            throw new Error('Not logged in');
        }

        console.log('📝 Getting your tweets...');
        
        await this.page.goto('https://twitter.com/home');
        await this.page.waitForTimeout(3000);
        
        const tweets = [];
        
        try {
            await this.page.waitForSelector('[data-testid="tweet"]', { timeout: 10000 });
            const tweetElements = await this.page.$$('[data-testid="tweet"]');
            
            console.log(`Found ${tweetElements.length} tweet elements`);
            
            for (let i = 0; i < Math.min(limit, tweetElements.length); i++) {
                try {
                    const tweet = tweetElements[i];
                    
                    const textElement = await tweet.$('[data-testid="tweetText"]');
                    const text = textElement ? await textElement.textContent() : 'No text found';
                    
                    const timeElement = await tweet.$('time');
                    const time = timeElement ? await timeElement.getAttribute('datetime') : 'No time found';
                    
                    const linkElement = await tweet.$('a[href*="/status/"]');
                    const link = linkElement ? await linkElement.getAttribute('href') : '';
                    
                    tweets.push({
                        id: i + 1,
                        text: text,
                        time: time,
                        url: link ? `https://twitter.com${link}` : ''
                    });
                    
                    console.log(`📝 Tweet ${i + 1}: ${text.substring(0, 50)}...`);
                    
                } catch (error) {
                    console.log(`⚠️ Error processing tweet ${i + 1}:`, error.message);
                }
            }
            
        } catch (error) {
            console.log('❌ Could not find tweets:', error.message);
        }
        
        return tweets;
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            console.log('🔒 Browser closed');
        }
    }
}

// Test function
async function test2FALogin() {
    // ⚠️ REPLACE WITH YOUR CREDENTIALS
    const TWITTER_USERNAME = 'jaqbek_eth';
    const TWITTER_PASSWORD = 'Jakubek666'; 
    
    const bot = new TwitterBot2FA();
    
    try {
        console.log('🤖 Starting Twitter Bot with 2FA support...');
        console.log('⚠️ Make sure to update your credentials above!\n');
        
        await bot.init();
        
        console.log('🔐 Attempting login with 2FA support...');
        const loginSuccess = await bot.loginWith2FA(TWITTER_USERNAME, TWITTER_PASSWORD);
        
        if (loginSuccess) {
            console.log('\n🎉 Login successful! Testing tweet retrieval...');
            
            const tweets = await bot.getMyTweets(3);
            
            if (tweets.length > 0) {
                console.log('\n📝 Your recent tweets:');
                tweets.forEach((tweet, i) => {
                    console.log(`${i + 1}. ${tweet.text}`);
                    console.log(`   Time: ${tweet.time}`);
                    console.log(`   URL: ${tweet.url}\n`);
                });
                
                console.log('✅ Bot is working perfectly with 2FA!');
            }
        } else {
            console.log('❌ Login failed');
        }
        
        // Keep browser open for 30 seconds
        setTimeout(async () => {
            await bot.close();
        }, 30000);
        
    } catch (error) {
        console.error('❌ Error:', error);
        await bot.close();
    }
}

module.exports = { TwitterBot2FA };

// Run if this file is executed directly
if (require.main === module) {
    test2FALogin().catch(console.error);
}