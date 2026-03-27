// scraper.js
const axios = require('axios');

const client = axios.create({
    timeout: 15000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
});

function cleanHtmlText(html) {
    if (!html) return '';
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function htmlToText(html) {
    if (!html) return '';
    html = html.replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])[^>]*>/gi, '\n');
    html = html.replace(/<[^>]+>/g, ' ');
    html = html.replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;/g, s => 
        ({'&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"'}[s]));
    return html.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(l => l).join('\n');
}

function extractAbout(html) {
    const heading = html.match(/<h[1-6][^>]*>[^<]*About[^<]*JAV Movie[^<]*<\/h[1-6]>/is);
    let block = '';
    if (heading) {
        block = html.slice(heading.index + heading[0].length).split(/<h[1-6][^>]*>/is)[0];
    } else {
        const m = html.match(/About[^<]*JAV Movie(.*)/is);
        if (m) block = m[1].split(/<h[1-6][^>]*>/is)[0];
    }
    if (!block) return null;
    let text = htmlToText(block)
        .replace(/\(No Ratings Yet\).*/g, '')
        .replace(/No Ratings Yet.*/g, '')
        .replace(/Loading\.+.*/g, '')
        .replace(/JAV Database only provides official.*$/gm, '');
    return text.split('\n').map(l => l.trim()).filter(l => l).join('\n').trim() || null;
}

function extractLabeledLinks(html, label) {
    const vals = [];
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`<(?:p|div|li)[^>]*>[^<]*<b[^>]*>[^<]*${escaped}[^<]*</b>(.*?)</(?:p|div|li)>`, 'gis');
    let match;
    while ((match = pattern.exec(html)) !== null) {
        const links = match[1].match(/<a[^>]*>(.*?)<\/a>/gis) || [];
        links.forEach(link => {
            const txt = link.match(/<a[^>]*>(.*?)<\/a>/i);
            if (txt) {                const cleaned = cleanHtmlText(txt[1]);
                if (cleaned) vals.push(cleaned);
            }
        });
    }
    return [...new Set(vals)];
}

function extractLabeledSingle(html, label) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`<(?:p|div|li)[^>]*>\\s*<b[^>]*>[^<]*${escaped}[^<]*</b>\\s*[:\\-–]?\\s*(.*?)</(?:p|div|li)>`, 'i');
    const m = html.match(pattern);
    if (!m) return null;
    let block = m[1].replace(/<b[^>]*>.*?<\/b>/i, '').split(/<b[^>]*>/)[0].replace(/<br\s*\/?>/gi, '\n');
    const firstLine = block.split('\n').find(l => l.trim()) || '';
    return cleanHtmlText(firstLine);
}

async function fetchSearch(query) {
    try {
        const resp = await client.get(`https://www.javdatabase.com/?post_type=movies%2Cuncensored&s=${encodeURIComponent(query)}`);
        const html = resp.data || '';
        const results = [];
        const cardPattern = /<div[^>]+class="[^"]*\bcard\b[^"]*\bborderlesscard\b[^"]*"[^>]*>(.*?)<\/div>/gis;
        let cardMatch;
        while ((cardMatch = cardPattern.exec(html)) !== null) {
            const block = cardMatch[1];
            let code = null, link = null, title = null, releaseDate = null, studio = null;
            const codeMatch = block.match(/<p[^>]+class="[^"]*\bpcard\b[^"]*"[^>]*>.*?<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/is);
            if (codeMatch) { link = codeMatch[1]; code = cleanHtmlText(codeMatch[2]); }
            const titleBlock = block.match(/<(?:div|p|span)[^>]+class="[^"]*\bmt-auto\b[^"]*"[^>]*>(.*?)<\/(?:div|p|span)>/is);
            if (titleBlock) {
                const t = titleBlock[1].match(/<a[^>]*>(.*?)<\/a>/i);
                if (t) title = cleanHtmlText(t[1]);
            }
            if (!title) title = code;
            const dateMatch = cleanHtmlText(block).match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) releaseDate = dateMatch[1];
            const studioMatch = block.match(/<span[^>]+class="[^"]*\bbtn(?:-primary)?\b[^"]*"[^>]*>.*?<a[^>]*>(.*?)<\/a>/is);
            if (studioMatch) studio = cleanHtmlText(studioMatch[1]);
            results.push({ code, title, link, date: releaseDate, studio });
        }
        return results.filter(r => r.link);
    } catch (e) {
        console.error('Search error:', e.message);
        return [];
    }
}

