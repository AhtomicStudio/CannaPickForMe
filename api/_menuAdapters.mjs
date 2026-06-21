/**
 * Menu source adapters.
 *
 * A dispensary's menu can come from different platforms. Each adapter knows how
 * to fetch + normalise one platform into a flat list of products:
 *     [{ name, brand, category, thc }]
 * where `name` is the strain/product name we match against strains.json.
 *
 * Onboarding a new dispensary is config, not code: give the dispensary a
 * `menuSource` object (see shapes below) and the right adapter runs. Adding a
 * brand-new *platform* is one new adapter function + a dispatch line.
 *
 * Source shapes:
 *   Dovetail (WordPress plugin proxying Dutchie Plus etc. — e.g. Cookies):
 *     { provider:'dovetail', baseUrl:'https://cookiesdispensary.com',
 *       retailer:'hayward', categories:['premium-flower','flower'] }
 *   Dutchie (direct dutchie.com public menu):
 *     { provider:'dutchie', slug:'cookies-hayward' }   // handled in sync-menu.js
 *
 * `fetch` is injected (defaults to global fetch) so the pagination + parsing
 * can be unit-tested without network (test/menu-adapters.test.mjs).
 */

import { coreStrainName } from './_menuMatch.mjs';

// Effect taxonomy (mirrors ALL_EFFECTS in src/main.js). Menu effects are
// intersected with this so off-taxonomy tags (e.g. "Inspired") never leak in.
const TAXONOMY_EFFECTS = new Set([
  'Relaxed', 'Happy', 'Euphoric', 'Creative', 'Uplifted', 'Energetic',
  'Focused', 'Talkative', 'Giggly', 'Sleepy', 'Hungry', 'Tingly', 'Body High', 'Head High',
]);
const titleCase = (s) => String(s).trim().toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());

// ── Dovetail ──────────────────────────────────────────────────────────────────

/** Build one page's products URL for a Dovetail source. Pure (testable). */
export function buildDovetailUrl(source, page = 1) {
  const baseUrl = String(source.baseUrl || '').replace(/\/+$/, '');
  const retailer = encodeURIComponent(source.retailer || '');
  const repository = encodeURIComponent(source.repository || 'dutchie_plus');
  const cats = (Array.isArray(source.categories) && source.categories.length
    ? source.categories
    : ['premium-flower']
  ).map((c) => `categories[]=${encodeURIComponent(c)}`).join('&');
  return `${baseUrl}/wp-json/dovetail-api/v1/products?retailer=${retailer}&repository=${repository}&${cats}&page=${page}`;
}

