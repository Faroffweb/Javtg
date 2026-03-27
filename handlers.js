// handlers.js
const { addToQueue, processNextInQueue } = require('./queue');
const { sendProgress } = require('./utils');
const { fetchSearch } = require('./scraper');
const { processTask } = require('./task');
const config = require('./config');

async function handleText(ctx, query) {
    const userId = ctx.from.id;
    const queuePos = addToQueue(userId, { query, type: 'text' });
    
    if (queuePos === 1) {
        await sendProgress(ctx, 'search', `🔍 Searching: ${query}`);
        const task = processNextInQueue(userId);
        if (task) await processTask(ctx, task.query);
    } else {
        await ctx.reply(`📋 Added to queue (position: ${queuePos})\n⏳ Current task is processing...`, { parse_mode: 'HTML' });
    }
}

async function handleSearch(ctx, query) {
    const userId = ctx.from.id;
    const queuePos = addToQueue(userId, { query, type: 'search' });
    
    if (queuePos === 1) {
        await sendProgress(ctx, 'search', `🔍 Starting search: ${query}`);
        const task = processNextInQueue(userId);
        if (task) await processTask(ctx, task.query);
    } else {
        await ctx.reply(`📋 Added to queue (position: ${queuePos})\nYou'll be notified when processing starts.`, { parse_mode: 'HTML' });
    }
}

async function handleDirect(ctx, url) {
    const userId = ctx.from.id;
    const queuePos = addToQueue(userId, { link: url, type: 'direct' });
    
    if (queuePos === 1) {
        await sendProgress(ctx, 'fetching', `📥 Fetching from URL`);
        const task = processNextInQueue(userId);
        if (task) await processTask(ctx, null, task.link);
    } else {
        await ctx.reply(`📋 Added to queue (position: ${queuePos})`, { parse_mode: 'HTML' });
    }
}

async function handleCallback(ctx) {
    await ctx.answerCbQuery();
    const data = ctx.callbackQuery.data;
    
    if (data.startsWith('select_')) {
        const idx = parseInt(data.split('_')[1]);
        const results = ctx.session?.results || [];
        if (idx >= 0 && idx < results.length) {
            const sel = results[idx];
            await ctx.editMessageText(`✅ Selected: <code>${sel.code}</code>\n\nFetching details...`, { parse_mode: 'HTML' });
            await processTask(ctx, null, sel.link, sel.title);
        }
    }
}

module.exports = {
    handleText,
    handleSearch,
    handleDirect,
    handleCallback
};