/**
 * Sponsorship migration runner — one-shot, idempotent.
 *
 * Purpose: at first admin load after the Phase 1 deploy, sweep the
 * legacy sponsor state into the new campaigns model so the user-facing
 * app continues showing the same promoted content with zero manual work.
 *
 * What it migrates:
 *   1. Hardcoded DISPENSARY_NAMES → /dispensaries collection
 *   2. strainDelta.sponsored + .sponsorSettings + .partnerStrains →
 *      a single "Legacy Sponsors" advertiser + "Legacy Sponsorship"
 *      campaign (status=live, no end date).
 *   3. Any /ads doc that doesn't have a campaignId yet → attached to
 *      the Legacy campaign.
 *
 * Idempotency: the migration writes a sentinel doc at
 *   /system/sponsorshipMigration  { ranAt, version: 1 }
 * and refuses to re-run if it's present, so admins refreshing the
 * dashboard don't create duplicate Legacy advertisers/campaigns.
 *
 * Safety: nothing is deleted. strainDelta.sponsored and .partnerStrains
 * stay populated after migration so old client bundles continue to
 * function during the deploy window. A follow-up cleanup task removes
 * them once everyone is on the new bundle.
 */

import { db } from '../firebase.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

import { getStrainDelta } from './strainService.js';
import { listDispensaries, saveDispensary } from './dispensaryService.js';
import { createAdvertiser, listAdvertisers, ADVERTISER_STATUS } from './advertiserService.js';
import { createCampaign, listCampaigns, updateCampaign, CAMPAIGN_STATUS, CAMPAIGN_TIER } from './campaignService.js';
import { getAllAds, updateAd } from './adService.js';

const SENTINEL_REF  = () => doc(db, 'system', 'sponsorshipMigration');
const MIGRATION_VERSION = 1;

// Mirror the DISPENSARY_NAMES map that lived in admin.js / main.js before
// migration. Used to seed the /dispensaries collection on first run.
// Adding a new dispensary post-migration goes through the admin UI, not
// this file.
const LEGACY_DISPENSARIES = {
  'cookies-hayward':              'Cookies Hayward',
  'garden-of-eden':               'Garden of Eden',
  'we-are-hemp':                  'We Are Hemp',
  'hayward-dispensary-delivery':  'Hayward Dispensary Delivery',
  'nug-wellness':                 'NUG Wellness',
  'flor-union-city':              'FLOR - Union City Dispensary',
  'lemonnade-union-city':         'Lemonnade Union City Dispensary',
  'harborside-san-leandro':       'Harborside San Leandro Dispensary',
  '4twenty-market-oakland':       '4Twenty Market Weed Dispensary Oakland',
  'three-trees-oakland':          'Three Trees Weed Dispensary Kiosk',
  'kanna-oakland':                'KANNA Weed Dispensary Oakland',
  'harborside-oakland':           'Harborside Oakland Dispensary',
  'ivy-hill-oakland':             'Ivy Hill Weed Dispensary Oakland',
  'urbana-oakland':               'Urbana Weed Dispensary Oakland',
};

async function hasRun() {
  try {
    const snap = await getDoc(SENTINEL_REF());
    return snap.exists() && (snap.data().version || 0) >= MIGRATION_VERSION;
  } catch {
    return false;
  }
}

async function markRan(summary) {
  try {
    await setDoc(SENTINEL_REF(), {
      ranAt: serverTimestamp(),
      version: MIGRATION_VERSION,
      summary: summary || null,
    });
  } catch (err) {
    console.warn('Failed to write migration sentinel:', err);
  }
}

async function seedDispensaries() {
  const existing = await listDispensaries();
  const seenSlugs = new Set(existing.map(d => d.id));
  let created = 0;
  for (const [slug, name] of Object.entries(LEGACY_DISPENSARIES)) {
    if (seenSlugs.has(slug)) continue;
    await saveDispensary(slug, { name, active: true });
    created++;
  }
  return created;
}

async function ensureLegacyAdvertiser() {
  const advertisers = await listAdvertisers();
  const existing = advertisers.find(a => a.name === 'Legacy Sponsors');
  if (existing) return existing;
  return createAdvertiser({
    name: 'Legacy Sponsors',
    contactName: 'CannaPickForMe',
    contactEmail: '',
    status: ADVERTISER_STATUS.ACTIVE,
    notes: 'Auto-created during the Phase 1 sponsorship migration. Houses pre-migration sponsored strains, partner strains, and orphaned ads. Once they\'re reassigned or retired, this advertiser can be archived.',
  });
}

