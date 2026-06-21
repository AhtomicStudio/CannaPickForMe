/**
 * Admin Dashboard for CannaPickForMe
 * Password-gated ad management interface.
 */

import './tokens.css';
import './admin.css';
// strains.json is served from /public and fetched at runtime (not bundled)
let strainsData = [];
import { getStrainDelta, saveStrainDelta, getMenuData, saveMenuData } from './services/strainService.js';
import { getAllAds, createAd, updateAd, deleteAd, uploadAdImage } from './services/adService.js';
import { getPageContent, savePageContent } from './services/pagesService.js';
import { getInfoTopics, saveInfoTopic, deleteInfoTopic } from './services/infoService.js';
import { auth } from './firebase.js';
import { sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, signOut, onAuthStateChanged } from 'firebase/auth';

// Phase 1 sponsorship system — campaign-based inventory.
import {
  listDispensaries, saveDispensary, deleteDispensary,
  getDispensaryNameSync, getDispensaryMap, invalidateDispensaryCache,
} from './services/dispensaryService.js';
import {
  listAdvertisers, createAdvertiser, updateAdvertiser, deleteAdvertiser, getAdvertiser,
  ADVERTISER_STATUS,
} from './services/advertiserService.js';
import {
  listCampaigns, createCampaign, updateCampaign, deleteCampaign, getCampaign,
  CAMPAIGN_STATUS, CAMPAIGN_TIER, TIER_DEFAULTS, isCampaignLive,
} from './services/campaignService.js';
import { invalidateSponsorshipCache } from './services/sponsorshipService.js';
import { runSponsorshipMigrationIfNeeded } from './services/sponsorshipMigration.js';

const ADMIN_EMAIL = 'twotales89@gmail.com';

// Dispensaries are now Firestore-backed (see dispensaryService.js).
// The map is prefetched at dashboard init (showDashboard) and refreshed
// after any mutation. _dispensaryPairs holds [slug, name] tuples in
// display-name order so the form rendering code can stay synchronous.
let _dispensaryPairs = [];
function dispensaryLabel(slug) {
  return getDispensaryNameSync(slug);
}

const ALL_EFFECTS = ['Creative','Energetic','Euphoric','Focused','Giggly','Happy','Hungry','Relaxed','Sleepy','Talkative','Tingly','Uplifted'];
const ALL_FLAVORS  = ['Apple','Banana','Berry','Blueberry','Candy','Cheese','Cherry','Chocolate','Citrus','Coffee','Creamy','Diesel','Earthy','Floral','Flowery','Fruity','Grape','Guava','Lemon','Mango','Melon','Mint','Minty','Nutty','Orange','Peach','Pine','Pineapple','Plum','Pungent','Sour','Spicy','Strawberry','Sweet','Tropical','Vanilla','Woody'];

// === AUTH ===
async function authedSaveStrainDelta(delta) {
  return saveStrainDelta(delta);
}

function logout() {
  signOut(auth).then(() => location.reload());
}

// === STATE ===
let editingAdId = null;
let existingImageUrl = null;
let previewImageSrc = null;
let previewPosition = { x: 50, y: 50 }; // object-position for the framed image

function applyPreviewPosition() {
  const pos = `${previewPosition.x}% ${previewPosition.y}%`;
  const cardImg = document.getElementById('ad-preview-card-img');
  const bannerImg = document.getElementById('ad-preview-banner-img');
  if (cardImg) cardImg.style.objectPosition = pos;
  if (bannerImg) bannerImg.style.objectPosition = pos;
}

// === STRAIN STATE ===
let strainDelta           = { hidden: [], overrides: {}, additions: [], sponsored: [], sponsorSettings: { threshold: 50, alwaysShow: false } };
let editingStrainId       = null;
let editingStrainIsAddition = false;
let selectedEffects       = [];
let selectedFlavors       = [];
let strainSearchQuery     = '';
let strainTypeFilter      = 'all';

// === TAG INPUT ===
function renderTagInput(pillsEl, optionsEl, selected, allOptions, pillClass, onChange) {
  pillsEl.innerHTML = selected.map(v =>
    `<span class="admin-tag-pill admin-tag-pill--${pillClass}" data-value="${v}">
      ${v} <span class="admin-tag-pill__remove">✕</span>
    </span>`
  ).join('');

  optionsEl.innerHTML = allOptions
    .filter(v => !selected.includes(v))
    .map(v => `<span class="admin-tag-option" data-value="${v}">${v}</span>`)
    .join('');

  pillsEl.querySelectorAll('.admin-tag-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      onChange(selected.filter(v => v !== pill.dataset.value));
    });
  });

  optionsEl.querySelectorAll('.admin-tag-option').forEach(opt => {
    opt.addEventListener('click', () => {
      onChange([...selected, opt.dataset.value]);
    });
  });
}

function refreshEffects() {
  renderTagInput(
    document.getElementById('effects-pills'),
    document.getElementById('effects-options'),
    selectedEffects,
    ALL_EFFECTS,
    'effect',
    (next) => { selectedEffects = next; refreshEffects(); }
  );
}

function refreshFlavors() {
  renderTagInput(
    document.getElementById('flavors-pills'),
    document.getElementById('flavors-options'),
    selectedFlavors,
    ALL_FLAVORS,
    'flavor',
    (next) => { selectedFlavors = next; refreshFlavors(); }
  );
}

function renderDispensaryCheckboxes(selected = []) {
  const group = document.getElementById('strain-dispensaries-group');
  group.innerHTML = _dispensaryPairs.map(([key, label]) =>
    `<label class="admin-checkbox-label">
      <input type="checkbox" value="${key}" ${selected.includes(key) ? 'checked' : ''} />
      ${label}
    </label>`
  ).join('');
}

