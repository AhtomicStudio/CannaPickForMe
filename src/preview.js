/**
 * Public sponsorship preview page.
 *
 * URL: /preview.html?c=CAMPAIGN_ID
 *
 * Purpose: shareable link to send a prospect — they see exactly how
 * their sponsorship will appear in the app, with their dispensary
 * branding, before they pay. Built as a flat static page (no auth)
 * so it works in cold emails without any sign-in friction.
 *
 * Reads from public-readable Firestore collections:
 *   - campaigns/{id}      (inventory, dates, tier, price)
 *   - advertisers/{id}    (name)
 *   - dispensaries/*      (display name lookup)
 *   - strains/delta       (admin-added strains + overrides)
 *   - ads/*               (creatives belonging to this campaign)
 *
 * No write access required. The page renders three mock screens that
 * mirror the actual app surfaces: the result screen sponsored card,
 * the better-matches modal partner card, and the home/result ad slot.
 */

import './tokens.css';
import './style.css';
import './preview.css';

import strainsData from './data/strains.json';
import { getCampaign }         from './services/campaignService.js';
import { getAdvertiser }       from './services/advertiserService.js';
import { getDispensaryMap }    from './services/dispensaryService.js';
import { getStrainDelta }      from './services/strainService.js';
import { getAllAds }           from './services/adService.js';

