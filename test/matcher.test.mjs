import test from 'node:test';
import assert from 'node:assert/strict';
import { matchStrains } from '../src/engine/matcher.js';

// Minimal strain factory. The matcher only reads id/name/type/effects (+
// optional effectOverrides/rating), so we keep fixtures tight.
const strain = (id, type, effects, extra = {}) => ({ id, name: id, type, effects, flavors: [], ...extra });

test('returns null for an empty or missing stash', () => {
  assert.equal(matchStrains([], { mood: 'chill' }), null);
  assert.equal(matchStrains(null, { mood: 'chill' }), null);
});

test('picks the strain whose effects fit the answers, with a strong score', () => {
  const relaxer = strain('relaxer', 'indica', ['Relaxed', 'Happy', 'Euphoric', 'Sleepy']);
  const energizer = strain('energizer', 'sativa', ['Energetic', 'Focused', 'Uplifted']);
  const res = matchStrains([energizer, relaxer], { mood: 'chill', goal: 'relax', intensity: 'moderate', vibe: 'movie' });
  assert.equal(res.pickedStrain.id, 'relaxer');
  assert.ok(res.matchScore > 80, `expected a strong score, got ${res.matchScore}`);
  assert.equal(res.isPerfectMatch, true);
  assert.equal(typeof res.reasoning, 'string');
});

test('isPerfectMatch is false when nothing fits well', () => {
  const off = strain('off', 'sativa', ['Energetic', 'Focused']);
  const res = matchStrains([off], { mood: 'chill', goal: 'sleep', intensity: 'low', vibe: 'movie' });
  assert.ok(res.matchScore < 80, `expected a weak score, got ${res.matchScore}`);
  assert.equal(res.isPerfectMatch, false);
});

test('type bonus favours indica for sleep over an identical sativa', () => {
  const effects = ['Sleepy', 'Relaxed'];
  const indica = strain('i', 'indica', effects);
  const sativa = strain('s', 'sativa', effects);
  const res = matchStrains([sativa, indica], { goal: 'sleep' });
  assert.equal(res.pickedStrain.id, 'i');
  const iScore = res.allScores.find((s) => s.strainId === 'i').score;
  const sScore = res.allScores.find((s) => s.strainId === 's').score;
  assert.ok(iScore > sScore, `indica ${iScore} should beat sativa ${sScore}`);
});

test('intensity multiplier scales a full-match score (high >= low)', () => {
  // Strain has every effect either intensity can desire, so the match ratio
  // stays 100% and only the scoreMultiplier differs (low 0.8 vs high 1.2).
  const s = strain('s', 'hybrid', ['Relaxed', 'Happy', 'Euphoric', 'Sleepy', 'Tingly']);
  const low = matchStrains([s], { mood: 'chill', intensity: 'low' }).matchScore;
  const high = matchStrains([s], { mood: 'chill', intensity: 'high' }).matchScore;
  assert.ok(high >= low, `high ${high} should be >= low ${low}`);
});

test('effectOverrides take priority over base effects', () => {
  const s = strain('s', 'hybrid', ['Energetic'], { effectOverrides: ['Relaxed', 'Happy', 'Sleepy'] });
  const res = matchStrains([s], { mood: 'chill', goal: 'relax' });
  assert.ok(res.matchScore > 50, `overrides should drive a relax match, got ${res.matchScore}`);
});

test('rating does NOT influence the match score (no unsourced ratings)', () => {
  const plain = matchStrains([strain('a', 'hybrid', ['Relaxed', 'Happy'])], { mood: 'chill' }).matchScore;
  const rated = matchStrains([strain('b', 'hybrid', ['Relaxed', 'Happy'], { rating: 5 })], { mood: 'chill' }).matchScore;
  assert.equal(rated, plain, `rating must not change score: rated ${rated} vs plain ${plain}`);
});

test('allScores includes every stash strain, sorted descending', () => {
  const res = matchStrains(
    [strain('a', 'indica', ['Relaxed']), strain('b', 'sativa', ['Energetic']), strain('c', 'hybrid', ['Happy'])],
    { mood: 'chill', goal: 'relax' },
  );
  assert.equal(res.allScores.length, 3);
  for (let i = 1; i < res.allScores.length; i++) {
    assert.ok(res.allScores[i - 1].score >= res.allScores[i].score, 'scores must be descending');
  }
});

test('tie-breaking is deterministic and independent of stash order', () => {
  // Identical strains tie on score; the winner must not depend on where a
  // strain sits in the input array (previously stable-sort kept input order).
  const effects = ['Relaxed', 'Happy'];
  const a = strain('aaa', 'hybrid', effects);
  const b = strain('bbb', 'hybrid', effects);
  const c = strain('ccc', 'hybrid', effects);
  const answers = { mood: 'chill', goal: 'relax' };
  const r1 = matchStrains([a, b, c], answers);
  const r2 = matchStrains([c, b, a], answers);
  assert.equal(r1.pickedStrain.id, r2.pickedStrain.id, 'winner must not depend on stash order');
  assert.deepEqual(r1.allScores, r2.allScores, 'full ordering must not depend on stash order');
  const r3 = matchStrains([a, b, c], answers);
  assert.deepEqual(r1.allScores, r3.allScores, 'same inputs must give the same order');
});

