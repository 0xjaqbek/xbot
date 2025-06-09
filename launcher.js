// launcher.js - One-click setup and launch script
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

class BotLauncher {
    constructor() {
        this.projectDir = process.cwd();
        this.requiredFiles = [
            'twitter-bot-2fa.js',
            'bot-server.js',
            'dashboard.html',
            'package.json'
        ];
    }

    async launch() {
        console.log('🚀 Twitter Bot Dashboard Launcher');
        console.log('=================================\n');

        try {
            // Check if files exist
            await this.checkRequiredFiles();
            
            // Check if dependencies are installed
            await this.checkDependencies();
            
            // Start the dashboard
            await this.startDashboard();
            
        } catch (error) {
            console.error('❌ Launch failed:', error.message);
            console.log('\n📋 Setup Instructions:');
            this.showSetupInstructions();
        }
    }

    checkRequiredFiles() {
        console.log('📁 Checking required files...');
        
        const missingFiles = this.requiredFiles.filter(file => 
            !fs.existsSync(path.join(this.projectDir, file))
        );

        if (missingFiles.length > 0) {
            throw new Error(`Missing files: ${missingFiles.join(', ')}`);
        }

        console.log('✅ All required files found');
    }

    async checkDependencies() {
        console.log('📦 Checking dependencies...');
        
        if (!fs.existsSync(path.join(this.projectDir, 'node_modules'))) {
            console.log('📦 Installing dependencies...');
            await this.runCommand('npm install');
            console.log('✅ Dependencies installed');
        } else {
            console.log('✅ Dependencies already installed');
        }

        // Check if Playwright browser is installed
        try {
            await this.runCommand('npx playwright install chromium --dry-run');
            console.log('✅ Playwright browser ready');
        } catch (error) {
            console.log('🌐 Installing Playwright browser...');
            await this.runCommand('npx playwright install chromium');
            console.log('✅ Playwright browser installed');
        }
    }

    async startDashboard() {
        console.log('🌐 Starting dashboard server...\n');
        
        // Save dashboard.html if needed
        this.createDashboardFile();
        
        // Import and start the server
        const { BotServer } = require('./bot-server.js');
        const server = new BotServer();
        
        // Add some custom logging
        server.emitActivity = (type, title, detail = '') => {
            const timestamp = new Date().toLocaleTimeString();
            console.log(`[${timestamp}] ${this.getIcon(type)} ${title}`);
            if (detail) console.log(`    ${detail}`);
            
            // Call original method
            server.io.emit('activity', { type, title, detail, timestamp: new Date() });
        };
        
        server.start(3000);
        
        // Open browser after a delay
        setTimeout(() => {
            this.openBrowser('http://localhost:3000');
        }, 2000);
    }

    createDashboardFile() {
        const dashboardPath = path.join(this.projectDir, 'dashboard.html');
        
        if (!fs.existsSync(dashboardPath)) {
            console.log('📄 Creating dashboard.html...');
            // You would copy the dashboard HTML content here
            // For brevity, just showing the concept
            fs.writeFileSync(dashboardPath, '<!-- Dashboard HTML content would go here -->');
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
                console.log('💡 Please open your browser and go to: http://localhost:3000');
            } else {
                console.log('🌐 Browser opened automatically');
            }
        });
    }

    getIcon(type) {
        const icons = {
            mention: '💬',
            reply: '✅',
            error: '❌',
            info: 'ℹ️',
            settings: '⚙️'
        };
        return icons[type] || 'ℹ️';
    }

    showSetupInstructions() {
        console.log(`
📋 SETUP INSTRUCTIONS:

1. Make sure you have these files in your project directory:
   ${this.requiredFiles.map(f => `   ✓ ${f}`).join('\n')}

2. Install dependencies:
   npm install

3. Install Playwright browser:
   npx playwright install chromium

4. Run the launcher again:
   node launcher.js

📁 Current directory: ${this.projectDir}

💡 Need help? Check the setup guide in the artifacts above.
`);
    }
}

// Quick setup helper
function quickSetup() {
    console.log('🛠️ Quick Setup Mode');
    console.log('==================\n');
    
    const packageJson = {
        "name": "twitter-bot-dashboard",
        "version": "1.0.0",
        "description": "Web dashboard for Twitter auto-reply bot",
        "main": "bot-server.js",
        "scripts": {
            "start": "node launcher.js",
            "server": "node bot-server.js",
            "setup": "npm install && npx playwright install chromium"
        },
        "dependencies": {
            "express": "^4.18.2",
            "socket.io": "^4.7.4",
            "playwright": "^1.40.0",
            "cors": "^2.8.5"
        },
        "keywords": ["twitter", "bot", "automation", "dashboard"],
        "license": "MIT"
    };
    
    // Create package.json if it doesn't exist
    if (!fs.existsSync('package.json')) {
        fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
        console.log('✅ Created package.json');
    }
    
    console.log('📦 Run these commands to complete setup:');
    console.log('   npm install');
    console.log('   npx playwright install chromium');
    console.log('   node launcher.js');
    console.log('\n💡 Or just run: npm run setup && node launcher.js');
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--setup') || args.includes('-s')) {
        quickSetup();
    } else {
        const launcher = new BotLauncher();
        launcher.launch();
    }
}

module.exports = { BotLauncher };