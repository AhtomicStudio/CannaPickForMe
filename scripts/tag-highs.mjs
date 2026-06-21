#!/usr/bin/env node
/**
 * Head High / Body High tagging — a strict, idempotent retag. See
 * docs/STRAIN-DATA-METHODOLOGY.md §7.
 *
 * These two tags are a DERIVED classification we own, not reviewed external
 * data — so this script writes them directly into strains.json (dry-run by
 * default). It is the single source of truth for them:
 *   1. strips any existing Head/Body High tag (+ its provenance),
 *   2. scores each strain on REAL signals only (type + terpenes + genuine
 *      effects — never the computed tag itself, which would be circular),
 *   3. tags ONLY when one axis clearly dominates (selective, not blanket).
 *
 * Balanced strains get no tag. Re-running always yields the same result.
 *
 * Signals:
 *   Body  <- indica lean · myrcene/linalool/caryophyllene · relaxed/sleepy/hungry
 *   Head  <- sativa lean · limonene/terpinolene/pinene/ocimene · energetic/creative/focused/uplifted
 *
 * Usage:  node scripts/tag-highs.mjs           # dry-run: distribution + what changes
 *         node scripts/tag-highs.mjs --write    # apply, then review `git diff`
 *
 * Tuning: raise FLOOR/MARGIN for fewer, stronger tags; lower for more.
 * No npm dependencies (Node 18+).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STRAINS = join(__dirname, '..', 'public', 'data', 'strains.json');
const SOURCE = 'heuristic-highs';
const TODAY = new Date().toISOString().slice(0, 10);
const WRITE = process.argv.includes('--write');

// Selectivity knobs: a tag needs a high absolute lean AND clear dominance.
const FLOOR = 4;   // minimum score on the winning axis
const MARGIN = 2;  // how far it must beat the other axis

// NOTE: the output tags (body high / head high) are deliberately NOT in these
// sets — scoring must use real signals only, so the retag is non-circular.
const BODY_TERPS = new Set(['myrcene', 'linalool', 'caryophyllene', 'humulene', 'bisabolol', 'nerolidol']);
const HEAD_TERPS = new Set(['limonene', 'terpinolene', 'pinene', 'alpha-pinene', 'beta-pinene', 'ocimene', 'valencene']);
const BODY_EFFECTS = new Set(['relaxed', 'sleepy', 'hungry', 'tingly']);
const HEAD_EFFECTS = new Set(['energetic', 'creative', 'focused', 'uplifted', 'talkative', 'giggly']);

function score(type, terpenes, baseEffects) {
  let body = 0, head = 0;
  const t = String(type || '').toLowerCase();
  if (t === 'indica') body += 2;
  else if (t === 'sativa') head += 2;
  else if (t === 'hybrid') { body += 1; head += 1; }

  const terps = (terpenes || []).map((x) => String(x.name || x).toLowerCase());
  body += Math.min(2, terps.filter((x) => BODY_TERPS.has(x)).length);
  head += Math.min(2, terps.filter((x) => HEAD_TERPS.has(x)).length);

  const eff = baseEffects.map((e) => e.toLowerCase());
  body += eff.filter((e) => BODY_EFFECTS.has(e)).length;
  head += eff.filter((e) => HEAD_EFFECTS.has(e)).length;
  return { body, head };
}

function main() {
  const strains = JSON.parse(readFileSync(STRAINS, 'utf8'));
  const dist = { body: 0, head: 0, neither: 0 };
  const removed = [], added = [];
  let changed = 0;

  for (const s of strains) {
    const current = s.effects || [];
    const hadBody = current.includes('Body High');
    const hadHead = current.includes('Head High');

    // 1. strip computed tags -> real effects only
    const base = current.filter((e) => e !== 'Body High' && e !== 'Head High');

    // 2. score on real signals
    const { body, head } = score(s.type, s.terpenes, base);

    // 3. tag only on clear dominance
    let tag = null;
    if (body >= FLOOR && body - head >= MARGIN) tag = 'Body High';
    else if (head >= FLOOR && head - body >= MARGIN) tag = 'Head High';

    s.effects = tag ? [...base, tag] : base;

    // provenance: drop our old stamp, re-add only if we tagged
    s.dataSources = (s.dataSources || []).filter((d) => !(d.field === 'effects' && d.source === SOURCE));
    if (tag) s.dataSources.push({ field: 'effects', source: SOURCE, fetchedAt: TODAY });
    if (!s.dataSources.length) delete s.dataSources;

    if (tag === 'Body High') dist.body++;
    else if (tag === 'Head High') dist.head++;
    else dist.neither++;

    const nowBody = tag === 'Body High', nowHead = tag === 'Head High';
    if (hadBody && !nowBody) removed.push(`${s.name} (Body High)`);
    if (hadHead && !nowHead) removed.push(`${s.name} (Head High)`);
    if (!hadBody && nowBody) added.push(`${s.name} (Body High)`);
    if (!hadHead && nowHead) added.push(`${s.name} (Head High)`);
    if (hadBody !== nowBody || hadHead !== nowHead) changed++;
  }

  const total = strains.length;
  const pct = (n) => `${n} (${((n / total) * 100).toFixed(0)}%)`;
  console.log(`Strains: ${total}  |  FLOOR=${FLOOR} MARGIN=${MARGIN}`);
  console.log(`  Body High: ${pct(dist.body)}`);
  console.log(`  Head High: ${pct(dist.head)}`);
  console.log(`  no tag:    ${pct(dist.neither)}`);
  console.log(`  net changes vs current: ${changed} (removed ${removed.length}, added ${added.length})`);
  if (removed.length) console.log(`\nRemoved (sample):\n  ${removed.slice(0, 30).join('\n  ')}${removed.length > 30 ? `\n  ...+${removed.length - 30} more` : ''}`);
  if (added.length) console.log(`\nAdded (sample):\n  ${added.slice(0, 20).join('\n  ')}${added.length > 20 ? `\n  ...+${added.length - 20} more` : ''}`);

  if (!WRITE) {
    console.log(`\nDRY RUN — nothing written. Re-run with --write to apply, then review \`git diff\`.`);
    return;
  }
  writeFileSync(STRAINS, JSON.stringify(strains, null, 2) + '\n');
  console.log(`\nWrote ${STRAINS}. Review \`git diff\` before committing.`);
}

main();
