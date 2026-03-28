// commands.js
const { Markup } = require('telegraf');
const { escapeHtml, scheduleDelete } = require('./utils');
const { getUserQueue, getQueueStats } = require('./queue');
const config = require('./config');
const { fetchSearch, fetchMovieMetadata } = require('./scraper');
const { startAuto, stopAuto, autoStatus, getAutoSession } = require('./task');
const { getAllActresses } = require('./tags');
const { showActressList } = require('./tagCommands');

async function startCommand(ctx) {
    const isAdmin = config.ADMIN_IDS.includes(ctx.from.id);
    // ✅ FIXED: Use <code> tags instead of <query> and <url>
    const welcome = `🎬 <b>JAV Database Bot</b>\n\n` +
        `Send a JAV ID (e.g. <code>SONE-763</code>) or title to search.\n\n` +
        `<b>Commands:</b>\n` +
        `/start - This message\n` +
        `/help - This message (alias for start)\n` +
        `/search <code>&lt;query&gt;</code> - Search movies\n` +
        `/direct <code>&lt;url&gt;</code> - Fetch from URL\n` +
        `/actress <code>&lt;name&gt;</code> - Search actresses\n` +
        `/actresslist - Show stored actress names\n` +
        `/studio <code>&lt;name&gt;</code> - Search studios\n` +
        `/tags - Browse tags\n` +
        `/queue - View your queue status\n` +
        `/stats - Bot statistics ${isAdmin ? '' : '(Admin only)'}\n` +
        `/autostart <code>JUQ-001</code> [JUQ-100] [interval] - Start auto-sequential search/range\n` +
        `/autostop - Stop auto mode\n` +
        `/autostatus - Auto mode status\n` +
        `/autointerval <code>&lt;seconds&gt;</code> - Set auto search interval\n` +
        `/autodelete <code>&lt;seconds&gt;</code> - Set auto delete for bot messages`;
    await ctx.reply(welcome, { parse_mode: 'HTML' });
}

async function helpCommand(ctx) {
    return startCommand(ctx);
}

async function actressListCommand(ctx) {
    return await showActressList(ctx, 0);
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

async function actressListCommand(ctx) {
    const actresses = getAllActresses();
    if (actresses.length === 0) {
        return ctx.reply('❌ No actresses stored yet.', { parse_mode: 'HTML' });
    }

    const chunkSize = 100;
    for (let i = 0; i < actresses.length; i += chunkSize) {
        const chunk = actresses.slice(i, i + chunkSize);
        await ctx.reply(`👥 <b>Actress list (${i + 1}-${Math.min(i + chunkSize, actresses.length)} / ${actresses.length})</b>\n\n${chunk.join('\n')}`, { parse_mode: 'HTML' });
    }
    return null;
}

async function autoStartCommand(ctx) {
    const args = ctx.message.text.replace('/autostart', '').trim().split(/\s+/).filter(Boolean);
    if (!args[0]) {
        return ctx.reply('❌ Usage: /autostart <startCode> [endCode] [interval_seconds]', { parse_mode: 'HTML' });
    }

    const startCode = args[0];
    let endCode = null;
    let interval = null;

    if (args[1]) {
        const maybeNum = parseInt(args[1], 10);
        if (!Number.isNaN(maybeNum)) {
            interval = maybeNum;
        } else {
            endCode = args[1];
        }
    }

    if (args[2]) {
        const maybeNum = parseInt(args[2], 10);
        if (!Number.isNaN(maybeNum)) {
            interval = maybeNum;
        }
    }

    if (interval !== null && (Number.isNaN(interval) || interval <= 0)) {
        return ctx.reply('❌ Interval must be a positive number of seconds.', { parse_mode: 'HTML' });
    }

    // Persist interval for user session for /autointerval behavior
    ctx.session = ctx.session || {};
    if (interval !== null) {
        ctx.session.autoIntervalSeconds = interval;
    }

    await startAuto(ctx.from.id, startCode, ctx, interval || (ctx.session.autoIntervalSeconds || null), endCode);
}

async function autoStopCommand(ctx) {
    const userId = ctx.from.id;
    const stopped = stopAuto(userId);
    if (stopped) {
        await ctx.reply('🛑 Auto-search stopped.', { parse_mode: 'HTML' });
    } else {
        await ctx.reply('⚠️ Auto-search was not running.', { parse_mode: 'HTML' });
    }
}

async function autoStatusCommand(ctx) {
    await autoStatus(ctx.from.id, ctx);
}

async function autoIntervalCommand(ctx) {
    const arg = ctx.message.text.replace('/autointerval', '').trim();
    const seconds = parseInt(arg, 10);
    if (!arg || Number.isNaN(seconds) || seconds <= 0) {
        return ctx.reply('❌ Usage: /autointerval <seconds> (example: /autointerval 30)', { parse_mode: 'HTML' });
    }
    ctx.session = ctx.session || {};
    ctx.session.autoIntervalSeconds = seconds;

    const session = getAutoSession(ctx.from.id);
    if (session && session.active) {
        session.intervalMs = seconds * 1000;
    }

    return ctx.reply(`✅ Auto interval set to ${seconds}s.`, { parse_mode: 'HTML' });
}

async function autoDeleteCommand(ctx) {
    const arg = ctx.message.text.replace('/autodelete', '').trim();
    const seconds = parseInt(arg, 10);
    if (!arg || Number.isNaN(seconds) || seconds <= 0) {
        return ctx.reply('❌ Usage: /autodelete <seconds> (example: /autodelete 60)', { parse_mode: 'HTML' });
    }
    ctx.session = ctx.session || {};
    ctx.session.autoDeleteSeconds = seconds;

    return ctx.reply(`✅ Auto-delete timeout set to ${seconds}s for your next progress messages.`, { parse_mode: 'HTML' });
}

module.exports = {
    startCommand,
    helpCommand,
    queueCommand,
    statsCommand,
    searchCommand,
    directCommand,
    actressListCommand,
    autoStartCommand,
    autoStopCommand,
    autoStatusCommand,
    autoIntervalCommand,
    autoDeleteCommand
};