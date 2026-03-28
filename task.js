// task.js
const { sendProgress } = require('./utils');
const { fetchSearch, fetchMovieMetadata, fetchPosterUrl, fetchPreviewImages } = require('./scraper');
const { uploadToChannel } = require('./post');
const { addToQueue, completeTask, processNextInQueue, getUserQueue } = require('./queue');
const { escapeHtml } = require('./utils');
const config = require('./config');

const DEFAULT_AUTO_INTERVAL_MS = 30 * 1000;
const AUTO_RETRY_DELAY_MS = 5 * 1000;
const AUTO_MAX_RETRIES = 1;

const autoSessions = new Map();

function parseAutoCode(code) {
    const normalized = String(code).trim().toUpperCase();
    const match = normalized.match(/^([A-Z]+[-_]?)?(\d+)$/);
    if (!match) return null;

    const prefix = match[1] || '';
    const digits = match[2];
    return {
        prefix,
        number: parseInt(digits, 10),
        width: digits.length,
        code: `${prefix}${digits}`
    };
}

function formatAutoCode(prefix, number, width) {
    const padded = String(number).padStart(width, '0');
    return `${prefix}${padded}`;
}

function getAutoSession(userId) {
    return autoSessions.get(userId);
}

async function scheduleAutoNext(ctx, userId, success) {
    const session = autoSessions.get(userId);
    if (!session || !session.active) return;

    if (success) {
        session.retryCount = 0;
        session.number += 1;
    } else {
        session.retryCount += 1;
        if (session.retryCount > AUTO_MAX_RETRIES) {
            session.retryCount = 0;
            session.number += 1;
        }
    }

    // Determine next query
    const nextQuery = formatAutoCode(session.prefix, session.number, session.width);
    const intervalMs = session.intervalMs || DEFAULT_AUTO_INTERVAL_MS;
    const delay = success || session.retryCount === 0 ? intervalMs : AUTO_RETRY_DELAY_MS;

    if (session.timer) {
        clearTimeout(session.timer);
        session.timer = null;
    }

    // Stop if we have reached endNumber (after counting this failed/success transition)
    if (session.endNumber && session.number > session.endNumber) {
        await ctx.reply(`✅ Auto-search range complete at <code>${formatAutoCode(session.prefix, session.endNumber, session.width)}</code>.`, { parse_mode: 'HTML' });
        stopAuto(userId);
        return;
    }

    session.timer = setTimeout(async () => {
        if (!session.active) return;
        try {
            await autoSearchEnqueue(ctx, userId, nextQuery);
        } catch (e) {
            console.error('Auto search enqueue failed:', e.message || e);
        }
    }, delay);
}

async function autoSearchEnqueue(ctx, userId, query) {
    const userQueue = getUserQueue(userId);
    const task = { query, type: 'search', auto: true };
    const queuePos = addToQueue(userId, task);

    if (userQueue.status === 'idle') {
        // Start processing immediately
        await sendProgress(ctx, 'search', `🤖 Auto search: ${query}`);
        const next = processNextInQueue(userId);
        if (next) {
            await processTask(ctx, next);
        }
    } else {
        await ctx.reply(`⏳ Auto queued: ${query} (position: ${queuePos})`, { parse_mode: 'HTML' });
    }
}

async function startAuto(userId, code, ctx, intervalSeconds = null, endCode = null) {
    const parsed = parseAutoCode(code);
    if (!parsed) {
        await ctx.reply('❌ Invalid code format. Use like <code>JUQ-001</code>.', { parse_mode: 'HTML' });
        return false;
    }

    let endSession = null;
    if (endCode) {
        const parsedEnd = parseAutoCode(endCode);
        if (!parsedEnd) {
            await ctx.reply('❌ Invalid end code format. Use like <code>JUQ-050</code>.', { parse_mode: 'HTML' });
            return false;
        }
        if (parsedEnd.prefix !== parsed.prefix) {
            await ctx.reply('❌ Start and end codes must share the same prefix.', { parse_mode: 'HTML' });
            return false;
        }
        if (parsedEnd.number < parsed.number) {
            await ctx.reply('❌ End code must be greater than or equal to start code.', { parse_mode: 'HTML' });
            return false;
        }
        endSession = parsedEnd.number;
    }

    stopAuto(userId); // reset state

    let intervalMs = DEFAULT_AUTO_INTERVAL_MS;
    if (intervalSeconds !== null && !Number.isNaN(intervalSeconds) && intervalSeconds > 0) {
        intervalMs = intervalSeconds * 1000;
    }

    autoSessions.set(userId, {
        active: true,
        prefix: parsed.prefix,
        number: parsed.number,
        width: parsed.width,
        retryCount: 0,
        timer: null,
        intervalMs,
        endNumber: endSession
    });

    let startedFrom = formatAutoCode(parsed.prefix, parsed.number, parsed.width);
    let rangeNote = endSession ? ` until ${formatAutoCode(parsed.prefix, endSession, parsed.width)}` : '';
    await ctx.reply(`✅ Auto-search started from <code>${startedFrom}</code>${rangeNote} with interval ${Math.round(intervalMs / 1000)}s.`, { parse_mode: 'HTML' });
    await autoSearchEnqueue(ctx, userId, startedFrom);
    return true;
}

