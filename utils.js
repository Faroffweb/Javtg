// utils.js

// ✅ Define escapeHtml FIRST
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
            return `#${prefix}${tag}`;
        })
        .join(' ');
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
        lines.push(`   ${formatHashtags(meta.actresses, 'Actress_')}`);
    }
    lines.push('');
    
    if (meta.genres) {
        lines.push(`🎭 <b>Genres:</b> ${escapeHtml(meta.genres)}`);
        lines.push(`   ${formatHashtags(meta.genres, 'Genre_')}`);
    }
    lines.push('');
    
    if (meta.plot) {
        const plot = meta.plot.length > 400 ? meta.plot.slice(0, 400) + '...' : meta.plot;
        lines.push(`📝 <b>Plot:</b>`);
        lines.push(`<i>${escapeHtml(plot)}</i>`);
        lines.push('');
    }
    
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
    try {
        await ctx.reply(`${icon} <b>${message}</b>`, { parse_mode: 'HTML' });
    } catch (e) {
        console.error('Progress notification failed:', e.message);
    }
}
// ✅ Export ALL functions at the END
module.exports = {
    escapeHtml,
    formatRuntime,
    formatHashtags,
    formatMessage,
    sendProgress
};