async function fetchMovieMetadata(pageUrl) {    try {
        const resp = await client.get(pageUrl);
        const html = resp.data || '';
        const meta = {};
        const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/is);
        meta.title = titleMatch ? cleanHtmlText(titleMatch[1]) : null;
        const pageText = htmlToText(html);
        function extractField(patterns, maxWords = null) {
            for (const pat of patterns) {
                const m = pageText.match(new RegExp(`${pat}\\s*[:\\-–]?\\s*(.*?)\\s*(?:\\n|$)`, 'i'));
                if (m) {
                    let val = m[1].trim().replace(/\s{2,}/g, ' ');
                    if (maxWords) val = val.split(' ').slice(0, maxWords).join(' ');
                    return val;
                }
            }
            return null;
        }
        meta.dvdId = extractLabeledSingle(html, 'DVD ID') || extractField(['DVD ID', 'DVD'], 4);
        meta.contentId = extractLabeledSingle(html, 'Content ID') || extractField(['Content ID'], 4);
        meta.releaseDate = extractLabeledSingle(html, 'Release Date') || extractField(['Released'], 4);
        meta.runtime = extractLabeledSingle(html, 'Runtime') || extractField(['Runtime'], 8);
        meta.studio = extractLabeledSingle(html, 'Studio') || extractField(['Studio'], 8);
        let director = extractLabeledSingle(html, 'Director');
        if (director === null) director = extractField(['Director'], 8);
        meta.director = director;
        meta.series = extractLabeledSingle(html, 'Series') || extractField(['Series'], 8);
        meta.plot = extractAbout(html);
        meta.genres = extractLabeledLinks(html, 'Genre').join(', ') || null;
        meta.actresses = extractLabeledLinks(html, 'Idol').join(', ') || null;
        return meta;
    } catch (e) {
        console.error('Metadata error:', e.message);
        return {};
    }
}

async function fetchPosterUrl(pageUrl) {
    try {
        const html = (await client.get(pageUrl)).data || '';
        let m = html.match(/<div[^>]+id="poster-container"[^>]*>(.*?)<\/div>/is);
        if (m) {
            const img = m[1].match(/<img[^>]+src="([^"]+)"/i);
            if (img) return img[1];
        }
        m = html.match(/<div[^>]+class="[^"]*\bposter\b[^"]*"[^>]*>.*?<img[^>]+src="([^"]+)"/is);
        if (m) return m[1];
        return null;
    } catch { return null; }
}
async function fetchPreviewImages(pageUrl, limit = 20) {
    try {
        const html = (await client.get(pageUrl)).data || '';
        const images = [];
        const pattern = /<a([^>]*data-image-src="[^"]+"[^>]*)>(.*?)<\/a>/gis;
        let match;
        while ((match = pattern.exec(html)) !== null && images.length < limit) {
            const prev = match[1].match(/data-image-src="([^"]+)"/i);
            const full = match[1].match(/data-image-href="([^"]+)"/i);
            if (prev?.[1] || full?.[1]) {
                images.push({ preview: prev?.[1] || null, full: full?.[1] || null });
            }
        }
        return images;
    } catch { return []; }
}

async function downloadImageBytes(url) {
    try {
        const resp = await client.get(url, { responseType: 'arraybuffer', timeout: 20000 });
        return Buffer.from(resp.data);
    } catch { return null; }
}

module.exports = {
    fetchSearch,
    fetchMovieMetadata,
    fetchPosterUrl,
    fetchPreviewImages,
    downloadImageBytes
};