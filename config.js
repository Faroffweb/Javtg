// config.js
require('dotenv').config();

module.exports = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    CHANNEL_ID: process.env.CHANNEL_ID,
    ADMIN_IDS: process.env.ADMIN_IDS 
        ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim())) 
        : [],
    
    // Validate required config
    validate() {
        if (!this.BOT_TOKEN) {
            console.error('❌ Error: BOT_TOKEN not found in .env!');
            process.exit(1);
        }
        if (!this.CHANNEL_ID) {
            console.warn('⚠️ Warning: CHANNEL_ID not set in .env. Channel uploads will be disabled until set.');
        }
        console.log('✅ Configuration loaded successfully');
        console.log(`📢 Channel: ${this.CHANNEL_ID}`);
        console.log(`👥 Admins: ${this.ADMIN_IDS.length}`);
    }
};