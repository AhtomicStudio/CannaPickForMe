/**
 * Pure, dependency-free helpers for matching a dispensary's Dutchie menu
 * against the local strain knowledge base. Extracted from api/sync-menu.js so
 * the logic can be unit-tested (test/menu-match.test.mjs) without dragging in
 * fs / network, and reused anywhere the same matching is needed.
 */

export const FLOWER_KEYWORDS = ['flower', 'bud', 'buds', 'nug', 'nugs', 'loose flower'];

/** True if a Dutchie category string denotes flower (vs. vapes, edibles, etc.). */
export function isFlower(category = '') {
  return FLOWER_KEYWORDS.some((k) => category.toLowerCase().includes(k));
}

/** Lowercase, strip punctuation, collapse whitespace: "Blue Dream #2!" -> "blue dream 2". */
export function normaliseName(name = '') {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find the knowledge-base strain a menu product name refers to. Exact
 * (normalised) match first, then a "product name contains a known strain name"
 * fallback. Returns the strain object or null. Guards against empty names so a
 * blank strain name can never false-match every product.
 */
/**
 * Reduce a menu product name to its core strain name by stripping grow-type
 * qualifiers ("- Indoor", "- Smalls") and trailing weights ("3.5g", "1/8oz").
 * "Nerdz - Indoor" -> "Nerdz"; "Blue Dream 3.5g" -> "Blue Dream".
 */
const GROW_SUFFIX = new RegExp(
  '\\s*[-\\u2013\\u2014|/]\\s*' +
  '(indoor|outdoor|greenhouse|green house|light ?dep(rivation)?|sun ?grown|mixed ?light|full ?sun|smalls?|popcorn|exotics?|exotix|premium|top ?shelf|flower|buds?)' +
  '\\s*$',
  'i',
);

export function coreStrainName(name = '') {
  let s = String(name);
  // strip a trailing weight/size token (and anything after it)
  s = s.replace(/\s*[-–—|]?\s*(\d+\/\d+|\d+(\.\d+)?)\s*(g|gram|grams|oz|ounce|eighth|quarter|half)\b.*$/i, '');
  // strip one or more trailing grow-type qualifiers
  let prev;
  do { prev = s; s = s.replace(GROW_SUFFIX, ''); } while (s !== prev);
  return s.trim();
}

/**
 * Find the knowledge-base strain a menu product refers to:
 *   1. exact (normalised) match,
 *   2. exact match on the cleaned core name,
 *   3. a known strain name contained in the product name — preferring the
 *      LONGEST such strain (so "Animal Cookies" wins over "Cookies") and
 *      ignoring very short names to avoid spurious hits.
 * Returns the strain object or null.
 */
export function findKnowledgeMatch(productName, strains = []) {
  const norm = normaliseName(productName);
  if (!norm) return null;

  let hit = strains.find((s) => normaliseName(s.name) === norm);
  if (hit) return hit;

  const core = normaliseName(coreStrainName(productName));
  if (core && core !== norm) {
    hit = strains.find((s) => normaliseName(s.name) === core);
    if (hit) return hit;
  }

  const hay = core || norm;
  let best = null;
  let bestLen = 0;
  for (const s of strains) {
    const sn = normaliseName(s.name);
    if (sn.length >= 4 && sn.length > bestLen && hay.includes(sn)) {
      best = s;
      bestLen = sn.length;
    }
  }
  return best;
}
