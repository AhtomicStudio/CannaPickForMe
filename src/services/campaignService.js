/**
 * Campaign Service for CannaPickForMe
 *
 * A Campaign is a time-boxed package of sponsored inventory purchased by
 * an Advertiser. It's the single source of truth for "what's currently
 * being promoted in the app." The user-facing app reads campaigns
 * indirectly through sponsorshipService.js (the aggregator).
 *
 * Schema: /campaigns/{campaignId}
 *   - advertiserId:       FK to /advertisers
 *   - name:               "Cookies Hayward — June 2026"
 *   - tier:               "bronze" | "silver" | "gold" | "custom"
 *                         Informational only; not enforced. Operator
 *                         decides what inventory goes in each campaign.
 *   - monthlyPriceCents:  for reporting and MRR rollups
 *   - status:             "draft" | "scheduled" | "live" | "paused" | "ended"
 *                         Auto-transitions are NOT done in the client —
 *                         the aggregator filters by status+dates at read
 *                         time, so an out-of-date status field never
 *                         leaks promoted content into the user app.
 *   - startsAt:           timestamp (inclusive)
 *   - endsAt:             timestamp (exclusive)
 *   - inventory:
 *       - sponsoredStrainIds: [strainId, ...]   // refs into strains
 *       - adIds:              [adId, ...]       // refs into /ads
 *       - partnerStrains:     [inline object]   // see partner strain shape below
 *
 *   Partner strain inline shape (lives on the campaign, not a separate collection):
 *     { strainName, strainType, brandName, effects[], flavors[], dispensaryId, clickUrl, active }
 *
 *   This denormalisation is deliberate: partner strains are owned 1:N by
 *   the campaign that bought them. Inlining keeps the user-facing reads
 *   to a single campaigns query instead of a campaigns + partnerStrains
 *   join, and means partner CRUD is just editing the campaign doc.
 *   - impressions:        rolled-up counter (incremented atomically)
 *   - clicks:             rolled-up counter
 *   - lastImpressionAt:   timestamp of most recent impression
 *   - lastClickAt:        timestamp of most recent click
 *   - createdAt, updatedAt
 *
 * Campaigns are publicly readable (the aggregator runs in the user-facing
 * app) but they intentionally contain NO billing details or contact info —
 * that all lives on the advertiser doc, which is admin-only.
 */

import { db } from '../firebase.js';
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  increment, serverTimestamp, Timestamp,
} from 'firebase/firestore';

const COLLECTION = 'campaigns';

export const CAMPAIGN_STATUS = Object.freeze({
  DRAFT:     'draft',     // not visible to users
  SCHEDULED: 'scheduled', // starts in the future
  LIVE:      'live',      // visible to users (subject to date window)
  PAUSED:    'paused',    // not visible — operator pulled it
  ENDED:     'ended',     // run has completed
});

export const CAMPAIGN_TIER = Object.freeze({
  BRONZE: 'bronze',
  SILVER: 'silver',
  GOLD:   'gold',
  CUSTOM: 'custom',
});

/**
 * Recommended inventory caps per tier, surfaced to the operator when
 * creating a campaign. NOT enforced — the operator decides.
 *
 * These mirror the pricing page we'll pitch to dispensaries.
 */
export const TIER_DEFAULTS = Object.freeze({
  bronze: { monthlyPriceCents:  9900, ads: 1, sponsoredStrains: 1, partnerStrains: 0 },
  silver: { monthlyPriceCents: 19900, ads: 2, sponsoredStrains: 3, partnerStrains: 1 },
  gold:   { monthlyPriceCents: 39900, ads: 5, sponsoredStrains: 8, partnerStrains: 3 },
  custom: { monthlyPriceCents: 0,     ads: 99, sponsoredStrains: 99, partnerStrains: 99 },
});

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
}

/**
 * Returns true if the campaign should currently be serving impressions
 * to the user-facing app. This is the single gating function used by
 * the aggregator — keep it in one place so policy changes are easy.
 */
export function isCampaignLive(campaign, now = new Date()) {
  if (!campaign || campaign.status !== CAMPAIGN_STATUS.LIVE) return false;
  const startsAt = toDate(campaign.startsAt);
  const endsAt   = toDate(campaign.endsAt);
  if (startsAt && now < startsAt) return false;
  if (endsAt && now >= endsAt) return false;
  return true;
}

