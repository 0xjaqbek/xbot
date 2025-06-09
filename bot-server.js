// bot-server.js - Backend server for the web UI
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const { TwitterBot2FA } = require('./twitter-bot-2fa');

class BotServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        
        this.bot = null;
        this.botState = {
            isRunning: false,
            startTime: null,
            stats: {
                mentions: 0,
                replies: 0,
                lastCheck: null,
                uptime: 0
            },
            settings: {
                interval: 5,
                autoPost: false
            },
            credentials: {
                username: '',
                password: '',
                apiKey: ''
            }
        };
        
        this.monitoringInterval = null;
        this.processedTweets = new Set();
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketEvents();
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, 'public')));
        
        // CORS middleware
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            next();
        });
    }

    setupRoutes() {
        // Serve the dashboard
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'dashboard.html'));
        });

        // API Routes
        this.app.post('/api/start-bot', async (req, res) => {
            try {
                const result = await this.startBot();
                res.json({ success: true, message: result });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.post('/api/stop-bot', async (req, res) => {
            try {
                await this.stopBot();
                res.json({ success: true, message: 'Bot stopped successfully' });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.post('/api/save-credentials', (req, res) => {
            try {
                const { username, password, apiKey } = req.body;
                
                if (!username || !password) {
                    return res.status(400).json({ success: false, error: 'Username and password required' });
                }
                
                this.botState.credentials = { username, password, apiKey };
                this.saveConfig();
                
                this.emitToClients('credentialsUpdated', this.botState.credentials);
                res.json({ success: true, message: 'Credentials saved successfully' });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.post('/api/save-settings', (req, res) => {
            try {
                const { interval, autoPost } = req.body;
                
                this.botState.settings = { interval, autoPost };
                this.saveConfig();
                
                this.emitToClients('settingsUpdated', this.botState.settings);
                res.json({ success: true, message: 'Settings saved successfully' });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.post('/api/generate-reply', async (req, res) => {
            try {
                const { originalTweet, commentText } = req.body;
                
                if (!commentText) {
                    return res.status(400).json({ success: false, error: 'Comment text required' });
                }
                
                const reply = await this.generateAIReply(originalTweet, commentText);
                res.json({ success: true, reply });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.get('/api/status', (req, res) => {
            res.json({
                success: true,
                state: this.botState
            });
        });
    }

    setupSocketEvents() {
        this.io.on('connection', (socket) => {
            console.log('🌐 Client connected to dashboard');
            
            // Send current state to new client
            socket.emit('botStateUpdate', this.botState);
            
            socket.on('disconnect', () => {
                console.log('🌐 Client disconnected');
            });
        });
    }

    async startBot() {
        if (this.botState.isRunning) {
            throw new Error('Bot is already running');
        }

        if (!this.botState.credentials.username || !this.botState.credentials.password) {
            throw new Error('Please configure Twitter credentials first');
        }

        try {
            this.emitActivity('info', '🚀 Initializing bot...');
            
            // Create new bot instance
            this.bot = new TwitterBot2FA();
            this.bot.deepseekApiKey = this.botState.credentials.apiKey;
            
            await this.bot.init();
            
            this.emitActivity('info', '🔐 Logging into Twitter...');
            const loginSuccess = await this.bot.loginWith2FA(
                this.botState.credentials.username,
                this.botState.credentials.password
            );

            if (!loginSuccess) {
                throw new Error('Twitter login failed');
            }

            this.botState.isRunning = true;
            this.botState.startTime = new Date();
            
            this.emitToClients('botStateUpdate', this.botState);
            this.emitActivity('info', '✅ Bot started successfully');
            
            // Start monitoring loop
            this.startMonitoringLoop();
            
            return 'Bot started successfully';

        } catch (error) {
            this.emitActivity('error', `❌ Bot start failed: ${error.message}`);
            throw error;
        }
    }

    async stopBot() {
        if (!this.botState.isRunning) {
            return;
        }

        this.botState.isRunning = false;
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }

        if (this.bot) {
            await this.bot.close();
            this.bot = null;
        }

        this.emitToClients('botStateUpdate', this.botState);
        this.emitActivity('info', '⏹️ Bot stopped');
    }

    async startMonitoringLoop() {
        if (!this.botState.isRunning) return;

        const checkActivity = async () => {
            if (!this.botState.isRunning) return;

            try {
                this.emitActivity('info', '🔍 Checking for new activity...');
                
                // Check for mentions
                const mentions = await this.checkMentions();
                
                // Check for replies to recent tweets
                const replies = await this.checkReplies();
                
                this.botState.stats.lastCheck = new Date();
                this.emitToClients('statsUpdate', this.botState.stats);
                
            } catch (error) {
                console.error('❌ Error in monitoring loop:', error);
                this.emitActivity('error', `❌ Monitoring error: ${error.message}`);
            }
        };

        // Run initial check
        await checkActivity();

        // Set up interval
        this.monitoringInterval = setInterval(checkActivity, this.botState.settings.interval * 60 * 1000);
    }

    async checkMentions() {
        if (!this.bot || !this.botState.isRunning) return [];

        try {
            const username = this.botState.credentials.username;
            const mentions = await this.searchForMentions(username);
            
            for (const mention of mentions) {
                if (this.processedTweets.has(mention.url)) continue;
                
                this.botState.stats.mentions++;
                this.emitActivity('mention', `💬 New mention from ${mention.author}`, mention.text);
                
                // Generate AI reply
                const aiReply = await this.generateAIReply('', mention.text, `Reply to mention from ${mention.author}`);
                
                if (this.botState.settings.autoPost) {
                    // Auto-post the reply
                    const success = await this.postReply(mention.url, aiReply);
                    if (success) {
                        this.botState.stats.replies++;
                        this.emitActivity('reply', `✅ Posted reply: "${aiReply}"`);
                    }
                } else {
                    // Emit pending reply for manual approval
                    this.emitToClients('pendingReply', {
                        originalText: mention.text,
                        reply: aiReply,
                        url: mention.url,
                        author: mention.author
                    });
                }
                
                this.processedTweets.add(mention.url);
                
                // Human-like delay
                await this.humanDelay();
            }
            
            return mentions;
        } catch (error) {
            console.error('Error checking mentions:', error);
            return [];
        }
    }

    async checkReplies() {
        if (!this.bot || !this.botState.isRunning) return [];

        try {
            const myTweets = await this.bot.getMyTweets(3);
            
            for (const tweet of myTweets) {
                const replies = await this.bot.getRepliesForTweet ? await this.bot.getRepliesForTweet(tweet.url) : [];
                
                for (const reply of replies) {
                    if (this.processedTweets.has(reply.url)) continue;
                    
                    this.emitActivity('mention', `💬 New reply on your tweet`, reply.text);
                    
                    const aiReply = await this.generateAIReply(tweet.text, reply.text, 'Reply to comment on your tweet');
                    
                    if (this.botState.settings.autoPost) {
                        const success = await this.postReply(reply.url, aiReply);
                        if (success) {
                            this.botState.stats.replies++;
                            this.emitActivity('reply', `✅ Posted reply: "${aiReply}"`);
                        }
                    } else {
                        this.emitToClients('pendingReply', {
                            originalText: reply.text,
                            reply: aiReply,
                            url: reply.url,
                            author: reply.author
                        });
                    }
                    
                    this.processedTweets.add(reply.url);
                    await this.humanDelay();
                }
            }
            
        } catch (error) {
            console.error('Error checking replies:', error);
            return [];
        }
    }

    async searchForMentions(username) {
        // Simplified mention search - in real implementation, use the bot's searchForMentions method
        try {
            if (this.bot && this.bot.searchForMentions) {
                return await this.bot.searchForMentions(username);
            }
            return [];
        } catch (error) {
            console.error('Error searching mentions:', error);
            return [];
        }
    }

    async generateAIReply(originalTweet, replyText, context = '') {
        if (!this.botState.credentials.apiKey) {
            // Fallback responses
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
            const prompt = `You are a helpful Twitter bot. Generate a thoughtful reply.

Original Tweet: "${originalTweet}"
Comment to Reply: "${replyText}"
Context: ${context}

Guidelines:
- Keep under 280 characters
- Be helpful and engaging
- Maintain a positive tone
- Ask questions to encourage discussion when appropriate

Reply:`;

            // For demo purposes, return a simulated response
            // In real implementation, call Deepseek API here
            const responses = [
                "Thanks for your comment! What's your experience with this approach? 🤔",
                "That's a great point! Have you tried implementing something similar?",
                "Absolutely! The key is starting small and iterating. What's your take?",
                "Interesting perspective! I'd love to hear more about your approach.",
                "Great question! The automation potential here is huge. What are you working on?"
            ];
            
            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
            
            return responses[Math.floor(Math.random() * responses.length)];

        } catch (error) {
            console.error('AI generation error:', error);
            return "Thanks for your comment! 😊";
        }
    }

    async postReply(tweetUrl, replyText) {
        if (!this.bot) return false;

        try {
            if (this.bot.replyToTweet) {
                return await this.bot.replyToTweet(tweetUrl, replyText);
            }
            return false;
        } catch (error) {
            console.error('Error posting reply:', error);
            this.emitActivity('error', `❌ Failed to post reply: ${error.message}`);
            return false;
        }
    }

    async humanDelay() {
        const delay = 10000 + Math.random() * 20000; // 10-30 seconds
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    emitToClients(event, data) {
        this.io.emit(event, data);
    }

    emitActivity(type, title, detail = '') {
        this.emitToClients('activity', {
            type,
            title,
            detail,
            timestamp: new Date()
        });
    }

    saveConfig() {
        const config = {
            settings: this.botState.settings,
            credentials: this.botState.credentials
        };
        
        try {
            fs.writeFileSync('bot-config.json', JSON.stringify(config, null, 2));
        } catch (error) {
            console.error('Error saving config:', error);
        }
    }

    loadConfig() {
        try {
            if (fs.existsSync('bot-config.json')) {
                const config = JSON.parse(fs.readFileSync('bot-config.json', 'utf8'));
                this.botState.settings = { ...this.botState.settings, ...config.settings };
                this.botState.credentials = { ...this.botState.credentials, ...config.credentials };
            }
        } catch (error) {
            console.error('Error loading config:', error);
        }
    }

    start(port = 3000) {
        this.loadConfig();
        
        this.server.listen(port, () => {
            console.log('🚀 Twitter Bot Dashboard started!');
            console.log(`📱 Open your browser and go to: http://localhost:${port}`);
            console.log('');
            console.log('Features:');
            console.log('  ✅ Web-based dashboard');
            console.log('  ✅ Real-time activity monitoring');
            console.log('  ✅ Bot start/stop controls');
            console.log('  ✅ Settings management');
            console.log('  ✅ Live stats and metrics');
            console.log('');
        });
    }
}

// Export for use as module
module.exports = { BotServer };

// Run if this file is executed directly
if (require.main === module) {
    const server = new BotServer();
    server.start(3000);
}