function stopAuto(userId) {
    const session = autoSessions.get(userId);
    if (!session) return false;
    session.active = false;
    if (session.timer) {
        clearTimeout(session.timer);
        session.timer = null;
    }
    autoSessions.delete(userId);
    return true;
}

async function autoStatus(userId, ctx) {
    const session = autoSessions.get(userId);
    if (!session || !session.active) {
        await ctx.reply('⛔ Auto-search is not running for you. Use /autostart <code>JUQ-001</code>.', { parse_mode: 'HTML' });
        return;
    }
    const intervalSeconds = Math.round((session.intervalMs || DEFAULT_AUTO_INTERVAL_MS) / 1000);
    const endText = session.endNumber ? ` until <code>${formatAutoCode(session.prefix, session.endNumber, session.width)}</code>` : '';
    await ctx.reply(`🤖 Auto-search is active. Next code: <code>${formatAutoCode(session.prefix, session.number, session.width)}</code>${endText}. Interval: ${intervalSeconds}s.`, { parse_mode: 'HTML' });
}

async function processTask(ctx, taskOrQuery, link = null, title = null) {
    // Support object task and legacy call with query string
    let task = null;
    if (typeof taskOrQuery === 'object' && taskOrQuery !== null) {
        task = taskOrQuery;
    } else {
        task = { query: taskOrQuery, link, title, type: 'search', auto: false };
    }

    const userId = ctx.from.id;
    const userQueue = getUserQueue(userId);
    let success = false;
    let selected = null;

    try {
        await sendProgress(ctx, 'search', 'Searching...');
        let results;

        if (task.link) {
            results = [{ link: task.link, title: task.title }];
        } else {
            results = await fetchSearch(task.query);
        }

        if (!results || results.length === 0) {
            await sendProgress(ctx, 'done', `❌ No results found for <code>${task.query || 'N/A'}</code>.`);
            success = false;
        } else {
            selected = results[0];
            await sendProgress(ctx, 'fetching', 'Fetching movie details...');
            const meta = await fetchMovieMetadata(selected.link);

            if (!meta || !meta.title) {
                await sendProgress(ctx, 'done', `❌ Failed to fetch details for <code>${task.query || 'N/A'}</code>.`);
                success = false;
            } else {
                await sendProgress(ctx, 'downloading', 'Downloading images...');
                const posterUrl = await fetchPosterUrl(selected.link);
                const previews = await fetchPreviewImages(selected.link, 20);

                await sendProgress(ctx, 'uploading', `Uploading to channel (${config.CHANNEL_ID})...`);
                await uploadToChannel(ctx.telegram, config.CHANNEL_ID, meta, selected, posterUrl, previews);

                await sendProgress(ctx, 'done',
                    `✅ <b>Post Complete!</b>\n\n` +
                    `🎬 ${escapeHtml(meta.title)}\n` +
                    `🆔 <code>${meta.dvdId || 'N/A'}</code>\n` +
                    `📸 ${previews.length + 1} images posted to channel`
                );

                success = true;
            }
        }
    } catch (e) {
        console.error('Task processing error:', e.message || e);
        await sendProgress(ctx, 'done', `❌ Error: ${String(e.message || e).slice(0, 100)}`);
        success = false;
    }

    // Auto mode follow-up
    if (task && task.auto && getAutoSession(userId) && getAutoSession(userId).active) {
        await scheduleAutoNext(ctx, userId, success);
    }

    completeTask(userId);

    const nextTask = processNextInQueue(userId);
    if (nextTask) {
        await sendProgress(ctx, 'search', `📋 Processing next in queue (${userQueue.queue.length} remaining)...`);
        await processTask(ctx, nextTask);
    }
}

module.exports = {
    processTask,
    startAuto,
    stopAuto,
    autoStatus,
    getAutoSession
};