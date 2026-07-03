#!/usr/bin/env node
/**
 * Layer 2 enrichment — pull THC/CBD potency ranges from a live dispensary menu
 * into a data-review proposal file.
 *
 * Fetches the Cookies Hayward Dovetail menu (public WP JSON endpoint), matches
 * flower products against strains.json, and writes ONLY thc/cbd range proposals
 * to data-review/menu-potency.json. Terpenes/effects from menus stay in the
 * admin sync review flow; this script is deliberately potency-only.
 *
 * Apply via the standard gate:
 *   node scripts/pull-menu-potency.mjs          # fetch + write proposals
 *   node scripts/apply-enrichment.mjs           # dry-run the merge
 *   node scripts/apply-enrichment.mjs --write   # apply (additive, fill-if-absent)
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
const OUT = join(ROOT, 'data-review', 'menu-potency.json');

const SOURCE = {
  provider: 'dovetail',
  baseUrl: 'https://cookiesdispensary.com',
  retailer: 'hayward',
  categories: ['premium-flower', 'flower'],
};
const SOURCE_LABEL = 'menu:cookies-hayward (Dovetail)';

// Infused flower (STIIIZY 40s, Pacific Stone Multi Infused, etc.) lives in the
// same "Premium Flower" category but its potency reflects the added concentrate,
// not the strain. Filter by name, plus a hard cap: flower above ~38% total THC
// is essentially always an infused product whether or not the name says so.
const INFUSED_RE = /\binfused\b/i;
const FLOWER_THC_CAP = 38;

const strains = JSON.parse(readFileSync(STRAINS, 'utf8'));

const products = await fetchDovetail(SOURCE);
console.log(`[pull-menu-potency] fetched ${products.length} products`);

// One proposal per strain; if several products match the same strain (multiple
// brands/batches), widen the range to cover all of them — honest about batch
// variance rather than pretending one batch is "the" number.
const byStrain = new Map();
let matched = 0;

let skippedInfused = 0;
for (const p of products) {
  if (p.category && !isFlower(p.category)) continue;
  if (!p.thcRange && !p.cbdRange) continue;
  if (INFUSED_RE.test(p.name) || (p.thcRange && p.thcRange.max > FLOWER_THC_CAP)) {
    skippedInfused++;
    continue;
  }
  const hit = findKnowledgeMatch(p.name, strains);
  if (!hit) continue;
  matched++;

  const cur = byStrain.get(hit.id) || { strain: hit, thc: null, cbd: null, products: [] };
  for (const key of ['thc', 'cbd']) {
    const range = p[`${key}Range`];
    if (!range) continue;
    cur[key] = cur[key]
      ? { min: Math.min(cur[key].min, range.min), max: Math.max(cur[key].max, range.max) }
      : { ...range };
  }
  cur.products.push(p.name + (p.brand ? ` (${p.brand})` : ''));
  byStrain.set(hit.id, cur);
}

const enrichment = [];
for (const { strain, thc, cbd, products: prods } of byStrain.values()) {
  const propose = {};
  if (thc && strain.thc == null) propose.thc = thc;
  if (cbd && strain.cbd == null) propose.cbd = cbd;
  if (!Object.keys(propose).length) continue;
  enrichment.push({
    name: strain.name,
    matchedProduct: prods.join('; '),
    propose,
    source: SOURCE_LABEL,
    needsReview: true,
  });
}

writeFileSync(OUT, JSON.stringify({
  _generated: new Date().toISOString().slice(0, 10),
  _source: SOURCE_LABEL,
  _note: 'THC/CBD ranges from live shelf data. Ranges widened across brands/batches where a strain had multiple products.',
  enrichment,
}, null, 2) + '\n', 'utf8');

console.log(`[pull-menu-potency] skipped ${skippedInfused} infused/over-cap products`);
console.log(`[pull-menu-potency] ${matched} product matches -> ${enrichment.length} strain proposals`);
console.log(`[pull-menu-potency] wrote ${OUT}`);
console.log('[pull-menu-potency] next: node scripts/apply-enrichment.mjs (dry-run), then --write');