function getSelectedDispensaries() {
  return [...document.querySelectorAll('#strain-dispensaries-group input:checked')]
    .map(el => el.value);
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// === STRAIN FORM ===
function resetStrainForm() {
  editingStrainId = null;
  editingStrainIsAddition = false;
  selectedEffects = [];
  selectedFlavors = [];

  document.getElementById('strain-form-title').textContent = '🌿 Add New Strain';
  document.getElementById('strain-form').reset();
  document.querySelector('input[name="strain-type"][value="hybrid"]').checked = true;
  document.getElementById('edit-strain-id').value = '';
  document.getElementById('edit-strain-is-addition').value = '';
  document.getElementById('btn-cancel-strain').classList.add('hidden');
  document.getElementById('btn-submit-strain').textContent = 'Add Strain';

  strainSearchQuery = '';
  strainTypeFilter = 'all';
  const searchInput = document.getElementById('strain-admin-search');
  if (searchInput) searchInput.value = '';
  document.querySelectorAll('#strain-filter-tabs .admin-filter-tab').forEach(t =>
    t.classList.toggle('admin-filter-tab--active', t.dataset.filter === 'all')
  );

  refreshEffects();
  refreshFlavors();
  renderDispensaryCheckboxes([]);
}

function startEditingStrain(strainId, isAddition) {
  let strain;
  if (isAddition) {
    strain = strainDelta.additions.find(s => s.id === strainId);
  } else {
    const base = strainsData.find(s => s.id === strainId) || {};
    const override = strainDelta.overrides[strainId] || {};
    strain = { ...base, ...override };
  }
  if (!strain) return;

  editingStrainId = strainId;
  editingStrainIsAddition = isAddition;
  selectedEffects = [...(strain.effects || [])];
  selectedFlavors = [...(strain.flavors || [])];

  document.getElementById('strain-form-title').textContent = '✏️ Edit Strain';
  document.getElementById('edit-strain-id').value = strainId;
  document.getElementById('edit-strain-is-addition').value = isAddition ? 'true' : '';
  document.getElementById('strain-name').value = strain.name || '';
  const typeRadio = document.querySelector(`input[name="strain-type"][value="${strain.type || 'hybrid'}"]`);
  if (typeRadio) typeRadio.checked = true;
  document.getElementById('strain-description').value = strain.description || '';
  document.getElementById('strain-genetics').value = strain.genetics || '';
  document.getElementById('strain-rating').value = strain.rating != null ? strain.rating : '';
  document.getElementById('btn-cancel-strain').classList.remove('hidden');
  document.getElementById('btn-submit-strain').textContent = 'Save Changes';

  refreshEffects();
  refreshFlavors();
  renderDispensaryCheckboxes(strain.dispensaries || []);

  expandSection('strain-form-section');
  document.getElementById('strain-form-title').scrollIntoView({ behavior: 'smooth' });
}

// === STRAIN LIST ===
function renderStrainList() {
  const container = document.getElementById('strains-admin-list');
  let rows = [
    ...strainsData.map(s => ({ ...s, _isAddition: false })),
    ...strainDelta.additions.map(s => ({ ...s, _isAddition: true })),
  ];

  if (strainSearchQuery) {
    rows = rows.filter(s => s.name.toLowerCase().includes(strainSearchQuery));
  }
  if (strainTypeFilter !== 'all') {
    rows = rows.filter(s => s.type === strainTypeFilter);
  }

  if (rows.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);padding:1rem 0.5rem;font-size:0.85rem;">No strains match.</p>';
    return;
  }

  // Phase 1: the ⭐ button is gone — sponsorship is managed inside a
  // campaign now. We still show a small read-only badge if a strain is
  // currently part of any live campaign's sponsored inventory, so the
  // operator can see at a glance what's active without leaving this list.
  const liveSponsoredIds = _liveSponsoredStrainIds || new Set();

  container.innerHTML = rows.map(s => {
    const isHidden    = strainDelta.hidden.includes(s.id);
    const isAddition  = s._isAddition;
    const hasOverride = !isAddition && !!strainDelta.overrides[s.id];
    const inLiveCampaign = liveSponsoredIds.has(s.id);

    return `
      <div class="admin-strain-row ${isHidden ? 'admin-strain-row--hidden' : ''}" data-id="${esc(s.id)}">
        <span class="admin-strain-row__dot" data-type="${esc(s.type)}"></span>
        <span class="admin-strain-row__name">${esc(s.name)}</span>
        <div class="admin-strain-row__badges">
          ${isAddition  ? '<span class="admin-tag" style="border-color:var(--green-primary);color:var(--green-glow)">🌱 Added</span>' : ''}
          ${hasOverride ? '<span class="admin-tag" style="border-color:#fbbf24;color:#fbbf24">edited</span>' : ''}
          ${s.needsReview ? '<span class="admin-tag" style="border-color:#f87171;color:#f87171">⚠️ Review</span>' : ''}
          ${inLiveCampaign ? '<span class="admin-tag" style="border-color:#f59e0b;color:#f59e0b" title="This strain is sponsored by a live campaign">⭐ Sponsored</span>' : ''}
        </div>
        <div class="admin-strain-row__actions">
          ${isHidden
            ? `<button class="admin-btn admin-btn--small" data-action="restore" data-id="${esc(s.id)}">↩ Restore</button>`
            : `<button class="admin-btn admin-btn--small" data-action="edit" data-id="${esc(s.id)}" data-addition="${isAddition}">✏️</button>
               <button class="admin-btn admin-btn--small admin-btn--danger" data-action="${isAddition ? 'delete' : 'hide'}" data-id="${esc(s.id)}">
                 ${isAddition ? '🗑️' : '🙈 Hide'}
               </button>`
          }
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () =>
      startEditingStrain(btn.dataset.id, btn.dataset.addition === 'true')
    );
  });

  container.querySelectorAll('[data-action="hide"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      strainDelta.hidden.push(btn.dataset.id);
      await authedSaveStrainDelta(strainDelta);
      renderStrainList();
    });
  });

  container.querySelectorAll('[data-action="restore"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      strainDelta.hidden = strainDelta.hidden.filter(id => id !== btn.dataset.id);
      await authedSaveStrainDelta(strainDelta);
      renderStrainList();
    });
  });

  container.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this strain permanently?')) return;
      strainDelta.additions = strainDelta.additions.filter(s => s.id !== btn.dataset.id);
      await authedSaveStrainDelta(strainDelta);
      renderStrainList();
    });
  });

  // [data-action="sponsor"] listener removed in Phase 1 — sponsorship
  // is managed inside campaigns now (see initCampaignManager).
}

// === UI ===
async function showDashboard() {
  document.getElementById('login-gate').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');

  // Prefetch the dispensary map BEFORE rendering any UI that depends
  // on it. Falls back to empty so the dashboard still loads if the
  // collection isn't seeded yet (the migration runs next and seeds it).
  try {
    const map = await getDispensaryMap();
    _dispensaryPairs = Object.entries(map).map(([slug, data]) => [slug, data.name || slug]);
    _dispensaryPairs.sort((a, b) => a[1].localeCompare(b[1]));
  } catch (err) {
    console.warn('Dispensary prefetch failed:', err);
    _dispensaryPairs = [];
  }

  // One-shot migration sweep: seed dispensaries, convert legacy sponsor
  // state into a Legacy campaign, attach orphan ads. Safe to call on
  // every load — the sentinel doc gates it after the first successful run.
  try {
    const summary = await runSponsorshipMigrationIfNeeded();
    if (summary) {
      // Migration just ran — refresh the dispensary cache so any newly
      // seeded entries are visible without a manual reload.
      invalidateDispensaryCache();
      const map = await getDispensaryMap();
      _dispensaryPairs = Object.entries(map).map(([slug, data]) => [slug, data.name || slug]);
      _dispensaryPairs.sort((a, b) => a[1].localeCompare(b[1]));

      const banner = document.getElementById('migration-banner');
      const text   = document.getElementById('migration-banner-text');
      if (banner && text) {
        const parts = [];
        if (summary.dispensariesSeeded > 0) parts.push(`${summary.dispensariesSeeded} dispensaries seeded`);
        if (summary.legacyCampaignId)      parts.push(`legacy sponsorships consolidated into a Legacy campaign`);
        if (summary.orphanAdsAttached > 0) parts.push(`${summary.orphanAdsAttached} existing ads linked`);
        text.textContent = parts.length ? parts.join(' · ') + '.' : 'Schema upgraded. No changes were needed.';
        banner.classList.remove('hidden');
      }
    }
  } catch (err) {
    console.error('Sponsorship migration failed:', err);
  }

  // Wire dismiss
  const dismiss = document.getElementById('migration-banner-dismiss');
  if (dismiss) dismiss.addEventListener('click', () => {
    document.getElementById('migration-banner')?.classList.add('hidden');
  });

  // Load strains.json from public/ (moved out of the bundle in ae9318c)
  try {
    const res = await fetch('/data/strains.json');
    if (!res.ok) throw new Error(`strains fetch failed: ${res.status}`);
    strainsData = await res.json();
  } catch (err) {
    console.error('Admin: failed to load strains.json:', err);
    strainsData = [];
  }

  loadAdsList();
  initStrainManager();
  initMenuSync();
  initInfoEditor();
  initPagesEditor();
  initSponsorSettings();
  initPartnerStrains();
  // Phase 1 additions:
  initCampaignManager();
  initAdvertiserManager();
  initDispensaryManager();
}

function populateSponsorDropdown() {
  const sel  = document.getElementById('sponsor-quick-edit-select');
  const hint = document.getElementById('sponsor-quick-edit-hint');
  if (!sel) return;

  const sponsored = strainDelta.sponsored || [];
  const allStrains = [
    ...strainsData,
    ...(strainDelta.additions || []),
  ];

  sel.innerHTML = '<option value="">— select a sponsored strain —</option>';

  if (sponsored.length === 0) {
    hint.textContent = 'No sponsored strains yet. Mark a strain as ⭐ sponsored in Manage Strains first.';
    hint.style.display = '';
    return;
  }

  hint.style.display = 'none';
  for (const id of sponsored) {
    const override = strainDelta.overrides?.[id];
    const base = allStrains.find(s => s.id === id);
    const name = override?.name || base?.name || id;
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = name;
    sel.appendChild(opt);
  }
}

function initSponsorSettings() {
  // Phase 1: this section is deprecated — campaigns replace the
  // threshold/alwaysShow knobs (the render path uses a fixed 50%).
  // We early-return if the section is marked deprecated so we don't
  // wire listeners to hidden DOM.
  const section = document.getElementById('sponsor-settings-section');
  if (section?.dataset.deprecated === 'true') return;

  const thresholdSlider  = document.getElementById('sponsor-threshold');
  const thresholdDisplay = document.getElementById('sponsor-threshold-display');
  const alwaysShowCheck  = document.getElementById('sponsor-always-show');
  const saveBtn          = document.getElementById('btn-save-sponsor-settings');
  const savedLabel       = document.getElementById('sponsor-settings-saved');

  if (!thresholdSlider) return;

  // Populate from loaded strainDelta (may not be loaded yet — we re-read after initStrainManager)
  function applySettings() {
    const s = strainDelta.sponsorSettings || {};
    thresholdSlider.value = s.threshold ?? 50;
    thresholdDisplay.textContent = `${thresholdSlider.value}%`;
    alwaysShowCheck.checked = s.alwaysShow ?? false;
  }

  // Wait for initStrainManager's getStrainDelta to resolve
  setTimeout(applySettings, 500);

  thresholdSlider.addEventListener('input', () => {
    thresholdDisplay.textContent = `${thresholdSlider.value}%`;
  });

  // Quick-edit button
  const quickEditBtn = document.getElementById('btn-sponsor-quick-edit');
  if (quickEditBtn) {
    quickEditBtn.addEventListener('click', () => {
      const sel = document.getElementById('sponsor-quick-edit-select');
      const id  = sel?.value;
      if (!id) { alert('Please select a sponsored strain from the dropdown.'); return; }
      const isAddition = !!(strainDelta.additions || []).find(s => s.id === id);
      startEditingStrain(id, isAddition);
      expandSection('strain-form-section');
      // Also expand the strain list so the user can see the list after editing
      expandSection('strain-list-section');
    });
  }

  // Populate after data loads (initStrainManager sets strainDelta)
  setTimeout(populateSponsorDropdown, 600);

  saveBtn.addEventListener('click', async () => {
    strainDelta.sponsorSettings = {
      threshold: parseInt(thresholdSlider.value, 10),
      alwaysShow: alwaysShowCheck.checked,
    };
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
    try {
      await authedSaveStrainDelta(strainDelta);
      savedLabel.style.display = 'inline';
      setTimeout(() => { savedLabel.style.display = 'none'; }, 2500);
    } catch (err) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      saveBtn.textContent = 'Save Sponsor Settings';
      saveBtn.disabled = false;
    }
  });
}

async function loadAdsList() {
  const loading = document.getElementById('ads-loading');
  const empty = document.getElementById('ads-empty');
  const tableWrap = document.getElementById('ads-table-wrap');
  const tbody = document.getElementById('ads-tbody');

  loading.classList.remove('hidden');
  empty.classList.add('hidden');
  tableWrap.classList.add('hidden');

  const ads = await getAllAds();

  loading.classList.add('hidden');

  if (ads.length === 0) {
    empty.classList.remove('hidden');
    return;
  }

  tableWrap.classList.remove('hidden');
  tbody.innerHTML = ads.map(ad => `
    <tr data-id="${ad.id}">
      <td>
        <img src="${ad.imageUrl}" alt="${ad.title}" class="admin-table__preview" />
      </td>
      <td>
        <strong>${ad.title || '(untitled)'}</strong>
        ${ad.description ? `<br><small>${ad.description}</small>` : ''}
      </td>
      <td><span class="admin-tag">${ad.placement}</span></td>
      <td><span class="admin-tag admin-tag--${ad.displayType || 'card'}">${ad.displayType || 'card'}</span></td>
      <td class="center">${ad.priority || 5}</td>
      <td class="center">
        <button class="admin-toggle ${ad.active ? 'admin-toggle--on' : ''}" data-action="toggle" data-id="${ad.id}" data-active="${ad.active}">
          ${ad.active ? '✅ ON' : '❌ OFF'}
        </button>
      </td>
      <td>
        <div class="admin-table__actions">
          <button class="admin-btn admin-btn--small" data-action="edit" data-id="${ad.id}">✏️</button>
          <button class="admin-btn admin-btn--small admin-btn--danger" data-action="delete" data-id="${ad.id}" data-image="${ad.imageUrl || ''}">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');

  // Event delegation
  tbody.querySelectorAll('[data-action="toggle"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const currentlyActive = btn.dataset.active === 'true';
      await updateAd(id, { active: !currentlyActive });
      loadAdsList();
    });
  });

  tbody.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this ad? This cannot be undone.')) return;
      await deleteAd(btn.dataset.id, btn.dataset.image);
      loadAdsList();
    });
  });

  tbody.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ad = ads.find(a => a.id === btn.dataset.id);
      if (ad) startEditing(ad);
    });
  });
}

function startEditing(ad) {
  editingAdId = ad.id;
  existingImageUrl = ad.imageUrl;

  document.getElementById('form-title').textContent = '✏️ Edit Ad';
  document.getElementById('edit-ad-id').value = ad.id;
  document.getElementById('ad-title').value = ad.title || '';
  document.getElementById('ad-click-url').value = ad.clickUrl || '';
  document.getElementById('ad-placement').value = ad.placement || 'home';
  document.getElementById('ad-display-type').value = ad.displayType || 'card';
  document.getElementById('ad-priority').value = ad.priority || 5;
  document.getElementById('priority-display').textContent = ad.priority || 5;
  document.getElementById('ad-description').value = ad.description || '';
  // Pre-select the ad's owning campaign in the dropdown. The dropdown
  // is populated at dashboard init; if it hasn't loaded yet, refresh
  // and then set the value.
  const campSel = document.getElementById('ad-campaign');
  if (campSel) {
    if (campSel.options.length > 1) {
      campSel.value = ad.campaignId || '';
    } else if (typeof refreshAdCampaignDropdown === 'function') {
      refreshAdCampaignDropdown().then(() => { campSel.value = ad.campaignId || ''; });
    }
  }

  // Show existing image preview
  const preview = document.getElementById('image-preview');
  const previewImg = document.getElementById('preview-img');
  previewImg.src = ad.imageUrl;
  preview.classList.remove('hidden');
  previewImageSrc = ad.imageUrl;
  previewPosition = { ...(ad.imagePosition || { x: 50, y: 50 }) };

  // Image is optional when editing
  document.getElementById('ad-image').removeAttribute('required');

  document.getElementById('btn-cancel-edit').classList.remove('hidden');
  document.getElementById('btn-submit-ad').textContent = 'Update Ad';

  // Scroll to form
  document.getElementById('form-title').scrollIntoView({ behavior: 'smooth' });
}

function cancelEditing() {
  editingAdId = null;
  existingImageUrl = null;

  document.getElementById('form-title').textContent = '➕ Add New Ad';
  document.getElementById('ad-form').reset();
  document.getElementById('edit-ad-id').value = '';
  document.getElementById('image-preview').classList.add('hidden');
  document.getElementById('ad-image').setAttribute('required', '');
  previewImageSrc = null;
  previewPosition = { x: 50, y: 50 };
  document.getElementById('btn-cancel-edit').classList.add('hidden');
  document.getElementById('btn-submit-ad').textContent = 'Create Ad';
  document.getElementById('priority-display').textContent = '5';
}

