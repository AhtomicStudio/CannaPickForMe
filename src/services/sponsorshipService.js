/**
 * Sponsorship Service — the aggregator.
 *
 * This is the ONE module the user-facing app talks to when it needs to
 * know "what's currently being promoted?" It hides the campaign data
 * model behind a small API:
 *
 *   await getActiveSponsoredStrainIds()      → Set of strain IDs
 *   await getActivePartnerStrains()          → array of partner strain objects
 *   await getActiveAdsForPlacement('home')   → array of ad objects (sorted)
 *   recordImpression('ad', adId)             → atomic counter bump
 *   recordClick('partner', { campaignId })   → atomic counter bump
 *
 * Why this exists:
 *   - Sponsored strains, ads, and partner strains used to live in three
 *     unrelated places (strainDelta.sponsored, /ads collection,
 *     strainDelta.partnerStrains). Now they all roll up under campaigns,
 *     but the user-facing code shouldn't have to know that.
 *   - Single point to enforce the live-window policy (status + dates).
 *   - Single point to fan out impression/click writes (to the ad doc
 *     AND its parent campaign — two writes, fire-and-forget).
 *
 * Performance notes:
 *   - listLiveCampaigns() is called once per page session and cached.
 *     Sponsored/partner derivations are pure functions over that cache.
 *   - Ads still come from the /ads collection but are filtered to those
 *     whose campaignId is in the live set. We hit the ads collection
 *     directly to keep ad image URLs and display config close to the
 *     thing that renders them.
 *   - All writes (impression, click) are fire-and-forget; failures are
 *     logged but never block the render path.
 */

import { listLiveCampaigns } from './campaignService.js';
import { getAllAds, incrementAdImpression, incrementAdClick } from './adService.js';
import { incrementCampaignImpression, incrementCampaignClick } from './campaignService.js';

let _liveCampaignsCache = null;
let _liveCampaignsPromise = null;
let _adsCache = null;
let _adsPromise = null;

/**
 * Force-refresh the in-memory caches. Call from the admin after a
 * campaign or ad mutation, or after a long-lived session crosses a
 * day boundary.
 */
export function invalidateSponsorshipCache() {
  _liveCampaignsCache = null;
  _liveCampaignsPromise = null;
  _adsCache = null;
  _adsPromise = null;
}

async function getLiveCampaignsCached() {
  if (_liveCampaignsCache) return _liveCampaignsCache;
  if (_liveCampaignsPromise) return _liveCampaignsPromise;
  _liveCampaignsPromise = (async () => {
    const list = await listLiveCampaigns();
    _liveCampaignsCache = list;
    return list;
  })().finally(() => { _liveCampaignsPromise = null; });
  return _liveCampaignsPromise;
}

async function getAdsCached() {
  if (_adsCache) return _adsCache;
  if (_adsPromise) return _adsPromise;
  _adsPromise = (async () => {
    const list = await getAllAds();
    _adsCache = list;
    return list;
  })().finally(() => { _adsPromise = null; });
  return _adsPromise;
}

/**
 * Set of strain IDs currently sponsored across all live campaigns.
 * Used by the result screen to decide whether to show the sponsored
 * strain card.
 */
export async function getActiveSponsoredStrainIds() {
  const campaigns = await getLiveCampaignsCached();
  const ids = new Set();
  for (const c of campaigns) {
    const list = c.inventory?.sponsoredStrainIds || [];
    for (const id of list) ids.add(id);
  }
  return ids;
}

/**
 * Returns each sponsored strain along with the campaign it came from,
 * so the render path can attribute the impression correctly.
 *
 *   [{ strainId, campaignId }, ...]
 */
export async function getActiveSponsoredEntries() {
  const campaigns = await getLiveCampaignsCached();
  const out = [];
  for (const c of campaigns) {
    const list = c.inventory?.sponsoredStrainIds || [];
    for (const id of list) out.push({ strainId: id, campaignId: c.id });
  }
  return out;
}

/**
 * All currently-active partner strain objects, with the campaign id
 * attached so click/impression events can roll up.
 *
 * Returned shape matches the legacy strainDelta.partnerStrains entries,
 * with one extra field — campaignId — so the render layer can pass it
 * back into recordClick().
 */
export async function getActivePartnerStrains() {
  const campaigns = await getLiveCampaignsCached();
  const out = [];
  for (const c of campaigns) {
    const list = c.inventory?.partnerStrains || [];
    for (const p of list) {
      if (p && p.active !== false) out.push({ ...p, campaignId: c.id });
    }
  }
  return out;
}

/**
 * Ads for a given placement, filtered to those tied to a live campaign,
 * sorted by priority desc (matching adService's prior behavior).
 *
 * If a legacy ad has no campaignId (pre-migration), it's included so
 * nothing disappears at deploy. The migration tool will sweep these
 * into the Legacy campaign on first admin load.
 */
export async function getActiveAdsForPlacement(placement) {
  const [campaigns, ads] = await Promise.all([
    getLiveCampaignsCached(),
    getAdsCached(),
  ]);
  const liveCampaignIds = new Set(campaigns.map(c => c.id));
  return ads
    .filter(ad => ad.placement === placement && ad.active !== false)
    .filter(ad => !ad.campaignId || liveCampaignIds.has(ad.campaignId))
    .sort((a, b) => (b.priority || 5) - (a.priority || 5));
}

/**
 * Record an impression. Type is "ad" | "sponsored" | "partner".
 *
 * Fire-and-forget: never throws into the render path.
 *
 *   recordImpression('ad', { adId, campaignId })
 *   recordImpression('sponsored', { campaignId })
 *   recordImpression('partner', { campaignId })
 */
export function recordImpression(type, refs = {}) {
  try {
    const { adId, campaignId } = refs;
    if (type === 'ad' && adId) incrementAdImpression(adId);
    if (campaignId) incrementCampaignImpression(campaignId);
  } catch (err) {
    console.warn('recordImpression failed', err);
  }
}

/**
 * Record a click. Type is "ad" | "partner". (Sponsored strain cards are
 * not currently clickable in the user-facing app.)
 *
 *   recordClick('ad', { adId, campaignId })
 *   recordClick('partner', { campaignId })
 */
export function recordClick(type, refs = {}) {
  try {
    const { adId, campaignId } = refs;
    if (type === 'ad' && adId) incrementAdClick(adId);
    if (campaignId) incrementCampaignClick(campaignId);
  } catch (err) {
    console.warn('recordClick failed', err);
  }
}
