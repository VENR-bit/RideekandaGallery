// Code.gs — Apps Script web-app proxy for Rideekanda Gallery
// Fetches photos from a PUBLIC Google Photos shared-album link.
// No Photos Library API needed (it was deprecated April 2025).

var SHARED_ALBUM_URL = 'https://photos.app.goo.gl/w7y98bSkPyDKCevg7';

var CACHE_TTL = 1800; // 30 minutes

function doGet(e) {
  var output;
  try {
    if (e && e.parameter && e.parameter.debug === 'ping') {
      output = ContentService.createTextOutput(JSON.stringify({
        success: true, message: 'pong', ts: new Date().toISOString()
      }));
      output.setMimeType(ContentService.MimeType.JSON);
      return output;
    }

    var photos = getCachedPhotos_();
    output = ContentService.createTextOutput(JSON.stringify({
      success: true,
      count: photos.length,
      photos: photos
    }));
  } catch (err) {
    output = ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.message
    }));
  }
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function getCachedPhotos_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('gallery_photos');
  if (cached) return JSON.parse(cached);
  var photos = fetchSharedAlbumPhotos_();
  // CacheService max value size is 100KB; chunk if needed
  var jsonStr = JSON.stringify(photos);
  if (jsonStr.length < 100000) {
    try { cache.put('gallery_photos', jsonStr, CACHE_TTL); } catch(e) {}
  }
  return photos;
}

// ── Fetch photos from the shared album page ──────────────────────────
function fetchSharedAlbumPhotos_() {
  if (!SHARED_ALBUM_URL) throw new Error('SHARED_ALBUM_URL is not set');

  // Follow redirects to get the full album page
  var resp = UrlFetchApp.fetch(SHARED_ALBUM_URL, {
    followRedirects: true,
    muteHttpExceptions: true
  });

  if (resp.getResponseCode() !== 200) {
    throw new Error('Failed to fetch shared album: HTTP ' + resp.getResponseCode());
  }

  var html = resp.getContentText();
  return parsePhotosFromHtml_(html);
}

// ── Parse embedded photo data from the shared album HTML ─────────────
function parsePhotosFromHtml_(html) {
  var photos = [];

  // Google Photos shared album pages embed photo data in script tags.
  // The photo URLs follow the pattern: https://lh3.googleusercontent.com/...
  // They appear in the HTML alongside dimensions and timestamps.

  // Strategy 1: Extract from AF_initDataCallback blocks
  var dataBlocks = html.match(/AF_initDataCallback\(\{[^}]*key:\s*'[^']*'[\s\S]*?\}\);/g) || [];

  for (var i = 0; i < dataBlocks.length; i++) {
    var block = dataBlocks[i];
    // Look for photo URL arrays: ["https://lh3.googleusercontent.com/...", width, height]
    var urlPattern = /\["(https:\/\/lh3\.googleusercontent\.com\/[^"]+)",(\d+),(\d+)/g;
    var match;
    while ((match = urlPattern.exec(block)) !== null) {
      var url = match[1];
      var w = parseInt(match[2]);
      var h = parseInt(match[3]);
      // Filter out tiny icons/thumbnails (only keep real photos)
      if (w > 200 && h > 200) {
        photos.push({
          baseUrl: url,
          w: w,
          h: h,
          ts: '' // timestamp not easily available from HTML
        });
      }
    }
  }

  // Strategy 2: If AF_initDataCallback didn't work, try broader regex
  if (photos.length === 0) {
    var urlPattern2 = /\["(https:\/\/lh3\.googleusercontent\.com\/pw\/[^"]+)",(\d+),(\d+)/g;
    var match2;
    while ((match2 = urlPattern2.exec(html)) !== null) {
      var url2 = match2[1];
      var w2 = parseInt(match2[2]);
      var h2 = parseInt(match2[3]);
      if (w2 > 200 && h2 > 200) {
        photos.push({
          baseUrl: url2,
          w: w2,
          h: h2,
          ts: ''
        });
      }
    }
  }

  // Strategy 3: Even broader — find all lh3.googleusercontent.com URLs
  if (photos.length === 0) {
    var urlPattern3 = /(https:\/\/lh3\.googleusercontent\.com\/pw\/[^"'\s\\]+)/g;
    var seen = {};
    var match3;
    while ((match3 = urlPattern3.exec(html)) !== null) {
      var url3 = match3[1];
      if (!seen[url3] && url3.length > 60) {
        seen[url3] = true;
        photos.push({
          baseUrl: url3,
          w: 0,
          h: 0,
          ts: ''
        });
      }
    }
  }

  // Deduplicate by URL
  var uniqueUrls = {};
  var unique = [];
  for (var j = 0; j < photos.length; j++) {
    // Normalize URL (remove size params at end)
    var baseKey = photos[j].baseUrl.split('=')[0];
    if (!uniqueUrls[baseKey]) {
      uniqueUrls[baseKey] = true;
      unique.push(photos[j]);
    }
  }

  return unique;
}

// ── Test function: run manually to verify ────────────────────────────
function testFetchAlbum() {
  if (!SHARED_ALBUM_URL) {
    Logger.log('ERROR: Set SHARED_ALBUM_URL at the top of Code.gs first!');
    return;
  }
  var photos = fetchSharedAlbumPhotos_();
  Logger.log('Found ' + photos.length + ' photos');
  for (var i = 0; i < Math.min(3, photos.length); i++) {
    Logger.log('Photo ' + (i+1) + ': ' + photos[i].baseUrl.substring(0, 80) + '... (' + photos[i].w + 'x' + photos[i].h + ')');
  }
}

// ── Debug: show raw HTML snippet to understand structure ──────────────
function testRawHtml() {
  if (!SHARED_ALBUM_URL) {
    Logger.log('ERROR: Set SHARED_ALBUM_URL at the top of Code.gs first!');
    return;
  }
  var resp = UrlFetchApp.fetch(SHARED_ALBUM_URL, {
    followRedirects: true,
    muteHttpExceptions: true
  });
  var html = resp.getContentText();
  Logger.log('Response code: ' + resp.getResponseCode());
  Logger.log('HTML length: ' + html.length);

  // Find all lh3 URLs
  var urls = html.match(/https:\/\/lh3\.googleusercontent\.com[^"'\s\\]*/g) || [];
  Logger.log('Found ' + urls.length + ' lh3 URLs total');
  for (var i = 0; i < Math.min(5, urls.length); i++) {
    Logger.log('URL ' + (i+1) + ': ' + urls[i].substring(0, 100));
  }

  // Check for AF_initDataCallback
  var afBlocks = html.match(/AF_initDataCallback/g) || [];
  Logger.log('AF_initDataCallback blocks: ' + afBlocks.length);
}
