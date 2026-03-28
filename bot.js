// ============================================================================
// DUMMY HTTP SERVER (for Render.com port binding)
// ============================================================================

const http = require('http');

// Only start HTTP server if PORT env var exists (Render)
if (process.env.PORT) {
    const server = http.createServer((req, res) => {
        // Health check endpoint
        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
        }
        // Root endpoint
        else if (req.url === '/') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('JAV Bot is running 🤖');
        }
        // 404 for everything else
        else {
            res.writeHead(404);
            res.end('Not Found');
        }
    });

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`🌐 Health server listening on port ${PORT}`);
    });
}
// bot.js
const { Telegraf, session, Markup } = require('telegraf');
const config = require('./config');
const { startCommand, searchCommand, directCommand, queueCommand, statsCommand } = require('./commands');
const { tagsCommand, tagSearchCommand, actressCommand, studioCommand } = require('./tagCommands');
const { handleText, handleSearch, handleDirect, handleCallback, handleActressSelect } = require('./handlers');

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
bot.command('actress', actressCommand);
bot.command('studio', studioCommand);

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
    // Actress movie selection
    else if (data.startsWith('selectactress_')) {
        await handleActressSelect(ctx);
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
