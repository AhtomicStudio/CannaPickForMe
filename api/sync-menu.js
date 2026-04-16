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

import strainsData from '../src/data/strains.json' assert { type: 'json' };

// ─── Flower category detection ───────────────────────────────────────────────

const FLOWER_KEYWORDS = ['flower', 'bud', 'buds', 'nug', 'nugs', 'loose flower'];

function isFlower(category = '') {
  return FLOWER_KEYWORDS.some(k => category.toLowerCase().includes(k));
}

// ─── Strain name normalisation & matching ────────────────────────────────────

function normaliseName(name = '') {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findKnowledgeMatch(productName) {
  const norm = normaliseName(productName);
  // Exact match first
  const exact = strainsData.find(s => normaliseName(s.name) === norm);
  if (exact) return exact;
  // Contains match — product name includes a known strain name
  return strainsData.find(s => norm.includes(normaliseName(s.name))) ?? null;
}

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
  // GraphQL puts the clean strain name in raw.strain.name
  const strainName = raw.strain?.name || raw.name || '';
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

    const knownStrain = findKnowledgeMatch(product.name);

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
