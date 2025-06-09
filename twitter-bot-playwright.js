// twitter-bot-playwright.js
// Browser automation approach - no API rate limits!

const { chromium } = require('playwright');
const fs = require('fs').promises;

class TwitterBot {
    constructor() {
        this.browser = null;
        this.page = null;
        this.isLoggedIn = false;
    }

    async init() {
        this.browser = await chromium.launch({ 
            headless: false, // Set to true for production
            slowMo: 1000 // Slow down for stability
        });
        this.page = await this.browser.newPage();
        
        // Set user agent to look more human
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        // Block images and videos to speed up loading
        await this.page.route('**/*.{png,jpg,jpeg,gif,mp4,webm}', route => route.abort());
    }

    async login(username, password) {
        try {
            console.log('🔐 Logging into Twitter...');
            
            await this.page.goto('https://twitter.com/login');
            await this.page.waitForTimeout(2000);

            // Enter username
            await this.page.fill('input[name="text"]', username);
            await this.page.click('text=Next');
            await this.page.waitForTimeout(2000);

            // Enter password
            await this.page.fill('input[name="password"]', password);
            await this.page.click('text=Log in');
            await this.page.waitForTimeout(3000);

            // Check if logged in successfully
            const isLoggedIn = await this.page.locator('[data-testid="SideNav_AccountSwitcher_Button"]').isVisible();
            
            if (isLoggedIn) {
                console.log('✅ Successfully logged in!');
                this.isLoggedIn = true;
                
                // Save session cookies for future use
                const cookies = await this.page.context().cookies();
                await fs.writeFile('twitter-session.json', JSON.stringify(cookies, null, 2));
            } else {
                throw new Error('Login failed');
            }

        } catch (error) {
            console.error('❌ Login error:', error);
            throw error;
        }
    }

    async loadSession() {
        try {
            const cookies = JSON.parse(await fs.readFile('twitter-session.json', 'utf8'));
            await this.page.context().addCookies(cookies);
            
            await this.page.goto('https://twitter.com/home');
            await this.page.waitForTimeout(3000);
            
            const isLoggedIn = await this.page.locator('[data-testid="SideNav_AccountSwitcher_Button"]').isVisible();
            if (isLoggedIn) {
                console.log('✅ Session restored successfully!');
                this.isLoggedIn = true;
                return true;
            }
        } catch (error) {
            console.log('⚠️ No valid session found, need to login');
            return false;
        }
        return false;
    }

    async getMyTweets(limit = 10) {
        if (!this.isLoggedIn) throw new Error('Not logged in');

        console.log('📝 Fetching your tweets...');
        
        // Go to your profile
        await this.page.goto('https://twitter.com/home');
        await this.page.waitForTimeout(2000);
        
        const tweets = [];
        const tweetElements = await this.page.locator('[data-testid="tweet"]').all();
        
        for (let i = 0; i < Math.min(limit, tweetElements.length); i++) {
            const tweet = tweetElements[i];
            
            try {
                const text = await tweet.locator('[data-testid="tweetText"]').textContent();
                const timeElement = await tweet.locator('time').getAttribute('datetime');
                const tweetLink = await tweet.locator('[data-testid="tweetText"]').locator('xpath=ancestor::article').locator('a[href*="/status/"]').first().getAttribute('href');
                
                const tweetId = tweetLink ? tweetLink.split('/status/')[1].split('?')[0] : null;
                
                const metrics = await this.getTweetMetrics(tweet);
                
                tweets.push({
                    id: tweetId,
                    text: text || '',
                    created_at: timeElement,
                    url: `https://twitter.com${tweetLink}`,
                    metrics: metrics
                });
                
            } catch (error) {
                console.log('⚠️ Error parsing tweet:', error.message);
            }
        }
        
        console.log(`✅ Found ${tweets.length} tweets`);
        return tweets;
    }

    async getTweetMetrics(tweetElement) {
        const metrics = { replies: 0, retweets: 0, likes: 0 };
        
        try {
            // Get reply count
            const replyButton = tweetElement.locator('[data-testid="reply"]');
            const replyText = await replyButton.textContent();
            metrics.replies = this.parseMetricNumber(replyText);

            // Get retweet count
            const retweetButton = tweetElement.locator('[data-testid="retweet"]');
            const retweetText = await retweetButton.textContent();
            metrics.retweets = this.parseMetricNumber(retweetText);

            // Get like count
            const likeButton = tweetElement.locator('[data-testid="like"]');
            const likeText = await likeButton.textContent();
            metrics.likes = this.parseMetricNumber(likeText);

        } catch (error) {
            console.log('⚠️ Error getting metrics:', error.message);
        }
        
        return metrics;
    }

