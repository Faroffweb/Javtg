// tagCommands.js
const { Markup } = require('telegraf');
const { getTags, searchByTag } = require('./tags');
const { escapeHtml } = require('./utils');

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
    
    await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard(keyboard)
    });
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
    
    await ctx.reply(text, { parse_mode: 'HTML' });
}

module.exports = {
    tagsCommand,
    tagSearchCommand
};