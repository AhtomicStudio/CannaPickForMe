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
    .map((r) => ({
      name: r.name.trim(),
      brand: (r.brand && typeof r.brand === 'object' ? r.brand.name : r.brand) || null,
      category: r.category || null,
      thc: extractDovetailThc(r),
    }));
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
