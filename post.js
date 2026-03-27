// post.js
const { formatMessage } = require('./utils');
const { fetchPosterUrl, fetchPreviewImages, downloadImageBytes } = require('./scraper');
const { addTag } = require('./tags');

async function uploadToChannel(telegram, CHANNEL_ID, meta, selected, posterUrl, previews) {
    if (!CHANNEL_ID) {
        console.error('❌ CHANNEL_ID not set');
        return null;
    }
    
    try {
        const caption = formatMessage(meta, selected);
        
        // ✅ Auto-Tag: Save to tag database
        if (meta.dvdId) {
            const movieInfo = {
                title: meta.title,
                dvdId: meta.dvdId,
                link: selected.link
            };
            
            if (meta.genres) {
                meta.genres.split(',').forEach(g => {
                    addTag('genres', g.trim(), movieInfo);
                });
            }
            if (meta.actresses) {
                meta.actresses.split(',').forEach(a => {
                    addTag('actresses', a.trim(), movieInfo);
                });
            }
            if (meta.studio) {
                addTag('studios', meta.studio, movieInfo);
            }
            if (meta.series) {
                addTag('series', meta.series, movieInfo);
            }
            console.log(`🏷️ Auto-tagged: ${meta.dvdId}`);
        }
        
        // POST 1: Poster + Details (with caption)
        if (posterUrl) {
            const posterBuf = await downloadImageBytes(posterUrl);
            if (posterBuf) {
                await telegram.sendPhoto(CHANNEL_ID, { source: posterBuf }, {
                    caption: caption,
                    parse_mode: 'HTML'
                });
                console.log(`📤 Posted poster to channel: ${CHANNEL_ID}`);
            }
        }
        
        // POST 2+: Preview images as media group (NO captions)
        if (previews.length > 0) {
            const groups = [];
            for (let i = 0; i < previews.length; i += 10) {
                groups.push(previews.slice(i, i + 10));
            }
            
            for (let g = 0; g < groups.length; g++) {
                const mediaGroup = [];
                for (const img of groups[g]) {
                    const imgUrl = img.full || img.preview;
                    if (imgUrl) {
                        const imgBuf = await downloadImageBytes(imgUrl);
                        if (imgBuf) {
                            mediaGroup.push({
                                type: 'photo',
                                media: { source: imgBuf }
                            });
                        }
                    }
                }
                
                if (mediaGroup.length > 0) {
                    await telegram.sendMediaGroup(CHANNEL_ID, mediaGroup);
                    console.log(`📤 Posted preview group ${g + 1}/${groups.length} to channel`);
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        }
        
        return true;
        
    } catch (e) {
        // ✅ FIXED: Proper catch block
        console.error('Channel upload error:', e.message);
        throw e;
    }
}

module.exports = {
    uploadToChannel
};