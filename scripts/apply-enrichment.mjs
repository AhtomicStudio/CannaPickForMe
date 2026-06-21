#!/usr/bin/env node
/**
 * Consolidation step — apply reviewed enrichment proposals into strains.json.
 *
 * Reads every JSON file in data-review/ and merges proposals from BOTH layers:
 *   - Layer 1 (Kushy)  : { proposals: [{ name, propose:{ genetics, flavorsSuggested, effectsSuggested } }] }
 *   - Layer 2 (menu)   : { enrichment: [{ name, propose:{ terpenes, thc, cbd, effectsSuggested, typeMismatch } }] }
 *   - or a bare array of those proposal objects.
 *
 * Safety model (see docs/STRAIN-DATA-METHODOLOGY.md):
 *   - DRY-RUN by default. Pass --write to actually modify strains.json.
 *   - Only ADDITIVE / fill-if-absent merges; existing values are never overwritten.
 *   - effectsSuggested is advisory (it changes matching) → skipped unless --effects.
 *   - typeMismatch is NEVER auto-applied → printed for manual resolution.
 *   - Every applied field records provenance in the strain's dataSources[].
 *   - Idempotent: re-running changes nothing once applied.
 *   - The final human gate is `git diff` before you commit.
 *
 * Usage:
 *   node scripts/apply-enrichment.mjs            # dry-run: show what would change
 *   node scripts/apply-enrichment.mjs --write    # apply safe fields
 *   node scripts/apply-enrichment.mjs --write --effects   # also apply effect suggestions
 *
 * No npm dependencies (Node 18+).
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normaliseName } from '../api/_menuMatch.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const STRAINS = join(ROOT, 'public', 'data', 'strains.json');
const REVIEW_DIR = join(ROOT, 'data-review');

const WRITE = process.argv.includes('--write');
const INCLUDE_EFFECTS = process.argv.includes('--effects');
const TODAY = new Date().toISOString().slice(0, 10);

// Taxonomy guard — never apply an off-taxonomy effect even if a proposal file has one.
const TAXONOMY_EFFECTS = new Set([
  'Relaxed', 'Happy', 'Euphoric', 'Creative', 'Uplifted', 'Energetic',
  'Focused', 'Talkative', 'Giggly', 'Sleepy', 'Hungry', 'Tingly', 'Body High', 'Head High',
]);

function loadProposals() {
  if (!existsSync(REVIEW_DIR)) return [];
  const out = [];
  for (const f of readdirSync(REVIEW_DIR).filter((x) => x.endsWith('.json'))) {
    let data;
    try { data = JSON.parse(readFileSync(join(REVIEW_DIR, f), 'utf8')); } catch { continue; }
    const list = Array.isArray(data) ? data : (data.proposals || data.enrichment || []);
    for (const p of list) if (p && p.name && p.propose) out.push({ ...p, _file: f });
  }
  return out;
}

function addSource(strain, field, source) {
  strain.dataSources = strain.dataSources || [];
  if (!strain.dataSources.some((d) => d.field === field && d.source === source)) {
    strain.dataSources.push({ field, source, fetchedAt: TODAY });
  }
}

/** Merge one proposal into a strain (additive, fill-if-absent). Records changes + manual items. */
function applyProposal(strain, p, changes, manual) {
  const src = p.source || 'enrichment';
  const pr = p.propose || {};

  if (pr.genetics && !strain.genetics) {
    strain.genetics = pr.genetics;
    addSource(strain, 'genetics', src);
    changes.push(`${strain.name}: +genetics (${pr.genetics})`);
  }

  if (Array.isArray(pr.terpenes) && pr.terpenes.length) {
    strain.terpenes = strain.terpenes || [];
    const have = new Set(strain.terpenes.map((t) => String(t.name || t).toLowerCase()));
    const add = pr.terpenes
      .map((t) => (typeof t === 'string' ? { name: t } : t))
      .filter((t) => t && t.name && !have.has(String(t.name).toLowerCase()));
    if (add.length) {
      strain.terpenes.push(...add);
      addSource(strain, 'terpenes', src);
      changes.push(`${strain.name}: +terpenes (${add.map((t) => t.name).join(', ')})`);
    }
  }

  if (Array.isArray(pr.flavorsSuggested) && pr.flavorsSuggested.length) {
    strain.flavors = strain.flavors || [];
    const have = new Set(strain.flavors.map((f) => f.toLowerCase()));
    const add = pr.flavorsSuggested.filter((f) => !have.has(f.toLowerCase()));
    if (add.length) {
      strain.flavors.push(...add);
      addSource(strain, 'flavors', src);
      changes.push(`${strain.name}: +flavors (${add.join(', ')})`);
    }
  }

  for (const key of ['thc', 'cbd']) {
    if (pr[key] && strain[key] == null && typeof pr[key].min === 'number') {
      strain[key] = pr[key];
      addSource(strain, key, src);
      changes.push(`${strain.name}: +${key} (${pr[key].min}-${pr[key].max})`);
    }
  }

  if (Array.isArray(pr.effectsSuggested) && pr.effectsSuggested.length) {
    if (INCLUDE_EFFECTS) {
      strain.effects = strain.effects || [];
      const have = new Set(strain.effects.map((e) => e.toLowerCase()));
      const add = pr.effectsSuggested.filter((e) => TAXONOMY_EFFECTS.has(e) && !have.has(e.toLowerCase()));
      if (add.length) {
        strain.effects.push(...add);
        addSource(strain, 'effects', src);
        changes.push(`${strain.name}: +effects (${add.join(', ')})`);
      }
    } else {
      manual.push(`${strain.name}: effect suggestions (run with --effects to apply): ${pr.effectsSuggested.join(', ')}`);
    }
  }

  if (pr.typeMismatch) {
    manual.push(`${strain.name}: TYPE mismatch — ours=${pr.typeMismatch.ours}, menu=${pr.typeMismatch.menu} (resolve by hand)`);
  }
}

