#!/usr/bin/env node
/**
 * Snapshot which library strains are on a dispensary's live menu right now.
 *
 * Writes public/data/menu-availability.json, which generate-seo.mjs bakes
 * into strain pages ("on the menu at Cookies Hayward as of <date>"). The
 * snapshot is committed, so the Vercel prebuild never needs network access;
 * freshness is bounded by how often this is re-run before a deploy.
 *
 *   node scripts/pull-menu-availability.mjs
 *
 * No npm dependencies (Node 18+, global fetch).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchDovetail } from '../api/_menuAdapters.mjs';
import { findKnowledgeMatch, isFlower } from '../api/_menuMatch.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const STRAINS = join(ROOT, 'public', 'data', 'strains.json');
const OUT = join(ROOT, 'public', 'data', 'menu-availability.json');

// One entry per tracked dispensary. Adding a dispensary is config, not code
// (same philosophy as the menu adapters).
const DISPENSARIES = [
  {
    id: 'cookies-hayward',
    name: 'Cookies Hayward',
    url: 'https://cookiesdispensary.com',
    source: {
      provider: 'dovetail',
      baseUrl: 'https://cookiesdispensary.com',
      retailer: 'hayward',
      categories: ['premium-flower', 'flower'],
    },
  },
];

const strains = JSON.parse(readFileSync(STRAINS, 'utf8'));
const fetched = new Date().toISOString().slice(0, 10);
const out = { _fetched: fetched, dispensaries: {} };

for (const disp of DISPENSARIES) {
  const products = await fetchDovetail(disp.source);
  const ids = new Set();
  for (const p of products) {
    if (p.category && !isFlower(p.category)) continue;
    const hit = findKnowledgeMatch(p.name, strains);
    if (hit) ids.add(hit.id);
  }
  out.dispensaries[disp.id] = {
    name: disp.name,
    url: disp.url,
    strains: [...ids].sort(),
  };
  console.log(`[menu-availability] ${disp.name}: ${products.length} products -> ${ids.size} matched strains`);
}

writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`[menu-availability] wrote ${OUT} (fetched ${fetched})`);
