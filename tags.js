// tags.js
const fs = require('fs');
const path = require('path');

const TAGS_FILE = path.join(__dirname, 'tags.json');

// Load existing tags from file
function loadTags() {
    try {
        if (fs.existsSync(TAGS_FILE)) {
            return JSON.parse(fs.readFileSync(TAGS_FILE, 'utf-8'));
        }
    } catch (e) {
        console.error('Failed to load tags:', e.message);
    }
    return {
        genres: {},
        actresses: {},
        studios: {},
        series: {}
    };
}

// Save tags to file
function saveTags(tags) {
    try {
        fs.writeFileSync(TAGS_FILE, JSON.stringify(tags, null, 2), 'utf-8');
    } catch (e) {
        console.error('Failed to save tags:', e.message);
    }
}

// Add a tag to the database
function addTag(category, tagName, movieInfo) {
    const tags = loadTags();
    
    if (!tags[category]) {
        tags[category] = {};
    }
    
    if (!tags[category][tagName]) {
        tags[category][tagName] = {
            count: 0,
            movies: [],
            lastUpdated: new Date().toISOString()
        };
    }
    
    tags[category][tagName].count++;
    tags[category][tagName].movies.push({
        title: movieInfo.title,
        dvdId: movieInfo.dvdId,
        link: movieInfo.link,
        postedAt: new Date().toISOString()
    });
    
    // Keep only last 100 movies per tag
    if (tags[category][tagName].movies.length > 100) {
        tags[category][tagName].movies.shift();
    }
    
    tags[category][tagName].lastUpdated = new Date().toISOString();
    saveTags(tags);
    
    return tags[category][tagName];
}

// Get all tags in a category
function getTags(category) {
    const tags = loadTags();
    if (!tags[category]) return {};
    
    // Sort by count (most popular first)
    return Object.entries(tags[category])
        .sort(([, a], [, b]) => b.count - a.count)
        .reduce((obj, [key, value]) => {
            obj[key] = value;
            return obj;
        }, {});
}

// Search movies by tag
function searchByTag(category, tagName) {
    const tags = loadTags();
    return tags[category]?.[tagName]?.movies || [];
}

module.exports = {
    loadTags,
    saveTags,
    addTag,
    getTags,
    searchByTag
};