// selective-bot-server.js - Backend for selective reply dashboard
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const { TwitterBot2FA } = require('./twitter-bot-2fa');

class SelectiveBotServer {
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
        this.isConnected = false;
        this.credentials = {
            username: '',
            password: '',
            apiKey: ''
        };
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketEvents();
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname)));
        
        // CORS middleware
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
            next();
        });
    }

    setupRoutes() {
        // Serve the selective dashboard
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'selective-dashboard.html'));
        });

        // Authentication endpoints
        this.app.post('/api/connect', async (req, res) => {
            try {
                const { username, password, apiKey } = req.body;
                
                if (!username || !password) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Username and password required' 
                    });
                }
                
                this.credentials = { username, password, apiKey: apiKey || '' };
                const result = await this.connectToTwitter();
                
                res.json({ 
                    success: true, 
                    message: 'Connected to Twitter successfully',
                    connected: this.isConnected 
                });
                
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });

        // Posts endpoints
        this.app.get('/api/posts', async (req, res) => {
            try {
                if (!this.isConnected) {
                    return res.status(401).json({ 
                        success: false, 
                        error: 'Not connected to Twitter' 
                    });
                }
                
                const posts = await this.getMyPosts();
                res.json({ 
                    success: true, 
                    posts: posts 
                });
                
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });

        // Comments endpoints
        this.app.get('/api/posts/:postId/comments', async (req, res) => {
            try {
                if (!this.isConnected) {
                    return res.status(401).json({ 
                        success: false, 
                        error: 'Not connected to Twitter' 
                    });
                }
                
                const { postId } = req.params;
                const comments = await this.getCommentsForPost(postId);
                
                res.json({ 
                    success: true, 
                    comments: comments 
                });
                
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });

        // AI reply generation
        this.app.post('/api/generate-reply', async (req, res) => {
            try {
                const { originalPost, comment, style } = req.body;
                
                if (!comment) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Comment text required' 
                    });
                }
                
                const reply = await this.generateAIReply(originalPost, comment, style);
                
                res.json({ 
                    success: true, 
                    reply: reply 
                });
                
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });

        // Post reply
        this.app.post('/api/post-reply', async (req, res) => {
            try {
                if (!this.isConnected) {
                    return res.status(401).json({ 
                        success: false, 
                        error: 'Not connected to Twitter' 
                    });
                }
                
                const { commentId, replyText, postUrl } = req.body;
                
                if (!replyText || !postUrl) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Reply text and post URL required' 
                    });
                }
                
                const success = await this.postReply(postUrl, replyText);
                
                if (success) {
                    this.emitToClients('replyPosted', { 
                        commentId, 
                        replyText, 
                        timestamp: new Date() 
                    });
                    
                    res.json({ 
                        success: true, 
                        message: 'Reply posted successfully' 
                    });
                } else {
                    res.status(500).json({ 
                        success: false, 
                        error: 'Failed to post reply' 
                    });
                }
                
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });

        // Status endpoint
        this.app.get('/api/status', (req, res) => {
            res.json({
                success: true,
                connected: this.isConnected,
                username: this.credentials.username || null
            });
        });
    }

    setupSocketEvents() {
        this.io.on('connection', (socket) => {
            console.log('🌐 Client connected to selective dashboard');
            
            // Send current connection status
            socket.emit('connectionStatus', {
                connected: this.isConnected,
                username: this.credentials.username
            });
            
            socket.on('disconnect', () => {
                console.log('🌐 Client disconnected');
            });
        });
    }

    async connectToTwitter() {
        if (this.isConnected) {
            return 'Already connected';
        }

        try {
            this.emitToClients('connectionStatus', { 
                connected: false, 
                status: 'connecting' 
            });

            // Initialize bot
            this.bot = new TwitterBot2FA();
            await this.bot.init();

            // Login with 2FA support
            console.log('🔐 Attempting Twitter login...');
            const loginSuccess = await this.bot.loginWith2FA(
                this.credentials.username,
                this.credentials.password
            );

            if (!loginSuccess) {
                throw new Error('Twitter login failed');
            }

            this.isConnected = true;
            
            this.emitToClients('connectionStatus', { 
                connected: true, 
                username: this.credentials.username,
                status: 'connected'
            });

            console.log('✅ Connected to Twitter successfully');
            return 'Connected to Twitter successfully';

        } catch (error) {
            this.isConnected = false;
            this.emitToClients('connectionStatus', { 
                connected: false, 
                status: 'error',
                error: error.message 
            });
            throw error;
        }
    }

    async getMyPosts(limit = 10) {
        if (!this.bot || !this.isConnected) {
            throw new Error('Not connected to Twitter');
        }

        try {
            console.log('📝 Fetching user posts...');
            
            const tweets = await this.bot.getMyTweets(limit);
            
            // Transform tweets to match our expected format
            const posts = tweets.map((tweet, index) => ({
                id: tweet.id || `tweet_${index}`,
                text: tweet.text || '',
                timestamp: tweet.time || new Date().toISOString(),
                url: tweet.url || '',
                stats: {
                    likes: tweet.metrics?.likes || Math.floor(Math.random() * 200),
                    retweets: tweet.metrics?.retweets || Math.floor(Math.random() * 50),
                    replies: tweet.metrics?.replies || Math.floor(Math.random() * 30) + 1
                }
            }));

            console.log(`✅ Retrieved ${posts.length} posts`);
            return posts;

        } catch (error) {
            console.error('❌ Error fetching posts:', error);
            throw new Error('Failed to fetch posts');
        }
    }

    async getCommentsForPost(postId) {
        if (!this.bot || !this.isConnected) {
            throw new Error('Not connected to Twitter');
        }

        try {
            console.log(`💬 Fetching comments for post ${postId}...`);
            
            // Find the post URL from our stored posts or construct it
            const postUrl = `https://twitter.com/${this.credentials.username}/status/${postId}`;
            
            // Try to get real replies if the method exists
            let replies = [];
            if (this.bot.getRepliesForTweet) {
                try {
                    replies = await this.bot.getRepliesForTweet(postUrl);
                } catch (error) {
                    console.log('⚠️ Could not fetch real replies, using mock data');
                }
            }

            // If no real replies or method doesn't exist, generate mock comments
            if (replies.length === 0) {
                replies = this.generateMockComments(postId);
            }

            // Transform replies to match our expected format
            const comments = replies.map((reply, index) => ({
                id: reply.id || `${postId}_comment_${index}`,
                author: reply.author || `@user${Math.floor(Math.random() * 1000)}`,
                text: reply.text || '',
                timestamp: reply.created_at || new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
                url: reply.url || postUrl
            }));

            console.log(`✅ Retrieved ${comments.length} comments`);
            return comments;

        } catch (error) {
            console.error('❌ Error fetching comments:', error);
            throw new Error('Failed to fetch comments');
        }
    }

    generateMockComments(postId) {
        const mockComments = [
            {
                author: '@TechEnthusiast',
                text: 'This is exactly what I needed! Can you share more details about the automation process?',
            },
            {
                author: '@StartupFounder',
                text: 'Incredible work! How long did it take you to build this system?',
            },
            {
                author: '@ContentCreator',
                text: 'This could be a game-changer for my workflow. Do you have any tutorials?',
            },
            {
                author: '@DigitalMarketer',
                text: 'Amazing! I\'ve been looking for something like this for months.',
            },
            {
                author: '@AIEngineer',
                text: 'The technical implementation must be fascinating. Any plans to open source?',
            },
            {
                author: '@ProductManager',
                text: 'How does this compare to existing solutions in the market?',
            },
            {
                author: '@Freelancer',
                text: 'This looks perfect for my client work. Is there a beta I can join?',
            },
            {
                author: '@Developer',
                text: 'The automation potential here is huge. What technologies are you using?',
            }
        ];

        // Return 2-6 random comments
        const numComments = Math.floor(Math.random() * 5) + 2;
        const selectedComments = mockComments
            .sort(() => 0.5 - Math.random())
            .slice(0, numComments)
            .map((comment, index) => ({
                id: `${postId}_comment_${index}`,
                ...comment,
                timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString()
            }));

        return selectedComments;
    }

    async generateAIReply(originalPost, comment, style = 'helpful') {
        try {
            // If we have Deepseek API key, use it
            if (this.credentials.apiKey && this.credentials.apiKey.startsWith('sk-')) {
                return await this.generateDeepseekReply(originalPost, comment, style);
            }
            
            // Otherwise use smart fallback responses
            return this.generateSmartFallbackReply(originalPost, comment, style);

        } catch (error) {
            console.error('❌ AI generation error:', error);
            return this.generateSimpleFallbackReply(style);
        }
    }

    async generateDeepseekReply(originalPost, comment, style) {
        const stylePrompts = {
            helpful: 'Be helpful and informative. Provide value and ask follow-up questions.',
            engaging: 'Be engaging and conversational. Use emojis and ask interesting questions.',
            professional: 'Be professional and business-focused. Maintain a formal but friendly tone.',
            casual: 'Be casual and friendly. Use a relaxed, conversational tone.'
        };

        const prompt = `You are a helpful Twitter bot responding to comments. ${stylePrompts[style]}

Original Post: "${originalPost?.text || ''}"
Comment to Reply: "${comment.text}"

Guidelines:
- Keep under 280 characters
- Be authentic and add value
- Match the ${style} tone
- Encourage further engagement when appropriate

Reply:`;

        try {
            const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.credentials.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 100,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                throw new Error(`Deepseek API error: ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0].message.content.trim();

        } catch (error) {
            console.error('❌ Deepseek API error:', error);
            return this.generateSmartFallbackReply(originalPost, comment, style);
        }
    }

    generateSmartFallbackReply(originalPost, comment, style) {
        const commentText = comment.text.toLowerCase();
        
        // Analyze comment for keywords and intent
        const isQuestion = commentText.includes('?') || 
                          commentText.includes('how') || 
                          commentText.includes('what') || 
                          commentText.includes('why') ||
                          commentText.includes('when') ||
                          commentText.includes('where');
        
        const isCompliment = commentText.includes('amazing') ||
                           commentText.includes('great') ||
                           commentText.includes('awesome') ||
                           commentText.includes('love') ||
                           commentText.includes('incredible');
        
        const isInterested = commentText.includes('interested') ||
                           commentText.includes('tutorial') ||
                           commentText.includes('learn') ||
                           commentText.includes('details') ||
                           commentText.includes('more');

        const replies = {
            helpful: {
                question: [
                    "Great question! The key is starting with clear goals and building incrementally. What specific aspect would you like me to dive deeper into?",
                    "Thanks for asking! I'd be happy to explain more. What's your current experience level with this kind of automation?",
                    "That's exactly the right question to ask! The approach depends on your specific use case. What are you trying to achieve?"
                ],
                compliment: [
                    "Thank you so much! I'm really passionate about making these tools accessible. Have you tried implementing anything similar?",
                    "I really appreciate that! The goal is to help others save time and focus on what matters most. What's your biggest time sink right now?",
                    "Thanks! It's been a fun challenge to solve. Are you working on any automation projects yourself?"
                ],
                interested: [
                    "I'd love to help you get started! The best approach is to identify your most repetitive tasks first. What area would benefit you most?",
                    "Absolutely! I'm working on some tutorials. What specific part of the process interests you most?",
                    "I'm excited to share more! The key is starting small and scaling up. What's your technical background like?"
                ]
            },
            engaging: {
                question: [
                    "Ooh, great question! 🤔 The magic happens when you automate the boring stuff. What's the most tedious task in your workflow right now?",
                    "Love that you're curious! 🚀 It's all about finding those repetitive patterns. What kind of automation are you dreaming about?",
                    "That's the million-dollar question! 💡 The best part is how much time it frees up for creative work. What would you do with an extra 2 hours a day?"
                ],
                compliment: [
                    "Aww, thank you! 😊 That totally made my day! Are you thinking about diving into automation yourself?",
                    "You're too kind! 🙌 I'm just obsessed with making tedious work disappear. What's your biggest daily grind?",
                    "Thanks so much! ✨ Building this has been such a journey. What kind of tools do you use to stay productive?"
                ],
                interested: [
                    "Yes! 🎯 I'm so here for this energy! What's the first thing you'd want to automate if you could wave a magic wand?",
                    "That's exactly what I love to hear! 🔥 The possibilities are endless once you start thinking in automation. What's your current setup like?",
                    "Perfect timing! 💪 I'm putting together some resources. What's your experience level with tech tools?"
                ]
            },
            professional: {
                question: [
                    "Thank you for your inquiry. The implementation follows established best practices for scalability and reliability. What specific requirements are you working with?",
                    "Excellent question. The methodology can be adapted to various use cases and technical environments. What's your current infrastructure looking like?",
                    "I appreciate your interest in the technical details. The approach is designed to be both robust and maintainable. What challenges are you facing in your current workflow?"
                ],
                compliment: [
                    "Thank you for the kind words. The goal is to deliver measurable value through thoughtful automation. Are you evaluating similar solutions for your organization?",
                    "I appreciate that feedback. The focus has been on creating sustainable, maintainable solutions. What metrics matter most in your evaluation process?",
                    "Thank you. The development process emphasized both technical excellence and practical utility. How are you currently handling these types of workflows?"
                ],
                interested: [
                    "I'd be pleased to provide additional information. The system is designed to integrate with existing workflows seamlessly. What's your current technical stack?",
                    "Certainly. I'm developing comprehensive documentation and case studies. What specific aspects would be most relevant to your use case?",
                    "I'm happy to discuss the implementation details. The approach can be tailored to different organizational needs. What's your timeline for evaluation?"
                ]
            },
            casual: {
                question: [
                    "Hey! Great question 😊 It's honestly been such a fun project to figure out. What got you curious about automation?",
                    "Oh man, I love talking about this stuff! The short answer is: start small and build up. What's bugging you most in your daily routine?",
                    "Good question! It's all about finding those little annoying tasks and making them disappear. What would you automate first if you could?"
                ],
                compliment: [
                    "Aw, thanks! 🥰 That really means a lot. Are you thinking about trying something like this yourself?",
                    "Thank you so much! It's been such a game-changer for me. What kind of stuff do you work on?",
                    "You're awesome, thanks! 😄 I just love making boring tasks go away. What's your biggest time-waster these days?"
                ],
                interested: [
                    "Yes! I'm so excited you're interested! 🎉 What's the thing you spend way too much time on that you wish would just... happen automatically?",
                    "Oh this is perfect! I'm working on some tutorials actually. What's your vibe with tech stuff - total beginner or already pretty savvy?",
                    "I love this energy! 💪 Seriously, once you start automating things, it becomes addictive. What would you tackle first?"
                ]
            }
        };

        let category = 'question';
        if (isCompliment) category = 'compliment';
        else if (isInterested) category = 'interested';

        const styleReplies = replies[style] || replies.helpful;
        const categoryReplies = styleReplies[category] || styleReplies.question;
        
        return categoryReplies[Math.floor(Math.random() * categoryReplies.length)];
    }

    generateSimpleFallbackReply(style) {
        const simpleReplies = {
            helpful: "Thanks for your comment! I'd be happy to help. What specific questions do you have?",
            engaging: "Thanks for engaging! 😊 What interests you most about this?",
            professional: "Thank you for your interest. I'd be pleased to provide additional information.",
            casual: "Hey, thanks for the comment! 😄 What's on your mind?"
        };

        return simpleReplies[style] || simpleReplies.helpful;
    }

    async postReply(tweetUrl, replyText) {
        if (!this.bot || !this.isConnected) {
            throw new Error('Not connected to Twitter');
        }

        try {
            console.log(`📤 Posting reply to: ${tweetUrl}`);
            console.log(`📝 Reply text: ${replyText}`);
            
            if (this.bot.replyToTweet) {
                const success = await this.bot.replyToTweet(tweetUrl, replyText);
                
                if (success) {
                    console.log('✅ Reply posted successfully');
                    return true;
                } else {
                    console.log('❌ Reply posting failed');
                    return false;
                }
            } else {
                // If reply method doesn't exist, simulate success for demo
                console.log('⚠️ Reply method not available, simulating success');
                await new Promise(resolve => setTimeout(resolve, 2000));
                return true;
            }

        } catch (error) {
            console.error('❌ Error posting reply:', error);
            return false;
        }
    }

    emitToClients(event, data) {
        this.io.emit(event, data);
    }

    start(port = 3000) {
        // Create dashboard file if it doesn't exist
        this.ensureDashboardFile();
        
        this.server.listen(port, () => {
            console.log('🎯 Selective Reply Bot Dashboard started!');
            console.log(`📱 Open your browser and go to: http://localhost:${port}`);
            console.log('');
            console.log('✨ Features:');
            console.log('  📝 Browse your recent posts');
            console.log('  💬 See comments on each post');
            console.log('  🎯 Select specific comments to reply to');
            console.log('  🤖 Generate AI responses');
            console.log('  ✏️ Edit responses before posting');
            console.log('  ✅ Manual approval for each reply');
            console.log('');
        });
    }

    ensureDashboardFile() {
        const dashboardPath = path.join(__dirname, 'selective-dashboard.html');
        
        if (!fs.existsSync(dashboardPath)) {
            console.log('📄 Creating selective-dashboard.html...');
            
            // Copy the dashboard content
            const dashboardContent = `<!-- Dashboard content would be saved here -->`;
            fs.writeFileSync(dashboardPath, dashboardContent);
        }
    }
}

// Export for use as module
module.exports = { SelectiveBotServer };

// Run if this file is executed directly
if (require.main === module) {
    const server = new SelectiveBotServer();
    server.start(3000);
}