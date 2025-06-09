// simple-twitter-bot.js - Fixed and simplified version
const { chromium } = require('playwright');

class SimpleTwitterBot {
    constructor() {
        this.browser = null;
        this.page = null;
        this.isLoggedIn = false;
    }

    async init() {
        console.log('🚀 Initializing browser...');
        
        this.browser = await chromium.launch({ 
            headless: false, // Keep false to see what's happening
            slowMo: 500 // Slow down for stability
        });
        
        // Create context with proper user agent
        const context = await this.browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 720 }
        });
        
        this.page = await context.newPage();
        
        console.log('✅ Browser initialized');
    }

    async debugPageInfo() {
        console.log('🔍 DEBUG INFO:');
        console.log('  URL:', this.page.url());
        console.log('  Title:', await this.page.title().catch(() => 'Unknown'));
        
        // Check for common login-related elements
        const elementsToCheck = [
            'input[type="password"]',
            'input[autocomplete="username"]',
            'text=Next',
            'text=Log in',
            '[data-testid="SideNav_AccountSwitcher_Button"]',
            '[data-testid="primaryColumn"]'
        ];
        
        for (const selector of elementsToCheck) {
            const isVisible = await this.page.locator(selector).isVisible().catch(() => false);
            console.log(`  ${selector}: ${isVisible ? '✅ Found' : '❌ Not found'}`);
        }
    }

    async login(username, password) {
        try {
            console.log('🔐 Navigating to Twitter...');
            
            // First, check if we're already logged in
            await this.page.goto('https://twitter.com/home');
            await this.page.waitForTimeout(2000);
            
            // Check if we're already logged in
            const alreadyLoggedIn = await this.page.locator('[data-testid="SideNav_AccountSwitcher_Button"]').isVisible().catch(() => false);
            
            if (alreadyLoggedIn) {
                console.log('✅ Already logged in!');
                this.isLoggedIn = true;
                return true;
            }
            
            console.log('🔐 Going to login page...');
            await this.page.goto('https://twitter.com/i/flow/login');
            await this.page.waitForTimeout(3000);

            console.log('📝 Entering username...');
            
            // Try multiple selectors for username input
            let usernameInput = null;
            const usernameSelectors = [
                'input[autocomplete="username"]',
                'input[name="text"]',
                'input[data-testid="ocfEnterTextTextInput"]',
                'input[placeholder*="email"], input[placeholder*="username"], input[placeholder*="phone"]'
            ];
            
            for (const selector of usernameSelectors) {
                try {
                    usernameInput = await this.page.waitForSelector(selector, { timeout: 3000 });
                    if (usernameInput) {
                        console.log(`✅ Found username input with selector: ${selector}`);
                        break;
                    }
                } catch (e) {
                    console.log(`⚠️ Selector ${selector} not found, trying next...`);
                }
            }
            
            if (!usernameInput) {
                throw new Error('Could not find username input field');
            }
            
            await usernameInput.fill(username);
            await this.page.waitForTimeout(1000);
            
            // Try to click Next button with multiple approaches
            console.log('🔄 Looking for Next button...');
            let nextClicked = false;
            
            const nextSelectors = [
                'text=Next',
                '[data-testid="ocfEnterTextNextButton"]',
                'button:has-text("Next")',
                'div[role="button"]:has-text("Next")'
            ];
            
            for (const selector of nextSelectors) {
                try {
                    await this.page.click(selector, { timeout: 3000 });
                    console.log(`✅ Clicked Next with selector: ${selector}`);
                    nextClicked = true;
                    break;
                } catch (e) {
                    console.log(`⚠️ Next selector ${selector} failed, trying next...`);
                }
            }
            
            if (!nextClicked) {
                // Try pressing Enter as fallback
                console.log('🔄 Trying Enter key as fallback...');
                await usernameInput.press('Enter');
            }
            
            await this.page.waitForTimeout(3000);

            console.log('🔑 Entering password...');
            
            // Try multiple selectors for password input
            let passwordInput = null;
            const passwordSelectors = [
                'input[type="password"]',
                'input[name="password"]',
                'input[autocomplete="current-password"]'
            ];
            
            for (const selector of passwordSelectors) {
                try {
                    passwordInput = await this.page.waitForSelector(selector, { timeout: 5000 });
                    if (passwordInput) {
                        console.log(`✅ Found password input with selector: ${selector}`);
                        break;
                    }
                } catch (e) {
                    console.log(`⚠️ Password selector ${selector} not found, trying next...`);
                }
            }
            
            if (!passwordInput) {
                throw new Error('Could not find password input field');
            }
            
            await passwordInput.fill(password);
            await this.page.waitForTimeout(1000);
            
            // Try to click Log in button
            console.log('🔐 Looking for Log in button...');
            let loginClicked = false;
            
            const loginSelectors = [
                'text=Log in',
                '[data-testid="LoginForm_Login_Button"]',
                'button:has-text("Log in")',
                'div[role="button"]:has-text("Log in")'
            ];
            
            for (const selector of loginSelectors) {
                try {
                    await this.page.click(selector, { timeout: 3000 });
                    console.log(`✅ Clicked Log in with selector: ${selector}`);
                    loginClicked = true;
                    break;
                } catch (e) {
                    console.log(`⚠️ Login selector ${selector} failed, trying next...`);
                }
            }
            
            if (!loginClicked) {
                // Try pressing Enter as fallback
                console.log('🔄 Trying Enter key as fallback...');
                await passwordInput.press('Enter');
            }
            
            console.log('⏳ Waiting for login to complete...');
            await this.page.waitForTimeout(5000);

            // Check if we're logged in
            console.log('✅ Checking login status...');
            
            // Wait for navigation to complete
            try {
                await this.page.waitForURL('**/home', { timeout: 10000 });
            } catch (e) {
                console.log('⚠️ Did not redirect to home, checking login status anyway...');
            }
            
            // Check multiple indicators of successful login
            const loginIndicators = [
                '[data-testid="SideNav_AccountSwitcher_Button"]',
                '[data-testid="primaryColumn"]',
                '[data-testid="AppTabBar_Home_Link"]',
                '[aria-label="Home timeline"]'
            ];
            
            for (const indicator of loginIndicators) {
                try {
                    const isVisible = await this.page.locator(indicator).isVisible();
                    if (isVisible) {
                        console.log(`✅ Login confirmed with indicator: ${indicator}`);
                        this.isLoggedIn = true;
                        return true;
                    }
                } catch (e) {
                    // Continue checking other indicators
                }
            }
            
            // Final check: look at the URL
            const currentUrl = this.page.url();
            if (currentUrl.includes('/home') || currentUrl.includes('/timeline')) {
                console.log('✅ Login confirmed by URL check');
                this.isLoggedIn = true;
                return true;
            }
            
            console.log('❌ Login verification failed');
            return false;

        } catch (error) {
            console.error('❌ Login error:', error.message);
            await this.debugPageInfo();
            return false;
        }
    }

    async getMyTweets(limit = 5) {
        if (!this.isLoggedIn) {
            throw new Error('Not logged in');
        }

        console.log('📝 Navigating to profile...');
        
        // Go to home first, then profile
        await this.page.goto('https://twitter.com/home', { waitUntil: 'networkidle' });
        await this.page.waitForTimeout(3000);
        
        // Click on profile link in sidebar
        try {
            await this.page.click('[data-testid="AppTabBar_Profile_Link"]');
            await this.page.waitForTimeout(3000);
        } catch (error) {
            console.log('⚠️ Could not find profile link, trying alternative...');
            // Alternative: go directly to profile URL
            await this.page.goto('https://twitter.com/i/flow/login', { waitUntil: 'networkidle' });
        }
        
        console.log('🔍 Looking for tweets...');
        
        const tweets = [];
        
        try {
            // Wait for tweets to load
            await this.page.waitForSelector('[data-testid="tweet"]', { timeout: 10000 });
            
            // Get tweet elements
            const tweetElements = await this.page.$$('[data-testid="tweet"]');
            console.log(`Found ${tweetElements.length} tweet elements`);
            
            for (let i = 0; i < Math.min(limit, tweetElements.length); i++) {
                try {
                    const tweet = tweetElements[i];
                    
                    // Extract tweet text
                    const textElement = await tweet.$('[data-testid="tweetText"]');
                    const text = textElement ? await textElement.textContent() : 'No text found';
                    
                    // Extract time
                    const timeElement = await tweet.$('time');
                    const time = timeElement ? await timeElement.getAttribute('datetime') : 'No time found';
                    
                    // Try to get tweet link
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

    async searchForMentions(username) {
        console.log(`🔍 Searching for mentions of @${username}...`);
        
        const searchQuery = `@${username}`;
        const searchUrl = `https://twitter.com/search?q=${encodeURIComponent(searchQuery)}&src=typed_query&f=live`;
        
        await this.page.goto(searchUrl, { waitUntil: 'networkidle' });
        await this.page.waitForTimeout(3000);
        
        const mentions = [];
        
        try {
            await this.page.waitForSelector('[data-testid="tweet"]', { timeout: 10000 });
            
            const tweetElements = await this.page.$$('[data-testid="tweet"]');
            console.log(`Found ${tweetElements.length} potential mentions`);
            
            for (let i = 0; i < Math.min(5, tweetElements.length); i++) {
                try {
                    const tweet = tweetElements[i];
                    
                    const textElement = await tweet.$('[data-testid="tweetText"]');
                    const text = textElement ? await textElement.textContent() : '';
                    
                    const linkElement = await tweet.$('a[href*="/status/"]');
                    const link = linkElement ? await linkElement.getAttribute('href') : '';
                    
                    if (text && link) {
                        mentions.push({
                            text: text,
                            url: `https://twitter.com${link}`
                        });
                        
                        console.log(`💬 Mention ${i + 1}: ${text.substring(0, 50)}...`);
                    }
                    
                } catch (error) {
                    console.log(`⚠️ Error processing mention ${i + 1}:`, error.message);
                }
            }
            
        } catch (error) {
            console.log('❌ Could not find mentions:', error.message);
        }
        
        return mentions;
    }

    async postTweet(text) {
        console.log('📤 Posting tweet...');
        
        try {
            // Go to home page
            await this.page.goto('https://twitter.com/home', { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(2000);
            
            // Find and click the tweet compose box
            const composeBox = await this.page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 10000 });
            await composeBox.click();
            await this.page.waitForTimeout(1000);
            
            // Type the tweet
            await composeBox.fill(text);
            await this.page.waitForTimeout(1000);
            
            // Click the Tweet button
            await this.page.click('[data-testid="tweetButtonInline"]');
            await this.page.waitForTimeout(3000);
            
            console.log('✅ Tweet posted successfully!');
            return true;
            
        } catch (error) {
            console.log('❌ Error posting tweet:', error.message);
            return false;
        }
    }

    async replyToTweet(tweetUrl, replyText) {
        console.log('💬 Replying to tweet...');
        
        try {
            // Navigate to the tweet
            await this.page.goto(tweetUrl, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(3000);
            
            // Click the reply button
            await this.page.click('[data-testid="reply"]');
            await this.page.waitForTimeout(2000);
            
            // Find the reply compose box
            const replyBox = await this.page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 10000 });
            await replyBox.fill(replyText);
            await this.page.waitForTimeout(1000);
            
            // Click the Reply button
            await this.page.click('[data-testid="tweetButtonInline"]');
            await this.page.waitForTimeout(3000);
            
            console.log('✅ Reply posted successfully!');
            return true;
            
        } catch (error) {
            console.log('❌ Error posting reply:', error.message);
            return false;
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            console.log('🔒 Browser closed');
        }
    }
}

// Simple AI Response Generator
class SimpleAI {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    async generateReply(originalText, replyToText) {
        if (!this.apiKey || this.apiKey === 'your-deepseek-api-key') {
            // Return a simple response if no AI key
            const responses = [
                "Thanks for your comment! 😊",
                "Interesting point! 🤔",
                "I appreciate your feedback! 👍",
                "Great to hear from you! ✨",
                "Thanks for engaging! 🙌"
            ];
            return responses[Math.floor(Math.random() * responses.length)];
        }

        try {
            const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful Twitter bot. Respond to comments in a friendly, engaging way. Keep responses under 280 characters.'
                        },
                        {
                            role: 'user',
                            content: `Original tweet: "${originalText}"\nComment to reply to: "${replyToText}"\n\nGenerate a helpful reply:`
                        }
                    ],
                    max_tokens: 100,
                    temperature: 0.7
                })
            });

            const data = await response.json();
            return data.choices[0].message.content.trim();

        } catch (error) {
            console.log('⚠️ AI generation failed, using simple response');
            return "Thanks for your comment! 😊";
        }
    }
}

