// commands.js
const { Markup } = require('telegraf');
const { escapeHtml } = require('./utils');
const { getUserQueue, getQueueStats } = require('./queue');
const config = require('./config');

async function startCommand(ctx) {
    const isAdmin = config.ADMIN_IDS.includes(ctx.from.id);
    // ✅ FIXED: Use <code> tags instead of <query> and <url>
    const welcome = `🎬 <b>JAV Database Bot</b>\n\n` +
        `Send a JAV ID (e.g. <code>SONE-763</code>) or title to search.\n\n` +
        `<b>Commands:</b>\n` +
        `/start - This message\n` +
        `/search <code>&lt;query&gt;</code> - Search movies\n` +
        `/direct <code>&lt;url&gt;</code> - Fetch from URL\n` +
        `/queue - View your queue status\n` +
        `/stats - Bot statistics ${isAdmin ? '' : '(Admin only)'}`;
    await ctx.reply(welcome, { parse_mode: 'HTML' });
}

async function queueCommand(ctx) {
    const userId = ctx.from.id;
    const userQueue = getUserQueue(userId);
    const status = userQueue.status === 'idle' ? '✅ Idle' : '⏳ Processing';
    const queueLength = userQueue.queue.length;
    const current = userQueue.current ? userQueue.current.query || userQueue.current.link : 'None';
    
    await ctx.reply(
        `📋 <b>Your Queue Status</b>\n\n` +
        `Status: ${status}\n` +
        `Current: ${current}\n` +
        `Queued: ${queueLength} task(s)`,
        { parse_mode: 'HTML' }
    );
}

async function statsCommand(ctx) {
    if (!config.ADMIN_IDS.includes(ctx.from.id)) {
        return ctx.reply('❌ Admin only command', { parse_mode: 'HTML' });
    }
    
    const queueStats = getQueueStats();
    const stats = {
        uptime: process.uptime(),
        memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        channel: config.CHANNEL_ID,
        admins: config.ADMIN_IDS.length,
        ...queueStats
    };
    
    await ctx.reply(
        `📊 <b>Bot Statistics</b>\n\n` +
        `⏱ Uptime: ${(stats.uptime / 3600).toFixed(2)}h\n` +
        `💾 Memory: ${stats.memory}MB\n` +
        `📢 Channel: ${stats.channel}\n` +
        `👥 Users: ${stats.users}\n` +
        `⚡ Processing: ${stats.processing}\n` +
        `📋 Queued: ${stats.queued}`,
        { parse_mode: 'HTML' }
    );
}

async function searchCommand(ctx) {
    const query = ctx.message.text.replace('/search', '').trim();
    if (!query) return ctx.reply('❌ Usage: /search <code>SONE-763</code>', { parse_mode: 'HTML' });
    return query;
}

async function directCommand(ctx) {
    const url = ctx.message.text.replace('/direct', '').trim();
    if (!url || !url.startsWith('http')) {
        await ctx.reply('❌ Usage: /direct <code>&lt;url&gt;</code>', { parse_mode: 'HTML' });
        return null;
    }
    return url;
}

module.exports = {
    startCommand,
    queueCommand,
    statsCommand,
    searchCommand,
    directCommand
};