import test from 'node:test';
import assert from 'node:assert/strict';
import { filterByTags, strainMatchesTags } from '../src/engine/tagFilter.mjs';

const S = (id, effects, flavors = []) => ({ id, name: id, effects, flavors });
const strains = [
  S('a', ['Relaxed', 'Happy'], ['Berry']),
  S('b', ['Energetic', 'Focused'], ['Citrus']),
  S('c', ['Relaxed', 'Sleepy'], ['Berry', 'Pine']),
];
const m = (entries = []) => new Map(entries);

test('no filters returns everything', () => {
  assert.equal(filterByTags(strains, m(), m()).length, 3);
});

test('include effect keeps strains that have it (OR within category)', () => {
  assert.deepEqual(filterByTags(strains, m([['Relaxed', 'in']]), m()).map((s) => s.id), ['a', 'c']);
});

test('exclude effect removes strains that have it', () => {
  assert.deepEqual(filterByTags(strains, m([['Sleepy', 'ex']]), m()).map((s) => s.id), ['a', 'b']);
});

test('include + exclude combine within a category', () => {
  // include Relaxed -> a,c ; then exclude Sleepy removes c -> a
  assert.deepEqual(filterByTags(strains, m([['Relaxed', 'in'], ['Sleepy', 'ex']]), m()).map((s) => s.id), ['a']);
});

test('effects AND flavors across categories', () => {
  // effect Relaxed -> a,c ; flavor Pine -> only c
  assert.deepEqual(filterByTags(strains, m([['Relaxed', 'in']]), m([['Pine', 'in']])).map((s) => s.id), ['c']);
});

test('flavor exclude removes matching strains', () => {
  assert.deepEqual(filterByTags(strains, m(), m([['Berry', 'ex']])).map((s) => s.id), ['b']);
});

test('strainMatchesTags evaluates a single strain', () => {
  assert.equal(strainMatchesTags(strains[0], m([['Relaxed', 'in']]), m()), true);
  assert.equal(strainMatchesTags(strains[1], m([['Relaxed', 'in']]), m()), false);
});