// Main function for testing
async function main() {
    // ⚠️ REPLACE THESE WITH YOUR ACTUAL CREDENTIALS
    const DEEPSEEK_API_KEY = 'sk-084c004b45fd4ac085d8f60df02af42d';
    const TWITTER_USERNAME = 'jaqbek_eth';
    const TWITTER_PASSWORD = 'Jakubek666'; 
       
    const bot = new SimpleTwitterBot();
    const ai = new SimpleAI(DEEPSEEK_API_KEY);
    
    try {
        console.log('🤖 Starting Twitter Bot...');
        
        // Initialize the bot
        await bot.init();
        
        // Login
        const loginSuccess = await bot.login(TWITTER_USERNAME, TWITTER_PASSWORD);
        
        if (!loginSuccess) {
            console.log('❌ Login failed. Please check your credentials.');
            await bot.close();
            return;
        }
        
        console.log('\n📋 Choose what to do:');
        console.log('1. Get my recent tweets');
        console.log('2. Search for mentions');
        console.log('3. Post a test tweet');
        console.log('4. Start auto-reply mode');
        
        // For now, let's just get recent tweets as a test
        console.log('\n🔄 Getting your recent tweets...');
        const tweets = await bot.getMyTweets(3);
        
        if (tweets.length > 0) {
            console.log('\n📝 Your recent tweets:');
            tweets.forEach((tweet, i) => {
                console.log(`${i + 1}. ${tweet.text}`);
                console.log(`   Time: ${tweet.time}`);
                console.log(`   URL: ${tweet.url}\n`);
            });
        }
        
        // Search for mentions
        console.log('\n🔍 Searching for mentions...');
        const mentions = await bot.searchForMentions(TWITTER_USERNAME.replace('@', ''));
        
        if (mentions.length > 0) {
            console.log('\n💬 Recent mentions:');
            mentions.forEach((mention, i) => {
                console.log(`${i + 1}. ${mention.text}`);
                console.log(`   URL: ${mention.url}\n`);
            });
            
            // Demo: Generate a reply for the first mention
            if (mentions[0]) {
                console.log('🤖 Generating AI reply for first mention...');
                const reply = await ai.generateReply('', mentions[0].text);
                console.log(`💡 Generated reply: "${reply}"`);
                
                // Uncomment the line below to actually post the reply
                // await bot.replyToTweet(mentions[0].url, reply);
                console.log('🚫 Reply posting disabled for safety - uncomment to enable');
            }
        }
        
        console.log('\n✅ Bot test completed! Press Ctrl+C to exit or wait for auto-close...');
        
        // Keep browser open for 30 seconds so you can see the results
        setTimeout(async () => {
            await bot.close();
        }, 30000);
        
    } catch (error) {
        console.error('❌ Bot error:', error);
        await bot.close();
    }
}

// Export for use in other files
module.exports = { SimpleTwitterBot, SimpleAI };

// Run if this file is executed directly
if (require.main === module) {
    console.log('🚀 Starting Twitter Bot...');
    console.log('⚠️  Make sure to update your credentials in the main() function!');
    console.log('📝 Edit TWITTER_USERNAME and TWITTER_PASSWORD\n');
    
    main().catch(console.error);
}