const CONTACT_EMAIL = 'twotales89@gmail.com';

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(value) {
  if (!value) return 'open-ended';
  const d = value instanceof Date ? value : (value.toDate ? value.toDate() : new Date(value));
  if (isNaN(d)) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtPrice(cents) {
  if (!cents) return 'Custom';
  return `$${Math.round(cents / 100)}/mo`;
}

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function showError(message) {
  document.getElementById('preview-loading').classList.add('hidden');
  const errEl = document.getElementById('preview-error');
  errEl.classList.remove('hidden');
  errEl.innerHTML = `
    <span class="preview-error__icon">🍃</span>
    <h2>Preview not available</h2>
    <p>${esc(message)}</p>
    <p class="preview-error__hint">If you got this link from us, it may have expired or been deleted. Reply to the email you received and we'll send a fresh one.</p>
  `;
}

async function main() {
  const campaignId = getQueryParam('c');
  if (!campaignId) return showError('No campaign specified. The link should look like /preview.html?c=YOUR_ID.');

  let campaign, advertiser, dispensaryMap, strainDelta, allAds;
  try {
    campaign = await getCampaign(campaignId);
    if (!campaign) return showError('This preview link is no longer valid.');

    [advertiser, dispensaryMap, strainDelta, allAds] = await Promise.all([
      campaign.advertiserId ? getAdvertiser(campaign.advertiserId).catch(() => null) : Promise.resolve(null),
      getDispensaryMap(),
      getStrainDelta(),
      getAllAds(),
    ]);
  } catch (err) {
    console.error('Preview load failed:', err);
    return showError('Something went wrong loading this preview. Please try again in a moment.');
  }

  // Resolve sponsored strains
  const allStrains = [...strainsData, ...(strainDelta?.additions || [])]
    .map(s => strainDelta?.overrides?.[s.id] ? { ...s, ...strainDelta.overrides[s.id] } : s);
  const sponsoredIds = campaign.inventory?.sponsoredStrainIds || [];
  const sponsoredStrains = sponsoredIds
    .map(id => allStrains.find(s => s.id === id))
    .filter(Boolean);

  const partnerStrains = campaign.inventory?.partnerStrains || [];
  const campaignAds = allAds.filter(a => a.campaignId === campaign.id);

  renderPreview({ campaign, advertiser, dispensaryMap, sponsoredStrains, partnerStrains, campaignAds });
}

function renderPreview({ campaign, advertiser, dispensaryMap, sponsoredStrains, partnerStrains, campaignAds }) {
  document.getElementById('preview-loading').classList.add('hidden');

  const wrap = document.getElementById('preview-content');
  wrap.classList.remove('hidden');

  const advName = advertiser?.name || campaign.name;
  const dispensaryId = advertiser?.dispensaryId;
  const dispensaryName = dispensaryId ? (dispensaryMap[dispensaryId]?.name || dispensaryId) : null;
  const city = advertiser && dispensaryMap[dispensaryId]?.city
    ? dispensaryMap[dispensaryId].city
    : 'California';

  const tier = campaign.tier || 'custom';
  const price = fmtPrice(campaign.monthlyPriceCents);
  const dateRange = `${fmtDate(campaign.startsAt)} → ${campaign.endsAt ? fmtDate(campaign.endsAt) : 'open'}`;

  // Inventory summary
  const inventorySummary = [
    sponsoredStrains.length ? `${sponsoredStrains.length} sponsored strain${sponsoredStrains.length > 1 ? 's' : ''}` : null,
    partnerStrains.length   ? `${partnerStrains.length} partner listing${partnerStrains.length > 1 ? 's' : ''}` : null,
    campaignAds.length      ? `${campaignAds.length} display ad${campaignAds.length > 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(' · ') || 'Inventory pending';

  wrap.innerHTML = `
    <header class="preview-header">
      <div class="preview-header__brand">
        <span class="preview-header__leaf">🌿</span>
        <span class="preview-header__name">CannaPickForMe</span>
      </div>
      <span class="preview-header__badge">Sponsorship Preview</span>
    </header>

    <section class="preview-hero">
      <p class="preview-hero__overline">Prepared for</p>
      <h1 class="preview-hero__title">${esc(advName)}</h1>
      <p class="preview-hero__sub">Here's how your sponsorship will appear to 21+ users in ${esc(city)}.</p>

      <div class="preview-meta">
        <div class="preview-meta__item">
          <span class="preview-meta__label">Tier</span>
          <span class="preview-meta__value preview-meta__value--tier preview-meta__value--tier-${esc(tier)}">${esc(tier)}</span>
        </div>
        <div class="preview-meta__item">
          <span class="preview-meta__label">Price</span>
          <span class="preview-meta__value">${esc(price)}</span>
        </div>
        <div class="preview-meta__item">
          <span class="preview-meta__label">Run dates</span>
          <span class="preview-meta__value">${esc(dateRange)}</span>
        </div>
        <div class="preview-meta__item preview-meta__item--wide">
          <span class="preview-meta__label">Inventory</span>
          <span class="preview-meta__value">${esc(inventorySummary)}</span>
        </div>
      </div>
    </section>

    ${renderSponsoredMock(sponsoredStrains)}
    ${renderPartnerMock(partnerStrains, dispensaryMap)}
    ${renderAdMock(campaignAds)}

    <section class="preview-cta">
      <h2>Ready to launch?</h2>
      <p>Reply to the email this link came from, or reach us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
      <p class="preview-cta__sub">Your sponsorship goes live the day after we receive payment. Want adjustments first? Just say what you'd change — we'll update the preview and resend.</p>
    </section>

    <footer class="preview-footer">
      <p>CannaPickForMe · 21+ only · Made with 💨 in California</p>
      <p class="preview-footer__legal">This is a preview. Inventory and pricing on this page are proposals only and become binding once a campaign is paid.</p>
    </footer>
  `;
}

function renderSponsoredMock(sponsoredStrains) {
  if (sponsoredStrains.length === 0) {
    return `
      <section class="preview-mock-section">
        <h3 class="preview-mock-section__title">Sponsored Strain Card</h3>
        <p class="preview-mock-section__sub">No sponsored strains in this campaign yet.</p>
      </section>
    `;
  }
  const strain = sponsoredStrains[0];
  return `
    <section class="preview-mock-section">
      <h3 class="preview-mock-section__title">⭐ Result Screen — Sponsored Card</h3>
      <p class="preview-mock-section__sub">Shown after every recommendation when your strain is a ≥50% match for the user's vibe.</p>
      <div class="preview-mock preview-mock--result">
        <div class="preview-mock__result-card">
          <h4 class="preview-mock__smoke">SMOKE</h4>
          <p class="preview-mock__strain-name">[user's matched strain]</p>
          <p class="preview-mock__match-score">87% match</p>
        </div>
        <div class="sponsored-strain-card sponsored-strain-card--demo">
          <div class="sponsored-ribbon">⭐ Sponsored Strain</div>
          <div class="sponsored-strain-card__body">
            <div class="sponsored-strain-card__type-dot" data-type="${esc(strain.type)}"></div>
            <div class="sponsored-strain-card__info">
              <div class="sponsored-strain-card__name">${esc(strain.name)}</div>
              <div class="sponsored-strain-card__type">${esc(strain.type.charAt(0).toUpperCase() + strain.type.slice(1))}</div>
            </div>
            <div class="sponsored-strain-card__score">82% match</div>
          </div>
        </div>
        ${sponsoredStrains.length > 1 ? `<p class="preview-mock__more">+ ${sponsoredStrains.length - 1} more in rotation</p>` : ''}
      </div>
    </section>
  `;
}

function renderPartnerMock(partnerStrains, dispensaryMap) {
  const active = partnerStrains.find(p => p.active !== false);
  if (!active) {
    return `
      <section class="preview-mock-section">
        <h3 class="preview-mock-section__title">Partner Strain</h3>
        <p class="preview-mock-section__sub">No partner listings in this campaign yet.</p>
      </section>
    `;
  }
  const dispName = active.dispensaryId ? (dispensaryMap[active.dispensaryId]?.name || active.dispensaryId) : null;
  const type = (active.strainType || 'hybrid');
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  const effects = (active.effects || []).slice(0, 3).join(' · ');

  return `
    <section class="preview-mock-section">
      <h3 class="preview-mock-section__title">✦ Better Matches Modal — Partner Card</h3>
      <p class="preview-mock-section__sub">Slot 4 of the "See strains beyond your stash" modal. Tappable, opens your link in a new tab.</p>
      <div class="preview-mock preview-mock--modal">
        <div class="partner-strain-card partner-strain-card--demo">
          <div class="partner-strain-card__header">
            <span class="partner-strain-card__badge">✦ Partnered Strain</span>
            <span class="partner-strain-card__brand">${esc(active.brandName || '')}</span>
          </div>
          <div class="partner-strain-card__body">
            <div class="strain-card__type-dot" data-type="${esc(type)}"></div>
            <div class="partner-strain-card__info">
              <div class="partner-strain-card__name">${esc(active.strainName || '')}</div>
              <div class="partner-strain-card__meta">${esc(typeLabel)}${effects ? ' · ' + esc(effects) : ''}</div>
              ${dispName ? `<div class="partner-strain-card__disp">📍 ${esc(dispName)}</div>` : ''}
            </div>
            ${active.clickUrl ? '<span class="partner-strain-card__cta">View →</span>' : ''}
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderAdMock(campaignAds) {
  if (campaignAds.length === 0) {
    return `
      <section class="preview-mock-section">
        <h3 class="preview-mock-section__title">📢 Display Ad</h3>
        <p class="preview-mock-section__sub">No ad creatives in this campaign yet. Once you send us your image (300×300 card or 1200×400 banner) it appears here.</p>
      </section>
    `;
  }
  const ad = campaignAds[0];
  const displayType = ad.displayType || 'card';
  const posX = Math.max(0, Math.min(100, Number(ad.imagePosition?.x) || 50));
  const posY = Math.max(0, Math.min(100, Number(ad.imagePosition?.y) || 50));
  const imgPos = `object-position: ${posX}% ${posY}%`;
  const placement = ad.placement === 'home' ? 'Home Screen' : 'Result Screen';

  const mockHtml = displayType === 'banner'
    ? `
      <div class="ad-banner ad-banner--demo">
        <img src="${esc(ad.imageUrl)}" alt="" class="ad-banner__image" style="${imgPos}" />
        <div class="ad-banner__footer"><span class="ad-banner__label">✦ Sponsored</span></div>
      </div>`
    : `
      <div class="ad-card ad-card--demo">
        <span class="ad-card__sponsored">Sponsored</span>
        <img src="${esc(ad.imageUrl)}" alt="" class="ad-card__image" style="${imgPos}" />
        <div class="ad-card__info">
          <div class="ad-card__title">${esc(ad.title || '')}</div>
          ${ad.description ? `<div class="ad-card__description">${esc(ad.description)}</div>` : ''}
        </div>
      </div>`;

  return `
    <section class="preview-mock-section">
      <h3 class="preview-mock-section__title">📢 ${esc(placement)} — ${esc(displayType === 'banner' ? 'Banner Ad' : 'Card Ad')}</h3>
      <p class="preview-mock-section__sub">Tappable. Links to your URL of choice. Impression and click counts are tracked.</p>
      <div class="preview-mock preview-mock--ad">${mockHtml}</div>
      ${campaignAds.length > 1 ? `<p class="preview-mock__more">+ ${campaignAds.length - 1} more in rotation</p>` : ''}
    </section>
  `;
}

main();
