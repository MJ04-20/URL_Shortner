/**
 * URL Service Tests — node:test
 *
 * Tests for URL validation, short-code generation, and resolution.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const UrlService = require('../services/urlService');

describe('URL Service', () => {
  it('accepts valid HTTP URLs', () => {
    const svc = new UrlService();
    assert.strictEqual(svc.isValidUrl('http://example.com'), true);
    assert.strictEqual(svc.isValidUrl('https://example.com/path?q=1'), true);
    assert.strictEqual(svc.isValidUrl('https://sub.domain.org:8080/a/b'), true);
  });

  it('rejects invalid URLs', () => {
    const svc = new UrlService();
    assert.strictEqual(svc.isValidUrl('not-a-url'), false);
    assert.strictEqual(svc.isValidUrl('ftp://files.example.com'), false);
    assert.strictEqual(svc.isValidUrl(''), false);
    assert.strictEqual(svc.isValidUrl('javascript:alert(1)'), false);
  });

  it('generates unique short codes for different URLs', () => {
    const svc = new UrlService();
    const { shortCode: code1 } = svc.shorten('https://example.com/a');
    const { shortCode: code2 } = svc.shorten('https://example.com/b');

    assert.notStrictEqual(code1, code2);
    assert.ok(code1.length > 0);
    assert.ok(code2.length > 0);
  });

  it('returns the same code for duplicate URLs', () => {
    const svc = new UrlService();
    const first = svc.shorten('https://example.com/dup');
    const second = svc.shorten('https://example.com/dup');

    assert.strictEqual(first.shortCode, second.shortCode);
    assert.strictEqual(first.created, true);
    assert.strictEqual(second.created, false);
  });

  it('resolves a valid short code to the original URL', () => {
    const svc = new UrlService();
    const { shortCode } = svc.shorten('https://example.com/test');
    const resolved = svc.resolve(shortCode);
    assert.strictEqual(resolved, 'https://example.com/test');
  });

  it('returns null for unknown short codes (404)', () => {
    const svc = new UrlService();
    assert.strictEqual(svc.resolve('ZZZZZZ'), null);
    assert.strictEqual(svc.resolve('nonexistent'), null);
  });

  it('tracks the number of stored URLs', () => {
    const svc = new UrlService();
    assert.strictEqual(svc.size, 0);
    svc.shorten('https://a.com');
    svc.shorten('https://b.com');
    assert.strictEqual(svc.size, 2);
  });

  it('reset clears all mappings', () => {
    const svc = new UrlService();
    svc.shorten('https://a.com');
    svc.reset();
    assert.strictEqual(svc.size, 0);
  });
});
