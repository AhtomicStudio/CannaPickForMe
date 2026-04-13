/**
 * Ad Service for CannaPickForMe
 *
 * Ads are managed via src/data/ads.json.
 * Images are stored in public/ads/ and served by Vercel.
 *
 * To add an ad:
 *   1. Drop your image into public/ads/
 *   2. Add an entry to src/data/ads.json (set active: true)
 *   3. Push to GitHub — Vercel auto-deploys
 *
 * Placements: "home" (below main buttons) | "result" (below result card)
 * Display types: "card" (default) | "banner" (full-width)
 */

import adsData from '../data/ads.json';

/**
 * Fetch active ads for a given placement, sorted by priority (highest first)
 */
export function getActiveAds(placement) {
  return adsData
    .filter(ad => ad.active && ad.placement === placement)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

/**
 * Fetch all ads (for admin/debugging use)
 */
export function getAllAds() {
  return [...adsData].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

// Ads are now managed via src/data/ads.json — these functions are no longer used.
export async function createAd() { throw new Error('Ads are managed via src/data/ads.json'); }
export async function updateAd() { throw new Error('Ads are managed via src/data/ads.json'); }
export async function deleteAd() { throw new Error('Ads are managed via src/data/ads.json'); }
export async function uploadAdImage() { throw new Error('Images go in public/ads/ folder'); }