// === STRAIN MANAGER INIT ===
function initStrainManager() {
  getStrainDelta().then(delta => {
    strainDelta = delta;
    resetStrainForm();
    renderStrainList();
  }).catch(err => {
    console.error('Failed to initialize strain manager:', err);
  });

  document.getElementById('strain-admin-search').addEventListener('input', e => {
    strainSearchQuery = e.target.value.toLowerCase();
    renderStrainList();
  });

  document.getElementById('strain-filter-tabs').querySelectorAll('.admin-filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#strain-filter-tabs .admin-filter-tab').forEach(t => t.classList.remove('admin-filter-tab--active'));
      tab.classList.add('admin-filter-tab--active');
      strainTypeFilter = tab.dataset.filter;
      renderStrainList();
    });
  });

  document.getElementById('btn-cancel-strain').addEventListener('click', resetStrainForm);

  document.getElementById('strain-form').addEventListener('submit', async e => {
    e.preventDefault();
    const submitBtn = document.getElementById('btn-submit-strain');
    submitBtn.textContent = 'Saving...';
    submitBtn.disabled = true;

    try {
      const name         = document.getElementById('strain-name').value.trim();
      const type         = document.querySelector('input[name="strain-type"]:checked').value;
      const description  = document.getElementById('strain-description').value.trim();
      const genetics     = document.getElementById('strain-genetics').value.trim() || null;
      const ratingRaw    = document.getElementById('strain-rating').value;
      const rating       = ratingRaw ? parseFloat(ratingRaw) : null;
      const dispensaries = getSelectedDispensaries();

      if (editingStrainIsAddition) {
        const idx = strainDelta.additions.findIndex(s => s.id === editingStrainId);
        if (idx >= 0) {
          strainDelta.additions[idx] = {
            ...strainDelta.additions[idx],
            name, type, effects: selectedEffects, flavors: selectedFlavors,
            description, genetics, rating, dispensaries, isAddition: true,
            needsReview: false,
          };
        }
      } else if (editingStrainId) {
        strainDelta.overrides[editingStrainId] = {
          name, type, effects: selectedEffects, flavors: selectedFlavors,
          description, genetics, rating, dispensaries,
        };
      } else {
        const id = 'add-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        strainDelta.additions.push({
          id, name, type,
          effects: selectedEffects,
          flavors: selectedFlavors,
          description, genetics, rating, dispensaries,
          isAddition: true,
        });
      }

      await authedSaveStrainDelta(strainDelta);
      resetStrainForm();
      renderStrainList();
      renderReviewQueue();
    } catch (err) {
      console.error('Error saving strain:', err);
      alert('Failed to save strain. Check console for details.');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// === DRAG-TO-REFRAME ===
function initDragPreview() {
  const previewWrap = document.getElementById('ad-preview-wrap');
  let dragging = false;
  let dragStartX = 0, dragStartY = 0;
  let dragStartPos = { x: 50, y: 50 };

  function startDrag(clientX, clientY) {
    if (!previewImageSrc) return;
    dragging = true;
    dragStartX = clientX;
    dragStartY = clientY;
    dragStartPos = { ...previewPosition };
    previewWrap.classList.add('admin-preview-wrap--dragging');
  }

  function moveDrag(clientX, clientY) {
    if (!dragging) return;
    const dx = clientX - dragStartX;
    const dy = clientY - dragStartY;
    // 0.3% per pixel — drag ~333px to go from 0% to 100%
    previewPosition.x = Math.max(0, Math.min(100, dragStartPos.x - dx * 0.3));
    previewPosition.y = Math.max(0, Math.min(100, dragStartPos.y - dy * 0.3));
    applyPreviewPosition();
  }

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    previewWrap.classList.remove('admin-preview-wrap--dragging');
  }

  previewWrap.addEventListener('mousedown', (e) => { startDrag(e.clientX, e.clientY); e.preventDefault(); });
  document.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
  document.addEventListener('mouseup', endDrag);

  function onTouchMove(e) {
    moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    e.preventDefault();
  }

  previewWrap.addEventListener('touchstart', (e) => {
    startDrag(e.touches[0].clientX, e.touches[0].clientY);
    if (dragging) {
      e.preventDefault();
      document.addEventListener('touchmove', onTouchMove, { passive: false });
    }
  }, { passive: false });

  document.addEventListener('touchend', () => {
    endDrag();
    document.removeEventListener('touchmove', onTouchMove);
  });
}

// === COLLAPSIBLE SECTIONS ===
function initCollapsibleSections() {
  document.querySelectorAll('.admin-section__toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const section = toggle.closest('.admin-section--collapsible');
      const nowCollapsed = section.classList.toggle('admin-section--collapsed');
      toggle.setAttribute('aria-expanded', String(!nowCollapsed));
    });
  });
}

function expandSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  section.classList.remove('admin-section--collapsed');
  section.querySelector('.admin-section__toggle').setAttribute('aria-expanded', 'true');
}

// === INIT ===
async function init() {
  initCollapsibleSections();
  initDragPreview();

  // Login form — register before any awaits so it's always wired
  // Magic-link login: email a one-time sign-in link to the admin address.
  const ACTION_CODE_SETTINGS = { url: `${location.origin}/admin`, handleCodeInApp: true };
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-admin-login');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    try {
      await sendSignInLinkToEmail(auth, ADMIN_EMAIL, ACTION_CODE_SETTINGS);
      document.getElementById('login-error')?.classList.add('hidden');
      document.getElementById('login-sent')?.classList.remove('hidden');
    } catch (err) {
      const el = document.getElementById('login-error');
      if (el) { el.textContent = `Couldn't send the link: ${err.message}`; el.classList.remove('hidden'); }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '📧 Email me a sign-in link'; }
    }
  });

  // If we arrived via the emailed magic link, complete sign-in.
  if (isSignInWithEmailLink(auth, window.location.href)) {
    signInWithEmailLink(auth, ADMIN_EMAIL, window.location.href)
      .then(() => history.replaceState(null, '', `${location.origin}/admin`))
      .catch((err) => {
        const el = document.getElementById('login-error');
        if (el) { el.textContent = `Sign-in link error: ${err.message}`; el.classList.remove('hidden'); }
      });
  }

  // Check existing session via Firebase auth state
  onAuthStateChanged(auth, (user) => {
    if (user && user.email === ADMIN_EMAIL) {
      showDashboard();
    } else {
      document.getElementById('login-gate').classList.remove('hidden');
      document.getElementById('dashboard').classList.add('hidden');
    }
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', logout);

  // Priority slider display
  document.getElementById('ad-priority').addEventListener('input', (e) => {
    document.getElementById('priority-display').textContent = e.target.value;
  });

  // Image preview
  document.getElementById('ad-image').addEventListener('change', (e) => {
    const file = e.target.files[0];
    const preview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    if (file) {
      const url = URL.createObjectURL(file);
      previewImg.src = url;
      preview.classList.remove('hidden');
      previewImageSrc = url;
    } else {
      preview.classList.add('hidden');
      previewImageSrc = null;
    }
    updateAdPreview();
  });

  // Dimension hint + live preview
  const HINTS = {
    card: '300 × 300 px recommended — square (1:1)',
    banner: '1200 × 400 px recommended — landscape (3:1)',
  };

  function updateAdPreview() {
    const displayType = document.getElementById('ad-display-type').value;
    const title = document.getElementById('ad-title').value.trim();
    const description = document.getElementById('ad-description').value.trim();
    const previewWrap = document.getElementById('ad-preview-wrap');
    const dragHint = document.getElementById('preview-drag-hint');

    document.getElementById('image-hint').textContent = HINTS[displayType] || HINTS.card;

    const empty = document.getElementById('ad-preview-empty');
    const cardEl = document.getElementById('ad-preview-card');
    const bannerEl = document.getElementById('ad-preview-banner');

    if (!previewImageSrc && !title) {
      empty.classList.remove('hidden');
      cardEl.classList.add('hidden');
      bannerEl.classList.add('hidden');
      previewWrap.classList.remove('admin-preview-wrap--draggable');
      dragHint.classList.add('hidden');
      return;
    }

    empty.classList.add('hidden');
    previewWrap.classList.toggle('admin-preview-wrap--draggable', !!previewImageSrc);
    dragHint.classList.toggle('hidden', !previewImageSrc);

    if (displayType === 'banner') {
      cardEl.classList.add('hidden');
      bannerEl.classList.remove('hidden');
      const img = document.getElementById('ad-preview-banner-img');
      img.src = previewImageSrc || '';
      img.style.display = previewImageSrc ? 'block' : 'none';
    } else {
      bannerEl.classList.add('hidden');
      cardEl.classList.remove('hidden');
      const img = document.getElementById('ad-preview-card-img');
      img.src = previewImageSrc || '';
      img.style.display = previewImageSrc ? 'block' : 'none';
      document.getElementById('ad-preview-card-title').textContent = title || 'Ad Title';
      document.getElementById('ad-preview-card-desc').textContent = description;
    }

    applyPreviewPosition();
  }

  document.getElementById('ad-display-type').addEventListener('change', updateAdPreview);
  document.getElementById('ad-title').addEventListener('input', updateAdPreview);
  document.getElementById('ad-description').addEventListener('input', updateAdPreview);

  // Cancel editing
  document.getElementById('btn-cancel-edit').addEventListener('click', cancelEditing);

  // Submit ad form
  document.getElementById('ad-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('btn-submit-ad');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Saving...';
    submitBtn.disabled = true;

    try {
      const fileInput = document.getElementById('ad-image');
      let imageUrl = existingImageUrl;

      // Upload new image if provided
      if (fileInput.files.length > 0) {
        imageUrl = await uploadAdImage(fileInput.files[0]);
      }

      if (!imageUrl) {
        alert('Please select an image.');
        return;
      }

      const adData = {
        title: document.getElementById('ad-title').value.trim(),
        clickUrl: document.getElementById('ad-click-url').value.trim(),
        placement: document.getElementById('ad-placement').value,
        displayType: document.getElementById('ad-display-type').value,
        priority: parseInt(document.getElementById('ad-priority').value, 10),
        description: document.getElementById('ad-description').value.trim(),
        imageUrl,
        imagePosition: { x: previewPosition.x, y: previewPosition.y },
        active: true,
        // Phase 1: every ad belongs to a campaign. Unassigned ads sit
        // dormant — the new aggregator filters them out.
        campaignId: document.getElementById('ad-campaign')?.value || null,
      };

      if (editingAdId) {
        await updateAd(editingAdId, adData);
      } else {
        await createAd(adData);
      }

      cancelEditing();
      loadAdsList();
      // Refresh campaign data — the new ad's impressions/clicks counters
      // live on the ad doc and are surfaced inside the campaign editor.
      try {
        if (typeof invalidateSponsorshipCache === 'function') invalidateSponsorshipCache();
        if (typeof refreshCampaignList === 'function') await refreshCampaignList();
      } catch { /* non-fatal */ }
    } catch (err) {
      console.error('Error saving ad:', err);
      alert('Failed to save ad. Check console for details.');
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
}

// ─── Strain name matching (shared with manual import) ────────────────────────

function normaliseName(name = '') {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function findKnowledgeMatch(name) {
  const norm = normaliseName(name);
  const all  = [...strainsData, ...strainDelta.additions];
  return all.find(s => normaliseName(s.name) === norm)
    || all.find(s => norm.includes(normaliseName(s.name)))
    || null;
}

// ─── Menu Sync ────────────────────────────────────────────────────────────────

const SYNC_DISPENSARY_ID = 'cookies-hayward';

// Holds the pending sync result until admin confirms or discards
let pendingSyncResult = null;

function formatSyncTimestamp(lastSynced) {
  if (!lastSynced) return 'Last synced: never';
  const date = lastSynced.toDate ? lastSynced.toDate() : new Date(lastSynced);
  return `Last synced: ${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function renderSyncItem(item) {
  const typeDot = `<span class="admin-strain-row__dot" data-type="${esc(item.type || 'hybrid')}"></span>`;
  const thcLabel = item.thc ? `<span style="color:var(--text-muted);font-size:0.75rem">${item.thc}% THC</span>` : '';
  return `
    <div class="admin-strain-row">
      ${typeDot}
      <span class="admin-strain-row__name">${esc(item.name)}</span>
      ${thcLabel}
    </div>`;
}

function showSyncResult(result, prevStrainIds) {
  pendingSyncResult = { ...result, prevStrainIds };

  const removedStrains = prevStrainIds
    .filter(id => !result.matched.some(m => m.id === id))
    .map(id => {
      const base = strainsData.find(s => s.id === id);
      const added = strainDelta.additions.find(s => s.id === id);
      return base || added || { id, name: id, type: 'hybrid' };
    });

  const summary = document.getElementById('menu-sync-summary');
  summary.textContent =
    `${result.matched.length} matched · ${result.unmatched.length} new · ${removedStrains.length} removed`;

  const matchedGroup = document.getElementById('menu-sync-matched');
  const matchedList  = document.getElementById('menu-sync-matched-list');
  if (result.matched.length > 0) {
    matchedList.innerHTML = result.matched.map(i => renderSyncItem(i, 'matched')).join('');
    matchedGroup.classList.remove('hidden');
  } else {
    matchedGroup.classList.add('hidden');
  }

  const unmatchedGroup = document.getElementById('menu-sync-unmatched');
  const unmatchedList  = document.getElementById('menu-sync-unmatched-list');
  if (result.unmatched.length > 0) {
    unmatchedList.innerHTML = result.unmatched.map(i => renderSyncItem(i, 'unmatched')).join('');
    unmatchedGroup.classList.remove('hidden');
  } else {
    unmatchedGroup.classList.add('hidden');
  }

  const removedGroup = document.getElementById('menu-sync-removed');
  const removedList  = document.getElementById('menu-sync-removed-list');
  if (removedStrains.length > 0) {
    removedList.innerHTML = removedStrains.map(i => renderSyncItem(i, 'removed')).join('');
    removedGroup.classList.remove('hidden');
  } else {
    removedGroup.classList.add('hidden');
  }

  document.getElementById('menu-sync-result').classList.remove('hidden');
}

function renderReviewQueue() {
  const queue = strainDelta.additions.filter(s => s.needsReview);
  const section = document.getElementById('menu-review-queue');
  const list    = document.getElementById('menu-review-list');

  if (queue.length === 0) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  list.innerHTML = queue.map(s => `
    <div class="admin-strain-row admin-strain-row--review" data-id="${esc(s.id)}" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; padding: 8px; border: 1px solid var(--border-color, #eee); border-radius: 6px;">
      <span class="admin-strain-row__dot" data-type="${esc(s.type)}" style="flex-shrink: 0;"></span>
      <input type="text" class="admin-input review-name" value="${esc(s.name)}" style="flex: 2; min-width: 150px; height: 32px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px;" placeholder="Name" />
      <select class="admin-input review-type" style="flex: 1; min-width: 90px; height: 32px; padding: 4px; border: 1px solid #ddd; border-radius: 4px;">
        <option value="hybrid" ${s.type === 'hybrid' ? 'selected' : ''}>Hybrid</option>
        <option value="sativa" ${s.type === 'sativa' ? 'selected' : ''}>Sativa</option>
        <option value="indica" ${s.type === 'indica' ? 'selected' : ''}>Indica</option>
      </select>
      <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
        <input type="number" step="0.01" class="admin-input review-thc" value="${s.thc || ''}" style="width: 60px; height: 32px; text-align: right; padding: 4px; border: 1px solid #ddd; border-radius: 4px;" placeholder="THC" />
        <span style="font-size: 0.75rem; color: var(--text-muted);">% THC</span>
      </div>
      <div class="admin-strain-row__actions" style="display: flex; gap: 4px; margin-left: auto; flex-shrink: 0;">
        <button class="admin-btn admin-btn--small admin-btn--primary" data-action="review-save" data-id="${esc(s.id)}" style="height: 32px; padding: 0 10px;">✓ Save</button>
        <button class="admin-btn admin-btn--small" data-action="review-edit" data-id="${esc(s.id)}" style="height: 32px; padding: 0 10px;">✏️ Full Edit</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-action="review-edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      startEditingStrain(btn.dataset.id, true);
      // Scroll to the strain form
      document.getElementById('strain-form-section').scrollIntoView({ behavior: 'smooth' });
      // Expand the form section if collapsed
      const body = document.getElementById('strain-form-section').querySelector('.admin-section__body');
      if (body) body.style.display = 'block';
    });
  });

  list.querySelectorAll('[data-action="review-save"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const row = btn.closest('.admin-strain-row');
      const name = row.querySelector('.review-name').value.trim();
      const type = row.querySelector('.review-type').value;
      const thcVal = row.querySelector('.review-thc').value;
      const thc = thcVal ? parseFloat(thcVal) : null;

      if (!name) {
        alert('Name is required.');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Saving...';

      try {
        const idx = strainDelta.additions.findIndex(s => s.id === id);
        if (idx !== -1) {
          strainDelta.additions[idx] = {
            ...strainDelta.additions[idx],
            name,
            type,
            thc,
            needsReview: false, // Clear the review flag
          };

          await authedSaveStrainDelta(strainDelta);
          renderStrainList();
          renderReviewQueue();
        }
      } catch (err) {
        console.error('Error saving inline review:', err);
        alert('Failed to save inline edit. Check console.');
        btn.disabled = false;
        btn.textContent = '✓ Save';
      }
    });
  });
}

