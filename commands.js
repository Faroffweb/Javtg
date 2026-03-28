// commands.js
const { Markup } = require('telegraf');
const { escapeHtml, scheduleDelete } = require('./utils');
const { getUserQueue, getQueueStats } = require('./queue');
const config = require('./config');
const { fetchSearch, fetchMovieMetadata } = require('./scraper');

async function startCommand(ctx) {
    const isAdmin = config.ADMIN_IDS.includes(ctx.from.id);
    // ✅ FIXED: Use <code> tags instead of <query> and <url>
    const welcome = `🎬 <b>JAV Database Bot</b>\n\n` +
        `Send a JAV ID (e.g. <code>SONE-763</code>) or title to search.\n\n` +
        `<b>Commands:</b>\n` +
        `/start - This message\n` +
        `/search <code>&lt;query&gt;</code> - Search movies\n` +
        `/direct <code>&lt;url&gt;</code> - Fetch from URL\n` +
        `/actress <code>&lt;name&gt;</code> - Search actresses\n` +
        `/tags - Browse tags\n` +
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

    const results = await fetchSearch(query);
    if (!results || results.length === 0) return ctx.reply('❌ No results found for your query.');

    const items = results.slice(0, 10);
    // fetch metadata to get DVD IDs
    for (let item of items) {
        try {
            const meta = await fetchMovieMetadata(item.link);
            item.code = meta.dvdId || meta.contentId || item.code;
        } catch (e) {
            // ignore per-item failures
        }
    }

    let text = `🔍 <b>Search results</b> for <i>${escapeHtml(query)}</i>\n\n`;
    items.forEach((it, i) => {
        text += `${i + 1}. <code>${it.code || 'Unknown'}</code> - ${escapeHtml(it.title || '')}\n`;
    });

    const keyboard = items.map((it, i) => [Markup.button.callback(String(it.code || 'Unknown'), `select_${i}`)]);

    // store into session for selection
    ctx.session = ctx.session || {};
    ctx.session.results = items;

    const sent = await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard }
    });
    if (sent && sent.message_id) scheduleDelete(ctx.telegram, sent.chat.id, sent.message_id);

    // returned null to indicate we've handled showing results (bot.js won't call handleSearch)
    return null;
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