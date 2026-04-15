/**
 * Admin Dashboard for CannaPickForMe
 * Password-gated ad management interface.
 */

import './admin.css';
import strainsData from './data/strains.json';
import { getStrainDelta, saveStrainDelta } from './services/strainService.js';
import { getAllAds, createAd, updateAd, deleteAd, uploadAdImage } from './services/adService.js';

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
let strainDelta           = { hidden: [], overrides: {}, additions: [] };
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

    return `
      <div class="admin-strain-row ${isHidden ? 'admin-strain-row--hidden' : ''}" data-id="${esc(s.id)}">
        <span class="admin-strain-row__dot" data-type="${esc(s.type)}"></span>
        <span class="admin-strain-row__name">${esc(s.name)}</span>
        <div class="admin-strain-row__badges">
          ${isAddition  ? '<span class="admin-tag" style="border-color:var(--green-primary);color:var(--green-glow)">🌱 Added</span>' : ''}
          ${hasOverride ? '<span class="admin-tag" style="border-color:#fbbf24;color:#fbbf24">edited</span>' : ''}
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
      await saveStrainDelta(strainDelta);
      renderStrainList();
    });
  });

  container.querySelectorAll('[data-action="restore"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      strainDelta.hidden = strainDelta.hidden.filter(id => id !== btn.dataset.id);
      await saveStrainDelta(strainDelta);
      renderStrainList();
    });
  });

  container.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this strain permanently?')) return;
      strainDelta.additions = strainDelta.additions.filter(s => s.id !== btn.dataset.id);
      await saveStrainDelta(strainDelta);
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

      await saveStrainDelta(strainDelta);
      resetStrainForm();
      renderStrainList();
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

  previewWrap.addEventListener('touchstart', (e) => {
    startDrag(e.touches[0].clientX, e.touches[0].clientY);
    e.preventDefault();
  }, { passive: false });
  document.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    e.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', endDrag);
}

// === INIT ===
function init() {
  initDragPreview();

  // Check existing session
  if (isAuthenticated()) {
    showDashboard();
  }

  // Login form
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = document.getElementById('admin-password').value;
    const valid = await checkPassword(pw);

    if (valid) {
      setAuthenticated();
      showDashboard();
    } else {
      document.getElementById('login-error').classList.remove('hidden');
      document.getElementById('admin-password').value = '';
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

// Module scripts are deferred — DOM is always ready when this runs
init();