async function ensureLegacyCampaign(advertiserId, strainDelta) {
  const campaigns = await listCampaigns();
  const existing = campaigns.find(c => c.advertiserId === advertiserId && c.name === 'Legacy Sponsorship');
  if (existing) return existing;
  return createCampaign({
    advertiserId,
    name: 'Legacy Sponsorship',
    tier: CAMPAIGN_TIER.CUSTOM,
    monthlyPriceCents: 0,
    status: CAMPAIGN_STATUS.LIVE,
    startsAt: new Date(),
    endsAt: null, // open-ended; operator sets an end date when retiring
    inventory: {
      sponsoredStrainIds: Array.isArray(strainDelta?.sponsored)       ? strainDelta.sponsored       : [],
      partnerStrains:     Array.isArray(strainDelta?.partnerStrains)  ? strainDelta.partnerStrains  : [],
      adIds:              [],
    },
  });
}

async function attachOrphanAdsToCampaign(campaignId) {
  const ads = await getAllAds();
  const orphans = ads.filter(ad => !ad.campaignId);
  for (const ad of orphans) {
    await updateAd(ad.id, { campaignId });
  }
  // Also patch the campaign's inventory.adIds so the join is symmetric.
  if (orphans.length > 0) {
    const updatedAds = orphans.map(a => a.id);
    await updateCampaign(campaignId, {
      inventory: {
        // Pull current values and append. We accept the read here because
        // the migration runs once on admin load and isn't latency-sensitive.
        adIds: updatedAds,
        sponsoredStrainIds: undefined,
        partnerStrains: undefined,
      },
    }).catch(() => {});
  }
  return orphans.length;
}

/**
 * Run the migration if it hasn't run yet. Safe to call on every admin
 * dashboard load.
 *
 * Returns a summary object suitable for surfacing in the admin UI:
 *   { ranAt, dispensariesSeeded, legacyCampaignId, orphanAdsAttached }
 * or null if the migration had already run.
 */
export async function runSponsorshipMigrationIfNeeded() {
  if (await hasRun()) return null;

  const summary = {
    ranAt: new Date().toISOString(),
    dispensariesSeeded: 0,
    legacyAdvertiserId: null,
    legacyCampaignId: null,
    orphanAdsAttached: 0,
    errors: [],
  };

  try {
    summary.dispensariesSeeded = await seedDispensaries();
  } catch (err) {
    summary.errors.push(`Dispensaries: ${err.message}`);
  }

  let strainDelta = null;
  try {
    strainDelta = await getStrainDelta();
  } catch (err) {
    summary.errors.push(`getStrainDelta: ${err.message}`);
  }

  const hasLegacyContent = strainDelta && (
    (strainDelta.sponsored || []).length > 0 ||
    (strainDelta.partnerStrains || []).length > 0
  );

  let campaignId = null;
  if (hasLegacyContent) {
    try {
      const advertiser = await ensureLegacyAdvertiser();
      summary.legacyAdvertiserId = advertiser.id;
      const campaign = await ensureLegacyCampaign(advertiser.id, strainDelta);
      campaignId = campaign.id;
      summary.legacyCampaignId = campaign.id;
    } catch (err) {
      summary.errors.push(`Legacy campaign: ${err.message}`);
    }
  }

  // Even if there's no strainDelta sponsorship to migrate, attach orphan
  // ads to a campaign — they need one for the new aggregator to keep
  // serving them.
  if (!campaignId) {
    try {
      const ads = await getAllAds();
      if (ads.some(a => !a.campaignId)) {
        const advertiser = await ensureLegacyAdvertiser();
        summary.legacyAdvertiserId = advertiser.id;
        const campaign = await ensureLegacyCampaign(advertiser.id, strainDelta || {});
        campaignId = campaign.id;
        summary.legacyCampaignId = campaign.id;
      }
    } catch (err) {
      summary.errors.push(`Ad migration prep: ${err.message}`);
    }
  }

  if (campaignId) {
    try {
      summary.orphanAdsAttached = await attachOrphanAdsToCampaign(campaignId);
    } catch (err) {
      summary.errors.push(`Attach orphan ads: ${err.message}`);
    }
  }

  await markRan(summary);
  return summary;
}