    parseMetricNumber(text) {
        if (!text) return 0;
        const match = text.match(/[\d,]+/);
        if (!match) return 0;
        return parseInt(match[0].replace(/,/g, ''));
    }

    async getTweetReplies(tweetUrl) {
        console.log('💬 Getting tweet replies...');
        
        await this.page.goto(tweetUrl);
        await this.page.waitForTimeout(3000);
        
        // Scroll to load more replies
        for (let i = 0; i < 3; i++) {
            await this.page.keyboard.press('PageDown');
            await this.page.waitForTimeout(1000);
        }
        
        const replies = [];
        const replyElements = await this.page.locator('[data-testid="tweet"]').all();
        
        // Skip the first tweet (original tweet)
        for (let i = 1; i < Math.min(10, replyElements.length); i++) {
            const reply = replyElements[i];
            
            try {
                const text = await reply.locator('[data-testid="tweetText"]').textContent();
                const author = await reply.locator('[data-testid="User-Name"]').first().textContent();
                const timeElement = await reply.locator('time').getAttribute('datetime');
                
                replies.push({
                    text: text || '',
                    author: author || '',
                    created_at: timeElement,
                    element: i // Store index for replying
                });
                
            } catch (error) {
                console.log('⚠️ Error parsing reply:', error.message);
            }
        }
        
        console.log(`✅ Found ${replies.length} replies`);
        return replies;
    }

    async replyToTweet(tweetUrl, replyText, replyToSpecificReply = null) {
        console.log('📤 Posting reply...');
        
        await this.page.goto(tweetUrl);
        await this.page.waitForTimeout(2000);
        
        if (replyToSpecificReply) {
            // Reply to a specific reply
            const replyElements = await this.page.locator('[data-testid="tweet"]').all();
            if (replyElements.length > replyToSpecificReply.element) {
                const targetReply = replyElements[replyToSpecificReply.element];
                await targetReply.locator('[data-testid="reply"]').click();
            }
        } else {
            // Reply to the main tweet
            await this.page.locator('[data-testid="reply"]').first().click();
        }
        
        await this.page.waitForTimeout(1000);
        
        // Type the reply
        const replyBox = this.page.locator('[data-testid="tweetTextarea_0"]');
        await replyBox.fill(replyText);
        await this.page.waitForTimeout(1000);
        
        // Post the reply
        await this.page.locator('[data-testid="tweetButtonInline"]').click();
        await this.page.waitForTimeout(2000);
        
        console.log('✅ Reply posted successfully!');
    }

    async searchMentions(username) {
        console.log('🔍 Searching for mentions...');
        
        const searchQuery = `@${username} -from:${username}`;
        await this.page.goto(`https://twitter.com/search?q=${encodeURIComponent(searchQuery)}&src=typed_query&f=live`);
        await this.page.waitForTimeout(3000);
        
        const mentions = [];
        const tweetElements = await this.page.locator('[data-testid="tweet"]').all();
        
        for (let i = 0; i < Math.min(5, tweetElements.length); i++) {
            const tweet = tweetElements[i];
            
            try {
                const text = await tweet.locator('[data-testid="tweetText"]').textContent();
                const author = await tweet.locator('[data-testid="User-Name"]').first().textContent();
                const tweetLink = await tweet.locator('a[href*="/status/"]').first().getAttribute('href');
                
                mentions.push({
                    text: text || '',
                    author: author || '',
                    url: `https://twitter.com${tweetLink}`,
                    tweetLink: tweetLink
                });
                
            } catch (error) {
                console.log('⚠️ Error parsing mention:', error.message);
            }
        }
        
        console.log(`✅ Found ${mentions.length} mentions`);
        return mentions;
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

// AI Response Generator (using Deepseek)
class AIResponseGenerator {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.apiUrl = 'https://api.deepseek.com/v1/chat/completions';
    }

    async generateResponse(originalTweet, replyToRespond, context = '') {
        const prompt = `
You are a helpful Twitter bot. Generate a thoughtful reply to this comment.

Original Tweet: "${originalTweet}"
Comment to Reply: "${replyToRespond}"
Context: ${context}

Guidelines:
- Keep under 280 characters
- Be helpful and engaging
- Maintain a positive tone
- Don't be overly promotional
- Ask questions to encourage discussion when appropriate

Reply:`;

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 100,
                    temperature: 0.7
                })
            });

            const data = await response.json();
            return data.choices[0].message.content.trim();

        } catch (error) {
            console.error('AI generation error:', error);
            return null;
        }
    }
}

