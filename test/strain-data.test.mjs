import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Data-quality guardrail for the strain knowledge base. Runs in CI, so any
// drift (a bad effect tag, a missing field, a medical-claim sneaking in via a
// menu sync or a hand edit) fails the build instead of shipping silently.
const __dirname = dirname(fileURLToPath(import.meta.url));
const strains = JSON.parse(readFileSync(join(__dirname, '../public/data/strains.json'), 'utf8'));

// The app's effect taxonomy (mirrors ALL_EFFECTS in src/main.js + effect-map.json).
const EFFECTS = new Set([
  'Relaxed', 'Happy', 'Euphoric', 'Creative', 'Uplifted', 'Energetic',
  'Focused', 'Talkative', 'Giggly', 'Sleepy', 'Hungry', 'Tingly', 'Body High', 'Head High',
]);

test('strains.json is a non-empty array', () => {
  assert.ok(Array.isArray(strains) && strains.length > 100, `got ${strains && strains.length}`);
});

test('every strain has name, type, effects, flavors, and description', () => {
  for (const s of strains) {
    assert.ok(s && typeof s.name === 'string' && s.name.trim(), `missing name near ${JSON.stringify(s).slice(0, 80)}`);
    assert.ok(s.type, `${s.name}: missing type`);
    assert.ok(Array.isArray(s.effects) && s.effects.length >= 1, `${s.name}: no effects`);
    assert.ok(Array.isArray(s.flavors) && s.flavors.length >= 1, `${s.name}: no flavors`);
    assert.ok(s.description && String(s.description).trim(), `${s.name}: no description`);
  }
});

test('every effect tag is in the taxonomy (blocks off-taxonomy tags and medical claims)', () => {
  const offenders = [];
  for (const s of strains) {
    for (const e of (s.effects || [])) if (!EFFECTS.has(e)) offenders.push(`${s.name}: "${e}"`);
  }
  assert.equal(offenders.length, 0, `off-taxonomy effect tags found:\n${offenders.join('\n')}`);
});

test('no duplicate effect tags within a strain', () => {
  for (const s of strains) {
    const eff = s.effects || [];
    assert.equal(new Set(eff).size, eff.length, `${s.name}: duplicate effect tag`);
  }
});

// --- Optional enrichment fields (terpenes, thc/cbd, dataSources). ---
// All optional and backward-compatible: a strain without them is valid. When
// present, they must be well-formed so Layer 1/2/3 enrichment can't ship junk.

test('optional terpenes, when present, are well-formed', () => {
  for (const s of strains) {
    if (s.terpenes == null) continue;
    assert.ok(Array.isArray(s.terpenes), `${s.name}: terpenes must be an array`);
    for (const t of s.terpenes) {
      assert.ok(t && typeof t.name === 'string' && t.name.trim(), `${s.name}: terpene needs a name`);
      if (t.pct != null) assert.ok(typeof t.pct === 'number' && t.pct >= 0 && t.pct <= 100, `${s.name}: terpene pct out of range`);
      if (t.dominant != null) assert.ok(typeof t.dominant === 'boolean', `${s.name}: terpene.dominant must be boolean`);
    }
  }
});

test('optional thc/cbd ranges, when present, are numeric with min <= max', () => {
  for (const s of strains) {
    for (const key of ['thc', 'cbd']) {
      const r = s[key];
      if (r == null) continue;
      assert.ok(r && typeof r.min === 'number' && typeof r.max === 'number', `${s.name}: ${key} must be {min,max} numbers`);
      assert.ok(r.min <= r.max, `${s.name}: ${key} min > max`);
    }
  }
});

test('optional dataSources, when present, are well-formed', () => {
  for (const s of strains) {
    if (s.dataSources == null) continue;
    assert.ok(Array.isArray(s.dataSources), `${s.name}: dataSources must be an array`);
    for (const d of s.dataSources) {
      assert.ok(d && typeof d.field === 'string' && typeof d.source === 'string', `${s.name}: dataSource needs field + source`);
    }
  }
});
