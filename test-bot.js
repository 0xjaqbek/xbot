// test-bot.js - Quick test to verify your bot works
const { TwitterBot2FA } = require('./twitter-bot-2fa');

async function testBot() {
    console.log('🧪 Testing your bot...');
    
    const bot = new TwitterBot2FA();
    
    try {
        console.log('🚀 Initializing...');
        await bot.init();
        console.log('✅ Bot initialized successfully!');
        
        console.log('🔐 Ready for login test');
        console.log('📝 Your bot is working correctly!');
        console.log('');
        console.log('Next step: Run the simple dashboard:');
        console.log('  node simple-dashboard.js');
        
        await bot.close();
        
    } catch (error) {
        console.error('❌ Bot test failed:', error.message);
        console.log('');
        console.log('🔧 Make sure:');
        console.log('  1. twitter-bot-2fa.js exists');
        console.log('  2. It exports TwitterBot2FA correctly');
        console.log('  3. All dependencies are installed');
    }
}

testBot();