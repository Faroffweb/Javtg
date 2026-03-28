// handlers.js
const { addToQueue, processNextInQueue } = require('./queue');
const { sendProgress, escapeHtml, scheduleDelete } = require('./utils');
const { fetchSearch, fetchPosterUrl, downloadImageBytes } = require('./scraper');
const { showIdolMovies, showActressList, searchAndShowActress } = require('./tagCommands');
const { processTask } = require('./task');
const config = require('./config');

async function handleText(ctx, query) {
    // Delete previous progress/result message for this chat (if any)
    try {
        if (ctx.session?.progressMessage) {
            const pm = ctx.session.progressMessage;
            if (pm.chatId && pm.messageId) {
                await ctx.telegram.deleteMessage(pm.chatId, pm.messageId).catch(() => {});
            }
            delete ctx.session.progressMessage;
        }
    } catch (e) {
        console.error('Failed to delete previous progress message:', e.message);
    }

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
    // Delete previous progress/result message for this chat (if any)
    try {
        if (ctx.session?.progressMessage) {
            const pm = ctx.session.progressMessage;
            if (pm.chatId && pm.messageId) {
                await ctx.telegram.deleteMessage(pm.chatId, pm.messageId).catch(() => {});
            }
            delete ctx.session.progressMessage;
        }
    } catch (e) {
        console.error('Failed to delete previous progress message:', e.message);
    }

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
            // Send poster preview to the user's chat before starting channel upload
            try {
                const posterUrl = await fetchPosterUrl(sel.link);
                if (posterUrl) {
                    const buf = await downloadImageBytes(posterUrl);
                    if (buf) {
                        const sent = await ctx.telegram.sendPhoto(ctx.chat.id, { source: buf }, {
                            caption: `🔎 Preview: <code>${sel.code || sel.dvdId}</code> - ${escapeHtml(sel.title || '')}`,
                            parse_mode: 'HTML'
                        });
                        if (sent && sent.message_id) scheduleDelete(ctx.telegram, sent.chat.id || ctx.chat.id, sent.message_id);
                    }
                }
            } catch (e) {
                console.error('Failed to send poster preview (select_):', e.message || e);
            }

            await ctx.editMessageText(`✅ Selected: <code>${sel.code || sel.dvdId}</code>\n\nFetching details...`, { parse_mode: 'HTML' });
            await processTask(ctx, null, sel.link, sel.title);
        }
    }
}

async function handleActressSelect(ctx) {
    await ctx.answerCbQuery();
    const data = ctx.callbackQuery.data;
    
    // Support both actress and studio selection callbacks
    if (data.startsWith('selectactress_') || data.startsWith('selectstudio_')) {
        const idx = parseInt(data.split('_')[1]);
        const movies = ctx.session?.tagResults || [];
        if (idx >= 0 && idx < movies.length) {
            const sel = movies[idx];
            // Send poster image to the user chat as a preview (best-effort)
            try {
                const posterUrl = await fetchPosterUrl(sel.link);
                if (posterUrl) {
                    const buf = await downloadImageBytes(posterUrl);
                    if (buf) {
                        const sent = await ctx.telegram.sendPhoto(ctx.chat.id, { source: buf }, {
                            caption: `🔎 Preview: <code>${sel.code || sel.dvdId}</code> - ${escapeHtml(sel.title || '')}`,
                            parse_mode: 'HTML'
                        });
                        if (sent && sent.message_id) scheduleDelete(ctx.telegram, sent.chat.id || ctx.chat.id, sent.message_id);
                    }
                }
            } catch (e) {
                console.error('Failed to send poster preview:', e.message || e);
            }

            await ctx.editMessageText(`🔍 Searching: <code>${sel.code || sel.dvdId}</code>`, { parse_mode: 'HTML' });
            await handleSearch(ctx, sel.code || sel.dvdId);
        }
    }
    else if (data.startsWith('actresspage_')) {
        const page = parseInt(data.split('_')[1]);
        const idol = ctx.session?.currentIdol;
        if (!idol) {
            await ctx.reply('⚠️ Idol data lost. Please run /actress <name> again.');
            return;
        }
        await showIdolMovies(ctx, idol, page);
    }
    else if (data.startsWith('actresslistpage_')) {
        const page = parseInt(data.split('_')[1]);
        await showActressList(ctx, page);
    }
    else if (data.startsWith('actresslistselect_')) {
        const idx = parseInt(data.split('_')[1]);
        const list = ctx.session?.actressList || [];
        const name = list[idx];
        if (!name) {
            return ctx.reply('⚠️ Actress context lost. Please run /actresslist again.');
        }
        await searchAndShowActress(ctx, name);
    }
    else if (data === 'cancelactresslist') {
        if (ctx.session) {
            delete ctx.session.actressList;
            delete ctx.session.actressListPage;
        }
        await ctx.reply('❌ Actress list canceled.', { parse_mode: 'HTML' });
    }
    else if (data === 'cancelactress') {
        if (ctx.session) {
            delete ctx.session.tagResults;
            delete ctx.session.currentIdol;
            delete ctx.session.currentPage;
        }
        await ctx.reply('❌ Selection canceled. You can start again with /actress or /studio.', { parse_mode: 'HTML' });
    }
}

module.exports = {
    handleText,
    handleSearch,
    handleDirect,
    handleCallback,
    handleActressSelect
};