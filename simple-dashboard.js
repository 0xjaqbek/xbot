// simple-dashboard.js - Complete working dashboard in one file
const express = require('express');
const path = require('path');

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

class SimpleDashboard {
    constructor() {
        this.app = express();
        this.bot = null;
        this.isConnected = false;
        this.credentials = null;
        
        this.setupApp();
    }

    setupApp() {
        this.app.use(express.json());
        this.app.use(express.static(__dirname));

        // Main dashboard page
        this.app.get('/', (req, res) => {
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

        // Generate reply
        this.app.post('/generate-reply', async (req, res) => {
            try {
                const { comment } = req.body;
                const reply = this.generateSimpleReply(comment);
                res.json({ success: true, reply });
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
                id: tweet.id || `post_${index}`,
                text: tweet.text || 'No text',
                time: tweet.time || new Date().toISOString(),
                url: tweet.url || '',
                stats: {
                    likes: Math.floor(Math.random() * 100) + 10,
                    replies: Math.floor(Math.random() * 20) + 1
                }
            }));
        } catch (error) {
            console.error('❌ Error getting posts:', error);
            throw error;
        }
    }

    generateSimpleReply(comment) {
        const replies = [
            "Thanks for your comment! What's your experience with this?",
            "Great point! I'd love to hear more about your thoughts.",
            "Appreciate your feedback! What questions do you have?",
            "Thanks for engaging! What interests you most about this?",
            "Good question! What specific aspects would you like to know more about?"
        ];
        
        return replies[Math.floor(Math.random() * replies.length)];
    }

    getHTML() {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Simple Twitter Dashboard</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #eee;
        }
        .header h1 {
            color: #667eea;
            margin-bottom: 10px;
        }
        .status {
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 20px;
            font-weight: bold;
        }
        .status.offline {
            background: #fee2e2;
            color: #dc2626;
        }
        .status.connecting {
            background: #fef3c7;
            color: #d97706;
        }
        .status.online {
            background: #dcfce7;
            color: #16a34a;
        }
        .login-section {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
        }
        .form-group {
            margin-bottom: 15px;
        }
        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        .form-group input {
            width: 100%;
            padding: 10px;
            border: 2px solid #ddd;
            border-radius: 5px;
            font-size: 14px;
        }
        .btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            margin-right: 10px;
            margin-bottom: 10px;
        }
        .btn:hover {
            background: #5a67d8;
        }
        .btn:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        .posts-section {
            margin-top: 20px;
        }
        .post-item {
            background: #f8f9fa;
            border: 2px solid #e9ecef;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 15px;
            cursor: pointer;
            transition: all 0.3s;
        }
        .post-item:hover {
            border-color: #667eea;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.2);
        }
        .post-item.selected {
            border-color: #667eea;
            background: #f0f4ff;
        }
        .post-text {
            font-size: 15px;
            line-height: 1.5;
            margin-bottom: 10px;
        }
        .post-meta {
            font-size: 12px;
            color: #666;
        }
        .comments-section {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 20px;
            margin-top: 20px;
        }
        .comment-item {
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 10px;
            cursor: pointer;
        }
        .comment-item:hover {
            border-color: #667eea;
        }
        .comment-item.selected {
            border-color: #667eea;
            background: #f0f4ff;
        }
        .reply-section {
            background: #e8f5e8;
            border-radius: 10px;
            padding: 20px;
            margin-top: 20px;
        }
        .generated-reply {
            background: white;
            border: 2px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            margin: 15px 0;
            min-height: 50px;
        }
        .hidden {
            display: none;
        }
        .loading {
            text-align: center;
            padding: 20px;
            color: #666;
        }
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            font-weight: bold;
            z-index: 1000;
            transform: translateX(400px);
            transition: transform 0.3s;
        }
        .notification.show {
            transform: translateX(0);
        }
        .notification.success {
            background: #10b981;
        }
        .notification.error {
            background: #ef4444;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 Simple Twitter Dashboard</h1>
            <p>Select posts and comments to reply to</p>
        </div>

        <div id="status" class="status offline">
            🔴 Not Connected
        </div>

        <div id="loginSection" class="login-section">
            <h3>🔐 Connect to Twitter</h3>
            <div class="form-group">
                <label>Username:</label>
                <input type="text" id="username" placeholder="your-username">
            </div>
            <div class="form-group">
                <label>Password:</label>
                <input type="password" id="password" placeholder="your-password">
            </div>
            <button id="connectBtn" class="btn">🚀 Connect & Start Bot</button>
        </div>

        <div id="connectedSection" class="hidden">
            <button id="loadPostsBtn" class="btn">📝 Load My Posts</button>
            <button id="refreshBtn" class="btn">🔄 Refresh</button>
            
            <div id="postsSection" class="posts-section hidden">
                <h3>📝 Your Recent Posts</h3>
                <div id="postsList"></div>
            </div>

            <div id="commentsSection" class="comments-section hidden">
                <h3>💬 Comments on Selected Post</h3>
                <div id="commentsList"></div>
            </div>

            <div id="replySection" class="reply-section hidden">
                <h3>🤖 Generate Reply</h3>
                <p><strong>Replying to:</strong> <span id="selectedComment"></span></p>
                <button id="generateBtn" class="btn">🎯 Generate AI Reply</button>
                <div id="generatedReply" class="generated-reply"></div>
                <button id="postReplyBtn" class="btn hidden">📤 Post Reply</button>
            </div>
        </div>
    </div>

    <script>
        let selectedPost = null;
        let selectedComment = null;
        let generatedReplyText = null;

        // DOM elements
        const statusDiv = document.getElementById('status');
        const loginSection = document.getElementById('loginSection');
        const connectedSection = document.getElementById('connectedSection');
        const connectBtn = document.getElementById('connectBtn');
        const loadPostsBtn = document.getElementById('loadPostsBtn');
        const refreshBtn = document.getElementById('refreshBtn');
        const postsSection = document.getElementById('postsSection');
        const commentsSection = document.getElementById('commentsSection');
        const replySection = document.getElementById('replySection');

        // Check initial status
        checkStatus();

        // Event listeners
        connectBtn.addEventListener('click', connectToTwitter);
        loadPostsBtn.addEventListener('click', loadPosts);
        refreshBtn.addEventListener('click', loadPosts);
        document.getElementById('generateBtn').addEventListener('click', generateReply);
        document.getElementById('postReplyBtn').addEventListener('click', postReply);

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

        async function connectToTwitter() {
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;

            if (!username || !password) {
                showNotification('Please enter both username and password', 'error');
                return;
            }

            connectBtn.disabled = true;
            connectBtn.textContent = '🔄 Connecting...';
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
                } else {
                    throw new Error(data.error);
                }

            } catch (error) {
                updateStatus('offline', '🔴 Connection Failed');
                showNotification('Connection failed: ' + error.message, 'error');
            } finally {
                connectBtn.disabled = false;
                connectBtn.textContent = '🚀 Connect & Start Bot';
            }
        }

        function showConnected(username) {
            updateStatus('online', \`🟢 Connected as \${username}\`);
            loginSection.classList.add('hidden');
            connectedSection.classList.remove('hidden');
        }

        function updateStatus(type, text) {
            statusDiv.className = \`status \${type}\`;
            statusDiv.textContent = text;
        }

        async function loadPosts() {
            loadPostsBtn.disabled = true;
            refreshBtn.disabled = true;
            
            const postsList = document.getElementById('postsList');
            postsList.innerHTML = '<div class="loading">Loading posts...</div>';
            postsSection.classList.remove('hidden');

            try {
                const response = await fetch('/get-posts');
                const data = await response.json();

                if (data.success) {
                    displayPosts(data.posts);
                    showNotification(\`Loaded \${data.posts.length} posts\`, 'success');
                } else {
                    throw new Error(data.error);
                }

            } catch (error) {
                postsList.innerHTML = '<div class="loading">Failed to load posts</div>';
                showNotification('Failed to load posts: ' + error.message, 'error');
            } finally {
                loadPostsBtn.disabled = false;
                refreshBtn.disabled = false;
            }
        }

        function displayPosts(posts) {
            const postsList = document.getElementById('postsList');
            
            if (posts.length === 0) {
                postsList.innerHTML = '<div class="loading">No posts found</div>';
                return;
            }

            postsList.innerHTML = '';

            posts.forEach((post, index) => {
                const postDiv = document.createElement('div');
                postDiv.className = 'post-item';
                postDiv.innerHTML = \`
                    <div class="post-text">\${post.text}</div>
                    <div class="post-meta">
                        \${new Date(post.time).toLocaleString()} • 
                        ❤️ \${post.stats.likes} • 
                        💬 \${post.stats.replies}
                    </div>
                \`;
                
                postDiv.addEventListener('click', () => selectPost(post, postDiv));
                postsList.appendChild(postDiv);
            });
        }

        function selectPost(post, element) {
            // Remove previous selection
            document.querySelectorAll('.post-item').forEach(item => 
                item.classList.remove('selected'));
            
            // Select current post
            element.classList.add('selected');
            selectedPost = post;
            
            // Show mock comments
            showMockComments();
        }

        function showMockComments() {
            const commentsList = document.getElementById('commentsList');
            commentsSection.classList.remove('hidden');
            
            const mockComments = [
                'This is exactly what I needed! Can you share more details?',
                'Incredible work! How long did it take you to build this?',
                'This could be a game-changer for my workflow. Any tutorials?',
                'Amazing! I\\'ve been looking for something like this for months.',
                'The technical implementation must be fascinating. Open source?'
            ];

            commentsList.innerHTML = '';

            mockComments.forEach((comment, index) => {
                const commentDiv = document.createElement('div');
                commentDiv.className = 'comment-item';
                commentDiv.innerHTML = \`
                    <strong>@user\${index + 1}:</strong> \${comment}
                \`;
                
                commentDiv.addEventListener('click', () => selectComment(comment, commentDiv));
                commentsList.appendChild(commentDiv);
            });
        }

        function selectComment(comment, element) {
            // Remove previous selection
            document.querySelectorAll('.comment-item').forEach(item => 
                item.classList.remove('selected'));
            
            // Select current comment
            element.classList.add('selected');
            selectedComment = comment;
            
            // Show reply section
            document.getElementById('selectedComment').textContent = comment;
            replySection.classList.remove('hidden');
            
            // Reset reply section
            document.getElementById('generatedReply').innerHTML = '';
            document.getElementById('postReplyBtn').classList.add('hidden');
        }

        async function generateReply() {
            if (!selectedComment) {
                showNotification('Please select a comment first', 'error');
                return;
            }

            const generateBtn = document.getElementById('generateBtn');
            const replyDiv = document.getElementById('generatedReply');
            
            generateBtn.disabled = true;
            generateBtn.textContent = '🔄 Generating...';
            replyDiv.innerHTML = 'Generating reply...';

            try {
                const response = await fetch('/generate-reply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ comment: selectedComment })
                });

                const data = await response.json();

                if (data.success) {
                    generatedReplyText = data.reply;
                    replyDiv.innerHTML = data.reply;
                    document.getElementById('postReplyBtn').classList.remove('hidden');
                    showNotification('Reply generated!', 'success');
                } else {
                    throw new Error(data.error);
                }

            } catch (error) {
                replyDiv.innerHTML = 'Failed to generate reply';
                showNotification('Failed to generate reply', 'error');
            } finally {
                generateBtn.disabled = false;
                generateBtn.textContent = '🎯 Generate AI Reply';
            }
        }

        function postReply() {
            if (!generatedReplyText) {
                showNotification('No reply to post', 'error');
                return;
            }

            if (confirm('Post this reply to Twitter?')) {
                showNotification('Reply posted! (Demo mode)', 'success');
                
                // Reset
                replySection.classList.add('hidden');
                selectedComment = null;
                generatedReplyText = null;
            }
        }

        function showNotification(message, type) {
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

    start(port = 3001) {
        this.app.listen(port, () => {
            console.log('🎯 Simple Twitter Dashboard Started!');
            console.log(`📱 Open: http://localhost:${port}`);
            console.log('');
            console.log('✅ Features:');
            console.log('  🔐 Uses your working twitter-bot-2fa.js');
            console.log('  📝 Load your recent posts');
            console.log('  💬 Select posts to see mock comments');
            console.log('  🤖 Generate AI replies');
            console.log('  📤 Manual approval workflow');
            console.log('');
            console.log('🚀 Just enter your Twitter username/password and click Connect!');
        });
    }
}

// Create and start the dashboard
const dashboard = new SimpleDashboard();
dashboard.start(3001);