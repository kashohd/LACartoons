/**
 * lacartoons - Built from src/lacartoons/
 * Generated: 2026-10-12T12:45:19.279Z
 */
var __create = Object.create;
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/lacartoons/http.js
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"
  // Add other common headers like 'Referer' if needed
};
function fetchText(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    console.log(`[LaCartoons] Fetching: ${url}`);
    const response = yield fetch(url, __spreadProps(__spreadValues({}, options), {
      headers: __spreadValues(__spreadValues({}, HEADERS), options.headers)
    }));
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status} for ${url}`);
    }
    return yield response.text();
  });
}
function fetchJson(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const raw = yield fetchText(url, options);
    return JSON.parse(raw);
  });
}

// src/lacartoons/extractor.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
var import_crypto_js = __toESM(require("crypto-js"));
var SITE_URL = "https://lacartoons.com";
var WIKIDATA_API = "https://www.wikidata.org/w/api.php";
var RPMVID_KEY = "kiemtienmua911ca";
var RPMVID_IV = "1234567890oiuytr";
function normalizeTitle(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function addTitle(titles, value) {
  if (value && !titles.includes(value)) {
    titles.push(value);
  }
}
function getTitleCandidates(tmdbId) {
  return __async(this, null, function* () {
    const searchUrl = `${WIKIDATA_API}?action=query&list=search&srsearch=haswbstatement%3AP4983%3D${encodeURIComponent(tmdbId)}&srnamespace=0&format=json`;
    const searchData = yield fetchJson(searchUrl);
    const entityId = searchData.query && searchData.query.search && searchData.query.search[0] ? searchData.query.search[0].title : null;
    if (!entityId || !/^Q\d+$/.test(entityId)) {
      return [];
    }
    const entityUrl = `${WIKIDATA_API}?action=wbgetentities&ids=${entityId}&props=labels%7Caliases&languages=es%7Cen&format=json`;
    const entityData = yield fetchJson(entityUrl);
    const entity = entityData.entities && entityData.entities[entityId];
    if (!entity) {
      return [];
    }
    const titles = [];
    const labels = entity.labels || {};
    const aliases = entity.aliases || {};
    addTitle(titles, labels.es && labels.es.value);
    addTitle(titles, labels.en && labels.en.value);
    ["es", "en"].forEach((language) => {
      (aliases[language] || []).forEach((alias) => addTitle(titles, alias.value));
    });
    return titles;
  });
}
function findSeries(title) {
  return __async(this, null, function* () {
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
      const html = yield fetchText(searchUrl);
      const $ = import_cheerio_without_node_native.default.load(html);
      let seriesPath = null;
      $('a[href^="/serie/"]').each(function() {
        const card = $(this);
        const cardTitle = card.find(".nombre-serie").first().text().trim();
        if (cardTitle && normalizeTitle(cardTitle) === normalizedTitle) {
          seriesPath = card.attr("href");
          return false;
        }
      });
      if (seriesPath) {
        return seriesPath;
      }
    }
    return null;
  });
}
function findEpisode(seriesPath, season, episode) {
  return __async(this, null, function* () {
    const seriesUrl = `${SITE_URL}${seriesPath}`;
    const html = yield fetchText(seriesUrl);
    const $ = import_cheerio_without_node_native.default.load(html);
    const seasonNumber = String(season);
    let seasonExists = false;
    $("h4[data-temporada-id]").each(function() {
      if (String($(this).attr("data-temporada-id")) === seasonNumber) {
        seasonExists = true;
        return false;
      }
    });
    if (!seasonExists) {
      return null;
    }
    let episodePath = null;
    $('.episodio-panel a[href*="/serie/capitulo/"]').each(function() {
      const link = $(this);
      const href = link.attr("href") || "";
      const text = link.text();
      const seasonMatch = href.match(/[?&]t=(\d+)/);
      const episodeMatch = text.match(/cap[ií]tulo\s*(\d+)/i);
      if (seasonMatch && seasonMatch[1] === seasonNumber && episodeMatch && Number(episodeMatch[1]) === Number(episode)) {
        episodePath = href;
        return false;
      }
    });
    if (!episodePath) {
      return null;
    }
    const episodeUrl = `${SITE_URL}${episodePath}`;
    const episodeHtml = yield fetchText(episodeUrl);
    const episodePage = import_cheerio_without_node_native.default.load(episodeHtml);
    const iframe = episodePage("iframe[src]").first().attr("src");
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
    const videoId = player.hash.slice(1).split("&")[0];
    if (!videoId || !/^[a-z0-9_-]+$/i.test(videoId)) {
      console.warn(`[LaCartoons] Player URL has no valid video ID: ${playerUrl}`);
      return null;
    }
    return { episodeUrl, playerUrl, videoId, playerOrigin: player.origin };
  });
}
function resolveVideoUrl(player) {
  return __async(this, null, function* () {
    const apiUrl = `${player.playerOrigin}/api/v1/video?id=${encodeURIComponent(player.videoId)}&w=1920&h=1080&r=${encodeURIComponent(new URL(player.episodeUrl).hostname)}`;
    const encryptedPayload = (yield fetchText(apiUrl, {
      headers: {
        Accept: "*/*",
        Referer: `${player.playerOrigin}/`
      }
    })).trim();
    if (!/^(?:[0-9a-f]{2})+$/i.test(encryptedPayload)) {
      throw new Error("El reproductor devolvi\xF3 una respuesta cifrada con formato inv\xE1lido.");
    }
    const key = import_crypto_js.default.enc.Utf8.parse(RPMVID_KEY);
    const iv = import_crypto_js.default.enc.Utf8.parse(RPMVID_IV);
    const ciphertext = import_crypto_js.default.enc.Base64.stringify(import_crypto_js.default.enc.Hex.parse(encryptedPayload));
    const decrypted = import_crypto_js.default.AES.decrypt(ciphertext, key, {
      iv,
      mode: import_crypto_js.default.mode.CBC,
      padding: import_crypto_js.default.pad.Pkcs7
    }).toString(import_crypto_js.default.enc.Utf8);
    if (!decrypted) {
      throw new Error("No se pudo descifrar la respuesta del reproductor.");
    }
    let payload;
    try {
      payload = JSON.parse(decrypted);
    } catch (error) {
      throw new Error(`La respuesta del reproductor no contiene JSON v\xE1lido: ${error.message}`);
    }
    if (typeof payload.source === "string" && payload.source) {
      const sourceUrl = new URL(payload.source, `${player.playerOrigin}/`);
      if (sourceUrl.protocol !== "https:") {
        throw new Error("El reproductor devolvi\xF3 una playlist que no usa HTTPS.");
      }
      return sourceUrl.href;
    }
    if (typeof payload.cfNative === "string" && payload.cfNative) {
      const nativeUrl = new URL(payload.cfNative, `${player.playerOrigin}/`);
      if (nativeUrl.protocol !== "https:") {
        throw new Error("El reproductor devolvi\xF3 una playlist nativa que no usa HTTPS.");
      }
      return nativeUrl.href;
    }
    if (typeof payload.hls === "string" && payload.hls) {
      return new URL(payload.hls, `${player.playerOrigin}/`).href;
    }
    if (typeof payload.hlsVideoTiktok === "string" && payload.hlsVideoTiktok) {
      let streamingConfig = {};
      if (typeof payload.streamingConfig === "string") {
        try {
          streamingConfig = JSON.parse(payload.streamingConfig);
        } catch (error) {
          throw new Error(`La configuraci\xF3n HLS no es JSON v\xE1lido: ${error.message}`);
        }
      }
      const tiktokConfig = streamingConfig.adjust && streamingConfig.adjust.Tiktok;
      const tiktokDomain = tiktokConfig && tiktokConfig.domain;
      if (typeof tiktokDomain !== "string" || !/^[a-z0-9.-]+$/i.test(tiktokDomain)) {
        throw new Error("La respuesta no incluye un dominio HLS de TikTok v\xE1lido.");
      }
      const hlsPath = payload.hlsVideoTiktok.replace(/^\/hls\//, "");
      if (hlsPath === payload.hlsVideoTiktok || hlsPath.indexOf("..") !== -1) {
        throw new Error("La ruta HLS de TikTok tiene un formato inv\xE1lido.");
      }
      const streamUrl = new URL(`/hlsmod/${tiktokDomain}/${hlsPath}`, `${player.playerOrigin}/`);
      const token = tiktokConfig.params && tiktokConfig.params.v;
      if (token) {
        streamUrl.searchParams.set("v", String(token));
      }
      return streamUrl.href;
    }
    if (typeof payload.cf === "string" && payload.cf) {
      const streamUrl = new URL(payload.cf, `${player.playerOrigin}/`);
      if (typeof payload.cfExpire === "string") {
        const expiry = payload.cfExpire.split("::");
        if (expiry.length >= 2) {
          streamUrl.searchParams.set("t", expiry[0]);
          streamUrl.searchParams.set("e", expiry[1]);
        }
      }
      if (/\.txt(?:$|\?)/i.test(streamUrl.href)) {
        streamUrl.hash = "index.m3u8";
      }
      return streamUrl.href;
    }
    throw new Error("El reproductor no devolvi\xF3 una fuente HLS compatible.");
  });
}
function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    if (mediaType !== "tv" && mediaType !== "series") {
      console.log("[LaCartoons] Only TV series are supported.");
      return [];
    }
    const seasonNumber = Number(season);
    const episodeNumber = Number(episode);
    if (!/^\d+$/.test(String(tmdbId)) || !Number.isInteger(seasonNumber) || seasonNumber < 1 || !Number.isInteger(episodeNumber) || episodeNumber < 1) {
      console.warn("[LaCartoons] Invalid TMDB ID, season, or episode.");
      return [];
    }
    const titles = yield getTitleCandidates(tmdbId);
    if (titles.length === 0) {
      console.warn(`[LaCartoons] Wikidata has no title for TMDB ID ${tmdbId}.`);
      return [];
    }
    let seriesPath = null;
    for (const title of titles) {
      seriesPath = yield findSeries(title);
      if (seriesPath) {
        break;
      }
    }
    if (!seriesPath) {
      console.warn(`[LaCartoons] No exact series match found for TMDB ID ${tmdbId}.`);
      return [];
    }
    const player = yield findEpisode(seriesPath, seasonNumber, episodeNumber);
    if (!player) {
      console.warn(`[LaCartoons] No player found for ${seriesPath}, S${seasonNumber}E${episodeNumber}.`);
      return [];
    }
    const streamUrl = yield resolveVideoUrl(player);
    return [{
      name: "LaCartoons",
      title: `Temporada ${seasonNumber} - Episodio ${episodeNumber}`,
      url: streamUrl,
      quality: "Auto",
      headers: __spreadProps(__spreadValues({}, HEADERS), {
        Referer: `${player.playerOrigin}/`
      })
    }];
  });
}

// src/lacartoons/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log(`[LaCartoons] Request: ${mediaType} ${tmdbId} S${season}E${episode}`);
      return yield extractStreams(tmdbId, mediaType, season, episode);
    } catch (error) {
      console.error(`[LaCartoons] Error: ${error.message}`);
      return [];
    }
  });
}
module.exports = { getStreams };
