/**
 * Vercel Serverless Function — /api/sync-menu
 *
 * Fetches a dispensary's live Dutchie menu (flower category only),
 * cross-references against the local strain knowledge base, and returns
 * a structured diff the admin panel uses to confirm before writing to Firestore.
 *
 * Query params:
 *   dispensary  — Dutchie dispensary slug (e.g. "cookies-hayward")
 *
 * Response:
 *   {
 *     matched:   [{ id, name, type, thc }]   — menu strains found in knowledge base
 *     unmatched: [{ name, type, thc, cbd }]  — menu strains NOT in knowledge base
 *     fetchedAt: ISO string
 *   }
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fetchDovetail, buildMenuEnrichment } from './_menuAdapters.mjs';
import { normaliseName, isFlower, findKnowledgeMatch, coreStrainName } from './_menuMatch.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const strainsData = JSON.parse(
  readFileSync(join(__dirname, '../public/data/strains.json'), 'utf8')
);

// Flower detection + strain-name matching are shared with the weekly refresh
// and unit tests — see ./_menuMatch.mjs (imported above).

// ─── THC extraction helpers ───────────────────────────────────────────────────

function extractThc(product) {
  // Dutchie REST format
  if (product.THCContent?.range?.length) {
    const [lo, hi] = product.THCContent.range;
    return hi ?? lo ?? null;
  }
  // Dutchie GraphQL format
  if (product.thcContent?.range?.length) {
    const [lo, hi] = product.thcContent.range;
    return hi ?? lo ?? null;
  }
  if (typeof product.thcContent?.formatted === 'string') {
    const m = product.thcContent.formatted.match(/[\d.]+/);
    return m ? parseFloat(m[0]) : null;
  }
  return null;
}

function extractCbd(product) {
  if (product.CBDContent?.range?.length) {
    const [lo, hi] = product.CBDContent.range;
    return hi ?? lo ?? null;
  }
  if (product.cbdContent?.range?.length) {
    const [lo, hi] = product.cbdContent.range;
    return hi ?? lo ?? null;
  }
  return null;
}

// ─── Dutchie fetchers ─────────────────────────────────────────────────────────

/**
 * Try Dutchie's REST-style public menu endpoint.
 * Returns raw product array or null if it fails.
 */
async function tryRestEndpoint(slug) {
  const url = `https://dutchie.com/api/public/dispensary/${encodeURIComponent(slug)}/menu`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const body = await res.json();
  // REST API returns an object with category keys, or a flat array
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object') {
    // Flatten categories
    return Object.values(body).flat().filter(p => typeof p === 'object');
  }
  return null;
}

/**
 * Try Dutchie's GraphQL endpoint.
 * Returns raw product array or null if it fails.
 */
async function tryGraphQL(slug) {
  const query = `
    query SyncMenu($slug: String!) {
      consumerMenu(dispensarySlug: $slug) {
        products {
          id
          name
          category
          strain { name }
          type
          thcContent { formatted range }
          cbdContent { formatted range }
          available
        }
      }
    }
  `;

  const res = await fetch('https://dutchie.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
    body: JSON.stringify({ query, variables: { slug } }),
  });

  if (!res.ok) return null;
  const body = await res.json();
  return body?.data?.consumerMenu?.products ?? null;
}

// ─── Product normalisation ────────────────────────────────────────────────────