// Show a copyable sync error in the panel (instead of an alert you can't select).
function showSyncError(message) {
  const ta = document.getElementById('menu-sync-error-text');
  if (ta) ta.value = message;
  document.getElementById('menu-sync-error')?.classList.remove('hidden');
}

async function initMenuSync() {
  // Load existing menu state
  const existing = await getMenuData(SYNC_DISPENSARY_ID);

  // Copy-to-clipboard for the sync error box
  document.getElementById('btn-copy-sync-error')?.addEventListener('click', () => {
    const ta = document.getElementById('menu-sync-error-text');
    if (!ta) return;
    ta.select();
    if (navigator.clipboard) navigator.clipboard.writeText(ta.value).catch(() => {});
    else { try { document.execCommand('copy'); } catch (_) {} }
    const b = document.getElementById('btn-copy-sync-error');
    if (b) { b.textContent = '✓ Copied'; setTimeout(() => { b.textContent = '📋 Copy'; }, 1500); }
  });
  document.getElementById('menu-sync-last-synced').textContent =
    formatSyncTimestamp(existing.lastSynced);

  renderReviewQueue();

  // Manual import button
  document.getElementById('btn-manual-import').addEventListener('click', async () => {
    const raw = document.getElementById('menu-manual-input').value;
    const lines = raw
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      alert('Paste at least one strain name before processing.');
      return;
    }

    // Normalise: strip weights (1oz, 3.5g, 7g, 14g, 28g) and brand prefixes (word(s) before " - ")
    const WEIGHT_RE = /\b(\d+(\.\d+)?\s*(oz|g|gram|grams|lb))\b/gi;
    const BRAND_PREFIX_RE = /^.+?\s+[-–]\s+/;

    const names = lines.map(l => {
      let n = l.replace(WEIGHT_RE, '').replace(BRAND_PREFIX_RE, '').trim();
      // Also strip trailing size in parens e.g. "(3.5g)"
      n = n.replace(/\s*\(.*?\)\s*/g, '').trim();
      return n;
    }).filter(Boolean);

    const existing = await getMenuData(SYNC_DISPENSARY_ID);
    const matched   = [];
    const unmatched = [];
    const seen      = new Set();

    for (const name of names) {
      const key = normaliseName(name);
      if (seen.has(key)) continue;
      seen.add(key);

      const knownStrain = findKnowledgeMatch(name);
      if (knownStrain) {
        matched.push({ id: knownStrain.id, name: knownStrain.name, type: knownStrain.type, thc: null });
      } else {
        unmatched.push({ name, type: 'hybrid', thc: null, cbd: null });
      }
    }

    showSyncResult({ matched, unmatched }, existing.strainIds || []);
  });

  // Sync Now button
  document.getElementById('btn-sync-menu').addEventListener('click', async () => {
    const btn = document.getElementById('btn-sync-menu');
    btn.textContent = '⏳ Syncing...';
    btn.disabled = true;
    document.getElementById('menu-sync-result').classList.add('hidden');
    document.getElementById('menu-sync-error')?.classList.add('hidden');

    let syncUrl = '';
    try {
      // Use the dispensary's configured menu source (e.g. Cookies' Dovetail
      // site) when set; fall back to the Dutchie slug. Mirrors the weekly refresh.
      const dispMap = await getDispensaryMap();
      const src = dispMap[SYNC_DISPENSARY_ID]?.menuSource;
      syncUrl = src
        ? `/api/sync-menu?source=${encodeURIComponent(JSON.stringify(src))}`
        : `/api/sync-menu?dispensary=${SYNC_DISPENSARY_ID}`;
      const res = await fetch(syncUrl);
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        showSyncError(
          `Sync failed — server returned a NON-JSON response (HTTP ${res.status}).\n` +
          `Most likely /api/sync-menu isn't running as a function: you're on "npm run dev" (Vite doesn't serve /api), or the latest code isn't deployed yet. The API only runs on the deployed Vercel site or via "vercel dev".\n\n` +
          `URL: ${syncUrl}\n\nFirst 1200 chars of the response:\n${text.slice(0, 1200)}`
        );
        return;
      }

      if (!res.ok) {
        showSyncError(`Sync failed (HTTP ${res.status}).\nURL: ${syncUrl}\n\n${data.error || 'Unknown error'}\n${data.hint || ''}`);
        return;
      }

      if (data.warning) {
        console.warn('Sync warning:', data.warning, data.rawCategories);
        showSyncError(`Sync warning (HTTP ${res.status}).\nURL: ${syncUrl}\n\n${data.warning}\nRaw categories found: ${(data.rawCategories || []).join(', ')}`);
      }

      showSyncResult(data, existing.strainIds || []);
    } catch (err) {
      showSyncError(`Sync error: ${(err && err.message) || err}\nURL: ${syncUrl}`);
    } finally {
      btn.textContent = '🔄 Sync Now';
      btn.disabled = false;
    }
  });

  // Discard button
  document.getElementById('btn-sync-cancel').addEventListener('click', () => {
    pendingSyncResult = null;
    document.getElementById('menu-sync-result').classList.add('hidden');
  });

  // Confirm button — write results to Firestore
  document.getElementById('btn-sync-confirm').addEventListener('click', async () => {
    if (!pendingSyncResult) return;

    const confirmBtn = document.getElementById('btn-sync-confirm');
    confirmBtn.textContent = 'Saving...';
    confirmBtn.disabled = true;

    try {
      const { matched, unmatched } = pendingSyncResult;

      // 1. Persist the menu snapshot (matched strain IDs + raw unknowns)
      await saveMenuData(SYNC_DISPENSARY_ID, {
        strainIds: matched.map(m => m.id),
        unknowns:  unmatched,
      });

      // 2. Add unknown strains to delta.additions (skip duplicates)
      const existingIds = new Set([
        ...strainsData.map(s => s.id),
        ...strainDelta.additions.map(s => s.id),
      ]);

      let addedCount = 0;
      for (const u of unmatched) {
        const id = 'add-' + u.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        if (existingIds.has(id)) continue;

        strainDelta.additions.push({
          id,
          name:        u.name,
          type:        u.type || 'hybrid',
          effects:     [],
          flavors:     [],
          description: '',
          genetics:    null,
          rating:      null,
          thc:         u.thc ?? null,
          dispensaries: [SYNC_DISPENSARY_ID],
          needsReview:  true,
          isAddition:   true,
        });
        addedCount++;
      }

      await authedSaveStrainDelta(strainDelta);

      // 3. Update UI
      document.getElementById('menu-sync-last-synced').textContent =
        formatSyncTimestamp(new Date());
      document.getElementById('menu-sync-result').classList.add('hidden');
      pendingSyncResult = null;

      renderStrainList();
      renderReviewQueue();

      alert(`Sync saved.\n✅ ${matched.length} matched\n🌱 ${addedCount} new strains added for review`);
    } catch (err) {
      console.error('Sync confirm failed:', err);
      alert(`Failed to save sync: ${err.message}`);
    } finally {
      confirmBtn.textContent = 'Confirm & Save';
      confirmBtn.disabled = false;
    }
  });
}

// === INFO CONTENT EDITOR ===
const DEFAULT_INFO_TOPICS = [
  { id: 'terpenes',     title: '🌿 Terpenes',     order: 1, content: '' },
  { id: 'effects',      title: '✨ Effects',       order: 2, content: '' },
  { id: 'strain-types', title: '💨 Strain Types',  order: 3, content: '' },
  { id: 'cannabinoids', title: '🧬 Cannabinoids',  order: 4, content: '' },
];