// Main Bot Controller
class TwitterBotController {
    constructor(deepseekApiKey) {
        this.bot = new TwitterBot();
        this.ai = new AIResponseGenerator(deepseekApiKey);
        this.processedReplies = new Set(); // Track processed replies
    }

    async start(username, password) {
        await this.bot.init();
        
        // Try to load existing session first
        const sessionLoaded = await this.bot.loadSession();
        
        if (!sessionLoaded) {
            await this.bot.login(username, password);
        }
        
        console.log('🤖 Bot is ready!');
    }

    async runAutoReplyLoop(intervalMinutes = 5) {
        console.log(`🔄 Starting auto-reply loop (checking every ${intervalMinutes} minutes)`);
        
        while (true) {
            try {
                await this.checkAndReplyToMentions();
                await this.checkAndReplyToTweetReplies();
                
                console.log(`⏰ Waiting ${intervalMinutes} minutes before next check...`);
                await new Promise(resolve => setTimeout(resolve, intervalMinutes * 60 * 1000));
                
            } catch (error) {
                console.error('❌ Error in auto-reply loop:', error);
                await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute before retry
            }
        }
    }

    async checkAndReplyToMentions() {
        try {
            const mentions = await this.bot.searchMentions('YOUR_USERNAME'); // Replace with your username
            
            for (const mention of mentions) {
                const mentionId = mention.url;
                
                if (this.processedReplies.has(mentionId)) {
                    continue; // Already processed
                }
                
                console.log(`💬 Processing mention: ${mention.text.substring(0, 50)}...`);
                
                const aiResponse = await this.ai.generateResponse(
                    '',
                    mention.text,
                    `Reply to mention from ${mention.author}`
                );
                
                if (aiResponse) {
                    await this.bot.replyToTweet(mention.url, aiResponse);
                    this.processedReplies.add(mentionId);
                    console.log('✅ Replied to mention');
                    
                    // Wait between replies to avoid looking like a bot
                    await new Promise(resolve => setTimeout(resolve, 10000));
                }
            }
            
        } catch (error) {
            console.error('Error checking mentions:', error);
        }
    }

    async checkAndReplyToTweetReplies() {
        try {
            const myTweets = await this.bot.getMyTweets(5); // Check last 5 tweets
            
            for (const tweet of myTweets) {
                if (tweet.metrics.replies === 0) continue; // No replies to check
                
                const replies = await this.bot.getTweetReplies(tweet.url);
                
                for (const reply of replies) {
                    const replyId = `${tweet.id}_${reply.element}`;
                    
                    if (this.processedReplies.has(replyId)) {
                        continue; // Already processed
                    }
                    
                    console.log(`💬 Processing reply: ${reply.text.substring(0, 50)}...`);
                    
                    const aiResponse = await this.ai.generateResponse(
                        tweet.text,
                        reply.text,
                        `Reply from ${reply.author} on your tweet`
                    );
                    
                    if (aiResponse) {
                        await this.bot.replyToTweet(tweet.url, aiResponse, reply);
                        this.processedReplies.add(replyId);
                        console.log('✅ Replied to comment');
                        
                        // Wait between replies
                        await new Promise(resolve => setTimeout(resolve, 15000));
                    }
                }
            }
            
        } catch (error) {
            console.error('Error checking tweet replies:', error);
        }
    }

    async stop() {
        await this.bot.close();
    }
}

// Usage Example
async function main() {
    const DEEPSEEK_API_KEY = 'sk-084c004b45fd4ac085d8f60df02af42d';
    const TWITTER_USERNAME = 'jaqbek_eth';
    const TWITTER_PASSWORD = 'Jakubek666';
    
    const botController = new TwitterBotController(DEEPSEEK_API_KEY);
    
    try {
        await botController.start(TWITTER_USERNAME, TWITTER_PASSWORD);
        
        // Run the auto-reply loop (checks every 5 minutes)
        await botController.runAutoReplyLoop(5);
        
    } catch (error) {
        console.error('Bot error:', error);
    } finally {
        await botController.stop();
    }
}

// Uncomment to run
 main();

module.exports = { TwitterBot, AIResponseGenerator, TwitterBotController };