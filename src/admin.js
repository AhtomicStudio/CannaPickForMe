/**
 * Admin Dashboard for CannaPickForMe
 * Password-gated ad management interface.
 */

import './admin.css';
import strainsData from './data/strains.json';
import { getStrainDelta, saveStrainDelta, getMenuData, saveMenuData } from './services/strainService.js';
import { getAllAds, createAd, updateAd, deleteAd, uploadAdImage } from './services/adService.js';
import { getPageContent, savePageContent } from './services/pagesService.js';
import { getInfoTopics, saveInfoTopic, deleteInfoTopic } from './services/infoService.js';
import { auth } from './firebase.js';
import { signInAnonymously } from 'firebase/auth';

// SHA-256 hash of the admin password
const ADMIN_HASH = 'b6cba8b101e45c8b2eddd705efc782ef96d4e32b090a5db14ccdb77d1247426a';
const SESSION_KEY = 'cpfm_admin_auth';

const DISPENSARY_NAMES = {
  'cookies-hayward': 'Cookies Hayward',
  'garden-of-eden': 'Garden of Eden',
  'we-are-hemp': 'We Are Hemp',
  'hayward-dispensary-delivery': 'Hayward Dispensary Delivery',
  'nug-wellness': 'NUG Wellness',
  'flor-union-city': 'FLOR - Union City Dispensary',
  'lemonnade-union-city': 'Lemonnade Union City Dispensary',
  'harborside-san-leandro': 'Harborside San Leandro Dispensary',
  '4twenty-market-oakland': '4Twenty Market Weed Dispensary Oakland',
  'three-trees-oakland': 'Three Trees Weed Dispensary Kiosk',
  'kanna-oakland': 'KANNA Weed Dispensary Oakland',
  'harborside-oakland': 'Harborside Oakland Dispensary',
  'ivy-hill-oakland': 'Ivy Hill Weed Dispensary Oakland',
  'urbana-oakland': 'Urbana Weed Dispensary Oakland',
};

const ALL_EFFECTS = ['Creative','Energetic','Euphoric','Focused','Giggly','Happy','Hungry','Relaxed','Sleepy','Talkative','Tingly','Uplifted'];
const ALL_FLAVORS  = ['Apple','Banana','Berry','Blueberry','Candy','Cheese','Cherry','Chocolate','Citrus','Coffee','Creamy','Diesel','Earthy','Floral','Flowery','Fruity','Grape','Guava','Lemon','Mango','Melon','Mint','Minty','Nutty','Orange','Peach','Pine','Pineapple','Plum','Pungent','Sour','Spicy','Strawberry','Sweet','Tropical','Vanilla','Woody'];

// === UTILITY: SHA-256 Hash ===
async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// === AUTH ===
async function checkPassword(password) {
  const hash = await sha256(password);
  return hash === ADMIN_HASH;
}

function isAuthenticated() {
  return sessionStorage.getItem(SESSION_KEY) === 'true';
}

function setAuthenticated() {
  sessionStorage.setItem(SESSION_KEY, 'true');
}

async function ensureFirebaseAuth() {
  if (auth.currentUser) return;
  await signInAnonymously(auth);
}

async function authedSaveStrainDelta(delta) {
  await ensureFirebaseAuth();
  return saveStrainDelta(delta);
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  location.reload();
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
  group.innerHTML = Object.entries(DISPENSARY_NAMES).map(([key, label]) =>
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

  container.innerHTML = rows.map(s => {
    const isHidden    = strainDelta.hidden.includes(s.id);
    const isAddition  = s._isAddition;
    const hasOverride = !isAddition && !!strainDelta.overrides[s.id];
    const isSponsored = (strainDelta.sponsored || []).includes(s.id);

    return `
      <div class="admin-strain-row ${isHidden ? 'admin-strain-row--hidden' : ''}" data-id="${esc(s.id)}">
        <span class="admin-strain-row__dot" data-type="${esc(s.type)}"></span>
        <span class="admin-strain-row__name">${esc(s.name)}</span>
        <div class="admin-strain-row__badges">
          ${isAddition  ? '<span class="admin-tag" style="border-color:var(--green-primary);color:var(--green-glow)">🌱 Added</span>' : ''}
          ${hasOverride ? '<span class="admin-tag" style="border-color:#fbbf24;color:#fbbf24">edited</span>' : ''}
          ${s.needsReview ? '<span class="admin-tag" style="border-color:#f87171;color:#f87171">⚠️ Review</span>' : ''}
          ${isSponsored ? '<span class="admin-tag" style="border-color:#f59e0b;color:#f59e0b">⭐ Sponsored</span>' : ''}
        </div>
        <div class="admin-strain-row__actions">
          ${isHidden
            ? `<button class="admin-btn admin-btn--small" data-action="restore" data-id="${esc(s.id)}">↩ Restore</button>`
            : `<button class="admin-btn admin-btn--small" data-action="edit" data-id="${esc(s.id)}" data-addition="${isAddition}">✏️</button>
               <button class="admin-btn admin-btn--small ${isSponsored ? 'admin-btn--active' : ''}" data-action="sponsor" data-id="${esc(s.id)}" title="${isSponsored ? 'Remove sponsor' : 'Mark as sponsored'}">⭐</button>
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

  container.querySelectorAll('[data-action="sponsor"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const sponsored = strainDelta.sponsored || [];
      if (sponsored.includes(id)) {
        strainDelta.sponsored = sponsored.filter(s => s !== id);
      } else {
        strainDelta.sponsored = [...sponsored, id];
      }
      await authedSaveStrainDelta(strainDelta);
      renderStrainList();
    });
  });
}

