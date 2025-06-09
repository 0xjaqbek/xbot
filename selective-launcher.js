// selective-launcher.js - One-click setup for selective reply bot
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

class SelectiveBotLauncher {
    constructor() {
        this.projectDir = process.cwd();
        this.requiredFiles = [
            'twitter-bot-2fa.js',
            'selective-bot-server.js',
            'selective-dashboard.html'
        ];
    }

    async launch() {
        console.log('🎯 Selective Reply Bot Launcher');
        console.log('===============================\n');

        try {
            // Check setup
            await this.checkSetup();
            
            // Start the selective dashboard
            await this.startSelectiveDashboard();
            
        } catch (error) {
            console.error('❌ Launch failed:', error.message);
            console.log('\n📋 Setup Instructions:');
            this.showSetupInstructions();
        }
    }

    async checkSetup() {
        console.log('📁 Checking files...');
        
        // Check required files
        const missingFiles = this.requiredFiles.filter(file => 
            !fs.existsSync(path.join(this.projectDir, file))
        );

        if (missingFiles.length > 0) {
            throw new Error(`Missing files: ${missingFiles.join(', ')}`);
        }

        console.log('✅ All required files found');

        // Check dependencies
        console.log('📦 Checking dependencies...');
        
        if (!fs.existsSync(path.join(this.projectDir, 'node_modules'))) {
            console.log('📦 Installing dependencies...');
            await this.runCommand('npm install express socket.io cors playwright');
            console.log('✅ Dependencies installed');
        } else {
            console.log('✅ Dependencies already installed');
        }

        // Check Playwright browser
        try {
            await this.runCommand('npx playwright install chromium --dry-run');
            console.log('✅ Playwright browser ready');
        } catch (error) {
            console.log('🌐 Installing Playwright browser...');
            await this.runCommand('npx playwright install chromium');
            console.log('✅ Playwright browser installed');
        }
    }

    async startSelectiveDashboard() {
        console.log('🎯 Starting Selective Reply Dashboard...\n');
        
        // Create the dashboard HTML file if needed
        this.createDashboardHTML();
        
        // Import and start the server
        try {
            const { SelectiveBotServer } = require('./selective-bot-server.js');
            const server = new SelectiveBotServer();
            
            // Start server
            server.start(3000);
            
            // Open browser after a delay
            setTimeout(() => {
                this.openBrowser('http://localhost:3000');
            }, 2000);
            
        } catch (error) {
            console.error('❌ Failed to start server:', error.message);
            throw error;
        }
    }

    createDashboardHTML() {
        const dashboardPath = path.join(this.projectDir, 'selective-dashboard.html');
        
        if (!fs.existsSync(dashboardPath)) {
            console.log('📄 Creating selective-dashboard.html...');
            
            // Read the dashboard content from the artifacts
            // In a real implementation, you'd copy the actual HTML content here
            const dashboardContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Selective Reply Dashboard</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 50px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
        }
        .message {
            background: rgba(255,255,255,0.1);
            padding: 30px;
            border-radius: 15px;
            max-width: 600px;
            margin: 0 auto;
        }
    </style>
</head>
<body>
    <div class="message">
        <h1>🎯 Selective Reply Dashboard</h1>
        <p>Please copy the HTML content from the first artifact to this file:</p>
        <p><strong>selective-dashboard.html</strong></p>
        <p>Then refresh this page to see your dashboard!</p>
    </div>
</body>
</html>`;
            
            fs.writeFileSync(dashboardPath, dashboardContent);
            console.log('✅ Dashboard HTML created (needs content from artifacts)');
        }
    }

    runCommand(command) {
        return new Promise((resolve, reject) => {
            exec(command, { cwd: this.projectDir }, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    openBrowser(url) {
        const start = process.platform === 'darwin' ? 'open' : 
                     process.platform === 'win32' ? 'start' : 'xdg-open';
        
        exec(`${start} ${url}`, (error) => {
            if (error) {
                console.log(`💡 Please open your browser and go to: ${url}`);
            } else {
                console.log('🌐 Browser opened automatically');
            }
        });
    }

    showSetupInstructions() {
        console.log(`
📋 SETUP INSTRUCTIONS:

1. Save these files in your project directory:
   ✓ twitter-bot-2fa.js (your existing working bot)
   ✓ selective-dashboard.html (from 1st artifact)
   ✓ selective-bot-server.js (from 2nd artifact)

2. Install dependencies:
   npm install express socket.io cors playwright

3. Install Playwright browser:
   npx playwright install chromium

4. Copy the dashboard HTML:
   - Open the first artifact (Selective Reply Dashboard)
   - Copy all the HTML content
   - Paste it into selective-dashboard.html

5. Run the launcher again:
   node selective-launcher.js

📁 Current directory: ${this.projectDir}

🎯 What you'll get:
   • Beautiful 3-panel dashboard
   • Browse your posts visually
   • Select specific comments to reply to
   • Generate AI responses with approval
   • Full manual control over every reply

💡 Need the HTML content? It's in the first artifact above!
`);
    }

    // Quick setup mode
    static quickSetup() {
        console.log('🛠️ Quick Setup Mode');
        console.log('==================\n');
        
        const packageJson = {
            "name": "selective-twitter-bot",
            "version": "1.0.0",
            "description": "Selective Twitter reply bot with manual control",
            "main": "selective-bot-server.js",
            "scripts": {
                "start": "node selective-launcher.js",
                "server": "node selective-bot-server.js",
                "setup": "npm install express socket.io cors playwright && npx playwright install chromium"
            },
            "dependencies": {
                "express": "^4.18.2",
                "socket.io": "^4.7.4",
                "cors": "^2.8.5",
                "playwright": "^1.40.0"
            },
            "keywords": ["twitter", "bot", "selective", "dashboard", "manual"],
            "license": "MIT"
        };
        
        // Create package.json if it doesn't exist
        if (!fs.existsSync('package.json')) {
            fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
            console.log('✅ Created package.json');
        }
        
        console.log('📦 Next steps:');
        console.log('1. npm run setup');
        console.log('2. Save the HTML content from artifacts to selective-dashboard.html');
        console.log('3. node selective-launcher.js');
        console.log('\n🎯 Features you\'ll get:');
        console.log('   • Browse your posts in a beautiful interface');
        console.log('   • See comments on each post');
        console.log('   • Select exactly which comments to reply to');
        console.log('   • Generate AI responses with full approval workflow');
        console.log('   • Edit responses before posting');
        console.log('   • Complete manual control over your engagement');
    }
}

// Helper function to create all necessary files
function createAllFiles() {
    console.log('📁 Creating all necessary files...\n');
    
    // Create package.json
    SelectiveBotLauncher.quickSetup();
    
    console.log('\n📄 File checklist:');
    console.log('   ✓ package.json - Created');
    console.log('   ⚠️ selective-dashboard.html - Needs HTML content from 1st artifact');
    console.log('   ⚠️ selective-bot-server.js - Needs JS content from 2nd artifact');
    console.log('   ✓ twitter-bot-2fa.js - Your existing file (should already exist)');
    console.log('   ✓ selective-launcher.js - This file');
    
    console.log('\n🎯 Copy the artifacts to complete setup!');
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--setup') || args.includes('-s')) {
        SelectiveBotLauncher.quickSetup();
    } else if (args.includes('--create') || args.includes('-c')) {
        createAllFiles();
    } else {
        const launcher = new SelectiveBotLauncher();
        launcher.launch().catch(console.error);
    }
}

module.exports = { SelectiveBotLauncher };