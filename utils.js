// utils.js

// ✅ Define escapeHtml FIRST
const AUTO_DELETE_SECONDS = parseInt(process.env.AUTO_DELETE_SECONDS || '60', 10) || 60;
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatRuntime(runtime) {
    if (!runtime) return '';
    const match = runtime.match(/(\d+)/);
    if (!match) return runtime;
    const minutes = parseInt(match[1]);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    return `${mins}m`;
}

function formatHashtags(items, prefix = '') {
    if (!items) return '';
    return items.split(',')
        .map(g => g.trim())
        .filter(g => g)
        .map(g => {
            const tag = g.replace(/\s+/g, '').replace(/[^a-zA-Z0-9_]/g, '');
            return `${prefix}${tag}`;
        })
        .join(' ');
}

function formatHashtagFromCode(id) {
    if (!id) return null;
    const match = String(id).trim().toUpperCase().match(/^([A-Z]+)[-_]?(\d*)$/);
    return match ? `#${match[1]}` : null;
}

function formatHashtagFromActress(name) {
    if (!name) return null;
    const clean = String(name).trim()
        .replace(/\s+/g, '')
        .replace(/[^A-Za-z0-9_]/g, '')
        .toLowerCase();
    if (!clean) return null;
    return `#${clean}`;
}

function formatMessage(meta, selected) {
    const lines = [];
    const title = escapeHtml(meta.title || selected.title || 'Unknown');
    
    lines.push(`🎬 <b>${title}</b>`);
    lines.push('');
    
    if (meta.dvdId || meta.contentId) {
        const ids = [];
        if (meta.dvdId) ids.push(`DVD: <code>${escapeHtml(meta.dvdId)}</code>`);
        if (meta.contentId) ids.push(`Content: <code>${escapeHtml(meta.contentId)}</code>`);
        lines.push(`<b>📀 IDs:</b> ${ids.join(' | ')}`);
        lines.push('');
    }
        const info = [];
    if (meta.releaseDate) info.push(`📅 ${meta.releaseDate}`);
    if (meta.runtime) info.push(`⏱ ${formatRuntime(meta.runtime)}`);
    if (meta.studio) info.push(`🏢 ${escapeHtml(meta.studio)}`);
    if (info.length) {
        lines.push(info.join(' | '));
        lines.push('');
    }
    
    if (meta.director) lines.push(`🎥 <b>Director:</b> ${escapeHtml(meta.director)}`);
    if (meta.actresses) {
        lines.push(`👥 <b>Actresses:</b> ${escapeHtml(meta.actresses)}`);
    }
    lines.push('');
    
    if (meta.genres) {
        lines.push(`🎭 <b>Genres:</b> ${escapeHtml(meta.genres)}`);
    }

    // Auto hashtaging
    const tagParts = [];
    const videoTag = formatHashtagFromCode(meta.dvdId || meta.contentId || selected.code || selected.title);
    if (videoTag) tagParts.push(videoTag);
    if (meta.actresses) {
        const actressTags = String(meta.actresses).split(',')
            .map(a => formatHashtagFromActress(a))
            .filter(Boolean);
        if (actressTags.length) tagParts.push(...actressTags);
    }

    if (tagParts.length) {
        lines.push('');
        lines.push(`<b>🔖 Hashtags:</b> ${tagParts.join(' ')} `);
    }

    lines.push('');
    lines.push(`<a href="${selected.link}">🔗 View on JAV Database</a>`);

    return lines.join('\n');
}

async function sendProgress(ctx, step, message) {
    const steps = {
        'search': '🔍',
        'fetching': '📥',
        'downloading': '⬇️',
        'uploading': '📤',
        'posting': '📬',
        'done': '✅'
    };
    const icon = steps[step] || '⏳';
    const text = `${icon} <b>${message}</b>`;
    try {
        ctx.session = ctx.session || {};
        const chatId = ctx.chat && ctx.chat.id;

        // If we have a stored progress message for this chat, try to edit it
        if (ctx.session.progressMessage && ctx.session.progressMessage.chatId === chatId && ctx.session.progressMessage.messageId) {
            try {
                await ctx.telegram.editMessageText(chatId, ctx.session.progressMessage.messageId, null, text, { parse_mode: 'HTML' });
                // If this is a final step, clear stored message
                if (step === 'done') delete ctx.session.progressMessage;
                return;
            } catch (e) {
                // Fall through to sending a fresh message if edit fails
                console.error('Progress edit failed, sending new message:', e.message);
            }
        }

        // Send new message and store its id for future edits
        const sent = await ctx.reply(text, { parse_mode: 'HTML' });
        if (sent && sent.message_id) {
            ctx.session.progressMessage = { chatId, messageId: sent.message_id };
            // schedule auto-delete
            const deleteSeconds = (ctx.session && ctx.session.autoDeleteSeconds) || AUTO_DELETE_SECONDS;
            scheduleDelete(ctx.telegram, chatId, sent.message_id, deleteSeconds);
            if (step === 'done') delete ctx.session.progressMessage;
        }
    } catch (e) {
        console.error('Progress notification failed:', e.message);
    }
}

function scheduleDelete(telegram, chatId, messageId, ttl = AUTO_DELETE_SECONDS) {
    if (!telegram || !chatId || !messageId) return;
    setTimeout(() => {
        try { telegram.deleteMessage(chatId, messageId).catch(() => {}); } catch (e) {}
    }, ttl * 1000);
}
// ✅ Export ALL functions at the END
module.exports = {
    escapeHtml,
    formatRuntime,
    formatHashtags,
    formatMessage,
    sendProgress
    ,scheduleDelete
};