import { fetchJson, fetchText, HEADERS } from './http.js';
import cheerio from 'cheerio-without-node-native';
import CryptoJS from 'crypto-js';

const SITE_URL = 'https://lacartoons.com';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const RPMVID_KEY = 'kiemtienmua911ca';
const RPMVID_IV = '1234567890oiuytr';

function normalizeTitle(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function addTitle(titles, value) {
    if (value && !titles.includes(value)) {
        titles.push(value);
    }
}

async function getTitleCandidates(tmdbId) {
    const searchUrl = `${WIKIDATA_API}?action=query&list=search&srsearch=haswbstatement%3AP4983%3D${encodeURIComponent(tmdbId)}&srnamespace=0&format=json`;
    const searchData = await fetchJson(searchUrl);
    const entityId = searchData.query && searchData.query.search && searchData.query.search[0]
        ? searchData.query.search[0].title
        : null;

    if (!entityId || !/^Q\d+$/.test(entityId)) {
        return [];
    }

    const entityUrl = `${WIKIDATA_API}?action=wbgetentities&ids=${entityId}&props=labels%7Caliases&languages=es%7Cen&format=json`;
    const entityData = await fetchJson(entityUrl);
    const entity = entityData.entities && entityData.entities[entityId];
    if (!entity) {
        return [];
    }

    const titles = [];
    const labels = entity.labels || {};
    const aliases = entity.aliases || {};
    addTitle(titles, labels.es && labels.es.value);
    addTitle(titles, labels.en && labels.en.value);

    ['es', 'en'].forEach((language) => {
        (aliases[language] || []).forEach((alias) => addTitle(titles, alias.value));
    });

    return titles;
}

async function findSeries(title) {
    const normalizedTitle = normalizeTitle(title);
    const queries = [title];
    const abbreviations = String(title).match(/\b[A-Z0-9]{2,}\b/g) || [];
    abbreviations.forEach((abbreviation) => {
        if (!queries.includes(abbreviation)) {
            queries.push(abbreviation);
        }
    });

    for (const query of queries) {
        const searchUrl = `${SITE_URL}/?Titulo=${encodeURIComponent(query)}`;
        const html = await fetchText(searchUrl);
        const $ = cheerio.load(html);
        let seriesPath = null;

        $('a[href^="/serie/"]').each(function () {
            const card = $(this);
            const cardTitle = card.find('.nombre-serie').first().text().trim();
            if (cardTitle && normalizeTitle(cardTitle) === normalizedTitle) {
                seriesPath = card.attr('href');
                return false;
            }
        });

        if (seriesPath) {
            return seriesPath;
        }
    }

    return null;
}

async function findEpisode(seriesPath, season, episode) {
    const seriesUrl = `${SITE_URL}${seriesPath}`;
    const html = await fetchText(seriesUrl);
    const $ = cheerio.load(html);
    const seasonNumber = String(season);
    let seasonExists = false;

    $('h4[data-temporada-id]').each(function () {
        if (String($(this).attr('data-temporada-id')) === seasonNumber) {
            seasonExists = true;
            return false;
        }
    });

    if (!seasonExists) {
        return null;
    }

    let episodePath = null;
    $('.episodio-panel a[href*="/serie/capitulo/"]').each(function () {
        const link = $(this);
        const href = link.attr('href') || '';
        const text = link.text();
        const seasonMatch = href.match(/[?&]t=(\d+)/);
        const episodeMatch = text.match(/cap[ií]tulo\s*(\d+)/i);

        if (seasonMatch && seasonMatch[1] === seasonNumber &&
            episodeMatch && Number(episodeMatch[1]) === Number(episode)) {
            episodePath = href;
            return false;
        }
    });

    if (!episodePath) {
        return null;
    }

    const episodeUrl = `${SITE_URL}${episodePath}`;
    const episodeHtml = await fetchText(episodeUrl);
    const episodePage = cheerio.load(episodeHtml);
    const iframe = episodePage('iframe[src]').first().attr('src');

    if (!iframe) {
        return null;
    }

    let playerUrl;
    try {
        playerUrl = new URL(iframe, SITE_URL).href;
    } catch (error) {
        console.warn(`[LaCartoons] Invalid player URL: ${error.message}`);
        return null;
    }

    const player = new URL(playerUrl);
    const videoId = player.hash.slice(1).split('&')[0];
    if (!videoId || !/^[a-z0-9_-]+$/i.test(videoId)) {
        console.warn(`[LaCartoons] Player URL has no valid video ID: ${playerUrl}`);
        return null;
    }

    return { episodeUrl, playerUrl, videoId, playerOrigin: player.origin };
}

async function resolveVideoUrl(player) {
    const apiUrl = `${player.playerOrigin}/api/v1/video?id=${encodeURIComponent(player.videoId)}&w=1920&h=1080&r=${encodeURIComponent(new URL(player.episodeUrl).hostname)}`;
    const encryptedPayload = (await fetchText(apiUrl, {
        headers: {
            Accept: '*/*',
            Referer: `${player.playerOrigin}/`
        }
    })).trim();

    if (!/^(?:[0-9a-f]{2})+$/i.test(encryptedPayload)) {
        throw new Error('El reproductor devolvió una respuesta cifrada con formato inválido.');
    }

    const key = CryptoJS.enc.Utf8.parse(RPMVID_KEY);
    const iv = CryptoJS.enc.Utf8.parse(RPMVID_IV);
    const ciphertext = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Hex.parse(encryptedPayload));
    const decrypted = CryptoJS.AES.decrypt(ciphertext, key, {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    }).toString(CryptoJS.enc.Utf8);

    if (!decrypted) {
        throw new Error('No se pudo descifrar la respuesta del reproductor.');
    }

    let payload;
    try {
        payload = JSON.parse(decrypted);
    } catch (error) {
        throw new Error(`La respuesta del reproductor no contiene JSON válido: ${error.message}`);
    }

    if (typeof payload.source === 'string' && payload.source) {
        const sourceUrl = new URL(payload.source, `${player.playerOrigin}/`);
        if (sourceUrl.protocol !== 'https:') {
            throw new Error('El reproductor devolvió una playlist que no usa HTTPS.');
        }
        return sourceUrl.href;
    }

    if (typeof payload.cfNative === 'string' && payload.cfNative) {
        const nativeUrl = new URL(payload.cfNative, `${player.playerOrigin}/`);
        if (nativeUrl.protocol !== 'https:') {
            throw new Error('El reproductor devolvió una playlist nativa que no usa HTTPS.');
        }
        return nativeUrl.href;
    }

    if (typeof payload.hls === 'string' && payload.hls) {
        return new URL(payload.hls, `${player.playerOrigin}/`).href;
    }

    if (typeof payload.hlsVideoTiktok === 'string' && payload.hlsVideoTiktok) {
        let streamingConfig = {};
        if (typeof payload.streamingConfig === 'string') {
            try {
                streamingConfig = JSON.parse(payload.streamingConfig);
            } catch (error) {
                throw new Error(`La configuración HLS no es JSON válido: ${error.message}`);
            }
        }

        const tiktokConfig = streamingConfig.adjust && streamingConfig.adjust.Tiktok;
        const tiktokDomain = tiktokConfig && tiktokConfig.domain;
        if (typeof tiktokDomain !== 'string' || !/^[a-z0-9.-]+$/i.test(tiktokDomain)) {
            throw new Error('La respuesta no incluye un dominio HLS de TikTok válido.');
        }

        const hlsPath = payload.hlsVideoTiktok.replace(/^\/hls\//, '');
        if (hlsPath === payload.hlsVideoTiktok || hlsPath.indexOf('..') !== -1) {
            throw new Error('La ruta HLS de TikTok tiene un formato inválido.');
        }

        const streamUrl = new URL(`/hlsmod/${tiktokDomain}/${hlsPath}`, `${player.playerOrigin}/`);
        const token = tiktokConfig.params && tiktokConfig.params.v;
        if (token) {
            streamUrl.searchParams.set('v', String(token));
        }
        return streamUrl.href;
    }

    if (typeof payload.cf === 'string' && payload.cf) {
        const streamUrl = new URL(payload.cf, `${player.playerOrigin}/`);
        if (typeof payload.cfExpire === 'string') {
            const expiry = payload.cfExpire.split('::');
            if (expiry.length >= 2) {
                streamUrl.searchParams.set('t', expiry[0]);
                streamUrl.searchParams.set('e', expiry[1]);
            }
        }
        if (/\.txt(?:$|\?)/i.test(streamUrl.href)) {
            streamUrl.hash = 'index.m3u8';
        }
        return streamUrl.href;
    }

    throw new Error('El reproductor no devolvió una fuente HLS compatible.');
}

export async function extractStreams(tmdbId, mediaType, season, episode) {
    if (mediaType !== 'tv' && mediaType !== 'series') {
        console.log('[LaCartoons] Only TV series are supported.');
        return [];
    }
    const seasonNumber = Number(season);
    const episodeNumber = Number(episode);
    if (!/^\d+$/.test(String(tmdbId)) || !Number.isInteger(seasonNumber) ||
        seasonNumber < 1 || !Number.isInteger(episodeNumber) || episodeNumber < 1) {
        console.warn('[LaCartoons] Invalid TMDB ID, season, or episode.');
        return [];
    }

    const titles = await getTitleCandidates(tmdbId);
    if (titles.length === 0) {
        console.warn(`[LaCartoons] Wikidata has no title for TMDB ID ${tmdbId}.`);
        return [];
    }

    let seriesPath = null;
    for (const title of titles) {
        seriesPath = await findSeries(title);
        if (seriesPath) {
            break;
        }
    }

    if (!seriesPath) {
        console.warn(`[LaCartoons] No exact series match found for TMDB ID ${tmdbId}.`);
        return [];
    }

    const player = await findEpisode(seriesPath, seasonNumber, episodeNumber);
    if (!player) {
        console.warn(`[LaCartoons] No player found for ${seriesPath}, S${seasonNumber}E${episodeNumber}.`);
        return [];
    }

    const streamUrl = await resolveVideoUrl(player);

    return [{
        name: 'LaCartoons',
        title: `Temporada ${seasonNumber} - Episodio ${episodeNumber}`,
        url: streamUrl,
        quality: 'Auto',
        headers: {
            ...HEADERS,
            Referer: `${player.playerOrigin}/`
        }
    }];
}