function main() {
  const strains = JSON.parse(readFileSync(STRAINS, 'utf8'));
  const byName = new Map();
  for (const s of strains) byName.set(normaliseName(s.name), s);

  const proposals = loadProposals();
  if (!proposals.length) {
    console.log(`No proposals found in ${REVIEW_DIR}. Run the producers first (scripts/enrich-strains.mjs, or save a sync's enrichment[] there).`);
    return;
  }

  const changes = [], manual = [], unmatched = [];
  for (const p of proposals) {
    const s = byName.get(normaliseName(p.name));
    if (!s) { unmatched.push(p.name); continue; }
    applyProposal(s, p, changes, manual);
  }

  console.log(`Proposals read: ${proposals.length} | strains changed: ${new Set(changes.map((c) => c.split(':')[0])).size}`);
  console.log(`\n=== Changes (${changes.length}) ===`);
  for (const c of changes.slice(0, 200)) console.log('  ' + c);
  if (changes.length > 200) console.log(`  ...and ${changes.length - 200} more`);

  if (manual.length) {
    console.log(`\n=== Manual review (${manual.length}) — NOT applied ===`);
    for (const m of manual) console.log('  ' + m);
  }
  if (unmatched.length) {
    console.log(`\n=== Proposals with no matching strain (${unmatched.length}) ===`);
    console.log('  ' + [...new Set(unmatched)].slice(0, 50).join(', '));
  }

  if (!WRITE) {
    console.log(`\nDRY RUN — nothing written. Re-run with --write to apply, then review \`git diff\`.`);
    return;
  }
  if (!changes.length) {
    console.log(`\nNothing to apply (already up to date).`);
    return;
  }
  writeFileSync(STRAINS, JSON.stringify(strains, null, 2) + '\n');
  console.log(`\nWrote ${STRAINS}. Review \`git diff\` before committing.`);
}

main();