test('aligned terpenes nudge the score above an otherwise identical strain', () => {
  const effects = ['Relaxed', 'Sleepy'];
  const plain = strain('plain', 'hybrid', effects);
  const terped = strain('terped', 'hybrid', effects, {
    terpenes: [{ name: 'Myrcene' }, { name: 'Linalool' }],
  });
  const res = matchStrains([plain, terped], { mood: 'chill', goal: 'sleep' });
  const pScore = res.allScores.find((s) => s.strainId === 'plain').score;
  const tScore = res.allScores.find((s) => s.strainId === 'terped').score;
  assert.ok(tScore > pScore, `terpene-aligned ${tScore} should beat plain ${pScore}`);
  assert.equal(res.pickedStrain.id, 'terped');
});

test('terpene bonus is bounded and never a penalty', () => {
  const effects = ['Relaxed', 'Sleepy'];
  const plain = strain('plain', 'hybrid', effects);
  const aligned = strain('aligned', 'hybrid', effects, {
    terpenes: [{ name: 'Myrcene' }, { name: 'Linalool' }, { name: 'Caryophyllene' }],
  });
  const misaligned = strain('mis', 'hybrid', effects, {
    terpenes: [{ name: 'Terpinolene' }, { name: 'Ocimene' }],
  });
  const answers = { mood: 'chill', goal: 'sleep' };
  const score = (id, list) => matchStrains(list, answers).allScores.find((s) => s.strainId === id).score;
  const pScore = score('plain', [plain]);
  const aScore = score('aligned', [aligned]);
  const mScore = score('mis', [misaligned]);
  assert.ok(aScore - pScore <= 8, `bonus must stay bounded, got +${aScore - pScore}`);
  assert.ok(mScore >= pScore, `misaligned terpenes must not penalize: ${mScore} vs ${pScore}`);
});

test('intensity prefers THC-aligned strains when potency data exists', () => {
  const effects = ['Relaxed', 'Happy'];
  const mellow = strain('mellow', 'hybrid', effects, { thc: { min: 16, max: 18 } });
  const heavy = strain('heavy', 'hybrid', effects, { thc: { min: 29, max: 32 } });
  const low = matchStrains([heavy, mellow], { mood: 'chill', intensity: 'low' });
  assert.equal(low.pickedStrain.id, 'mellow', 'low intensity should pick the lower-THC strain');
  const high = matchStrains([heavy, mellow], { mood: 'chill', intensity: 'high' });
  assert.equal(high.pickedStrain.id, 'heavy', 'high intensity should pick the higher-THC strain');
});

test('strains without THC data are not penalized by intensity', () => {
  const effects = ['Relaxed', 'Happy'];
  const noData = matchStrains([strain('a', 'hybrid', effects)], { mood: 'chill', intensity: 'low' }).matchScore;
  const inBand = matchStrains([strain('b', 'hybrid', effects, { thc: { min: 16, max: 18 } })], { mood: 'chill', intensity: 'low' }).matchScore;
  assert.ok(inBand >= noData, 'aligned potency should only ever help');
  const heavyNoAnswer = matchStrains([strain('c', 'hybrid', effects, { thc: { min: 29, max: 32 } })], { mood: 'chill' }).matchScore;
  const plainNoAnswer = matchStrains([strain('d', 'hybrid', effects)], { mood: 'chill' }).matchScore;
  assert.equal(heavyNoAnswer, plainNoAnswer, 'without an intensity answer, THC data must not change the score');
});

test('personal feedback nudges past picks up or down', () => {
  const effects = ['Relaxed', 'Happy'];
  const a = strain('aaa', 'hybrid', effects);
  const b = strain('bbb', 'hybrid', effects);
  const answers = { mood: 'chill', goal: 'relax' };
  const base = matchStrains([a, b], answers);
  const loser = base.allScores[1].strainId;
  // A 'hit' verdict on the tie-loser should flip the pick
  const boosted = matchStrains([a, b], answers, { feedback: { [loser]: 'hit' } });
  assert.equal(boosted.pickedStrain.id, loser, 'hit feedback should win a near-tie');
  // A 'miss' on the original winner should also flip it
  const dropped = matchStrains([a, b], answers, { feedback: { [base.pickedStrain.id]: 'miss' } });
  assert.equal(dropped.pickedStrain.id, loser, 'miss feedback should lose a near-tie');
  // No feedback -> unchanged
  const again = matchStrains([a, b], answers, { feedback: {} });
  assert.equal(again.pickedStrain.id, base.pickedStrain.id);
});

test('scores are clamped to 0–100', () => {
  const res = matchStrains([strain('s', 'indica', ['Relaxed', 'Happy', 'Euphoric', 'Sleepy'])], {
    mood: 'chill', goal: 'relax', intensity: 'max', vibe: 'movie',
  });
  assert.ok(res.matchScore >= 0 && res.matchScore <= 100, `out of range: ${res.matchScore}`);
});
