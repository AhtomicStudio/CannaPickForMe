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

test('a higher rating adds a small bonus', () => {
  const plain = matchStrains([strain('a', 'hybrid', ['Relaxed', 'Happy'])], { mood: 'chill' }).matchScore;
  const rated = matchStrains([strain('b', 'hybrid', ['Relaxed', 'Happy'], { rating: 5 })], { mood: 'chill' }).matchScore;
  assert.ok(rated >= plain, `rated ${rated} should be >= plain ${plain}`);
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

test('scores are clamped to 0–100', () => {
  const res = matchStrains([strain('s', 'indica', ['Relaxed', 'Happy', 'Euphoric', 'Sleepy'])], {
    mood: 'chill', goal: 'relax', intensity: 'max', vibe: 'movie',
  });
  assert.ok(res.matchScore >= 0 && res.matchScore <= 100, `out of range: ${res.matchScore}`);
});