async function initInfoEditor() {
  let topics = await getInfoTopics();

  if (topics.length === 0) {
    await Promise.all(DEFAULT_INFO_TOPICS.map(t => saveInfoTopic(t.id, t)));
    topics = DEFAULT_INFO_TOPICS.map(t => ({ ...t }));
  }

  function renderTopics() {
    const list = document.getElementById('info-topics-list');
    list.innerHTML = topics.map(topic => `
      <div class="info-topic info-topic--collapsed" data-id="${esc(topic.id)}">
        <button type="button" class="info-topic__header">
          <span class="info-topic__title">${esc(topic.title)}</span>
          <span class="info-topic__chevron">▾</span>
        </button>
        <div class="info-topic__body">
          <div class="info-topic__content">
            <div class="admin-form__row" style="margin-bottom:0.75rem;">
              <div class="admin-form__group">
                <label style="font-size:0.78rem;color:var(--text-muted);margin-bottom:0.3rem;display:block;">Icon (emoji)</label>
                <input type="text" class="info-topic__icon-input" value="${esc(topic.icon || '')}" placeholder="e.g. 🌿" style="width:5rem;font-size:1.3rem;text-align:center;" />
              </div>
              <div class="admin-form__group" style="flex:1;">
                <label style="font-size:0.78rem;color:var(--text-muted);margin-bottom:0.3rem;display:block;">Teaser (one-liner shown on card)</label>
                <input type="text" class="info-topic__teaser-input" value="${esc(topic.teaser || '')}" placeholder="e.g. The secret language of plants" />
              </div>
            </div>
            <label style="font-size:0.78rem;color:var(--text-muted);margin-bottom:0.3rem;display:block;">Header Image URL (optional)</label>
            <input type="text" class="info-topic__image-input" value="${esc(topic.image || '')}" placeholder="https://… a hero photo for the post" style="margin-bottom:0.75rem;" />
            <label style="font-size:0.78rem;color:var(--text-muted);margin-bottom:0.3rem;display:block;">Full Content — Markdown supported</label>
            <p class="admin-info-hint" style="margin:0 0 0.4rem;font-size:0.72rem;line-height:1.5;">**bold** · [link text](https://…) · photos with ![caption](image-url) · bullet lists with - · link to strains like [Blue Dream](/strain/blue-dream)</p>
            <textarea placeholder="Write content for ${esc(topic.title)}… (Markdown supported)" rows="8">${esc(topic.content || '')}</textarea>
            <div class="info-topic__actions">
              <button type="button" class="admin-btn admin-btn--ghost admin-btn--small info-topic__delete">🗑 Delete</button>
              <button type="button" class="admin-btn admin-btn--primary info-topic__save">Save</button>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.info-topic__header').forEach(header => {
      header.addEventListener('click', () => {
        header.closest('.info-topic').classList.toggle('info-topic--collapsed');
      });
    });

    list.querySelectorAll('.info-topic__save').forEach(btn => {
      btn.addEventListener('click', async () => {
        const topicEl = btn.closest('.info-topic');
        const id = topicEl.dataset.id;
        const content = topicEl.querySelector('textarea').value.trim();
        const icon    = topicEl.querySelector('.info-topic__icon-input')?.value.trim() || '';
        const teaser  = topicEl.querySelector('.info-topic__teaser-input')?.value.trim() || '';
        const image   = topicEl.querySelector('.info-topic__image-input')?.value.trim() || '';
        const topic = topics.find(t => t.id === id);
        if (!topic) return;

        btn.textContent = 'Saving...';
        btn.disabled = true;
        try {
          await saveInfoTopic(id, { ...topic, content, icon, teaser, image });
          topic.content = content;
          topic.icon    = icon;
          topic.teaser  = teaser;
          topic.image   = image;
          btn.textContent = 'Saved ✓';
          setTimeout(() => { btn.textContent = 'Save'; btn.disabled = false; }, 2000);
        } catch (err) {
          console.error('Save info topic failed:', err);
          alert(`Failed to save: ${err.message}`);
          btn.textContent = 'Save';
          btn.disabled = false;
        }
      });
    });

    list.querySelectorAll('.info-topic__delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const topicEl = btn.closest('.info-topic');
        const id = topicEl.dataset.id;
        const topic = topics.find(t => t.id === id);
        if (!confirm(`Delete "${topic?.title || id}"?`)) return;
        await deleteInfoTopic(id);
        topics = topics.filter(t => t.id !== id);
        renderTopics();
      });
    });
  }

  renderTopics();

  document.getElementById('btn-add-info-topic').addEventListener('click', async () => {
    const input = document.getElementById('new-info-topic-title');
    const title = input.value.trim();
    if (!title) return;

    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (topics.find(t => t.id === id)) {
      alert(`A topic with slug "${id}" already exists.`);
      return;
    }

    const topic = { id, title, order: topics.length + 1, content: '' };
    await saveInfoTopic(id, topic);
    topics = [...topics, topic];
    renderTopics();
    input.value = '';
  });
}

// === PAGES EDITOR ===
async function initPagesEditor() {
  // Load existing content for both pages
  const [aboutData, loreData] = await Promise.all([
    getPageContent('about'),
    getPageContent('lore'),
  ]);

  if (aboutData?.content) {
    document.getElementById('about-content').value = aboutData.content;
  }
  if (loreData?.content) {
    document.getElementById('lore-content').value = loreData.content;
  }

  document.getElementById('btn-save-about').addEventListener('click', async () => {
    const btn = document.getElementById('btn-save-about');
    const content = document.getElementById('about-content').value.trim();
    btn.textContent = 'Saving...';
    btn.disabled = true;
    try {
      await savePageContent('about', content);
      btn.textContent = 'Saved ✓';
      setTimeout(() => { btn.textContent = 'Save About Me'; btn.disabled = false; }, 2000);
    } catch (err) {
      console.error('Failed to save About Me:', err);
      alert(`Failed to save: ${err.message}`);
      btn.textContent = 'Save About Me';
      btn.disabled = false;
    }
  });

  document.getElementById('btn-save-lore').addEventListener('click', async () => {
    const btn = document.getElementById('btn-save-lore');
    const content = document.getElementById('lore-content').value.trim();
    btn.textContent = 'Saving...';
    btn.disabled = true;
    try {
      await savePageContent('lore', content);
      btn.textContent = 'Saved ✓';
      setTimeout(() => { btn.textContent = 'Save Lore'; btn.disabled = false; }, 2000);
    } catch (err) {
      console.error('Failed to save Lore:', err);
      alert(`Failed to save: ${err.message}`);
      btn.textContent = 'Save Lore';
      btn.disabled = false;
    }
  });
}

// === PARTNER STRAINS ===
async function initPartnerStrains() {
  // Phase 1: deprecated — partner strains belong to a campaign now.
  // Early-return if the section is marked deprecated.
  const section = document.getElementById('partner-strains-section');
  if (section?.dataset.deprecated === 'true') return;

  // Populate dispensary select
  const dispSel = document.getElementById('partner-dispensary');
  dispSel.innerHTML = '<option value="">— none —</option>' +
    _dispensaryPairs.map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

  function splitTags(str) {
    return str.split(',').map(s => s.trim()).filter(Boolean);
  }

  function resetForm() {
    document.getElementById('partner-edit-id').value = '';
    document.getElementById('partner-strain-name').value = '';
    document.getElementById('partner-strain-type').value = 'hybrid';
    document.getElementById('partner-brand').value = '';
    document.getElementById('partner-effects').value = '';
    document.getElementById('partner-flavors').value = '';
    document.getElementById('partner-dispensary').value = '';
    document.getElementById('partner-url').value = '';
    document.getElementById('partner-active').checked = true;
    document.getElementById('partner-cancel-btn').style.display = 'none';
    document.getElementById('partner-save-btn').textContent = 'Save Partner';
  }

  function renderPartnerList(partners) {
    const listEl = document.getElementById('partner-strains-list');
    if (!partners.length) { listEl.innerHTML = '<p class="admin-hint">No partner strains yet.</p>'; return; }
    listEl.innerHTML = partners.map((p, i) => {
      const disp = p.dispensaryId ? dispensaryLabel(p.dispensaryId) : '—';
      return `
        <div class="partner-row ${p.active ? '' : 'partner-row--inactive'}">
          <div class="partner-row__info">
            <span class="partner-row__name">${p.strainName || '—'}</span>
            <span class="partner-row__brand">${p.brandName || ''}</span>
            <span class="partner-row__disp">${disp}</span>
          </div>
          <div class="partner-row__actions">
            <button class="admin-btn admin-btn--small ${p.active ? 'admin-btn--active' : ''}" data-action="toggle" data-idx="${i}">${p.active ? '● On' : '○ Off'}</button>
            <button class="admin-btn admin-btn--small" data-action="edit" data-idx="${i}">Edit</button>
            <button class="admin-btn admin-btn--small admin-btn--danger" data-action="delete" data-idx="${i}">✕</button>
          </div>
        </div>`;
    }).join('');

    listEl.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.dataset.idx);
        const action = btn.dataset.action;
        const delta = strainDelta;
        const partners = [...(delta.partnerStrains || [])];

        if (action === 'toggle') {
          partners[idx] = { ...partners[idx], active: !partners[idx].active };
          delta.partnerStrains = partners;
          await authedSaveStrainDelta(delta);
          strainDelta = delta;
          renderPartnerList(partners);
        } else if (action === 'delete') {
          if (!confirm('Remove this partner strain?')) return;
          partners.splice(idx, 1);
          delta.partnerStrains = partners;
          await authedSaveStrainDelta(delta);
          strainDelta = delta;
          renderPartnerList(partners);
        } else if (action === 'edit') {
          const p = partners[idx];
          document.getElementById('partner-edit-id').value = String(idx);
          document.getElementById('partner-strain-name').value = p.strainName || '';
          document.getElementById('partner-strain-type').value = p.strainType || 'hybrid';
          document.getElementById('partner-brand').value = p.brandName || '';
          document.getElementById('partner-effects').value = (p.effects || []).join(', ');
          document.getElementById('partner-flavors').value = (p.flavors || []).join(', ');
          document.getElementById('partner-dispensary').value = p.dispensaryId || '';
          document.getElementById('partner-url').value = p.clickUrl || '';
          document.getElementById('partner-active').checked = !!p.active;
          document.getElementById('partner-cancel-btn').style.display = '';
          document.getElementById('partner-save-btn').textContent = 'Update Partner';
        }
      });
    });
  }

  // Load existing
  renderPartnerList(strainDelta.partnerStrains || []);

  // Save / Update
  document.getElementById('partner-save-btn').addEventListener('click', async () => {
    const strainName   = document.getElementById('partner-strain-name').value.trim();
    const strainType   = document.getElementById('partner-strain-type').value;
    const brandName    = document.getElementById('partner-brand').value.trim();
    const effects      = splitTags(document.getElementById('partner-effects').value);
    const flavors      = splitTags(document.getElementById('partner-flavors').value);
    const dispensaryId = document.getElementById('partner-dispensary').value || null;
    const clickUrl     = document.getElementById('partner-url').value.trim() || null;
    const active       = document.getElementById('partner-active').checked;
    const editIdx      = document.getElementById('partner-edit-id').value;

    if (!strainName) { alert('Please enter a strain name.'); return; }

    const entry = { strainName, strainType, brandName, effects, flavors, dispensaryId, clickUrl, active };
    const delta = strainDelta;
    const partners = [...(delta.partnerStrains || [])];

    if (editIdx !== '') {
      partners[parseInt(editIdx)] = entry;
    } else {
      partners.push(entry);
    }

    delta.partnerStrains = partners;
    const btn = document.getElementById('partner-save-btn');
    btn.textContent = 'Saving…'; btn.disabled = true;
    try {
      await authedSaveStrainDelta(delta);
      strainDelta = delta;
      renderPartnerList(partners);
      resetForm();
      btn.textContent = 'Saved ✓';
      setTimeout(() => { btn.textContent = 'Save Partner'; btn.disabled = false; }, 1500);
    } catch (err) {
      alert(`Failed to save: ${err.message}`);
      btn.textContent = 'Save Partner'; btn.disabled = false;
    }
  });

  document.getElementById('partner-cancel-btn').addEventListener('click', resetForm);
}

// ─────────────────────────────────────────────────────────────────────────
// PHASE 1: Campaign / Advertiser / Dispensary managers
// ─────────────────────────────────────────────────────────────────────────
//
// These three managers replace the prior "edit one Firestore doc at a
// time" mental model with: an Advertiser owns N Campaigns, a Campaign
// owns its inventory (sponsored strains, partner strains, ads). The
// user-facing app reads everything via the sponsorshipService aggregator.
//
// Single rule the operator needs to remember:
//   A campaign is only visible to users while status === 'live' AND
//   now is between startsAt and endsAt. Everything else is a knob.

let _campaignsCache    = [];
let _advertisersCache  = [];
let _editingCampaign   = null; // the campaign object being edited, or null for "new"
let _editingPartners   = [];   // working copy of inventory.partnerStrains during edit
let _liveSponsoredStrainIds = new Set(); // strain IDs currently sponsored by any live campaign — used for the read-only ⭐ badge in Manage Strains

function fmtDate(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : (value.toDate ? value.toDate() : new Date(value));
  if (isNaN(d)) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function toDateInputValue(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : (value.toDate ? value.toDate() : new Date(value));
  if (isNaN(d)) return '';
  return d.toISOString().slice(0, 10);
}

function fmtMoney(cents) {
  if (cents == null || isNaN(cents)) return '$0';
  return `$${(cents / 100).toFixed(0)}`;
}

function fmtNumber(n) {
  if (n == null || isNaN(n)) return '0';
  return Number(n).toLocaleString();
}

function ctr(impressions, clicks) {
  if (!impressions) return '—';
  const pct = (clicks / impressions) * 100;
  return `${pct.toFixed(1)}%`;
}

// ─── Campaign Manager ────────────────────────────────────────────────────

async function initCampaignManager() {
  const newBtn         = document.getElementById('btn-new-campaign');
  const editor         = document.getElementById('campaign-editor');
  const editorClose    = document.getElementById('campaign-editor-close');
  const saveBtn        = document.getElementById('btn-campaign-save');
  const deleteBtn      = document.getElementById('btn-campaign-delete');
  const newAdvLink     = document.getElementById('campaign-new-advertiser-link');
  const addPartnerBtn  = document.getElementById('btn-campaign-add-partner');
  const tierSelect     = document.getElementById('campaign-tier');
  const priceInput     = document.getElementById('campaign-price');

  if (!editor) return; // safety: only init if the section is present

  newBtn?.addEventListener('click', () => openCampaignEditor(null));
  editorClose?.addEventListener('click', closeCampaignEditor);
  saveBtn?.addEventListener('click', saveCampaignFromEditor);
  deleteBtn?.addEventListener('click', deleteCampaignFromEditor);
  newAdvLink?.addEventListener('click', (e) => { e.preventDefault(); openAdvertiserModal(null); });
  addPartnerBtn?.addEventListener('click', () => openPartnerMiniModal(null));

  // When the tier changes, suggest the matching default price.
  tierSelect?.addEventListener('change', () => {
    const def = TIER_DEFAULTS[tierSelect.value];
    if (def && priceInput) priceInput.value = Math.round(def.monthlyPriceCents / 100);
  });

  // Partner mini-modal save/cancel
  document.getElementById('partner-mini-cancel')?.addEventListener('click', () => closeModal('partner-mini-modal'));
  document.getElementById('partner-mini-save')?.addEventListener('click', savePartnerMiniModal);

  await refreshCampaignList();
}

function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}
function openModal(id) {
  document.getElementById(id)?.classList.remove('hidden');
}

async function refreshCampaignList() {
  const loading = document.getElementById('campaigns-loading');
  const empty   = document.getElementById('campaigns-empty');
  const wrap    = document.getElementById('campaigns-by-status');

  loading?.classList.remove('hidden');
  empty?.classList.add('hidden');
  if (wrap) wrap.innerHTML = '';

  try {
    [_campaignsCache, _advertisersCache] = await Promise.all([
      listCampaigns(),
      listAdvertisers(),
    ]);
  } catch (err) {
    console.error('Failed to load campaigns/advertisers:', err);
    _campaignsCache = []; _advertisersCache = [];
  }

  loading?.classList.add('hidden');

  // Snapshot stats
  const now = new Date();
  const live = _campaignsCache.filter(c => isCampaignLive(c, now));

  // Rebuild the read-only "in live campaign" set used by Manage Strains.
  _liveSponsoredStrainIds = new Set();
  for (const c of live) {
    for (const id of (c.inventory?.sponsoredStrainIds || [])) {
      _liveSponsoredStrainIds.add(id);
    }
  }
  // Re-render strain list if it's already on screen so badges update.
  if (document.getElementById('strains-admin-list')?.children.length) {
    renderStrainList();
  }

  // Renewal banner — campaigns ending in the next 7 days.
  renderRenewalBanner(_campaignsCache, _advertisersCache);
  const mrrCents = live.reduce((sum, c) => sum + (c.monthlyPriceCents || 0), 0);
  const totalImpr = _campaignsCache.reduce((s, c) => s + (c.impressions || 0), 0);
  const totalClicks = _campaignsCache.reduce((s, c) => s + (c.clicks || 0), 0);
  document.getElementById('stat-live-count').textContent   = String(live.length);
  document.getElementById('stat-mrr').textContent          = fmtMoney(mrrCents);
  document.getElementById('stat-impressions').textContent  = fmtNumber(totalImpr);
  document.getElementById('stat-clicks').textContent       = fmtNumber(totalClicks);

  if (_campaignsCache.length === 0) {
    empty?.classList.remove('hidden');
    return;
  }

  // Group by status (live, scheduled, paused, draft, ended)
  const groups = {
    live:      { title: 'Live',      list: [] },
    scheduled: { title: 'Scheduled', list: [] },
    paused:    { title: 'Paused',    list: [] },
    draft:     { title: 'Draft',     list: [] },
    ended:     { title: 'Ended',     list: [] },
  };
  for (const c of _campaignsCache) {
    const key = groups[c.status] ? c.status : 'draft';
    groups[key].list.push(c);
  }

  const advertiserNameById = Object.fromEntries(_advertisersCache.map(a => [a.id, a.name]));

  const html = Object.entries(groups)
    .filter(([, g]) => g.list.length > 0)
    .map(([key, g]) => `
      <div class="campaign-status-group">
        <div class="campaign-status-group__title">${g.title} · ${g.list.length}</div>
        ${g.list.map(c => renderCampaignCard(c, advertiserNameById)).join('')}
      </div>
    `).join('');

  if (wrap) wrap.innerHTML = html;

  // Wire actions
  wrap?.querySelectorAll('[data-campaign-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.campaignId;
      const action = btn.dataset.campaignAction;
      const c = _campaignsCache.find(x => x.id === id);
      if (!c) return;
      if (action === 'edit')    return openCampaignEditor(c);
      if (action === 'pause')   return quickStatusChange(c, CAMPAIGN_STATUS.PAUSED);
      if (action === 'resume')  return quickStatusChange(c, CAMPAIGN_STATUS.LIVE);
      if (action === 'end')     return quickStatusChange(c, CAMPAIGN_STATUS.ENDED);
      if (action === 'preview') return copyPreviewLink(c, btn);
      if (action === 'report')  return openCampaignReport(c);
      if (action === 'clone')   return cloneCampaign(c);
    });
  });
}

/**
 * Render the renewal alert banner. Lists every campaign whose endsAt
 * is within the next 7 days, with a one-click "Clone for next month"
 * action. Hidden entirely if nothing is expiring soon.
 *
 * Why this exists: a paying advertiser who lapses unnoticed is harder
 * to win back than a current advertiser whose campaign was renewed on
 * time. This is the single biggest churn defense at our scale.
 */
function renderRenewalBanner(campaigns, advertisers) {
  const banner = document.getElementById('renewal-banner');
  if (!banner) return;

  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 7);

  const expiring = campaigns.filter(c => {
    if (c.status !== CAMPAIGN_STATUS.LIVE) return false;
    if (!c.endsAt) return false;
    const ends = c.endsAt.toDate ? c.endsAt.toDate() : new Date(c.endsAt);
    return ends >= now && ends <= horizon;
  }).sort((a, b) => {
    const ad = a.endsAt.toDate ? a.endsAt.toDate() : new Date(a.endsAt);
    const bd = b.endsAt.toDate ? b.endsAt.toDate() : new Date(b.endsAt);
    return ad - bd;
  });

  if (expiring.length === 0) {
    banner.classList.add('hidden');
    banner.innerHTML = '';
    return;
  }

  const advertiserName = id => advertisers.find(a => a.id === id)?.name || '— unknown —';

  banner.innerHTML = `
    <div class="renewal-banner__head">
      <span class="renewal-banner__icon">⏰</span>
      <div class="renewal-banner__head-text">
        <strong>${expiring.length} campaign${expiring.length > 1 ? 's' : ''} ending in the next 7 days.</strong>
        <span class="renewal-banner__sub">Clone for next month before they expire to avoid lapses.</span>
      </div>
    </div>
    <ul class="renewal-banner__list">
      ${expiring.map(c => {
        const ends = c.endsAt.toDate ? c.endsAt.toDate() : new Date(c.endsAt);
        const daysLeft = Math.max(0, Math.ceil((ends - now) / (1000 * 60 * 60 * 24)));
        return `
          <li class="renewal-banner__row" data-campaign-id="${esc(c.id)}">
            <div class="renewal-banner__row-main">
              <span class="renewal-banner__name">${esc(c.name || 'Untitled')}</span>
              <span class="renewal-banner__meta">${esc(advertiserName(c.advertiserId))} · ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'} · ${fmtMoney(c.monthlyPriceCents)}/mo</span>
            </div>
            <button class="admin-btn admin-btn--small admin-btn--primary" data-renewal-action="clone" data-campaign-id="${esc(c.id)}">⎘ Clone for next month</button>
          </li>`;
      }).join('')}
    </ul>
  `;
  banner.classList.remove('hidden');

  banner.querySelectorAll('[data-renewal-action="clone"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = expiring.find(x => x.id === btn.dataset.campaignId);
      if (c) cloneCampaign(c);
    });
  });
}

/**
 * Copy the public preview URL for a campaign to the clipboard. The
 * button gives a brief "Copied ✓" flash so the operator knows the
 * action succeeded — clipboard writes are otherwise invisible.
 */
async function copyPreviewLink(campaign, btn) {
  const url = `${window.location.origin}/preview.html?c=${encodeURIComponent(campaign.id)}`;
  try {
    await navigator.clipboard.writeText(url);
    const orig = btn.textContent;
    btn.textContent = '✓ Copied';
    setTimeout(() => { btn.textContent = orig; }, 1800);
  } catch {
    // Fallback for clipboard API failures: prompt the user
    prompt('Copy this preview link:', url);
  }
}

/**
 * Clone a campaign. Opens the editor pre-filled with the same
 * advertiser, inventory, and tier. Dates default to "today" and
 * "today + one month" so the operator can confirm and save.
 *
 * Most renewals are the same campaign with new dates — this drops
 * month-2 setup time from a few minutes to under a minute.
 */
function cloneCampaign(source) {
  const now = new Date();
  const monthLater = new Date(now);
  monthLater.setMonth(monthLater.getMonth() + 1);

  const clone = {
    // No id — this signals the editor to "create new" on save.
    advertiserId: source.advertiserId,
    name:         (source.name || 'Untitled') + ' — renewal',
    tier:         source.tier,
    monthlyPriceCents: source.monthlyPriceCents,
    status:       CAMPAIGN_STATUS.DRAFT, // safe default; operator promotes to live
    startsAt:     now,
    endsAt:       monthLater,
    inventory: {
      sponsoredStrainIds: [...(source.inventory?.sponsoredStrainIds || [])],
      partnerStrains:     JSON.parse(JSON.stringify(source.inventory?.partnerStrains || [])),
      adIds:              [], // ads stay with the original; the operator reassigns explicitly
    },
    // Counters intentionally start at 0 — the clone is a new campaign.
    impressions: 0,
    clicks: 0,
  };
  openCampaignEditor(clone);
}

function renderCampaignCard(c, advertiserNameById) {
  const advName = advertiserNameById[c.advertiserId] || '— unknown —';
  const tier    = c.tier || 'custom';
  const dateRange = `${fmtDate(c.startsAt)} → ${c.endsAt ? fmtDate(c.endsAt) : 'open'}`;
  const impressions = c.impressions || 0;
  const clicks      = c.clicks || 0;

  let actionButtons = '';
  if (c.status === CAMPAIGN_STATUS.LIVE)   actionButtons = `<button class="admin-btn admin-btn--small" data-campaign-action="pause"  data-campaign-id="${c.id}">Pause</button>`;
  if (c.status === CAMPAIGN_STATUS.PAUSED) actionButtons = `<button class="admin-btn admin-btn--small" data-campaign-action="resume" data-campaign-id="${c.id}">Resume</button>`;

  return `
    <div class="campaign-card campaign-card--${c.status || 'draft'}">
      <div class="campaign-card__main">
        <div class="campaign-card__title-row">
          <span class="campaign-card__name">${esc(c.name || 'Untitled')}</span>
          <span class="campaign-card__tier campaign-card__tier--${tier}">${tier}</span>
        </div>
        <div class="campaign-card__meta">
          ${esc(advName)} · ${dateRange} · ${fmtMoney(c.monthlyPriceCents)}/mo
        </div>
      </div>
      <div class="campaign-card__stats">
        <div class="campaign-card__stat"><strong>${fmtNumber(impressions)}</strong>impressions</div>
        <div class="campaign-card__stat"><strong>${fmtNumber(clicks)}</strong>clicks</div>
        <div class="campaign-card__stat"><strong>${ctr(impressions, clicks)}</strong>CTR</div>
      </div>
      <div class="campaign-card__actions">
        ${actionButtons}
        <button class="admin-btn admin-btn--small" data-campaign-action="preview" data-campaign-id="${c.id}" title="Copy a shareable preview link to your clipboard">📋 Preview link</button>
        <button class="admin-btn admin-btn--small" data-campaign-action="report" data-campaign-id="${c.id}" title="Open a printable partner report">📊 Report</button>
        <button class="admin-btn admin-btn--small" data-campaign-action="clone" data-campaign-id="${c.id}" title="Clone this campaign for next month">⎘ Clone</button>
        <button class="admin-btn admin-btn--small admin-btn--primary" data-campaign-action="edit" data-campaign-id="${c.id}">Manage</button>
      </div>
    </div>
  `;
}

// Opens a clean, printable 1-page partner report for a campaign in a new tab.
// Uses only data already on the campaign (impressions/clicks tracked live), so
// the numbers are real. "Taps" are placement-level click events; sponsored
// placements never alter a user's honest match.
function openCampaignReport(campaign) {
  if (!campaign) return;
  const advertiser = _advertisersCache.find(a => a.id === campaign.advertiserId);
  const advertiserName = advertiser?.name || 'Advertiser';
  const dispName = campaign.dispensaryId
    ? (_dispensaryPairs.find(([k]) => k === campaign.dispensaryId)?.[1] || campaign.dispensaryId)
    : null;
  const impressions = campaign.impressions || 0;
  const clicks = campaign.clicks || 0;
  const tapRate = impressions > 0 ? `${((clicks / impressions) * 100).toFixed(1)}%` : '—';
  const period = `${fmtDate(campaign.startsAt) || '—'} → ${fmtDate(campaign.endsAt) || 'ongoing'}`;
  const plan = campaign.monthlyPriceCents
    ? `$${Math.round(campaign.monthlyPriceCents / 100)}/mo`
    : 'Founding (free)';

  const allStrains = [...strainsData, ...((strainDelta && strainDelta.additions) || [])];
  const strainName = (id) => allStrains.find(s => s.id === id)?.name || id;
  const sponsored = campaign.inventory?.sponsoredStrainIds || [];
  const partners = campaign.inventory?.partnerStrains || [];
  const sponsoredRows = sponsored.length
    ? sponsored.map(id => `<li>${esc(strainName(id))}</li>`).join('')
    : '<li class="muted">None</li>';
  const partnerRows = partners.length
    ? partners.map(p => `<li>${esc(p.strainName || 'Partner strain')}${p.brandName ? ' — ' + esc(p.brandName) : ''}</li>`).join('')
    : '<li class="muted">None</li>';

  const html = `<!doctype html><html><head><meta charset="utf-8">
  <title>CannaPickForMe — ${esc(advertiserName)} report</title>
  <style>
    body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#16241c;max-width:720px;margin:40px auto;padding:0 24px;}
    h1{font-size:22px;margin:0 0 2px;} .sub{color:#5b6b62;margin:0 0 20px;}
    .row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px dashed #e6efe9;}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:22px 0;}
    .stat{border:1px solid #d9e6df;border-radius:10px;padding:14px;text-align:center;}
    .stat .v{font-size:26px;font-weight:700;color:#2f8f4e;}
    .stat .l{font-size:11px;color:#5b6b62;text-transform:uppercase;letter-spacing:.05em;margin-top:2px;}
    h2{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#5b6b62;border-bottom:1px solid #e6efe9;padding-bottom:6px;margin-top:26px;}
    ul{margin:8px 0;padding-left:18px;} .muted{color:#9aa8a0;list-style:none;margin-left:-18px;}
    .foot{margin-top:30px;font-size:11px;color:#9aa8a0;border-top:1px solid #e6efe9;padding-top:12px;}
    button{background:#2f8f4e;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-weight:600;cursor:pointer;}
    @media print{.noprint{display:none;}body{margin:0;}}
  </style></head><body>
    <div class="noprint" style="text-align:right;margin-bottom:16px;"><button onclick="window.print()">Print / Save PDF</button></div>
    <h1>${esc(advertiserName)}</h1>
    <p class="sub">CannaPickForMe partner report · ${esc(campaign.name || '')}</p>
    <div class="row"><span>Reporting period</span><strong>${esc(period)}</strong></div>
    <div class="row"><span>Status</span><strong>${esc(campaign.status || '')}</strong></div>
    <div class="row"><span>Plan</span><strong>${esc(plan)}</strong></div>
    ${dispName ? `<div class="row"><span>"Buy" links to</span><strong>📍 ${esc(dispName)}</strong></div>` : ''}
    <div class="grid">
      <div class="stat"><div class="v">${fmtNumber(impressions)}</div><div class="l">Impressions</div></div>
      <div class="stat"><div class="v">${fmtNumber(clicks)}</div><div class="l">Taps</div></div>
      <div class="stat"><div class="v">${tapRate}</div><div class="l">Tap rate</div></div>
    </div>
    <h2>Sponsored strains</h2><ul>${sponsoredRows}</ul>
    <h2>Partner strains</h2><ul>${partnerRows}</ul>
    <p class="foot">Figures are placement-level events recorded by CannaPickForMe, generated ${new Date().toLocaleDateString()}. Sponsored placements are clearly labeled in-app and never alter a user's honest strain match.</p>
  </body></html>`;

  const w = window.open('', '_blank');
  if (!w) { alert('Please allow pop-ups to open the report.'); return; }
  w.document.write(html);
  w.document.close();
}

async function quickStatusChange(campaign, nextStatus) {
  try {
    await updateCampaign(campaign.id, { status: nextStatus });
    invalidateSponsorshipCache();
    await refreshCampaignList();
  } catch (err) {
    alert(`Status change failed: ${err.message}`);
  }
}

async function openCampaignEditor(campaign) {
  _editingCampaign = campaign;
  _editingPartners = campaign ? [...(campaign.inventory?.partnerStrains || [])] : [];

  document.getElementById('campaign-editor-title').textContent = campaign ? 'Edit Campaign' : 'New Campaign';
  document.getElementById('campaign-edit-id').value = campaign?.id || '';
  document.getElementById('campaign-name').value  = campaign?.name || '';
  document.getElementById('campaign-tier').value  = campaign?.tier || CAMPAIGN_TIER.BRONZE;
  document.getElementById('campaign-price').value =
    campaign?.monthlyPriceCents != null ? Math.round(campaign.monthlyPriceCents / 100)
                                        : Math.round((TIER_DEFAULTS[CAMPAIGN_TIER.BRONZE].monthlyPriceCents) / 100);
  document.getElementById('campaign-starts').value = toDateInputValue(campaign?.startsAt);
  document.getElementById('campaign-ends').value   = toDateInputValue(campaign?.endsAt);
  document.getElementById('campaign-status').value = campaign?.status || CAMPAIGN_STATUS.DRAFT;

  // Populate advertiser dropdown
  const advSel = document.getElementById('campaign-advertiser');
  advSel.innerHTML = '<option value="">— select —</option>' +
    _advertisersCache.map(a => `<option value="${a.id}" ${campaign?.advertiserId === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('');

  // Populate the sponsoring-dispensary dropdown (where Sponsored "Buy" links go).
  const campDisp = document.getElementById('campaign-dispensary');
  if (campDisp) {
    campDisp.innerHTML = '<option value="">— strain\'s in-stock dispensary —</option>' +
      _dispensaryPairs.map(([k, v]) => `<option value="${esc(k)}" ${campaign?.dispensaryId === k ? 'selected' : ''}>${esc(v)}</option>`).join('');
  }

  // Populate partner-mini dispensary dropdown
  const pmDisp = document.getElementById('partner-mini-dispensary');
  if (pmDisp) {
    pmDisp.innerHTML = '<option value="">— none —</option>' +
      _dispensaryPairs.map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('');
  }

  renderSponsoredPicker(campaign?.inventory?.sponsoredStrainIds || []);
  renderPartnerListInEditor();
  await renderAdsInEditor(campaign);
  renderPerfPanel(campaign);

  // Show Delete only when editing an existing campaign — not for
  // brand-new ones or clones (clones have no id until saved).
  document.getElementById('btn-campaign-delete').classList.toggle('hidden', !campaign?.id);
  document.getElementById('campaign-editor').classList.remove('hidden');
  document.getElementById('campaign-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeCampaignEditor() {
  _editingCampaign = null;
  _editingPartners = [];
  document.getElementById('campaign-editor').classList.add('hidden');
}

function renderSponsoredPicker(selectedIds) {
  const picker = document.getElementById('campaign-sponsored-picker');
  if (!picker) return;

  // Combine base strains + admin-added strains. We're tolerant of the
  // strainDelta cache not being loaded yet — the rendered picker just
  // shows base strains in that case.
  const all = [
    ...strainsData,
    ...(strainDelta.additions || []),
  ].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const selected = new Set(selectedIds);
  picker.innerHTML = all.map(s => {
    const isSel = selected.has(s.id);
    return `
      <label class="campaign-picker__item ${isSel ? 'campaign-picker__item--selected' : ''}" data-strain-id="${esc(s.id)}">
        <input type="checkbox" ${isSel ? 'checked' : ''} />
        <span>${esc(s.name)}</span>
      </label>`;
  }).join('');

  picker.querySelectorAll('.campaign-picker__item').forEach(item => {
    item.addEventListener('change', () => {
      const cb = item.querySelector('input');
      item.classList.toggle('campaign-picker__item--selected', cb.checked);
    });
  });
}

function getSelectedSponsoredIds() {
  return [...document.querySelectorAll('#campaign-sponsored-picker .campaign-picker__item')]
    .filter(el => el.querySelector('input').checked)
    .map(el => el.dataset.strainId);
}

function renderPartnerListInEditor() {
  const list = document.getElementById('campaign-partners-list');
  if (!list) return;

  if (_editingPartners.length === 0) {
    list.innerHTML = '<p class="admin-hint" style="padding:0.5rem 0;">No partners yet. Click "+ Add partner" above.</p>';
    return;
  }

  list.innerHTML = _editingPartners.map((p, i) => `
    <div class="campaign-partner-row">
      <div class="campaign-partner-row__main">
        <span class="campaign-partner-row__name">${esc(p.strainName || '—')} <small style="color:var(--text-muted);">${esc(p.brandName || '')}</small></span>
        <span class="campaign-partner-row__meta">${esc(p.strainType || 'hybrid')} · ${p.dispensaryId ? esc(dispensaryLabel(p.dispensaryId)) : 'no dispensary'} · ${p.clickUrl ? 'linked' : 'no link'}</span>
      </div>
      <div class="campaign-partner-row__actions">
        <button class="admin-btn admin-btn--small" data-partner-idx="${i}" data-partner-action="edit">Edit</button>
        <button class="admin-btn admin-btn--small admin-btn--danger" data-partner-idx="${i}" data-partner-action="delete">✕</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-partner-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.partnerIdx, 10);
      const action = btn.dataset.partnerAction;
      if (action === 'delete') {
        if (!confirm('Remove this partner from the campaign?')) return;
        _editingPartners.splice(idx, 1);
        renderPartnerListInEditor();
      } else if (action === 'edit') {
        openPartnerMiniModal(idx);
      }
    });
  });
}

function openPartnerMiniModal(idx) {
  document.getElementById('partner-mini-index').value = idx == null ? '' : String(idx);
  document.getElementById('partner-mini-title').textContent = idx == null ? 'Add Partner Strain' : 'Edit Partner Strain';

  const p = idx == null ? {} : _editingPartners[idx] || {};
  document.getElementById('partner-mini-name').value     = p.strainName || '';
  document.getElementById('partner-mini-type').value     = p.strainType || 'hybrid';
  document.getElementById('partner-mini-brand').value    = p.brandName || '';
  document.getElementById('partner-mini-effects').value  = (p.effects || []).join(', ');
  document.getElementById('partner-mini-flavors').value  = (p.flavors || []).join(', ');
  document.getElementById('partner-mini-dispensary').value = p.dispensaryId || '';
  document.getElementById('partner-mini-url').value      = p.clickUrl || '';
  document.getElementById('partner-mini-active').checked = p.active !== false;

  openModal('partner-mini-modal');
}

function savePartnerMiniModal() {
  const idxRaw = document.getElementById('partner-mini-index').value;
  const idx    = idxRaw === '' ? null : parseInt(idxRaw, 10);

  const entry = {
    strainName:   document.getElementById('partner-mini-name').value.trim(),
    strainType:   document.getElementById('partner-mini-type').value,
    brandName:    document.getElementById('partner-mini-brand').value.trim(),
    effects:      document.getElementById('partner-mini-effects').value.split(',').map(s => s.trim()).filter(Boolean),
    flavors:      document.getElementById('partner-mini-flavors').value.split(',').map(s => s.trim()).filter(Boolean),
    dispensaryId: document.getElementById('partner-mini-dispensary').value || null,
    clickUrl:     document.getElementById('partner-mini-url').value.trim() || null,
    active:       document.getElementById('partner-mini-active').checked,
  };

  if (!entry.strainName) { alert('Strain name is required.'); return; }

  if (idx == null) {
    _editingPartners.push(entry);
  } else {
    _editingPartners[idx] = entry;
  }

  renderPartnerListInEditor();
  closeModal('partner-mini-modal');
}

async function renderAdsInEditor(campaign) {
  const wrap = document.getElementById('campaign-ads-list');
  if (!wrap) return;

  // Show ads currently assigned to this campaign. Editing the campaignId
  // on each ad happens in the existing Add/Edit Ad form below.
  const ads = await getAllAds();
  const assigned = campaign ? ads.filter(a => a.campaignId === campaign.id) : [];

  if (assigned.length === 0) {
    wrap.innerHTML = `<p class="admin-hint" style="padding:0.5rem 0;">
      No ads assigned to this campaign yet. Create an ad in "Add New Ad" below and set its Campaign to this one.
    </p>`;
    return;
  }

  wrap.innerHTML = assigned.map(ad => `
    <div class="campaign-ad-row">
      <img src="${ad.imageUrl}" class="campaign-ad-row__thumb" alt="" />
      <div class="campaign-ad-row__title">${esc(ad.title || '(untitled)')}</div>
      <span class="campaign-ad-row__meta">${esc(ad.placement)} · ${esc(ad.displayType || 'card')} · ${fmtNumber(ad.impressions || 0)} impressions</span>
    </div>
  `).join('');
}

function renderPerfPanel(campaign) {
  const wrap = document.getElementById('campaign-editor-perf');
  if (!wrap) return;
  if (!campaign) { wrap.innerHTML = ''; return; }

  const impressions = campaign.impressions || 0;
  const clicks      = campaign.clicks || 0;
  wrap.innerHTML = `
    <div><div class="perf-stat__label">Impressions</div><div class="perf-stat__value">${fmtNumber(impressions)}</div></div>
    <div><div class="perf-stat__label">Clicks</div><div class="perf-stat__value">${fmtNumber(clicks)}</div></div>
    <div><div class="perf-stat__label">CTR</div><div class="perf-stat__value">${ctr(impressions, clicks)}</div></div>
    <div><div class="perf-stat__label">Last activity</div><div class="perf-stat__value" style="font-size:0.95rem;">${fmtDate(campaign.lastImpressionAt) || '—'}</div></div>
  `;
}

async function saveCampaignFromEditor() {
  const id = document.getElementById('campaign-edit-id').value || null;
  const advertiserId = document.getElementById('campaign-advertiser').value;
  const name = document.getElementById('campaign-name').value.trim();
  const tier = document.getElementById('campaign-tier').value;
  const priceRaw = document.getElementById('campaign-price').value;
  const monthlyPriceCents = priceRaw ? Math.round(parseFloat(priceRaw) * 100) : 0;
  const startsAtStr = document.getElementById('campaign-starts').value;
  const endsAtStr   = document.getElementById('campaign-ends').value;
  const status = document.getElementById('campaign-status').value;
  const dispensaryId = document.getElementById('campaign-dispensary')?.value || null;
  const sponsoredStrainIds = getSelectedSponsoredIds();

  if (!advertiserId) { alert('Please pick an advertiser.'); return; }
  if (!name)         { alert('Campaign needs a name.');    return; }

  const btn = document.getElementById('btn-campaign-save');
  btn.textContent = 'Saving…';
  btn.disabled = true;

  try {
    const payload = {
      advertiserId,
      name,
      tier,
      monthlyPriceCents,
      status,
      dispensaryId,
      startsAt: startsAtStr ? new Date(startsAtStr) : null,
      endsAt:   endsAtStr   ? new Date(endsAtStr)   : null,
      inventory: {
        sponsoredStrainIds,
        partnerStrains: _editingPartners,
        // adIds isn't edited here; ads carry their own campaignId and
        // are listed read-only above. We don't mirror them to keep one
        // source of truth (the ad doc).
      },
    };

    if (id) {
      await updateCampaign(id, payload);
    } else {
      await createCampaign(payload);
    }
    invalidateSponsorshipCache();
    closeCampaignEditor();
    await refreshCampaignList();
    await refreshAdCampaignDropdown();
    btn.textContent = 'Saved ✓';
    setTimeout(() => { btn.textContent = 'Save Campaign'; btn.disabled = false; }, 1500);
  } catch (err) {
    console.error(err);
    alert(`Save failed: ${err.message}`);
    btn.textContent = 'Save Campaign';
    btn.disabled = false;
  }
}

async function deleteCampaignFromEditor() {
  const id = document.getElementById('campaign-edit-id').value;
  if (!id) return;
  if (!confirm('Permanently delete this campaign? Ads assigned to it will become unassigned (won\'t serve).')) return;
  try {
    await deleteCampaign(id);
    invalidateSponsorshipCache();
    closeCampaignEditor();
    await refreshCampaignList();
    await refreshAdCampaignDropdown();
  } catch (err) {
    alert(`Delete failed: ${err.message}`);
  }
}

// ─── Advertiser Manager ──────────────────────────────────────────────────

function initAdvertiserManager() {
  document.getElementById('btn-new-advertiser')?.addEventListener('click', () => openAdvertiserModal(null));
  document.getElementById('advertiser-modal-cancel')?.addEventListener('click', () => closeModal('advertiser-modal'));
  document.getElementById('advertiser-modal-save')?.addEventListener('click', saveAdvertiserFromModal);
  refreshAdvertiserList();
}

function openAdvertiserModal(advertiser) {
  document.getElementById('advertiser-modal-title').textContent = advertiser ? 'Edit Advertiser' : 'New Advertiser';
  document.getElementById('advertiser-edit-id').value = advertiser?.id || '';
  document.getElementById('advertiser-name').value    = advertiser?.name || '';
  document.getElementById('advertiser-contact').value = advertiser?.contactName || '';
  document.getElementById('advertiser-email').value   = advertiser?.contactEmail || '';
  document.getElementById('advertiser-phone').value   = advertiser?.phone || '';
  document.getElementById('advertiser-notes').value   = advertiser?.notes || '';

  const dispSel = document.getElementById('advertiser-dispensary');
  dispSel.innerHTML = '<option value="">— none —</option>' +
    _dispensaryPairs.map(([k, v]) => `<option value="${esc(k)}" ${advertiser?.dispensaryId === k ? 'selected' : ''}>${esc(v)}</option>`).join('');

  openModal('advertiser-modal');
}

async function saveAdvertiserFromModal() {
  const id = document.getElementById('advertiser-edit-id').value || null;
  const payload = {
    name:         document.getElementById('advertiser-name').value.trim(),
    contactName:  document.getElementById('advertiser-contact').value.trim(),
    contactEmail: document.getElementById('advertiser-email').value.trim(),
    phone:        document.getElementById('advertiser-phone').value.trim(),
    dispensaryId: document.getElementById('advertiser-dispensary').value || null,
    notes:        document.getElementById('advertiser-notes').value.trim(),
  };
  if (!payload.name) { alert('Business name required.'); return; }

  try {
    if (id) await updateAdvertiser(id, payload);
    else    await createAdvertiser(payload);
    closeModal('advertiser-modal');
    await refreshAdvertiserList();
    await refreshCampaignList(); // advertiser names show up there
  } catch (err) {
    alert(`Save failed: ${err.message}`);
  }
}

async function refreshAdvertiserList() {
  const wrap = document.getElementById('advertisers-list');
  if (!wrap) return;

  const [advertisers, campaigns] = await Promise.all([
    listAdvertisers(),
    listCampaigns(),
  ]);
  _advertisersCache = advertisers;

  if (advertisers.length === 0) {
    wrap.innerHTML = '<p class="admin-hint">No advertisers yet. Create one to start a campaign.</p>';
    return;
  }

  const countByAdvId = campaigns.reduce((acc, c) => {
    acc[c.advertiserId] = (acc[c.advertiserId] || 0) + 1;
    return acc;
  }, {});

  wrap.innerHTML = advertisers.map(a => {
    const liveCount = campaigns.filter(c => c.advertiserId === a.id && isCampaignLive(c)).length;
    return `
      <div class="advertiser-row" data-id="${esc(a.id)}">
        <div class="advertiser-row__main">
          <span class="advertiser-row__name">${esc(a.name)}</span>
          <span class="advertiser-row__meta">${esc(a.contactName || '—')}${a.contactEmail ? ' · ' + esc(a.contactEmail) : ''}</span>
          <span class="advertiser-row__campaigns">${countByAdvId[a.id] || 0} campaigns · ${liveCount} live</span>
        </div>
        <div class="advertiser-row__actions">
          <button class="admin-btn admin-btn--small" data-action="edit" data-id="${esc(a.id)}">Edit</button>
          <button class="admin-btn admin-btn--small admin-btn--danger" data-action="delete" data-id="${esc(a.id)}">✕</button>
        </div>
      </div>`;
  }).join('');

  wrap.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === 'edit') {
        const adv = await getAdvertiser(id);
        if (adv) openAdvertiserModal(adv);
      } else if (action === 'delete') {
        if (!confirm('Delete this advertiser? Their campaigns will remain but will reference a missing advertiser.')) return;
        try { await deleteAdvertiser(id); await refreshAdvertiserList(); await refreshCampaignList(); }
        catch (err) { alert(`Delete failed: ${err.message}`); }
      }
    });
  });
}

// ─── Dispensary Manager ──────────────────────────────────────────────────

function initDispensaryManager() {
  document.getElementById('btn-save-dispensary')?.addEventListener('click', saveDispensaryFromForm);
  refreshDispensaryList();
}

async function saveDispensaryFromForm() {
  const slug = document.getElementById('dispensary-slug').value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const name = document.getElementById('dispensary-name').value.trim();
  const city = document.getElementById('dispensary-city').value.trim();
  const menuUrl = document.getElementById('dispensary-menu-url').value.trim();
  const dutchieSlug = document.getElementById('dispensary-dutchie-slug').value.trim().toLowerCase();
  const menuSourceRaw = document.getElementById('dispensary-menu-source').value.trim();
  let menuSource = null;
  if (menuSourceRaw) {
    try { menuSource = JSON.parse(menuSourceRaw); }
    catch { alert('Menu source must be valid JSON (or left blank).'); return; }
  }
  if (!slug || !name) { alert('Slug and name are required.'); return; }

  try {
    await saveDispensary(slug, { name, city, active: true, menuUrl, dutchieSlug, menuSource });
    document.getElementById('dispensary-slug').value = '';
    document.getElementById('dispensary-name').value = '';
    document.getElementById('dispensary-city').value = '';
    document.getElementById('dispensary-menu-url').value = '';
    document.getElementById('dispensary-dutchie-slug').value = '';
    document.getElementById('dispensary-menu-source').value = '';
    invalidateDispensaryCache();
    const map = await getDispensaryMap();
    _dispensaryPairs = Object.entries(map).map(([slug, data]) => [slug, data.name || slug]);
    _dispensaryPairs.sort((a, b) => a[1].localeCompare(b[1]));
    await refreshDispensaryList();
    // Also refresh forms that show dispensary dropdowns
    renderDispensaryCheckboxes(getSelectedDispensaries());
  } catch (err) {
    alert(`Save failed: ${err.message}`);
  }
}

async function refreshDispensaryList() {
  const wrap = document.getElementById('dispensaries-list');
  if (!wrap) return;
  const list = await listDispensaries();

  if (list.length === 0) {
    wrap.innerHTML = '<p class="admin-hint">No dispensaries yet.</p>';
    return;
  }

  wrap.innerHTML = list.map(d => `
    <div class="dispensary-row">
      <div>
        <div class="dispensary-row__name">${esc(d.name)}</div>
        <div class="dispensary-row__slug">${esc(d.id)}${d.city ? ' · ' + esc(d.city) : ''}${d.menuUrl ? ' · 🔗 menu' : ' · no menu'}${d.dutchieSlug ? ' · ↻ auto' : ''}</div>
      </div>
      <button class="admin-btn admin-btn--small" data-disp-action="edit" data-disp-id="${esc(d.id)}">Edit</button>
      <button class="admin-btn admin-btn--small admin-btn--danger" data-disp-action="delete" data-disp-id="${esc(d.id)}">✕</button>
    </div>`).join('');

  wrap.querySelectorAll('[data-disp-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.dispId;
      const action = btn.dataset.dispAction;
      if (action === 'edit') {
        const map = await getDispensaryMap();
        const d = map[id] || {};
        document.getElementById('dispensary-slug').value = id;
        document.getElementById('dispensary-name').value = d.name || '';
        document.getElementById('dispensary-city').value = d.city || '';
        document.getElementById('dispensary-menu-url').value = d.menuUrl || '';
        document.getElementById('dispensary-dutchie-slug').value = d.dutchieSlug || '';
        document.getElementById('dispensary-menu-source').value = d.menuSource ? JSON.stringify(d.menuSource, null, 2) : '';
        document.getElementById('dispensary-name').focus();
        document.getElementById('dispensary-slug').scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (action === 'delete') {
        if (!confirm(`Delete "${id}"? Existing references will fall back to the raw slug.`)) return;
        await deleteDispensary(id);
        invalidateDispensaryCache();
        const map = await getDispensaryMap();
        _dispensaryPairs = Object.entries(map).map(([slug, data]) => [slug, data.name || slug]);
        _dispensaryPairs.sort((a, b) => a[1].localeCompare(b[1]));
        await refreshDispensaryList();
      }
    });
  });
}

// ─── Ad form: keep the Campaign dropdown populated ───────────────────────

async function refreshAdCampaignDropdown() {
  const sel = document.getElementById('ad-campaign');
  if (!sel) return;
  const current = sel.value;
  const campaigns = await listCampaigns();
  sel.innerHTML = '<option value="">— unassigned (won\'t serve) —</option>' +
    campaigns.map(c => `<option value="${esc(c.id)}" ${current === c.id ? 'selected' : ''}>${esc(c.name)} · ${esc(c.status)}</option>`).join('');
}

// The existing ad form's submit handler already reads
// `document.getElementById('ad-campaign')` and writes campaignId into
// adData, so we only need to keep the dropdown populated. The dropdown
// is refreshed at dashboard boot (via initCampaignManager) and after
// any campaign mutation (via refreshAdCampaignDropdown()).
//
// Pre-selecting the right campaign when editing an existing ad is
// handled directly inside startEditing() — see the campaign-pre-select
// block in that function.

// Module scripts are deferred — DOM is always ready when this runs
init();
