// debug-dashboard.js - Force new content to bypass cache
const express = require('express');

const app = express();
app.use(express.json());

// Main page with cache-busting headers
app.get('/', (req, res) => {
    // Force no caching
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>DEBUG Twitter Dashboard</title>
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <style>
        body { 
            font-family: Arial, sans-serif; 
            background: #667eea; 
            color: white; 
            padding: 20px; 
            text-align: center;
        }
        .container {
            background: white;
            color: black;
            padding: 30px;
            border-radius: 15px;
            max-width: 600px;
            margin: 0 auto;
        }
        .form-group {
            margin: 15px 0;
            text-align: left;
        }
        .form-group label {
            display: block;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .form-group input {
            width: 100%;
            padding: 10px;
            border: 2px solid #ddd;
            border-radius: 5px;
            box-sizing: border-box;
        }
        .btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            margin: 10px;
        }
        .btn:hover {
            background: #5a67d8;
        }
        .status {
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            font-weight: bold;
        }
        .offline { background: #fee2e2; color: #dc2626; }
        .connecting { background: #fef3c7; color: #d97706; }
        .online { background: #dcfce7; color: #16a34a; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔧 DEBUG TWITTER DASHBOARD</h1>
        <p><strong>If you see this page, the new server is working!</strong></p>
        <p>Timestamp: ${new Date().toLocaleString()}</p>
        
        <div id="status" class="status offline">
            🔴 Not Connected
        </div>

        <h3>🔐 Connect to Twitter</h3>
        <p><strong>This should show USERNAME/PASSWORD fields, NOT an OAuth button!</strong></p>
        
        <div class="form-group">
            <label>Username:</label>
            <input type="text" id="username" placeholder="your-twitter-username">
        </div>
        
        <div class="form-group">
            <label>Password:</label>
            <input type="password" id="password" placeholder="your-twitter-password">
        </div>
        
        <button id="connectBtn" class="btn">🚀 CONNECT & START BOT</button>
        
        <hr style="margin: 30px 0;">
        
        <div style="background: #f0f0f0; padding: 20px; border-radius: 8px;">
            <h3>🔍 What do you see?</h3>
            <p>You should see:</p>
            <ul style="text-align: left;">
                <li>✅ Username input field</li>
                <li>✅ Password input field</li>
                <li>✅ "🚀 CONNECT & START BOT" button</li>
            </ul>
            <p><strong>You should NOT see:</strong></p>
            <ul style="text-align: left;">
                <li>❌ "Login to Twitter" OAuth button</li>
                <li>❌ Any OAuth/authorization flow</li>
                <li>❌ Client ID or redirect URI errors</li>
            </ul>
        </div>
        
        <div id="result" style="margin-top: 20px; padding: 15px; background: #f9f9f9; border-radius: 5px; display: none;">
            <h4>Test Result:</h4>
            <div id="resultText"></div>
        </div>
    </div>

    <script>
        // Add timestamp to show this is fresh content
        console.log('🔧 DEBUG Dashboard loaded at:', new Date());
        console.log('🔧 If you see OAuth buttons, you have caching issues!');
        
        document.getElementById('connectBtn').addEventListener('click', function() {
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            const resultDiv = document.getElementById('result');
            const resultText = document.getElementById('resultText');
            
            resultDiv.style.display = 'block';
            
            if (!username || !password) {
                resultText.innerHTML = '❌ Please enter both username and password';
                return;
            }
            
            resultText.innerHTML = \`
                ✅ Form working correctly!<br>
                Username: \${username}<br>
                Password: [hidden]<br>
                <em>This confirms the new dashboard is loaded.</em>
            \`;
            
            console.log('✅ New dashboard form is working!');
        });
        
        // Debug info
        console.log('🔧 Current URL:', window.location.href);
        console.log('🔧 Page title:', document.title);
    </script>
</body>
</html>
    `);
});

app.listen(3002, () => {
    console.log('🔧 DEBUG Dashboard started!');
    console.log('📱 Open: http://localhost:3002');
    console.log('');
    console.log('🎯 What you should see:');
    console.log('   ✅ "DEBUG TWITTER DASHBOARD" title');
    console.log('   ✅ Username and password input fields');
    console.log('   ✅ "🚀 CONNECT & START BOT" button');
    console.log('');
    console.log('❌ What you should NOT see:');
    console.log('   ❌ "Login to Twitter" OAuth button');
    console.log('   ❌ Any client ID or redirect errors');
    console.log('');
    console.log('🔍 This will help us confirm if caching is the issue!');
});