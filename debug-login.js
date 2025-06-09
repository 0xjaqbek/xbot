// debug-login.js - Simple debug version to test login only
const { chromium } = require('playwright');

async function debugLogin() {
    // ⚠️ REPLACE WITH YOUR CREDENTIALS
    const USERNAME = 'jaqbek_eth';
    const PASSWORD = 'Jakubek666';

    const DEEPSEEK_API_KEY = 'sk-084c004b45fd4ac085d8f60df02af42d';
    const TWITTER_USERNAME = 'jaqbek_eth';
    const TWITTER_PASSWORD = 'Jakubek666'; 
    
    console.log('🔧 DEBUG: Starting login test...');
    
    const browser = await chromium.launch({ 
        headless: false, // Keep browser visible
        slowMo: 1000 // Slow down to see what's happening
    });
    
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    try {
        console.log('🔧 DEBUG: Navigating to Twitter...');
        await page.goto('https://twitter.com/login');
        await page.waitForTimeout(3000);
        
        console.log('🔧 DEBUG: Current URL:', page.url());
        
        // Take a screenshot to see what we're dealing with
        await page.screenshot({ path: 'debug-step1.png' });
        console.log('📸 Screenshot saved as debug-step1.png');
        
        // Log all visible input fields
        const inputs = await page.$$('input');
        console.log(`🔧 DEBUG: Found ${inputs.length} input fields`);
        
        for (let i = 0; i < inputs.length; i++) {
            const input = inputs[i];
            const type = await input.getAttribute('type') || 'text';
            const name = await input.getAttribute('name') || 'no-name';
            const placeholder = await input.getAttribute('placeholder') || 'no-placeholder';
            const autocomplete = await input.getAttribute('autocomplete') || 'no-autocomplete';
            
            console.log(`  Input ${i}: type="${type}" name="${name}" placeholder="${placeholder}" autocomplete="${autocomplete}"`);
        }
        
        // Try to find username input
        console.log('🔧 DEBUG: Looking for username input...');
        let usernameInput = null;
        
        const selectors = [
            'input[autocomplete="username"]',
            'input[name="text"]',
            'input[placeholder*="phone"]',
            'input[placeholder*="email"]',
            'input[placeholder*="username"]'
        ];
        
        for (const selector of selectors) {
            try {
                const found = await page.$(selector);
                if (found) {
                    console.log(`✅ Found username input with: ${selector}`);
                    usernameInput = found;
                    break;
                }
            } catch (e) {
                console.log(`❌ Selector failed: ${selector}`);
            }
        }
        
        if (!usernameInput) {
            console.log('❌ Could not find username input');
            console.log('🔧 DEBUG: Waiting 10 seconds for manual inspection...');
            await page.waitForTimeout(10000);
            await browser.close();
            return;
        }
        
        console.log('📝 Filling username...');
        await usernameInput.fill(USERNAME);
        await page.waitForTimeout(1000);
        
        // Take another screenshot
        await page.screenshot({ path: 'debug-step2.png' });
        console.log('📸 Screenshot saved as debug-step2.png');
        
        // Look for Next button
        console.log('🔧 DEBUG: Looking for Next button...');
        const buttons = await page.$$('button, [role="button"], div[role="button"]');
        console.log(`🔧 DEBUG: Found ${buttons.length} clickable elements`);
        
        for (let i = 0; i < Math.min(buttons.length, 10); i++) {
            const button = buttons[i];
            const text = await button.textContent();
            const ariaLabel = await button.getAttribute('aria-label') || 'no-aria-label';
            
            console.log(`  Button ${i}: text="${text?.trim()}" aria-label="${ariaLabel}"`);
        }
        
        // Try to click Next
        let nextClicked = false;
        const nextSelectors = [
            'text=Next',
            'button:has-text("Next")',
            '[role="button"]:has-text("Next")',
            'div:has-text("Next")'
        ];
        
        for (const selector of nextSelectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    console.log(`✅ Found Next button with: ${selector}`);
                    await element.click();
                    nextClicked = true;
                    break;
                }
            } catch (e) {
                console.log(`❌ Next button selector failed: ${selector}`);
            }
        }
        
        if (!nextClicked) {
            console.log('🔄 Trying Enter key instead...');
            await usernameInput.press('Enter');
        }
        
        await page.waitForTimeout(3000);
        console.log('🔧 DEBUG: URL after username:', page.url());
        
        // Check if we're already at home (sometimes Twitter skips steps)
        if (page.url().includes('/home')) {
            console.log('🎉 SUCCESS: Went directly to home page!');
            console.log('✅ Login appears to be successful');
            
            await page.waitForTimeout(5000);
            await browser.close();
            return;
        }
        
        // Take screenshot of password step
        await page.screenshot({ path: 'debug-step3.png' });
        console.log('📸 Screenshot saved as debug-step3.png');
        
        // Look for password input
        console.log('🔧 DEBUG: Looking for password input...');
        const passwordInput = await page.$('input[type="password"]');
        
        if (!passwordInput) {
            console.log('❌ Could not find password input');
            console.log('🔧 This might mean additional verification is required');
            console.log('⏳ Waiting 30 seconds for you to complete verification manually...');
            
            await page.waitForTimeout(30000);
            
            // Check if we're now logged in
            if (page.url().includes('/home')) {
                console.log('🎉 SUCCESS: Manual verification completed!');
            } else {
                console.log('❌ Still not logged in after 30 seconds');
            }
            
            await browser.close();
            return;
        }
        
        console.log('📝 Filling password...');
        await passwordInput.fill(PASSWORD);
        await page.waitForTimeout(1000);
        
        // Try to click Log in
        console.log('🔧 DEBUG: Looking for Login button...');
        let loginClicked = false;
        const loginSelectors = [
            'text=Log in',
            'button:has-text("Log in")',
            '[role="button"]:has-text("Log in")'
        ];
        
        for (const selector of loginSelectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    console.log(`✅ Found Login button with: ${selector}`);
                    await element.click();
                    loginClicked = true;
                    break;
                }
            } catch (e) {
                console.log(`❌ Login button selector failed: ${selector}`);
            }
        }
        
        if (!loginClicked) {
            console.log('🔄 Trying Enter key instead...');
            await passwordInput.press('Enter');
        }
        
        await page.waitForTimeout(5000);
        console.log('🔧 DEBUG: Final URL:', page.url());
        
        if (page.url().includes('/home')) {
            console.log('🎉 SUCCESS: Login completed successfully!');
        } else {
            console.log('❌ Login may have failed or requires additional steps');
            console.log('⏳ Browser will stay open for 30 seconds for manual inspection...');
            await page.waitForTimeout(30000);
        }
        
    } catch (error) {
        console.error('❌ Debug error:', error);
    } finally {
        await browser.close();
    }
}

console.log('🔧 Twitter Login Debug Tool');
console.log('📝 Make sure to update USERNAME and PASSWORD in the code');
console.log('📸 This will save screenshots to help debug issues');
console.log('');

debugLogin().catch(console.error);