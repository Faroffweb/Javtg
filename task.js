// task.js
const { sendProgress } = require('./utils');
const { fetchSearch, fetchMovieMetadata, fetchPosterUrl, fetchPreviewImages } = require('./scraper');
const { uploadToChannel } = require('./post');
const { completeTask, processNextInQueue, getUserQueue } = require('./queue');
const { escapeHtml } = require('./utils');
const config = require('./config');

async function processTask(ctx, query, link = null, title = null) {
    const userId = ctx.from.id;
    const userQueue = getUserQueue(userId);
    
    try {
        await sendProgress(ctx, 'search', 'Searching...');
        let results;
        if (link) {
            results = [{ link, title }];
        } else {
            results = await fetchSearch(query);
        }
        
        if (!results || results.length === 0) {
            await sendProgress(ctx, 'done', '❌ No results found');
            completeTask(userId);
            return;
        }
        
        const selected = link ? results[0] : results[0];
        
        await sendProgress(ctx, 'fetching', 'Fetching movie details...');
        const meta = await fetchMovieMetadata(selected.link);
        
        if (!meta || !meta.title) {
            await sendProgress(ctx, 'done', '❌ Failed to fetch details');
            completeTask(userId);
            return;
        }
        
        await sendProgress(ctx, 'downloading', 'Downloading images...');
        const posterUrl = await fetchPosterUrl(selected.link);
        const previews = await fetchPreviewImages(selected.link, 20);
        
        await sendProgress(ctx, 'uploading', `Uploading to channel (${config.CHANNEL_ID})...`);
        
        // ✅ FIXED: Use ctx.telegram instead of ctx.bot
        await uploadToChannel(ctx.telegram, config.CHANNEL_ID, meta, selected, posterUrl, previews);
        
        await sendProgress(ctx, 'done', 
            `✅ <b>Post Complete!</b>\n\n` +
            `🎬 ${escapeHtml(meta.title)}\n` +
            `🆔 <code>${meta.dvdId || 'N/A'}</code>\n` +
            `📸 ${previews.length + 1} images posted to channel`
        );
        
        completeTask(userId);
        const nextTask = processNextInQueue(userId);
        if (nextTask) {
            await sendProgress(ctx, 'search', `📋 Processing next in queue (${userQueue.queue.length + 1} remaining)...`);
            await processTask(ctx, nextTask.query, nextTask.link, nextTask.title);
        }
        
    } catch (e) {
        console.error('Task processing error:', e.message);
        await sendProgress(ctx, 'done', `❌ Error: ${e.message.slice(0, 100)}`);
        completeTask(userId);
    }
}

module.exports = {
    processTask
};