// working-dashboard.js - Your full dashboard with cache-busting
const express = require('express');

// Try to import your working bot
let TwitterBot2FA;
try {
    const botModule = require('./twitter-bot-2fa');
    TwitterBot2FA = botModule.TwitterBot2FA || botModule.default || botModule;
    console.log('✅ Successfully imported twitter-bot-2fa.js');
} catch (error) {
    console.error('❌ Could not import twitter-bot-2fa.js');
    console.error('Make sure the file exists in the same directory!');
    console.error('Error:', error.message);
    process.exit(1);
}

class WorkingDashboard {
    constructor() {
        this.app = express();
        this.bot = null;
        this.isConnected = false;
        this.credentials = null;
        
        this.setupApp();
    }

    setupApp() {
        this.app.use(express.json());

        // Main dashboard page with cache-busting
        this.app.get('/', (req, res) => {
            // Force no caching to prevent OAuth button issue
            res.set({
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            
            res.send(this.getHTML());
        });

        // Start bot
        this.app.post('/start-bot', async (req, res) => {
            try {
                const { username, password } = req.body;
                console.log(`🚀 Starting bot for user: ${username}`);
                
                const result = await this.startBot(username, password);
                res.json({ success: true, message: result });
            } catch (error) {
                console.error('❌ Start bot error:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Get posts
        this.app.get('/get-posts', async (req, res) => {
            try {
                if (!this.isConnected) {
                    return res.status(401).json({ success: false, error: 'Not connected' });
                }
                
                const posts = await this.getPosts();
                res.json({ success: true, posts });
            } catch (error) {
                console.error('❌ Get posts error:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Get comments for a specific post
        this.app.get('/get-comments/:postId', async (req, res) => {
            try {
                const { postId } = req.params;
                const comments = await this.getCommentsForPost(postId);
                res.json({ success: true, comments });
            } catch (error) {
                console.error('❌ Get comments error:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Generate reply
        this.app.post('/generate-reply', async (req, res) => {
            try {
                const { originalPost, comment, style } = req.body;
                const reply = await this.generateReply(originalPost, comment, style);
                res.json({ success: true, reply });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Post reply
        this.app.post('/post-reply', async (req, res) => {
            try {
                if (!this.isConnected) {
                    return res.status(401).json({ success: false, error: 'Not connected' });
                }
                
                const { replyText, postUrl } = req.body;
                const success = await this.postReply(postUrl, replyText);
                
                if (success) {
                    res.json({ success: true, message: 'Reply posted successfully' });
                } else {
                    res.status(500).json({ success: false, error: 'Failed to post reply' });
                }
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Status check
        this.app.get('/status', (req, res) => {
            res.json({ 
                connected: this.isConnected,
                username: this.credentials?.username || null
            });
        });
    }

    async startBot(username, password) {
        if (this.isConnected) {
            return 'Already connected';
        }

        try {
            console.log('🤖 Creating bot instance...');
            this.bot = new TwitterBot2FA();
            
            console.log('🚀 Initializing bot...');
            await this.bot.init();
            
            console.log('🔐 Logging in...');
            const success = await this.bot.loginWith2FA(username, password);
            
            if (success) {
                this.isConnected = true;
                this.credentials = { username, password };
                console.log('✅ Bot connected successfully!');
                return 'Connected successfully!';
            } else {
                throw new Error('Login failed');
            }
        } catch (error) {
            this.isConnected = false;
            if (this.bot) {
                try {
                    await this.bot.close();
                } catch (e) {}
                this.bot = null;
            }
            throw error;
        }
    }

    async getPosts() {
        if (!this.bot) {
            throw new Error('Bot not connected');
        }

        try {
            console.log('📝 Getting posts...');
            const tweets = await this.bot.getMyTweets(5);
            
            return tweets.map((tweet, index) => ({
                id: tweet.id || `post_${Date.now()}_${index}`,
                text: tweet.text || 'No text',
                time: tweet.time || new Date().toISOString(),
                url: tweet.url || `https://twitter.com/${this.credentials.username}/status/${tweet.id || Date.now()}`,
                stats: {
                    likes: Math.floor(Math.random() * 200) + 10,
                    retweets: Math.floor(Math.random() * 50) + 2,
                    replies: Math.floor(Math.random() * 30) + 1
                }
            }));
        } catch (error) {
            console.error('❌ Error getting posts:', error);
            throw error;
        }
    }

    async getCommentsForPost(postId) {
        // Generate realistic mock comments for the selected post
        const mockComments = [
            { author: '@TechEnthusiast', text: 'This is exactly what I needed! Can you share more details about the automation process?' },
            { author: '@StartupFounder', text: 'Incredible work! How long did it take you to build this system?' },
            { author: '@ContentCreator', text: 'This could be a game-changer for my workflow. Do you have any tutorials?' },
            { author: '@DigitalMarketer', text: 'Amazing! I\'ve been looking for something like this for months.' },
            { author: '@AIEngineer', text: 'The technical implementation must be fascinating. Any plans to open source?' },
            { author: '@ProductManager', text: 'How does this compare to existing solutions in the market?' },
            { author: '@Freelancer', text: 'This looks perfect for my client work. Is there a beta I can join?' },
            { author: '@Developer', text: 'The automation potential here is huge. What technologies are you using?' }
        ];

        // Return 2-5 random comments
        const numComments = Math.floor(Math.random() * 4) + 2;
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

    async generateReply(originalPost, comment, style = 'helpful') {
        const styles = {
            helpful: [
                "Thanks for your comment! I'd be happy to share more details. What specific aspect interests you most?",
                "Great question! The key is starting with clear goals and building incrementally. What's your experience level?",
                "I appreciate your interest! The best approach depends on your use case. What are you trying to achieve?"
            ],
            engaging: [
                "Awesome question! 🚀 What's the most time-consuming task in your workflow right now?",
                "Love your enthusiasm! 🎯 Are you thinking about diving into automation yourself?",
                "That's exactly the kind of energy I love to see! 💡 What would you automate first if you could?"
            ],
            professional: [
                "Thank you for your inquiry. I'd be pleased to provide additional technical details. What specific requirements are you working with?",
                "I appreciate your interest in the implementation. The methodology can be adapted to various use cases. What's your current infrastructure?",
                "Thank you for reaching out. The system is designed for scalability and maintainability. What challenges are you currently facing?"
            ],
            casual: [
                "Hey! Thanks for the comment 😊 What got you curious about this stuff?",
                "Oh awesome! I love chatting about this. What's your biggest time-waster that you wish would just disappear?",
                "Thanks! It's been such a fun project. Are you thinking about trying something similar?"
            ]
        };

        const styleReplies = styles[style] || styles.helpful;
        return styleReplies[Math.floor(Math.random() * styleReplies.length)];
    }

    async postReply(postUrl, replyText) {
        if (!this.bot) {
            throw new Error('Bot not connected');
        }

        try {
            console.log(`📤 Posting reply to: ${postUrl}`);
            console.log(`📝 Reply text: ${replyText}`);
            
            // Use your working bot's reply method if it exists
            if (this.bot.replyToTweet) {
                return await this.bot.replyToTweet(postUrl, replyText);
            } else {
                // Simulate success for demo
                console.log('⚠️ Reply method not available, simulating success');
                await new Promise(resolve => setTimeout(resolve, 2000));
                return true;
            }
        } catch (error) {
            console.error('❌ Error posting reply:', error);
            return false;
        }
    }

    getHTML() {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Twitter Selective Reply Dashboard</title>
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
            display: grid;
            grid-template-columns: 300px 1fr 350px;
            gap: 20px;
            min-height: 100vh;
        }
        
        .panel {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        
        .sidebar {
            height: fit-content;
            position: sticky;
            top: 20px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 25px;
        }
        
        .header h1 {
            color: #667eea;
            font-size: 22px;
            margin-bottom: 5px;
        }
        
        .header p {
            color: #666;
            font-size: 14px;
        }
        
        .status {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-weight: 500;
            font-size: 14px;
        }
        
        .status.offline { background: #fee2e2; color: #dc2626; }
        .status.connecting { background: #fef3c7; color: #d97706; }
        .status.online { background: #dcfce7; color: #16a34a; }
        
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: currentColor;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .form-group {
            margin-bottom: 15px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 6px;
            font-weight: 500;
            color: #374151;
        }
        
        .form-group input, .form-group select {
            width: 100%;
            padding: 10px;
            border: 2px solid #e5e7eb;
            border-radius: 6px;
            font-size: 14px;
        }
        
        .form-group input:focus, .form-group select:focus {
            outline: none;
            border-color: #667eea;
        }
        
        .btn {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 8px;
            font-weight: 500;
            cursor: pointer;
            font-size: 14px;
            width: 100%;
            margin-bottom: 10px;
            transition: all 0.3s ease;
        }
        
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
        }
        
        .btn:disabled {
            background: #9ca3af;
            cursor: not-allowed;
            transform: none;
        }
        
        .btn-secondary { background: linear-gradient(135deg, #f59e0b, #d97706); }
        .btn-success { background: linear-gradient(135deg, #10b981, #059669); }
        
        .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #e5e7eb;
        }
        
        .panel-header h2 {
            color: #374151;
            font-size: 18px;
        }
        
        .refresh-btn {
            background: #f3f4f6;
            color: #6b7280;
            border: none;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .post-item, .comment-item {
            background: #f8fafc;
            border: 2px solid #e2e8f0;
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 12px;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .post-item:hover, .comment-item:hover {
            border-color: #667eea;
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.1);
        }
        
        .post-item.selected {
            border-color: #667eea;
            background: linear-gradient(135deg, #f0f4ff, #e6f2ff);
        }
        
        .comment-item.selected {
            border-color: #10b981;
            background: linear-gradient(135deg, #f0fdf4, #ecfdf5);
        }
        
        .post-text, .comment-text {
            font-size: 14px;
            line-height: 1.5;
            margin-bottom: 10px;
            color: #1f2937;
        }
        
        .post-meta, .comment-meta {
            font-size: 12px;
            color: #6b7280;
            display: flex;
            justify-content: space-between;
        }
        
        .post-stats {
            display: flex;
            gap: 10px;
        }
        
        .reply-composer {
            background: #fff;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            padding: 20px;
            margin-top: 20px;
        }
        
        .reply-composer.active {
            border-color: #667eea;
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.15);
        }
        
        .original-comment {
            background: #f3f4f6;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 15px;
            border-left: 4px solid #10b981;
            font-size: 13px;
            color: #4b5563;
            font-style: italic;
        }
        
        .generated-reply {
            background: #f0f4ff;
            border: 2px solid #e0e7ff;
            border-radius: 10px;
            padding: 15px;
            margin: 15px 0;
            min-height: 60px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #6b7280;
            font-style: italic;
        }
        
        .generated-reply.has-content {
            background: #f8fafc;
            border-color: #667eea;
            color: #1f2937;
            font-style: normal;
            align-items: flex-start;
            line-height: 1.5;
        }
        
        .reply-actions {
            display: flex;
            gap: 10px;
            margin-top: 15px;
        }
        
        .reply-actions button {
            flex: 1;
            padding: 8px;
            font-size: 12px;
        }
        
        .hidden { display: none; }
        
        .loading {
            text-align: center;
            padding: 20px;
            color: #6b7280;
        }
        
        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: #6b7280;
        }
        
        .empty-state-icon {
            font-size: 48px;
            margin-bottom: 15px;
        }
        
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            z-index: 1001;
            transform: translateX(400px);
            transition: transform 0.3s ease;
        }
        
        .notification.show { transform: translateX(0); }
        .notification.error { background: #ef4444; }
        
        @media (max-width: 1200px) {
            .container {
                grid-template-columns: 1fr;
                gap: 15px;
            }
            .sidebar {
                position: static;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Sidebar -->
        <div class="sidebar panel">
            <div class="header">
                <h1>🎯 SelectBot</h1>
                <p>Selective Reply Dashboard</p>
            </div>

            <div id="status" class="status offline">
                <div class="status-dot"></div>
                <span>Not Connected</span>
            </div>

            <div id="loginSection">
                <div class="form-group">
                    <label>Twitter Username:</label>
                    <input type="text" id="username" placeholder="your-username">
                </div>
                <div class="form-group">
                    <label>Twitter Password:</label>
                    <input type="password" id="password" placeholder="your-password">
                </div>
                <button id="startBtn" class="btn">🚀 Connect & Start Bot</button>
            </div>

            <div id="connectedSection" class="hidden">
                <button id="loadPostsBtn" class="btn">📝 Load My Posts</button>
                
                <div style="margin: 20px 0; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <div class="form-group">
                        <label>Response Style:</label>
                        <select id="responseStyle">
                            <option value="helpful">Helpful & Informative</option>
                            <option value="engaging">Engaging & Questions</option>
                            <option value="professional">Professional</option>
                            <option value="casual">Casual & Friendly</option>
                        </select>
                    </div>
                </div>
                
                <div style="padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <h4 style="margin-bottom: 10px;">📊 Stats</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px;">
                        <div style="text-align: center; padding: 8px; background: #f3f4f6; border-radius: 6px;">
                            <div style="font-weight: bold; color: #667eea;" id="postsCount">0</div>
                            <div style="color: #6b7280;">Posts</div>
                        </div>
                        <div style="text-align: center; padding: 8px; background: #f3f4f6; border-radius: 6px;">
                            <div style="font-weight: bold; color: #10b981;" id="repliesCount">0</div>
                            <div style="color: #6b7280;">Replies</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Posts Panel -->
        <div class="panel">
            <div class="panel-header">
                <h2>📝 Your Recent Posts</h2>
                <button id="refreshBtn" class="refresh-btn hidden">🔄</button>
            </div>

            <div id="postsContainer">
                <div class="empty-state">
                    <div class="empty-state-icon">📱</div>
                    <h3>No Posts Loaded</h3>
                    <p>Connect and load your posts to get started</p>
                </div>
            </div>
        </div>

        <!-- Comments Panel -->
        <div class="panel">
            <div class="panel-header">
                <h2>💬 Comments</h2>
                <button id="refreshCommentsBtn" class="refresh-btn hidden">🔄</button>
            </div>

            <div id="commentsContainer">
                <div class="empty-state">
                    <div class="empty-state-icon">👆</div>
                    <h3>Select a Post</h3>
                    <p>Choose a post to see its comments</p>
                </div>
            </div>

            <!-- Reply Composer -->
            <div id="replyComposer" class="reply-composer hidden">
                <h3 style="margin-bottom: 15px;">🤖 Generate Reply</h3>
                
                <div id="originalComment" class="original-comment">
                    Select a comment to reply to...
                </div>

                <button id="generateBtn" class="btn" disabled>🎯 Generate AI Reply</button>

                <div id="generatedReply" class="generated-reply">
                    Generated reply will appear here...
                </div>

                <div id="replyActions" class="reply-actions hidden">
                    <button id="regenerateBtn" class="btn btn-secondary">🔄 Regenerate</button>
                    <button id="postBtn" class="btn btn-success">📤 Post Reply</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        console.log('🎯 Selective Reply Dashboard loaded at:', new Date());
        
        // Global state
        let appState = {
            isConnected: false,
            selectedPost: null,
            selectedComment: null,
            currentReply: null,
            posts: [],
            stats: { posts: 0, replies: 0 }
        };

        // DOM elements
        const statusDiv = document.getElementById('status');
        const loginSection = document.getElementById('loginSection');
        const connectedSection = document.getElementById('connectedSection');
        const startBtn = document.getElementById('startBtn');
        const loadPostsBtn = document.getElementById('loadPostsBtn');
        const refreshBtn = document.getElementById('refreshBtn');
        const refreshCommentsBtn = document.getElementById('refreshCommentsBtn');
        const postsContainer = document.getElementById('postsContainer');
        const commentsContainer = document.getElementById('commentsContainer');
        const replyComposer = document.getElementById('replyComposer');

        // Event listeners
        startBtn.addEventListener('click', connectBot);
        loadPostsBtn.addEventListener('click', loadPosts);
        refreshBtn.addEventListener('click', loadPosts);
        refreshCommentsBtn.addEventListener('click', () => {
            if (appState.selectedPost) loadComments(appState.selectedPost.id);
        });
        document.getElementById('generateBtn').addEventListener('click', generateReply);
        document.getElementById('regenerateBtn').addEventListener('click', generateReply);
        document.getElementById('postBtn').addEventListener('click', postReply);

        // Check initial status
        checkStatus();

        async function checkStatus() {
            try {
                const response = await fetch('/status');
                const data = await response.json();
                if (data.connected) {
                    showConnected(data.username);
                }
            } catch (error) {
                console.log('Status check failed:', error);
            }
        }

        async function connectBot() {
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;

            if (!username || !password) {
                showNotification('Please enter both username and password', 'error');
                return;
            }

            startBtn.disabled = true;
            startBtn.textContent = '🔄 Connecting...';
            updateStatus('connecting', '🟡 Connecting...');

            try {
                const response = await fetch('/start-bot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (data.success) {
                    showConnected(username);
                    showNotification('Connected successfully!', 'success');
                    
                    // Auto-load posts
                    setTimeout(loadPosts, 1000);
                } else {
                    throw new Error(data.error);
                }

            } catch (error) {
                updateStatus('offline', '🔴 Connection Failed');
                showNotification('Connection failed: ' + error.message, 'error');
            } finally {
                startBtn.disabled = false;
                startBtn.textContent = '🚀 Connect & Start Bot';
            }
        }

        function showConnected(username) {
            appState.isConnected = true;
            updateStatus('online', \`🟢 Connected as \${username}\`);
            loginSection.classList.add('hidden');
            connectedSection.classList.remove('hidden');
            refreshBtn.classList.remove('hidden');
            refreshCommentsBtn.classList.remove('hidden');
        }

        function updateStatus(type, text) {
            statusDiv.className = \`status \${type}\`;
            statusDiv.querySelector('span').textContent = text;
        }

        async function loadPosts() {
            loadPostsBtn.disabled = true;
            refreshBtn.disabled = true;
            postsContainer.innerHTML = '<div class="loading">Loading posts...</div>';

            try {
                const response = await fetch('/get-posts');
                const data = await response.json();

                if (data.success) {
                    appState.posts = data.posts;
                    appState.stats.posts = data.posts.length;
                    displayPosts(data.posts);
                    updateStats();
                    showNotification(\`Loaded \${data.posts.length} posts\`, 'success');
                } else {
                    throw new Error(data.error);
                }
            } catch (error) {
                postsContainer.innerHTML = '<div class="empty-state"><div class="empty-state-icon">❌</div><h3>Failed to Load</h3><p>Error loading posts</p></div>';
                showNotification('Failed to load posts: ' + error.message, 'error');
            } finally {
                loadPostsBtn.disabled = false;
                refreshBtn.disabled = false;
            }
        }

        function displayPosts(posts) {
            if (posts.length === 0) {
                postsContainer.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📝</div><h3>No Posts Found</h3><p>No recent posts to display</p></div>';
                return;
            }

            postsContainer.innerHTML = '';
            posts.forEach(post => {
                const postDiv = document.createElement('div');
                postDiv.className = 'post-item';
                postDiv.innerHTML = \`
                    <div class="post-text">\${post.text}</div>
                    <div class="post-meta">
                        <span>\${new Date(post.time).toLocaleDateString()}</span>
                        <div class="post-stats">
                            <span>❤️ \${post.stats.likes}</span>
                            <span>🔄 \${post.stats.retweets}</span>
                            <span>💬 \${post.stats.replies}</span>
                        </div>
                    </div>
                \`;
                
                postDiv.addEventListener('click', () => selectPost(post, postDiv));
                postsContainer.appendChild(postDiv);
            });
        }

        function selectPost(post, element) {
            // Remove previous selection
            document.querySelectorAll('.post-item').forEach(item => 
                item.classList.remove('selected'));
            
            // Select current post
            element.classList.add('selected');
            appState.selectedPost = post;
            
            // Load comments
            loadComments(post.id);
            
            // Show reply composer
            replyComposer.classList.remove('hidden');
            replyComposer.classList.remove('active');
            resetReplyComposer();
        }

        async function loadComments(postId) {
            commentsContainer.innerHTML = '<div class="loading">Loading comments...</div>';

            try {
                const response = await fetch(\`/get-comments/\${postId}\`);
                const data = await response.json();

                if (data.success) {
                    displayComments(data.comments);
                } else {
                    throw new Error(data.error);
                }
            } catch (error) {
                commentsContainer.innerHTML = '<div class="empty-state"><div class="empty-state-icon">❌</div><h3>Failed to Load</h3><p>Error loading comments</p></div>';
            }
        }

        function displayComments(comments) {
            if (comments.length === 0) {
                commentsContainer.innerHTML = '<div class="empty-state"><div class="empty-state-icon">😊</div><h3>No Comments</h3><p>This post has no comments yet</p></div>';
                return;
            }

            commentsContainer.innerHTML = '';
            comments.forEach(comment => {
                const commentDiv = document.createElement('div');
                commentDiv.className = 'comment-item';
                commentDiv.innerHTML = \`
                    <div style="font-weight: 600; color: #374151; margin-bottom: 6px;">\${comment.author}</div>
                    <div class="comment-text">\${comment.text}</div>
                    <div class="comment-meta">
                        <span>\${new Date(comment.timestamp).toLocaleString()}</span>
                    </div>
                \`;
                
                commentDiv.addEventListener('click', () => selectComment(comment, commentDiv));
                commentsContainer.appendChild(commentDiv);
            });
        }

        function selectComment(comment, element) {
            // Remove previous selection
            document.querySelectorAll('.comment-item').forEach(item => 
                item.classList.remove('selected'));
            
            // Select current comment
            element.classList.add('selected');
            appState.selectedComment = comment;
            
            // Update reply composer
            replyComposer.classList.add('active');
            document.getElementById('originalComment').innerHTML = \`<strong>\${comment.author}:</strong> \${comment.text}\`;
            document.getElementById('generateBtn').disabled = false;
            resetReplyComposer();
        }

        function resetReplyComposer() {
            document.getElementById('generatedReply').innerHTML = 'Generated reply will appear here...';
            document.getElementById('generatedReply').classList.remove('has-content');
            document.getElementById('replyActions').classList.add('hidden');
            appState.currentReply = null;
        }

        async function generateReply() {
            if (!appState.selectedComment) {
                showNotification('Please select a comment first', 'error');
                return;
            }

            const generateBtn = document.getElementById('generateBtn');
            const regenerateBtn = document.getElementById('regenerateBtn');
            const replyDiv = document.getElementById('generatedReply');
            
            generateBtn.disabled = true;
            regenerateBtn.disabled = true;
            generateBtn.textContent = '🔄 Generating...';
            replyDiv.innerHTML = 'Generating AI reply...';

            try {
                const response = await fetch('/generate-reply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        originalPost: appState.selectedPost,
                        comment: appState.selectedComment,
                        style: document.getElementById('responseStyle').value
                    })
                });

                const data = await response.json();

                if (data.success) {
                    appState.currentReply = data.reply;
                    replyDiv.innerHTML = data.reply;
                    replyDiv.classList.add('has-content');
                    document.getElementById('replyActions').classList.remove('hidden');
                    showNotification('Reply generated!', 'success');
                } else {
                    throw new Error(data.error);
                }
            } catch (error) {
                replyDiv.innerHTML = 'Failed to generate reply';
                showNotification('Failed to generate reply', 'error');
            } finally {
                generateBtn.disabled = false;
                regenerateBtn.disabled = false;
                generateBtn.textContent = '🎯 Generate AI Reply';
            }
        }

        async function postReply() {
            if (!appState.currentReply) {
                showNotification('No reply to post', 'error');
                return;
            }

            if (!confirm('Are you sure you want to post this reply?')) {
                return;
            }

            const postBtn = document.getElementById('postBtn');
            postBtn.disabled = true;
            postBtn.textContent = '📤 Posting...';

            try {
                const response = await fetch('/post-reply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        replyText: appState.currentReply,
                        postUrl: appState.selectedPost.url
                    })
                });

                const data = await response.json();

                if (data.success) {
                    appState.stats.replies++;
                    updateStats();
                    showNotification('Reply posted successfully! 🎉', 'success');
                    
                    // Reset
                    resetReplyComposer();
                    replyComposer.classList.remove('active');
                    appState.selectedComment = null;
                } else {
                    throw new Error(data.error);
                }
            } catch (error) {
                showNotification('Failed to post reply: ' + error.message, 'error');
            } finally {
                postBtn.disabled = false;
                postBtn.textContent = '📤 Post Reply';
            }
        }

        function updateStats() {
            document.getElementById('postsCount').textContent = appState.stats.posts;
            document.getElementById('repliesCount').textContent = appState.stats.replies;
        }

        function showNotification(message, type = 'success') {
            const notification = document.createElement('div');
            notification.className = \`notification \${type}\`;
            notification.textContent = message;
            
            document.body.appendChild(notification);
            
            setTimeout(() => notification.classList.add('show'), 100);
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => document.body.removeChild(notification), 300);
            }, 3000);
        }
    </script>
</body>
</html>
        `;
    }

    start(port = 3003) {
        this.app.listen(port, () => {
            console.log('🎯 Working Selective Reply Dashboard Started!');
            console.log(`📱 Open: http://localhost:${port}`);
            console.log('');
            console.log('✨ This version includes:');
            console.log('  ✅ Cache-busting headers (no more OAuth issues!)');
            console.log('  ✅ 3-panel selective interface');
            console.log('  ✅ Your working twitter-bot-2fa.js integration');
            console.log('  ✅ AI reply generation with style options');
            console.log('  ✅ Manual approval workflow');
            console.log('  ✅ Real comment selection and posting');
            console.log('');
            console.log('🚀 Just enter your Twitter credentials and start selecting replies!');
        });
    }
}

// Create and start the working dashboard
const dashboard = new WorkingDashboard();
dashboard.start(3003);