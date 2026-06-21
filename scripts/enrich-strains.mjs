#!/usr/bin/env node
/**
 * Layer 1 strain enrichment — seed genetics + flavors from the openly-licensed
 * Kushy dataset (MIT). See docs/STRAIN-DATA-METHODOLOGY.md.
 *
 * REVIEW-ONLY: this script never writes public/data/strains.json. It produces
 * proposals in data-review/ for a human to approve. Nothing here can change a
 * live card.
 *
 * What it takes from Kushy (and ONLY this):
 *   - crosses  -> genetics  (IDs resolved to names within the dataset)
 *   - flavor   -> flavorsSuggested (new flavors only; advisory)
 *   - effects  -> effectsSuggested (intersected with OUR taxonomy; advisory)
 * What it deliberately DROPS for quality/compliance:
 *   - ailment          (medical claims)
 *   - thc/thca/.../cbl  (placeholder junk in this dataset)
 *   - description       (often contains medical phrasing; we keep ours)
 *
 * Usage:
 *   node scripts/enrich-strains.mjs                 # fetch Kushy (cached), write proposals
 *   node scripts/enrich-strains.mjs --csv path.csv  # use a local CSV instead
 *
 * Requires Node 18+ (global fetch). No npm dependencies.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normaliseName, coreStrainName } from '../api/_menuMatch.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const CSV_URL =
  'https://raw.githubusercontent.com/kushyapp/cannabis-dataset/master/Dataset/Strains/strains-kushy_api.2017-11-14.csv';
const CACHE = join(__dirname, '.cache', 'kushy-strains.csv');
const STRAINS = join(ROOT, 'public', 'data', 'strains.json');
const OUT_DIR = join(ROOT, 'data-review');
const OUT_JSON = join(OUT_DIR, 'kushy-enrichment-proposals.json');
const OUT_MD = join(OUT_DIR, 'kushy-enrichment-summary.md');
const SOURCE_TAG = 'kushy-2017-11-14';

// Our effect taxonomy (mirrors ALL_EFFECTS in src/main.js). Kushy effects get
// intersected with this, which automatically drops side-effects like
// "Dry Mouth", "Paranoid", "Anxious", "Dizzy".
const TAXONOMY_EFFECTS = new Set([
  'Relaxed', 'Happy', 'Euphoric', 'Creative', 'Uplifted', 'Energetic',
  'Focused', 'Talkative', 'Giggly', 'Sleepy', 'Hungry', 'Tingly',
  'Body High', 'Head High',
]);

// ---- tiny dependency-free CSV parser (handles quotes + embedded commas/newlines) ----
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else { field += c; }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

const clean = (v) => {
  if (v == null) return null;
  const t = String(v).trim();
  return (t === '' || t === 'NULL') ? null : t;
};
const titleCase = (s) =>
  s.trim().toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
const splitList = (v) =>
  (clean(v) || '').split(',').map((x) => x.trim()).filter(Boolean);

async function loadCsv() {
  const argCsv = process.argv.find((a) => a.startsWith('--csv'));
  if (argCsv) {
    const p = argCsv.includes('=') ? argCsv.split('=')[1] : process.argv[process.argv.indexOf(argCsv) + 1];
    console.log(`Reading local CSV: ${p}`);
    return readFileSync(p, 'utf8');
  }
  if (existsSync(CACHE)) {
    console.log(`Using cached Kushy CSV: ${CACHE}`);
    return readFileSync(CACHE, 'utf8');
  }
  console.log(`Fetching Kushy CSV: ${CSV_URL}`);
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const text = await res.text();
  mkdirSync(dirname(CACHE), { recursive: true });
  writeFileSync(CACHE, text);
  console.log(`Cached ${(text.length / 1e6).toFixed(2)} MB -> ${CACHE}`);
  return text;
}

function main(csvText) {
  const rows = parseCsv(csvText);
  const header = rows.shift().map((h) => h.replace(/^"|"$/g, '').trim());
  const col = Object.fromEntries(header.map((h, i) => [h, i]));
  for (const need of ['id', 'name', 'crosses', 'flavor', 'effects']) {
    if (!(need in col)) throw new Error(`CSV missing expected column: ${need}`);
  }

  // Index Kushy: id -> name (for lineage resolution) + normalised-name -> record.
  const idToName = new Map();
  const byNorm = new Map();
  const kushy = [];
  for (const r of rows) {
    if (!r.length || r.every((c) => clean(c) == null)) continue;
    const id = clean(r[col.id]);
    const name = clean(r[col.name]);
    if (!id || !name) continue;
    const rec = {
      id,
      name,
      crosses: splitList(r[col.crosses]).filter((x) => /^\d+$/.test(x) && x !== '0'),
      flavor: splitList(r[col.flavor]).map(titleCase),
      effects: splitList(r[col.effects]).map(titleCase).filter((e) => TAXONOMY_EFFECTS.has(e)),
    };
    idToName.set(id, name);
    kushy.push(rec);
    const key = normaliseName(coreStrainName(name));
    if (key && !byNorm.has(key)) byNorm.set(key, rec);
  }

  // Match each of OUR strains to a Kushy record (exact-normalised, then core).
  const ours = JSON.parse(readFileSync(STRAINS, 'utf8'));
  const proposals = [];
  const stats = { total: ours.length, matched: 0, genetics: 0, flavors: 0, effects: 0 };

  for (const s of ours) {
    const norm = normaliseName(s.name);
    const core = normaliseName(coreStrainName(s.name));
    const k = byNorm.get(norm) || byNorm.get(core);
    if (!k) continue;
    stats.matched++;

    // genetics (cross) from Kushy crosses (resolve ids -> names, exclude self)
    const parents = k.crosses
      .map((id) => idToName.get(id))
      .filter((n) => n && normaliseName(n) !== norm);
    const genetics = parents.length ? parents.join(' × ') : null;

    // new flavors only (don't duplicate what we already have)
    const haveFlavors = new Set((s.flavors || []).map((f) => f.toLowerCase()));
    const flavorsSuggested = [...new Set(k.flavor)].filter((f) => !haveFlavors.has(f.toLowerCase()));

    // advisory effect cross-reference (already taxonomy-filtered)
    const haveEffects = new Set((s.effects || []).map((e) => e.toLowerCase()));
    const effectsSuggested = k.effects.filter((e) => !haveEffects.has(e.toLowerCase()));

    if (!genetics && !flavorsSuggested.length && !effectsSuggested.length) continue;
    if (genetics) stats.genetics++;
    if (flavorsSuggested.length) stats.flavors++;
    if (effectsSuggested.length) stats.effects++;

    proposals.push({
      name: s.name,
      matchedKushy: { id: k.id, name: k.name },
      propose: {
        ...(genetics ? { genetics } : {}),
        ...(flavorsSuggested.length ? { flavorsSuggested } : {}),
        ...(effectsSuggested.length ? { effectsSuggested } : {}),
      },
      source: SOURCE_TAG,
      needsReview: true,
    });
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), source: SOURCE_TAG, stats, proposals }, null, 2));

  const pct = (n) => `${n} (${((n / stats.total) * 100).toFixed(0)}%)`;
  const md = [
    `# Kushy enrichment — proposals for review`,
    ``,
    `Generated ${new Date().toISOString()} from \`${SOURCE_TAG}\`. **Review-only** — nothing applied to strains.json.`,
    ``,
    `- Our strains: **${stats.total}**`,
    `- Matched in Kushy: **${pct(stats.matched)}**`,
    `- Got proposed genetics: **${pct(stats.genetics)}**`,
    `- Got new flavor suggestions: **${pct(stats.flavors)}**`,
    `- Got effect cross-refs: **${pct(stats.effects)}**`,
    ``,
    `Genetics fills gaps where we lack a cross (~100 strains). Flavors/effects are advisory.`,
    `Terpenes are NOT here — Kushy has none; those come from menu sync + AI draft.`,
    ``,
    `Full proposals: \`data-review/kushy-enrichment-proposals.json\`.`,
    ``,
    `## Sample (first 25)`,
    ``,
    ...proposals.slice(0, 25).map((p) => {
      const bits = [];
      if (p.propose.genetics) bits.push(`genetics: ${p.propose.genetics}`);
      if (p.propose.flavorsSuggested) bits.push(`+flavors: ${p.propose.flavorsSuggested.join(', ')}`);
      if (p.propose.effectsSuggested) bits.push(`+effects?: ${p.propose.effectsSuggested.join(', ')}`);
      return `- **${p.name}** — ${bits.join(' · ')}`;
    }),
  ].join('\n');
  writeFileSync(OUT_MD, md);

  console.log(`\nMatched ${stats.matched}/${stats.total} strains.`);
  console.log(`  genetics: ${stats.genetics}, flavors: ${stats.flavors}, effects: ${stats.effects}`);
  console.log(`Wrote ${OUT_JSON}`);
  console.log(`Wrote ${OUT_MD}`);
}

loadCsv().then(main).catch((e) => { console.error(e); process.exit(1); });
