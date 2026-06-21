#!/usr/bin/env node
/**
 * Layer 3 — AI-draft research for the long tail. See docs/STRAIN-DATA-METHODOLOGY.md.
 *
 * No API key, no cost: it generates a strict paste-ready prompt for YOUR
 * Claude/Gemini chat, then ingests the JSON back and sanitizes it hard before
 * it ever touches the data. Nothing here auto-publishes — output is proposals
 * for the same review queue (apply-enrichment.mjs), human-approved via git diff.
 *
 * Two modes:
 *   node scripts/draft-research.mjs
 *     -> scans strains.json for gaps (missing genetics or terpenes) and writes
 *        data-review/ai-research-prompt.md  (paste each batch into your AI)
 *
 *   node scripts/draft-research.mjs --ingest data-review/ai-response.json
 *     -> validates + sanitizes the AI's JSON and writes
 *        data-review/ai-research-proposals.json  (then: apply-enrichment.mjs --write)
 *
 * No npm dependencies (Node 18+).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normaliseName } from '../api/_menuMatch.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const STRAINS = join(ROOT, 'public', 'data', 'strains.json');
const OUT_DIR = join(ROOT, 'data-review');
const PROMPT_OUT = join(OUT_DIR, 'ai-research-prompt.md');
const PROPOSALS_OUT = join(OUT_DIR, 'ai-research-proposals.json');
const CHUNK = 20;

// Common cannabis terpenes — the AI may only return names from this list.
const TERP_ALLOW = new Set([
  'myrcene', 'limonene', 'caryophyllene', 'pinene', 'alpha-pinene', 'beta-pinene',
  'linalool', 'terpinolene', 'humulene', 'ocimene', 'terpineol', 'bisabolol',
  'nerolidol', 'camphene', 'guaiol', 'valencene', 'eucalyptol', 'geraniol',
  'phellandrene', 'carene', 'sabinene', 'fenchol', 'borneol', 'pulegone',
]);
// Base effect taxonomy (NOT Head/Body High — tag-highs.mjs owns those).
const EFFECT_ALLOW = new Set([
  'Relaxed', 'Happy', 'Euphoric', 'Creative', 'Uplifted', 'Energetic',
  'Focused', 'Talkative', 'Giggly', 'Sleepy', 'Hungry', 'Tingly',
]);
// Anything that smells like a medical/health claim is rejected outright.
const MED = /\b(treat|cure|heal|pain|anxiet|depress|insomnia|cancer|medical|medicinal|nausea|seizure|inflamm|arthrit|migrain|ptsd|adhd|epilep|disorder|condition|relief|reliev|therap|symptom|diagnos|disease)/i;

const titleCase = (s) => String(s).trim().toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());

const INSTRUCTIONS =
`You are a cannabis strain reference assistant. Return ONLY a JSON array (no prose,
no markdown fences) of objects exactly shaped like:
[{ "name": "<exact name as given>", "genetics": "<Parent A × Parent B>" | null,
   "terpenes": ["Myrcene","Limonene"], "effects": ["Relaxed"], "source": "<e.g. Leafly>" }]

RULES (important):
- Only include facts that are widely documented. If unsure, use null or []. Never guess.
- genetics: the lineage cross as "A × B" (or null). No sentences.
- terpenes: ONLY names from this list, no percentages:
  ${[...TERP_ALLOW].map(titleCase).join(', ')}
- effects: ONLY from this list:
  ${[...EFFECT_ALLOW].join(', ')}
- NO medical or health claims anywhere — no conditions, no "helps/treats/relieves".
  Vibe/effect words only.
- Return one object per strain, in the same order. Output the JSON array only.`;

function loadStrains() {
  return JSON.parse(readFileSync(STRAINS, 'utf8'));
}

// ── Mode 1: scan gaps + write prompt pack ──────────────────────────────────────
function buildPrompt() {
  const strains = loadStrains();
  const gaps = strains.filter((s) => !s.genetics || !(Array.isArray(s.terpenes) && s.terpenes.length));
  if (!gaps.length) {
    console.log('No gaps found — every strain has genetics and terpenes.');
    return;
  }
  const noGen = gaps.filter((s) => !s.genetics).length;
  const noTerp = gaps.filter((s) => !(Array.isArray(s.terpenes) && s.terpenes.length)).length;

  const batches = [];
  for (let i = 0; i < gaps.length; i += CHUNK) batches.push(gaps.slice(i, i + CHUNK));

  const blocks = batches.map((batch, bi) => {
    const list = batch.map((s, i) => {
      const eff = (s.effects || []).filter((e) => e !== 'Head High' && e !== 'Body High');
      return `${i + 1}. ${s.name} (${s.type})${eff.length ? ` — current effects: ${eff.join(', ')}` : ''}`;
    }).join('\n');
    return `\n\n---\n\n## PASTE THIS AS ONE MESSAGE — batch ${bi + 1} of ${batches.length}\n\n${INSTRUCTIONS}\n\nSTRAINS:\n${list}\n`;
  });

  mkdirSync(OUT_DIR, { recursive: true });
  const header = `# AI research prompt pack\n\nGaps: ${gaps.length} strains (${noGen} missing genetics, ${noTerp} missing terpenes).\nPaste each batch below into Claude or Gemini. Save the combined JSON replies into one\nfile (a JSON array), then run:\n\n    node scripts/draft-research.mjs --ingest data-review/ai-response.json\n`;
  writeFileSync(PROMPT_OUT, header + blocks.join(''));
  console.log(`Gaps: ${gaps.length} (${noGen} no genetics, ${noTerp} no terpenes) across ${batches.length} batch(es).`);
  console.log(`Wrote ${PROMPT_OUT}`);
}

// ── Mode 2: ingest + sanitize AI JSON -> proposals ─────────────────────────────
function extractArray(text) {
  const t = text.replace(/```json/gi, '').replace(/```/g, '');
  const a = t.indexOf('['), b = t.lastIndexOf(']');
  if (a < 0 || b < 0 || b < a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

function ingest(file) {
  const strains = loadStrains();
  const byName = new Map(strains.map((s) => [normaliseName(s.name), s]));
  const raw = readFileSync(file, 'utf8');
  const arr = extractArray(raw);
  if (!Array.isArray(arr)) {
    console.error(`Could not parse a JSON array from ${file}. Make sure it contains the AI's reply.`);
    process.exit(1);
  }

  const proposals = [];
  const stats = { entries: arr.length, matched: 0, genetics: 0, terpenes: 0, effects: 0, rejectedMed: 0, unmatched: 0 };
  for (const e of arr) {
    if (!e || typeof e !== 'object') continue;
    const s = byName.get(normaliseName(e.name || ''));
    if (!s) { stats.unmatched++; continue; }
    stats.matched++;
    const propose = {};

    if (typeof e.genetics === 'string') {
      const g = e.genetics.trim();
      if (g && g.length <= 80 && /[×x]| and /i.test(g)) {
        if (MED.test(g)) stats.rejectedMed++;
        else { propose.genetics = g.replace(/\s+[xX]\s+/g, ' × '); stats.genetics++; }
      }
    }

    if (Array.isArray(e.terpenes)) {
      const terps = [...new Set(
        e.terpenes.map((t) => String(t && t.name ? t.name : t).trim())
          .filter((t) => TERP_ALLOW.has(t.toLowerCase()))
          .map(titleCase),
      )];
      if (terps.length) { propose.terpenes = terps.map((name) => ({ name })); stats.terpenes++; }
    }

    if (Array.isArray(e.effects)) {
      const eff = [...new Set(e.effects.map(titleCase).filter((x) => EFFECT_ALLOW.has(x)))];
      if (eff.length) { propose.effectsSuggested = eff; stats.effects++; }
    }

    if (Object.keys(propose).length) {
      proposals.push({ name: s.name, source: 'ai-draft', aiSource: typeof e.source === 'string' ? e.source.slice(0, 60) : null, propose, needsReview: true });
    }
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(PROPOSALS_OUT, JSON.stringify({ generatedAt: new Date().toISOString(), source: 'ai-draft', stats, proposals }, null, 2) + '\n');
  console.log(`Entries: ${stats.entries} | matched ${stats.matched} | proposals ${proposals.length}`);
  console.log(`  genetics: ${stats.genetics}, terpenes: ${stats.terpenes}, effects: ${stats.effects}`);
  if (stats.rejectedMed) console.log(`  rejected (medical-claim genetics): ${stats.rejectedMed}`);
  if (stats.unmatched) console.log(`  unmatched names: ${stats.unmatched}`);
  console.log(`\nWrote ${PROPOSALS_OUT}`);
  console.log(`Review it, then:  node scripts/apply-enrichment.mjs --write           (genetics + terpenes)`);
  console.log(`                  node scripts/apply-enrichment.mjs --write --effects (also effect suggestions)`);
}

const ingestIdx = process.argv.indexOf('--ingest');
if (ingestIdx !== -1) {
  const file = process.argv[ingestIdx + 1];
  if (!file) { console.error('Usage: --ingest <path-to-ai-response.json>'); process.exit(1); }
  ingest(file);
} else {
  buildPrompt();
}
