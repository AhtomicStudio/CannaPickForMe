/**
 * Pure tri-state tag filtering for the strains browser.
 *
 * `effectStates` / `flavorStates` are Maps of tag -> 'in' (include) | 'ex'
 * (exclude). Tags not present in the map are neutral. Semantics:
 *   - include: OR within a category — a strain passes if it has ANY included tag.
 *   - exclude: a strain is removed if it has ANY excluded tag.
 *   - effects and flavors are combined with AND across categories.
 *
 * Kept dependency-free so it can be unit-tested (test/tag-filter.test.mjs) and
 * reused by the strains screen without pulling in the DOM.
 */

export function splitStates(stateMap) {
  const incl = [];
  const excl = [];
  for (const [tag, state] of stateMap) (state === 'ex' ? excl : incl).push(tag);
  return { incl, excl };
}

export function strainMatchesTags(strain, effectStates, flavorStates) {
  const effs = strain.effects || [];
  const flas = strain.flavors || [];
  const e = splitStates(effectStates);
  const f = splitStates(flavorStates);
  if (e.incl.length && !e.incl.some((x) => effs.includes(x))) return false;
  if (e.excl.length &&  e.excl.some((x) => effs.includes(x))) return false;
  if (f.incl.length && !f.incl.some((x) => flas.includes(x))) return false;
  if (f.excl.length &&  f.excl.some((x) => flas.includes(x))) return false;
  return true;
}

export function filterByTags(strains, effectStates, flavorStates) {
  return strains.filter((s) => strainMatchesTags(s, effectStates, flavorStates));
}
