import { extractStreams } from './extractor.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        console.log(`[LaCartoons] Request: ${mediaType} ${tmdbId} S${season}E${episode}`);
        return await extractStreams(tmdbId, mediaType, season, episode);
    } catch (error) {
        console.error(`[LaCartoons] Error: ${error.message}`);
        return [];
    }
}

module.exports = { getStreams };