// === UI ===
function showDashboard() {
  document.getElementById('login-gate').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  loadAdsList();
  initStrainManager();
  initMenuSync();
  initInfoEditor();
  initPagesEditor();
  initSponsorSettings();
  initPartnerStrains();
}

function initSponsorSettings() {
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
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = document.getElementById('admin-password').value;
    const valid = await checkPassword(pw);

    if (valid) {
      setAuthenticated();
      try { await ensureFirebaseAuth(); } catch (err) {
        console.error('Firebase auth failed:', err);
        alert('Authentication error. Please refresh and try again.');
        return;
      }
      showDashboard();
    } else {
      document.getElementById('login-error').classList.remove('hidden');
      document.getElementById('admin-password').value = '';
    }
  });

  // Check existing session
  if (isAuthenticated()) {
    try { await ensureFirebaseAuth(); } catch (err) { console.warn('Session auth failed:', err); }
    showDashboard();
  }

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
      };

      if (editingAdId) {
        await updateAd(editingAdId, adData);
      } else {
        await createAd(adData);
      }

      cancelEditing();
      loadAdsList();
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
    <div class="admin-strain-row" data-id="${esc(s.id)}">
      <span class="admin-strain-row__dot" data-type="${esc(s.type)}"></span>
      <span class="admin-strain-row__name">${esc(s.name)}</span>
      <div class="admin-strain-row__badges">
        <span class="admin-tag" style="border-color:#f87171;color:#f87171">⚠️ Review</span>
        ${s.thc ? `<span class="admin-tag">${s.thc}% THC</span>` : ''}
      </div>
      <div class="admin-strain-row__actions">
        <button class="admin-btn admin-btn--small" data-action="review-edit" data-id="${esc(s.id)}">✏️ Edit</button>
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
}

async function initMenuSync() {
  // Load existing menu state
  const existing = await getMenuData(SYNC_DISPENSARY_ID);
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

    try {
      const res = await fetch(`/api/sync-menu?dispensary=${SYNC_DISPENSARY_ID}`);
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        alert(`Sync failed: server returned a non-JSON response (status ${res.status}).\n\n${text.slice(0, 400)}`);
        return;
      }

      if (!res.ok) {
        alert(`Sync failed: ${data.error || 'Unknown error'}\n\n${data.hint || ''}`);
        return;
      }

      if (data.warning) {
        console.warn('Sync warning:', data.warning, data.rawCategories);
        alert(`Sync warning: ${data.warning}\nRaw categories found: ${(data.rawCategories || []).join(', ')}`);
      }

      showSyncResult(data, existing.strainIds || []);
    } catch (err) {
      alert(`Sync error: ${err.message}`);
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
            <textarea placeholder="Write content for ${esc(topic.title)}..." rows="6">${esc(topic.content || '')}</textarea>
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
        const topic = topics.find(t => t.id === id);
        if (!topic) return;

        btn.textContent = 'Saving...';
        btn.disabled = true;
        try {
          await saveInfoTopic(id, { ...topic, content });
          topic.content = content;
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
  // Populate dispensary select
  const dispSel = document.getElementById('partner-dispensary');
  dispSel.innerHTML = '<option value="">— none —</option>' +
    Object.entries(DISPENSARY_NAMES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

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
      const disp = p.dispensaryId ? (DISPENSARY_NAMES[p.dispensaryId] || p.dispensaryId) : '—';
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

// Module scripts are deferred — DOM is always ready when this runs
init();