/** Pull a THC % from a Dovetail product's potency list, if present. */
function extractDovetailThc(r) {
  if (r.potency_thc) {
    if (Array.isArray(r.potency_thc.range) && r.potency_thc.range[0] != null) {
      return r.potency_thc.range[0];
    }
    if (typeof r.potency_thc.formatted === 'string') {
      const m = r.potency_thc.formatted.match(/[\d.]+/);
      if (m) return parseFloat(m[0]);
    }
  }
  if (typeof r.thc === 'number') return r.thc;
  const pot = r.potency || r.cannabinoids || [];
  if (Array.isArray(pot)) {
    const hit = pot.find((p) => p && /thc/i.test(p.name || '') && !/thca/i.test(p.name || ''));
    if (hit && hit.value != null) {
      const n = parseFloat(hit.value);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

/** Terpene names from a Dovetail product (drops the long reference descriptions). */
export function extractDovetailTerpenes(r) {
  if (!Array.isArray(r.terpenes)) return [];
  return [...new Set(
    r.terpenes
      .map((t) => (t && typeof t === 'object' ? t.name : t))
      .filter((n) => typeof n === 'string' && n.trim())
      .map((n) => n.trim()),
  )];
}

/** {min,max} from a Dovetail potency object (range array or "18-22%" formatted). */
function potencyRange(potency) {
  if (!potency || typeof potency !== 'object') return null;
  let nums = [];
  if (Array.isArray(potency.range)) nums = potency.range.map(Number).filter(Number.isFinite);
  if (!nums.length && typeof potency.formatted === 'string') {
    nums = (potency.formatted.match(/[\d.]+/g) || []).map(Number).filter(Number.isFinite);
  }
  return nums.length ? { min: Math.min(...nums), max: Math.max(...nums) } : null;
}

/** THC/CBD {min,max} ranges from a Dovetail product. */
export function extractDovetailRanges(r) {
  return { thc: potencyRange(r.potency_thc), cbd: potencyRange(r.potency_cbd) };
}

/** Normalise strain_type to indica|sativa|hybrid, or null ("Not Applicable" -> null). */
function normaliseStrainType(t) {
  const s = typeof t === 'string' ? t.trim().toLowerCase() : '';
  return ['indica', 'sativa', 'hybrid'].includes(s) ? s : null;
}

/**
 * Parse one Dovetail page into normalised products. Critically: we read ONLY
 * each result's own top-level `name` (the strain). Nested `name`s — brand,
 * specials, variants (1/8oz), cannabinoids (THC-D9) — are ignored.
 * Pure (testable).
 */
export function parseDovetailResults(json) {
  const results = Array.isArray(json?.results) ? json.results
    : Array.isArray(json?.products) ? json.products
    : Array.isArray(json) ? json
    : [];
  return results
    .filter((r) => r && typeof r === 'object' && typeof r.name === 'string' && r.name.trim())
    .map((r) => {
      const brandName = (r.brand && typeof r.brand === 'object' ? r.brand.name : r.brand) || '';
      let cleanName = r.name.trim();

      // Strip brand prefix if name starts with brand + separator
      if (brandName) {
        const escapedBrand = String(brandName).replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const brandRegex = new RegExp(`^${escapedBrand}\\s*[-–—|/]\\s*`, 'i');
        cleanName = cleanName.replace(brandRegex, '');
      }

      // Strip trailing weights and grow suffixes
      cleanName = coreStrainName(cleanName);

      const ranges = extractDovetailRanges(r);
      return {
        name: cleanName,
        brand: brandName || null,
        category: r.category || null,
        thc: extractDovetailThc(r),
        // Layer 2 enrichment (additive, often sparse): real per-shelf data.
        thcRange: ranges.thc,
        cbdRange: ranges.cbd,
        terpenes: extractDovetailTerpenes(r),
        effects: Array.isArray(r.effects) ? r.effects.filter((e) => typeof e === 'string') : [],
        strainType: normaliseStrainType(r.strain_type),
      };
    });
}

/**
 * Build a review proposal of NEW strain data a matched menu product carries.
 * Same shape as the Kushy proposals (scripts/enrich-strains.mjs) so both layers
 * feed one Review Queue. Only proposes fields the strain lacks; effects are
 * intersected with the taxonomy. Returns null if there's nothing new.
 */
export function buildMenuEnrichment(strain, product, { source = 'menu' } = {}) {
  const propose = {};
  if (product.terpenes && product.terpenes.length) {
    const have = new Set((strain.terpenes || []).map((t) => String(t.name || t).toLowerCase()));
    const add = product.terpenes.filter((n) => !have.has(n.toLowerCase()));
    if (add.length) propose.terpenes = add.map((name) => ({ name }));
  }
  if (product.thcRange && strain.thc == null) propose.thc = product.thcRange;
  if (product.cbdRange && strain.cbd == null) propose.cbd = product.cbdRange;
  if (product.effects && product.effects.length) {
    const have = new Set((strain.effects || []).map((e) => e.toLowerCase()));
    const add = [...new Set(product.effects.map(titleCase))]
      .filter((e) => TAXONOMY_EFFECTS.has(e) && !have.has(e.toLowerCase()));
    if (add.length) propose.effectsSuggested = add;
  }
  if (product.strainType && strain.type && product.strainType !== String(strain.type).toLowerCase()) {
    propose.typeMismatch = { ours: strain.type, menu: product.strainType };
  }
  if (!Object.keys(propose).length) return null;
  return { name: strain.name, matchedProduct: product.name, propose, source, needsReview: true };
}

/** Fetch all pages for a Dovetail source. Network (fetch injectable for tests). */
export async function fetchDovetail(source, fetchImpl = fetch) {
  const out = [];
  const MAX_PAGES = 40; // safety cap (Dutchie Plus menus are well under this)
  let page = 1;
  let pages = 1;
  do {
    const res = await fetchImpl(buildDovetailUrl(source, page), { headers: { Accept: 'application/json' } });
    if (!res || !res.ok) break;
    const json = await res.json();
    pages = Number(json?.pages) || 1;
    out.push(...parseDovetailResults(json));
    page += 1;
  } while (page <= pages && page <= MAX_PAGES);
  return out;
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

/**
 * Resolve a menu source into normalised products. Only providers implemented
 * here are dispatched; sync-menu.js keeps the existing Dutchie-direct path for
 * `provider:'dutchie'` so that flow is untouched.
 */
export async function fetchMenuProducts(source, fetchImpl = fetch) {
  if (!source || !source.provider) throw new Error('menu source requires a provider');
  if (source.provider === 'dovetail') return fetchDovetail(source, fetchImpl);
  throw new Error(`unsupported menu provider in adapters: ${source.provider}`);
}
