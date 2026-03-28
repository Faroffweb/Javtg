// tagCommands.js
const { Markup } = require('telegraf');
const { getTags, searchTags, searchByTag } = require('./tags');
const { escapeHtml, scheduleDelete } = require('./utils');
const { fetchSearchIdols, fetchIdolMovies, fetchMovieMetadata, fetchSearchStudios } = require('./scraper');

async function tagsCommand(ctx) {
    const category = ctx.message.text.split(' ')[1] || 'genres';
    const tags = getTags(category);
    
    if (Object.keys(tags).length === 0) {
        return ctx.reply('❌ No tags found yet.');
    }
    
    let text = `🏷️ <b>Top Tags</b> (${category})\n\n`;
    const tagList = Object.entries(tags).slice(0, 20);
    
    tagList.forEach(([tag, data]) => {
        text += `• <code>${tag}</code> - ${data.count} posts\n`;
    });
    
    // Create inline keyboard for top tags
    const keyboard = tagList.slice(0, 10).map(([tag]) => [
        Markup.button.callback(`${tag} (${tags[tag].count})`, `tagsearch_${category}_${tag}`)
    ]);
    
    const sentTags = await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard(keyboard)
    });
    if (sentTags && sentTags.message_id) scheduleDelete(ctx.telegram, sentTags.chat.id, sentTags.message_id);
}

async function actressCommand(ctx) {
    const query = ctx.message.text.replace('/actress', '').trim();
    if (!query) return ctx.reply('❌ Usage: /actress <name>', { parse_mode: 'HTML' });
    
    const idols = await fetchSearchIdols(query);
    
    if (idols.length === 0) {
        return ctx.reply('❌ No actresses found matching the query.');
    }
    
    // Assume first matching actress
    const idol = idols[0];
    await showIdolMovies(ctx, idol);
}

async function studioCommand(ctx) {
    const query = ctx.message.text.replace('/studio', '').trim();
    if (!query) return ctx.reply('❌ Usage: /studio <name>', { parse_mode: 'HTML' });

    const studios = await fetchSearchStudios(query);
    if (studios.length === 0) return ctx.reply('❌ No studios found matching the query.');

    // Assume first matching studio
    const studio = studios[0];
    await showIdolMovies(ctx, { name: studio.name, link: studio.link });
}

async function tagSearchCommand(ctx, category, tagName) {
    const movies = searchByTag(category, tagName);
    
    if (movies.length === 0) {
        return ctx.reply(`❌ No movies found for #${tagName}`);
    }
    
    let text = `🏷️ <b>#${tagName}</b>\n\nFound ${movies.length} movies:\n\n`;
    
    movies.slice(0, 10).forEach((m, i) => {
        text += `${i + 1}. <code>${m.dvdId}</code> - ${escapeHtml(m.title)}\n`;
    });
    
    if (movies.length > 10) {
        text += `\n...and ${movies.length - 10} more`;
    }
    
    // Create inline keyboard for movie selection
    const keyboard = movies.slice(0, 10).map((m, i) => [
        Markup.button.callback(`${m.dvdId}`, `selectactress_${i}`)
    ]);
    
    // Store movies in session for selection
    ctx.session = ctx.session || {};
    ctx.session.tagResults = movies;
    
    const sent = await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard(keyboard)
    });
    if (sent && sent.message_id) scheduleDelete(ctx.telegram, sent.chat.id, sent.message_id);
}

async function showIdolMovies(ctx, idol) {
    let movies = await fetchIdolMovies(idol.link);
    movies = movies.slice(0, 10); // Limit to 10 for performance
    
    if (movies.length === 0) {
        return ctx.reply(`❌ No movies found for ${idol.name}`);
    }
    
    // Fetch actual DVD IDs for accurate button text
    for (let m of movies) {
        const meta = await fetchMovieMetadata(m.link);
        m.code = meta.dvdId || meta.contentId || m.code;
    }
    
    let text = `👥 <b>${idol.name}</b>\n\nClick a video ID to search and upload:\n\n`;
    
    // Create inline keyboard for movie codes (vertical list: one button per row)
    const keyboard = movies.map((m, idx) => [{
        text: String(m.code || 'Unknown'),
        callback_data: `selectactress_${idx}`
    }]);

    // debug: ensure keyboard built
    console.log('showIdolMovies:', idol.name, 'movies:', movies.length, 'keyboard rows:', keyboard.length);
    
    // Store movies in session for selection
    ctx.session = ctx.session || {};
    ctx.session.tagResults = movies;
    
    const sent = await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard }
    });
    if (sent && sent.message_id) scheduleDelete(ctx.telegram, sent.chat.id, sent.message_id);
}

module.exports = {
    tagsCommand,
    tagSearchCommand,
    actressCommand,
    showIdolMovies,
    studioCommand
};