function normaliseProduct(raw) {
  const brandObj = raw.brand || raw.Brand;
  const brandName = (brandObj && typeof brandObj === 'object' ? brandObj.name : brandObj) || '';
  let strainName = raw.strain?.name || raw.name || '';

  if (brandName && strainName) {
    const escapedBrand = String(brandName).replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const brandRegex = new RegExp(`^${escapedBrand}\\s*[-–—|/]\\s*`, 'i');
    strainName = String(strainName).replace(brandRegex, '');
  }

  // GraphQL's strainName is already clean, but if it came from raw.name, run coreStrainName
  if (!raw.strain?.name) {
    strainName = coreStrainName(strainName);
  }

  const category   = raw.category || raw.Category || '';
  // Dutchie REST uses "Indica" / "Hybrid" / "Sativa" on the product itself
  const type       = (raw.type || raw.Type || 'hybrid').toLowerCase();

  return {
    name:     strainName,
    category,
    type,
    thc:      extractThc(raw),
    cbd:      extractCbd(raw),
    available: raw.available ?? raw.inStock ?? true,
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Config-driven menu source (e.g. Dovetail/WordPress sites like Cookies).
  // Back-compat: ?dispensary=<slug> still uses the Dutchie-direct path below.
  let menuSource = null;
  if (req.query.source) {
    try { menuSource = JSON.parse(req.query.source); } catch { /* ignore malformed source */ }
  }
  if (menuSource && menuSource.provider === 'dovetail') {
    let products = [];
    try {
      products = await fetchDovetail(menuSource);
    } catch (err) {
      return res.status(502).json({ error: `Dovetail fetch failed: ${String((err && err.message) || err)}` });
    }
    const matched = [], unmatched = [], enrichment = [], seen = new Set();
    const enrichSource = `dovetail:${menuSource.retailer || ''}`;
    for (const p of products) {
      const key = normaliseName(p.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const known = findKnowledgeMatch(p.name, strainsData);
      if (known) {
        matched.push({ id: known.id, name: known.name, type: known.type, thc: p.thc ?? null });
        // Layer 2: capture any new terpenes / THC / effects this shelf product carries.
        const enrich = buildMenuEnrichment(known, p, { source: enrichSource });
        if (enrich) enrichment.push(enrich);
      } else {
        unmatched.push({ name: p.name, brand: p.brand ?? null, thc: p.thc ?? null });
      }
    }
    return res.status(200).json({ matched, unmatched, enrichment, fetchedAt: new Date().toISOString(), source: 'dovetail' });
  }

  const { dispensary } = req.query;

  if (!dispensary) {
    return res.status(400).json({ error: 'dispensary query param is required' });
  }

  // ── Fetch from Dutchie ──────────────────────────────────────────────────────
  let rawProducts = null;
  let source = null;

  try {
    rawProducts = await tryGraphQL(dispensary);
    if (rawProducts) source = 'graphql';
  } catch {
    rawProducts = null;
  }

  if (!rawProducts) {
    try {
      rawProducts = await tryRestEndpoint(dispensary);
      if (rawProducts) source = 'rest';
    } catch {
      rawProducts = null;
    }
  }

  if (!rawProducts) {
    return res.status(502).json({
      error: `Could not reach Dutchie menu for "${dispensary}". The slug may be incorrect or Dutchie's endpoint may have changed.`,
      hint:  'Check the dispensary slug — try looking at the URL of their embedded Dutchie menu.',
    });
  }

  // ── Normalise & filter to flower ────────────────────────────────────────────
  const flowerProducts = rawProducts
    .map(normaliseProduct)
    .filter(p => isFlower(p.category) && p.available !== false && p.name);

  if (flowerProducts.length === 0) {
    return res.status(200).json({
      matched:   [],
      unmatched: [],
      fetchedAt: new Date().toISOString(),
      source,
      warning: 'No flower products found. Category names on this menu may differ — inspect the raw response.',
      rawCategories: [...new Set(rawProducts.map(p => p.category || p.Category).filter(Boolean))],
    });
  }

  // ── Cross-reference against knowledge base ──────────────────────────────────
  const matched   = [];
  const unmatched = [];
  const seen      = new Set();

  for (const product of flowerProducts) {
    const key = normaliseName(product.name);
    if (seen.has(key)) continue;
    seen.add(key);

    const knownStrain = findKnowledgeMatch(product.name, strainsData);

    if (knownStrain) {
      matched.push({
        id:   knownStrain.id,
        name: knownStrain.name,
        type: knownStrain.type,
        thc:  product.thc,
      });
    } else {
      unmatched.push({
        name: product.name,
        type: product.type,
        thc:  product.thc,
        cbd:  product.cbd,
      });
    }
  }

  return res.status(200).json({
    matched,
    unmatched,
    fetchedAt: new Date().toISOString(),
    source,
  });
}
