// this is url shortening service

const config = require('../config');

const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// this function converts number to base62 string
function toBase62(num) {
  if (num === 0) return BASE62_CHARS[0];
  let result = '';
  while (num > 0) {
    result = BASE62_CHARS[num % 62] + result;
    num = Math.floor(num / 62);
  }
  return result;
}

class UrlService {
  constructor() {
    // this map stores shortCode to originalUrl
    this.urlMap = new Map();
    // this map stores originalUrl to shortCode
    this.reverseMap = new Map();
    // this counter increments for each new url
    this.counter = 1000;
  }

  // this function checks if url is valid
  isValidUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  // this function creates a short code for url
  shorten(originalUrl) {
    if (this.reverseMap.has(originalUrl)) {
      return { shortCode: this.reverseMap.get(originalUrl), created: false };
    }

    const shortCode = toBase62(this.counter++).padStart(config.SHORT_CODE_LENGTH, '0').slice(-config.SHORT_CODE_LENGTH);
    this.urlMap.set(shortCode, originalUrl);
    this.reverseMap.set(originalUrl, shortCode);
    return { shortCode, created: true };
  }

  // this function gets original url from short code
  resolve(shortCode) {
    return this.urlMap.get(shortCode) || null;
  }

  // this function gets total count of urls
  get size() {
    return this.urlMap.size;
  }

  // this function resets all mappings
  reset() {
    this.urlMap.clear();
    this.reverseMap.clear();
    this.counter = 1000;
  }
}

module.exports = UrlService;
module.exports.toBase62 = toBase62;
