// bot.js
const { Telegraf, session, Markup } = require('telegraf');
const config = require('./config');
const { startCommand, searchCommand, directCommand, queueCommand, statsCommand } = require('./commands');
const { tagsCommand, tagSearchCommand } = require('./tagCommands');
const { handleText, handleSearch, handleDirect, handleCallback } = require('./handlers');

// Validate configuration
config.validate();

// Initialize bot with session
const bot = new Telegraf(config.BOT_TOKEN);
bot.use(session());

// ============================================================================
// COMMANDS
// ============================================================================

bot.start(startCommand);
bot.command('queue', queueCommand);
bot.command('stats', statsCommand);
bot.command('tags', tagsCommand);

// Search command
bot.command('search', async (ctx) => {
    const query = await searchCommand(ctx);
    if (query) await handleSearch(ctx, query);
});

// Direct command
bot.command('direct', async (ctx) => {
    const url = await directCommand(ctx);
    if (url) await handleDirect(ctx, url);
});

// Text messages (non-command)
bot.on('text', async (ctx) => {
    const txt = ctx.message.text.trim();
    if (txt.startsWith('/')) return;
    await handleText(ctx, txt);
});

// ============================================================================
// CALLBACK QUERIES (Inline Buttons)
// ============================================================================

bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    
    // Tag search callbacks
    if (data.startsWith('tagsearch_')) {
        await ctx.answerCbQuery();
        const [, category, tagName] = data.split('_');
        await tagSearchCommand(ctx, category, tagName);
    }
    // Other callbacks (select_, refresh_, etc.)
    else {
        await handleCallback(ctx);
    }
});

// ============================================================================
// START BOT
// ============================================================================

async function main() {
    console.log('🚀 Starting JAV Bot...');
    await bot.launch();
    console.log('✅ Bot is running! Press Ctrl+C to stop');
    
    // Graceful shutdown
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch(console.error);