/**
 * Create a new campaign.
 *
 * Defaults to status="draft" so newly created campaigns never accidentally
 * show up in the user-facing app before the operator has set them up.
 */
export async function createCampaign({
  advertiserId,
  name,
  tier = CAMPAIGN_TIER.BRONZE,
  monthlyPriceCents = null,
  status = CAMPAIGN_STATUS.DRAFT,
  dispensaryId = null,
  startsAt = null,
  endsAt = null,
  inventory = {},
}) {
  if (!advertiserId) throw new Error('createCampaign requires an advertiserId');
  if (!name) throw new Error('createCampaign requires a name');

  const defaults = TIER_DEFAULTS[tier] || TIER_DEFAULTS.custom;
  const data = {
    advertiserId,
    name: String(name).trim(),
    tier,
    monthlyPriceCents: monthlyPriceCents ?? defaults.monthlyPriceCents,
    status,
    dispensaryId: dispensaryId || null,
    startsAt: startsAt ? Timestamp.fromDate(toDate(startsAt)) : null,
    endsAt:   endsAt   ? Timestamp.fromDate(toDate(endsAt))   : null,
    inventory: {
      sponsoredStrainIds: Array.isArray(inventory.sponsoredStrainIds) ? inventory.sponsoredStrainIds : [],
      adIds:              Array.isArray(inventory.adIds)              ? inventory.adIds              : [],
      partnerStrains:     Array.isArray(inventory.partnerStrains)     ? inventory.partnerStrains     : [],
    },
    impressions: 0,
    clicks: 0,
    lastImpressionAt: null,
    lastClickAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, COLLECTION), data);
  return { id: ref.id, ...data };
}

/**
 * Update a campaign. Only the keys provided are written. Pass startsAt
 * or endsAt as a Date and we'll convert to Firestore Timestamp.
 */
export async function updateCampaign(id, patch) {
  if (!id) throw new Error('updateCampaign requires an id');
  const out = { ...patch, updatedAt: serverTimestamp() };
  if ('startsAt' in patch) out.startsAt = patch.startsAt ? Timestamp.fromDate(toDate(patch.startsAt)) : null;
  if ('endsAt'   in patch) out.endsAt   = patch.endsAt   ? Timestamp.fromDate(toDate(patch.endsAt))   : null;
  await updateDoc(doc(db, COLLECTION, id), out);
}

export async function getCampaign(id) {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * List all campaigns. Admin view. Sorted by lastImpressionAt desc so
 * the active ones bubble to the top.
 */
export async function listCampaigns() {
  try {
    const snap = await getDocs(collection(db, COLLECTION));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const ad = toDate(a.lastImpressionAt) || toDate(a.updatedAt) || new Date(0);
        const bd = toDate(b.lastImpressionAt) || toDate(b.updatedAt) || new Date(0);
        return bd - ad;
      });
  } catch (err) {
    console.warn('Failed to list campaigns:', err);
    return [];
  }
}

/**
 * Fetch all campaigns that are currently serving. Used by the user-facing
 * aggregator. We filter client-side so we don't need composite Firestore
 * indexes for a status+date compound query (matches the pattern adService
 * uses for ads).
 */
export async function listLiveCampaigns() {
  try {
    const snap = await getDocs(collection(db, COLLECTION));
    const now = new Date();
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(c => isCampaignLive(c, now));
  } catch (err) {
    console.warn('Failed to list live campaigns:', err);
    return [];
  }
}

export async function deleteCampaign(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}

/**
 * Atomically bump the impression counter on a campaign. Called by
 * sponsorshipService.recordImpression after an ad/sponsored item renders.
 *
 * Firestore's increment() is atomic on the server, so concurrent renders
 * from many users don't race. We also stamp lastImpressionAt so the
 * admin dashboard can sort by recency.
 */
export async function incrementCampaignImpression(id) {
  if (!id) return;
  try {
    await updateDoc(doc(db, COLLECTION, id), {
      impressions: increment(1),
      lastImpressionAt: serverTimestamp(),
    });
  } catch (err) {
    // Counter failures should never break the render path.
    console.warn('Failed to increment campaign impression:', err);
  }
}

/**
 * Atomically bump the click counter on a campaign.
 */
export async function incrementCampaignClick(id) {
  if (!id) return;
  try {
    await updateDoc(doc(db, COLLECTION, id), {
      clicks: increment(1),
      lastClickAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Failed to increment campaign click:', err);
  }
}
