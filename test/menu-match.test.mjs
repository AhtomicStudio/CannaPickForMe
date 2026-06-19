import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseName, isFlower, findKnowledgeMatch, coreStrainName } from '../api/_menuMatch.mjs';

const strains = [
  { id: 'blue-dream', name: 'Blue Dream', type: 'hybrid' },
  { id: 'gelato-33', name: 'Gelato #33', type: 'hybrid' },
  { id: 'og-kush', name: 'OG Kush', type: 'indica' },
];

test('normaliseName lowercases, strips punctuation, collapses spaces', () => {
  assert.equal(normaliseName('Blue Dream!! '), 'blue dream');
  assert.equal(normaliseName('Gelato #33'), 'gelato 33');
  assert.equal(normaliseName('  OG    Kush  '), 'og kush');
});

test('isFlower detects flower categories only', () => {
  assert.equal(isFlower('Flower'), true);
  assert.equal(isFlower('Loose Flower'), true);
  assert.equal(isFlower('Nugs'), true);
  assert.equal(isFlower('Vape Cartridge'), false);
  assert.equal(isFlower('Edibles'), false);
});

test('findKnowledgeMatch: exact match ignoring case and punctuation', () => {
  assert.equal(findKnowledgeMatch('blue dream', strains)?.id, 'blue-dream');
  assert.equal(findKnowledgeMatch('Gelato 33', strains)?.id, 'gelato-33');
});

test('findKnowledgeMatch: contains match for branded product names', () => {
  assert.equal(findKnowledgeMatch('Cookies Blue Dream 3.5g', strains)?.id, 'blue-dream');
});

test('findKnowledgeMatch: returns null when nothing matches', () => {
  assert.equal(findKnowledgeMatch('Unknown Strain XYZ', strains), null);
  assert.equal(findKnowledgeMatch('', strains), null);
});

test('findKnowledgeMatch: a blank knowledge-base name never false-matches', () => {
  assert.equal(findKnowledgeMatch('anything at all', [{ id: 'x', name: '' }]), null);
});

test('coreStrainName strips grow-type suffixes and weights', () => {
  assert.equal(coreStrainName('Nerdz - Indoor'), 'Nerdz');
  assert.equal(coreStrainName('Kush Mints - Smalls'), 'Kush Mints');
  assert.equal(coreStrainName('Blue Dream 3.5g'), 'Blue Dream');
  assert.equal(coreStrainName('Gelato - 1/8oz'), 'Gelato');
  assert.equal(coreStrainName('OG Kush'), 'OG Kush');
});

test('findKnowledgeMatch matches despite a grow-type suffix', () => {
  const db = [{ id: 'nerdz', name: 'Nerdz' }, { id: 'km', name: 'Kush Mints' }];
  assert.equal(findKnowledgeMatch('Nerdz - Indoor', db)?.id, 'nerdz');
  assert.equal(findKnowledgeMatch('Kush Mints - Smalls', db)?.id, 'km');
});

test('findKnowledgeMatch prefers the longest contained strain name', () => {
  const db = [{ id: 'cookies', name: 'Cookies' }, { id: 'ac', name: 'Animal Cookies' }];
  assert.equal(findKnowledgeMatch('Animal Cookies - Indoor', db)?.id, 'ac');
});

test('findKnowledgeMatch ignores very short strain names in contains matching', () => {
  const db = [{ id: 'og', name: 'OG' }];
  assert.equal(findKnowledgeMatch('Mango Tango', db), null);
  assert.equal(findKnowledgeMatch('OG', db)?.id, 'og'); // exact still matches
});

test('findKnowledgeMatch matches a brand-prefixed product via contains', () => {
  const db = [{ id: 'st', name: 'Super Teds' }];
  assert.equal(findKnowledgeMatch('Teds Budz - Super Teds - Indoor', db)?.id, 'st');
});
