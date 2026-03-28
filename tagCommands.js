// tagCommands.js
const { Markup } = require('telegraf');
const { getTags, searchTags, searchByTag, getAllActresses } = require('./tags');
const { escapeHtml, scheduleDelete } = require('./utils');
const { fetchSearchIdols, fetchIdolMoviesAll, fetchMovieMetadata, fetchSearchStudios } = require('./scraper');

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

async function showActressList(ctx, page = 0) {
    ctx.session = ctx.session || {};
    const actresses = getAllActresses();
    if (actresses.length === 0) {
        return ctx.reply('❌ No actresses stored yet.', { parse_mode: 'HTML' });
    }

    const perPage = 15;
    const total = actresses.length;
    const start = page * perPage;
    const end = Math.min(start + perPage, total);
    const pageSlice = actresses.slice(start, end);

    const keyboard = pageSlice.map((name, idx) => [{
        text: name,
        callback_data: `actresslistselect_${start + idx}`
    }]);

    const navRow = [];
    if (page > 0) navRow.push(Markup.button.callback('◀ Prev', `actresslistpage_${page - 1}`));
    if (end < total) navRow.push(Markup.button.callback('Next ▶', `actresslistpage_${page + 1}`));
    if (navRow.length > 0) keyboard.push(navRow);
    keyboard.push([Markup.button.callback('✖ Cancel', 'cancelactresslist')]);

    ctx.session.actressList = actresses;
    ctx.session.actressListPage = page;

    const text = `👥 <b>Actresses</b> (${start + 1}-${end} of ${total})\n\nSelect an actress to load her movies:`;
    const sent = await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard }
    });
    if (sent && sent.message_id) scheduleDelete(ctx.telegram, sent.chat.id, sent.message_id);
}

async function searchAndShowActress(ctx, actressName) {
    const idols = await fetchSearchIdols(actressName);
    if (!idols || idols.length === 0) {
        return ctx.reply(`❌ No actress found for: ${actressName}`, { parse_mode: 'HTML' });
    }
    const idol = idols[0];
    await showIdolMovies(ctx, idol);
}

async function showIdolMovies(ctx, idol, page = 0) {
    ctx.session = ctx.session || {};
    const perPage = 10;

    // If no cached movies for this idol or idol changed, fetch all pages
    if (!ctx.session.tagResults || (ctx.session.currentIdol && ctx.session.currentIdol.link !== idol.link)) {
        const allMovies = await fetchIdolMoviesAll(idol.link);
        ctx.session.tagResults = allMovies;
        ctx.session.currentIdol = idol;
    }

    const movies = ctx.session.tagResults || [];
    if (movies.length === 0) {
        return ctx.reply(`❌ No movies found for ${idol.name}`);
    }

    const start = page * perPage;
    const subMovies = movies.slice(start, start + perPage);
    if (subMovies.length === 0) {
        return ctx.reply('⚠️ No more results.', { parse_mode: 'HTML' });
    }

    // Fetch actual DVD IDs for accurate button text (only page slice)
    for (let idx = 0; idx < subMovies.length; idx++) {
        const m = subMovies[idx];
        const meta = await fetchMovieMetadata(m.link);
        m.code = meta.dvdId || meta.contentId || m.code || `Result ${start + idx + 1}`;
    }

    const total = movies.length;
    const end = Math.min(start + perPage, total);
    let text = `👥 <b>${idol.name}</b>\n\nShowing ${start + 1}-${end} of ${total} movies.\n\nClick a video ID to search and upload:\n\n`;

    const keyboard = subMovies.map((m, idx) => [{
        text: String(m.code || 'Unknown'),
        callback_data: `selectactress_${start + idx}`
    }]);

    const navRow = [];
    if (page > 0) navRow.push(Markup.button.callback('◀ Prev', `actresspage_${page - 1}`));
    if (end < total) navRow.push(Markup.button.callback('Next ▶', `actresspage_${page + 1}`));
    if (navRow.length) keyboard.push(navRow);

    // Add cancel button row
    keyboard.push([Markup.button.callback('✖ Cancel', 'cancelactress')]);

    console.log('showIdolMovies:', idol.name, 'movies total:', total, 'page:', page, 'rows:', keyboard.length);

    ctx.session.tagResults = movies;
    ctx.session.currentIdol = idol;
    ctx.session.currentPage = page;

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
    showActressList,
    searchAndShowActress,
    showIdolMovies,
    studioCommand
};