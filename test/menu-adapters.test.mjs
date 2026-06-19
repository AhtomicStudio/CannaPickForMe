import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDovetailUrl, parseDovetailResults, fetchDovetail } from '../api/_menuAdapters.mjs';

const source = {
  provider: 'dovetail',
  baseUrl: 'https://cookiesdispensary.com',
  retailer: 'hayward',
  categories: ['premium-flower', 'flower'],
};

test('buildDovetailUrl builds the products URL with categories + page', () => {
  const url = buildDovetailUrl(source, 2);
  assert.match(url, /^https:\/\/cookiesdispensary\.com\/wp-json\/dovetail-api\/v1\/products\?/);
  assert.match(url, /retailer=hayward/);
  assert.match(url, /repository=dutchie_plus/);
  assert.match(url, /categories\[\]=premium-flower/);
  assert.match(url, /categories\[\]=flower/);
  assert.match(url, /page=2/);
});

test('buildDovetailUrl trims trailing slash and defaults category', () => {
  const url = buildDovetailUrl({ baseUrl: 'https://x.com/', retailer: 'r' }, 1);
  assert.match(url, /^https:\/\/x\.com\/wp-json/);
  assert.match(url, /categories\[\]=premium-flower/);
});

// A page shaped like the real Cookies response: each result has a top-level
// `name` (the strain) plus nested objects that ALSO contain `name`s.
const page = {
  total: 3, page: 1, pages: 1, per_page: 20,
  results: [
    {
      id: '1', name: 'Gluetopia', description: 'A cross...', category: 'Premium Flower', subcategory: 'Default',
      brand: { name: 'Cannabiotix' },
      specials: [{ name: 'EVERYDAY DEALS - 30% OFF ENTIRE STORE' }],
      variants: [{ name: '1/8oz' }],
      potency: [{ name: 'THC-D9 (Delta 9)', value: '28.5' }, { name: 'THCA', value: '30' }],
    },
    { id: '2', name: 'Kush Mints', category: 'Premium Flower', brand: 'CAM', potency: [{ name: 'THC-D9', value: '26' }] },
    { id: '3', name: '   ', category: 'Premium Flower' }, // blank name → dropped
  ],
};

test('parseDovetailResults extracts only the top-level strain names', () => {
  const out = parseDovetailResults(page);
  assert.deepEqual(out.map((p) => p.name), ['Gluetopia', 'Kush Mints']);
  // nested names must NOT leak in as products
  const names = out.map((p) => p.name);
  for (const leak of ['Cannabiotix', 'CAM', 'EVERYDAY DEALS - 30% OFF ENTIRE STORE', '1/8oz', 'THC-D9']) {
    assert.ok(!names.includes(leak), `leaked nested name: ${leak}`);
  }
});

test('parseDovetailResults reads brand (object or string) and THC (not THCA)', () => {
  const out = parseDovetailResults(page);
  assert.equal(out[0].brand, 'Cannabiotix');
  assert.equal(out[0].thc, 28.5);
  assert.equal(out[1].brand, 'CAM');
  assert.equal(out[1].thc, 26);
});

test('parseDovetailResults tolerates products[] or a bare array', () => {
  assert.equal(parseDovetailResults({ products: [{ name: 'X' }] })[0].name, 'X');
  assert.equal(parseDovetailResults([{ name: 'Y' }])[0].name, 'Y');
  assert.deepEqual(parseDovetailResults({}), []);
});

test('fetchDovetail follows pagination and concatenates all pages', async () => {
  const pages = {
    1: { pages: 2, results: [{ name: 'A', category: 'Premium Flower' }] },
    2: { pages: 2, results: [{ name: 'B', category: 'Premium Flower' }] },
  };
  const calls = [];
  const mockFetch = async (url) => {
    calls.push(url);
    const p = Number(url.match(/page=(\d+)/)[1]);
    return { ok: true, json: async () => pages[p] };
  };
  const out = await fetchDovetail(source, mockFetch);
  assert.deepEqual(out.map((p) => p.name), ['A', 'B']);
  assert.equal(calls.length, 2);
});

test('fetchDovetail stops on a non-ok response without throwing', async () => {
  const mockFetch = async () => ({ ok: false, status: 502, json: async () => ({}) });
  assert.deepEqual(await fetchDovetail(source, mockFetch), []);
});
