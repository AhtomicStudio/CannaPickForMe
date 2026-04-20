import './style.css';
import './profile.css';
import { inject, track } from '@vercel/analytics';
import strainsData from './data/strains.json';
import questionsData from './data/questions.json';
import { matchStrains } from './engine/matcher.js';
import { getNextQuote } from './data/quotes.js';
import { pickAnimation } from './animations/index.js';
import {
  getStash, addToStash, removeFromStash, isInStash, clearStash,
  getCustomStrains, addCustomStrain, removeCustomStrain,
  getEffectOverrides, setEffectOverride, getStrainEffectOverride, clearEffectOverride,
  getStrainDispensaries,
  isAgeVerified, setAgeVerified, applyOverrides,
  addSessionEntry,
} from './storage/store.js';
import {
  getCurrentUser, signInWithGoogle,
  scheduleSync, loadAndResolveProfile, signOutUser, deleteAccount, initAuth,
  sendSignInLink, handleSignInLink, completeSignInWithEmail, NEEDS_EMAIL_CONFIRMATION,
} from './services/userService.js';
import { loadSavedTheme } from './services/themeService.js';
import { shareResult } from './shareCard.js';
import { initProfile, setProfileBackHandler, renderProfileScreen } from './profile.js';

// === CONSTANTS ===
const ALL_EFFECTS = ['Relaxed','Happy','Euphoric','Creative','Uplifted','Energetic','Focused','Talkative','Giggly','Sleepy','Hungry','Tingly'];
const ALL_FLAVORS = ['Earthy','Sweet','Berry','Citrus','Pine','Diesel','Pungent','Woody','Grape','Lemon','Mango','Tropical','Minty','Vanilla','Flowery','Spicy','Cherry','Blueberry','Strawberry','Orange','Pineapple','Coffee','Cheese','Creamy','Nutty','Apple','Banana','Chocolate','Candy','Fruity','Peach'];

// Neon color palette for the random SMOKE text
const SMOKE_NEON_COLORS = [
  { glow: '#4ade80', rgb: '74, 222, 128' },   // Green
  { glow: '#fbbf24', rgb: '251, 191, 36' },   // Gold
  { glow: '#c084fc', rgb: '192, 132, 252' },  // Purple
  { glow: '#f472b6', rgb: '244, 114, 182' },  // Pink
  { glow: '#38bdf8', rgb: '56, 189, 248' },   // Sky Blue
  { glow: '#fb923c', rgb: '251, 146, 60' },   // Orange
  { glow: '#a78bfa', rgb: '167, 139, 250' },  // Violet
  { glow: '#34d399', rgb: '52, 211, 153' },   // Emerald
  { glow: '#f87171', rgb: '248, 113, 113' },  // Red
  { glow: '#22d3ee', rgb: '34, 211, 238' },   // Cyan
];

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

// Apply both effect and dispensary overrides to a strain before rendering
function applyAllOverrides(strain) {
  const withEffects = applyOverrides(strain);
  const dispOverride = getStrainDispensaries(strain.id);
  return dispOverride !== null ? { ...withEffects, dispensaries: dispOverride } : withEffects;
}

// === STRAIN DELTA CACHE ===
let strainDelta = { hidden: [], overrides: {}, additions: [] };

function applyDelta(strains, delta) {
  const { hidden, overrides, additions } = delta;
  const hiddenSet = new Set(hidden);
  return strains
    .filter(s => !hiddenSet.has(s.id))
    .map(s => overrides[s.id] ? { ...s, ...overrides[s.id] } : s)
    .concat(additions.map(a => ({
      effects: [], flavors: [], dispensaries: [], description: '',
      genetics: null, rating: null,
      ...a,
      type: a.type || 'hybrid',
      name: a.name || 'Unknown',
      id: a.id || `addition-${Date.now()}`,
    })));
}

// === STRAIN EXPAND BODY ===
function buildExpandBody(strain) {
  const effects = strain.effectOverrides || strain.effects || [];
  const flavors = strain.flavors || [];
  const dispensaries = strain.dispensaries || [];

  const geneticsHTML = strain.genetics
    ? `<p class="strain-card__genetics-known">${strain.genetics}</p>`
    : `<span class="strain-card__genetics-unknown">🤫</span>`;

  const effectsHTML = effects
    .map(e => `<span class="strain-pill--effect">${e}</span>`)
    .join('');

  const flavorsHTML = flavors
    .map(f => `<span class="strain-pill--flavor">${f}</span>`)
    .join('');

  const dispensaryHTML = dispensaries.length > 0
    ? `<div class="strain-card__expand-dispensaries">
        ${dispensaries.map(d => `<span class="strain-pill--dispensary">📍 ${DISPENSARY_NAMES[d] || d}</span>`).join('')}
      </div>`
    : '';

  const flavorsSection = flavorsHTML
    ? `<div>
        <p class="strain-card__expand-label">Flavors</p>
        <div class="strain-pill-row">${flavorsHTML}</div>
      </div>`
    : '';

  return `
    <div class="strain-card__expand">
      <div class="strain-card__expand-body">
        <div>
          <p class="strain-card__expand-label">About</p>
          <p class="strain-card__expand-text">${strain.description || ''}</p>
        </div>
        <div>
          <p class="strain-card__expand-label">Genetics</p>
          ${geneticsHTML}
        </div>
        <div>
          <p class="strain-card__expand-label">Effects</p>
          <div class="strain-pill-row">${effectsHTML}</div>
        </div>
        ${flavorsSection}
        ${dispensaryHTML}
      </div>
    </div>
  `;
}

// === STATE ===
let currentScreen = 'age-gate';
let sessionAnswers = {};
let currentQuestionIndex = 0;
let lastShareData = null; // set after each result render
let currentSearchQuery = '';
let currentFilter = 'all';
let currentEffectFilters = new Set();
let currentFlavorFilters = new Set();
let currentExcludeFilters = new Set();
let currentSortAlpha = false;
let currentSortAsc = true;
let overrideStrainId = null;

// === SCREEN NAVIGATION ===
function showScreen(id) {
  const prev = document.getElementById(currentScreen + '-screen') || document.getElementById(currentScreen);
  const next = document.getElementById(id + '-screen') || document.getElementById(id);

  if (prev) prev.classList.add('hidden');
  if (next) {
    next.classList.remove('hidden');
    next.classList.add('screen--entering');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        next.classList.remove('screen--entering');
      });
    });
  }
  currentScreen = id;
}

// === HELPERS ===
function getAllStrains() {
  const customs = getCustomStrains();
  return applyDelta([...strainsData, ...customs], strainDelta);
}

async function initStrainDelta() {
  try {
    const { getStrainDelta } = await import('./services/strainService.js');
    strainDelta = await getStrainDelta();
    // Re-render browse list if it is currently visible
    const list = document.getElementById('strain-list');
    if (list) renderBrowseList();
  } catch {
    // Silent — fall back to raw JSON
  }
}

function getStashStrains() {
  const stashIds = getStash();
  const all = getAllStrains();
  return stashIds
    .map(id => all.find(s => s.id === id))
    .filter(Boolean)
    .map(applyOverrides);
}

function updateStashUI() {
  const count = getStash().length;
  const countEl = document.getElementById('stash-count');
  const tabCountEl = document.getElementById('tab-stash-count');
  const pickBtn = document.getElementById('btn-pick');
  const hint = document.getElementById('stash-hint');
  const clearBtn = document.getElementById('btn-clear-stash');
  const doneCount = document.getElementById('done-count');

  if (countEl) countEl.textContent = count;
  if (tabCountEl) tabCountEl.textContent = count;
  if (pickBtn) pickBtn.disabled = count < 2;
  if (hint) {
    hint.textContent = count < 2
      ? `Add at least ${2 - count} more strain${2 - count > 1 ? 's' : ''} to your stash to get started!`
      : `You have ${count} strain${count > 1 ? 's' : ''} ready. Let's roll! 🔥`;
  }
  // Show/hide clear stash button
  if (clearBtn) {
    clearBtn.classList.toggle('hidden', count === 0);
  }
  // Update done bar count
  if (doneCount) {
    doneCount.textContent = `${count} selected`;
  }
}

// === AGE GATE ===
function initAgeGate() {
  if (isAgeVerified()) {
    document.getElementById('age-gate').classList.add('hidden');
    showScreen('home');
    return;
  }

  document.getElementById('age-yes').addEventListener('click', () => {
    setAgeVerified();
    showScreen('disclaimer');
  });

  document.getElementById('age-no').addEventListener('click', () => {
    document.querySelector('.age-gate__question p').textContent = 'Come back when you\'re 21! ✌️';
    document.querySelector('.age-gate__buttons').innerHTML =
      '<p style="color: var(--text-muted); font-size: 0.9rem;">This app is for adults 21+ only.</p>';
  });
}

// === DISCLAIMER ===
function initDisclaimer() {
  const screen = document.getElementById('disclaimer-screen');
  screen.addEventListener('click', (e) => {
    // Don't dismiss if clicking the details/summary
    if (e.target.closest('details')) return;
    showScreen('home');
  });
}

// === HOME ===
function initHome() {
  const tagline = document.getElementById('home-tagline');
  if (tagline) {
    const timeWord = new Date().getHours() < 12 ? 'today' : 'tonight';
    tagline.textContent = `What are we shmokin' ${timeWord}?`;
  }
  document.getElementById('btn-pick').addEventListener('click', () => {
    sessionAnswers = {};
    currentQuestionIndex = 0;
    renderQuestion();
    showScreen('session');
  });

  document.getElementById('btn-stash').addEventListener('click', () => {
    renderBrowseList();
    renderMyStashList();
    updateStashUI();
    showScreen('stash');

    if (!localStorage.getItem('cpfm_stash_tip_shown')) {
      const tip = document.getElementById('stash-tip');
      tip.classList.remove('hidden');
      const dismiss = () => {
        tip.classList.add('hidden');
        localStorage.setItem('cpfm_stash_tip_shown', '1');
        tip.removeEventListener('click', dismiss);
      };
      tip.addEventListener('click', dismiss);
    }
  });

  document.getElementById('btn-profile').addEventListener('click', () => {
    const user = getCurrentUser();
    if (!user) {
      document.getElementById('account-modal').classList.remove('hidden');
      setAccountState('signedout');
      return;
    }
    renderProfileScreen();
    showScreen('profile');
  });

  document.getElementById('legal-link').addEventListener('click', (e) => {
    e.preventDefault();
    showScreen('disclaimer');
  });

  // Clear Stash
  document.getElementById('btn-clear-stash').addEventListener('click', () => {
    const count = getStash().length;
    if (count === 0) return;
    const confirmed = confirm(`Clear all ${count} strain${count > 1 ? 's' : ''} from your stash?`);
    if (confirmed) {
      clearStash();
      scheduleSync();
      updateStashUI();
    }
  });

  updateStashUI();
}

// === STASH SCREEN ===
function initStash() {
  // Back button
  document.getElementById('stash-back').addEventListener('click', () => {
    showScreen('home');
    updateStashUI();
  });

  // Tabs
  document.querySelectorAll('.stash__tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('.stash__tabs .tab').forEach(t => t.classList.remove('tab--active'));
      tab.classList.add('tab--active');

      document.getElementById('browse-panel').classList.toggle('hidden', target !== 'browse');
      document.getElementById('my-stash-panel').classList.toggle('hidden', target !== 'my-stash');

      if (target === 'my-stash') renderMyStashList();
    });
  });

  // Search
  document.getElementById('strain-search').addEventListener('input', (e) => {
    currentSearchQuery = e.target.value.toLowerCase();
    renderBrowseList();
  });

  // Type filter chips
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('filter-chip--active'));
      chip.classList.add('filter-chip--active');
      currentFilter = chip.dataset.filter;
      renderBrowseList();
    });
  });

  initMultiSelects();

  // Add custom
  document.getElementById('btn-add-custom').addEventListener('click', openCustomModal);

  // Done button
  document.getElementById('btn-stash-done').addEventListener('click', () => {
    showScreen('home');
    updateStashUI();
  });
}

function setupMultiSelect({ btnId, panelId, searchId, optionsId, badgeId, wrapId, items, selectedSet, onchange }) {
  const btn = document.getElementById(btnId);
  const panel = document.getElementById(panelId);
  const searchInput = document.getElementById(searchId);
  const optionsEl = document.getElementById(optionsId);
  const badge = document.getElementById(badgeId);
  if (!btn || !panel || !optionsEl) return;

  function buildOptions(query = '') {
    const filtered = query ? items.filter(i => i.toLowerCase().includes(query.toLowerCase())) : items;
    optionsEl.innerHTML = filtered.map(item => `
      <label class="ms-option${selectedSet.has(item) ? ' checked' : ''}">
        <input type="checkbox" value="${item}" ${selectedSet.has(item) ? 'checked' : ''} />
        ${item}
      </label>
    `).join('');
    optionsEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) selectedSet.add(cb.value);
        else selectedSet.delete(cb.value);
        cb.closest('.ms-option').classList.toggle('checked', cb.checked);
        if (badge) {
          badge.textContent = selectedSet.size;
          badge.classList.toggle('hidden', selectedSet.size === 0);
        }
        onchange();
      });
    });
  }

  buildOptions();

  if (searchInput) {
    searchInput.addEventListener('input', () => buildOptions(searchInput.value));
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !panel.classList.contains('hidden');
    document.querySelectorAll('.ms-panel').forEach(p => p.classList.add('hidden'));
    if (!isOpen) {
      panel.classList.remove('hidden');
      if (searchInput) searchInput.focus();
    }
  });

  document.addEventListener('click', (e) => {
    const wrap = document.getElementById(wrapId);
    if (wrap && !wrap.contains(e.target)) panel.classList.add('hidden');
  });
}

function updateClearBtn() {
  const active = currentEffectFilters.size > 0 || currentFlavorFilters.size > 0 || currentExcludeFilters.size > 0;
  document.getElementById('btn-clear-filters')?.classList.toggle('hidden', !active);
}

function clearAllFilters() {
  currentEffectFilters.clear();
  currentFlavorFilters.clear();
  currentExcludeFilters.clear();
  document.querySelectorAll('.ms-panel-options input[type="checkbox"]').forEach(cb => {
    cb.checked = false;
    cb.closest('.ms-option')?.classList.remove('checked');
  });
  ['ms-effect-badge', 'ms-flavor-badge', 'ms-exclude-badge'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = '0'; el.classList.add('hidden'); }
  });
  document.getElementById('ms-exclude-btn')?.classList.remove('ms-has-selection');
  updateClearBtn();
  renderBrowseList();
}

function updateSortIcon() {
  const icon = document.getElementById('sort-icon');
  const btn = document.getElementById('sort-strains-btn');
  if (!icon || !btn) return;
  if (!currentSortAlpha) {
    icon.textContent = '↕';
    btn.classList.remove('sorted');
  } else {
    icon.textContent = currentSortAsc ? '↑' : '↓';
    btn.classList.add('sorted');
  }
}

function initMultiSelects() {
  const all = getAllStrains();
  const effects = [...new Set(all.flatMap(s => s.effects || []))].sort();
  const flavors = [...new Set(all.flatMap(s => s.flavors || []))].sort();

  setupMultiSelect({
    wrapId: 'ms-effect', btnId: 'ms-effect-btn', panelId: 'ms-effect-panel',
    searchId: 'ms-effect-search', optionsId: 'ms-effect-options', badgeId: 'ms-effect-badge',
    items: effects, selectedSet: currentEffectFilters,
    onchange: () => { updateClearBtn(); renderBrowseList(); },
  });

  setupMultiSelect({
    wrapId: 'ms-flavor', btnId: 'ms-flavor-btn', panelId: 'ms-flavor-panel',
    searchId: 'ms-flavor-search', optionsId: 'ms-flavor-options', badgeId: 'ms-flavor-badge',
    items: flavors, selectedSet: currentFlavorFilters,
    onchange: () => { updateClearBtn(); renderBrowseList(); },
  });

  setupMultiSelect({
    wrapId: 'ms-exclude', btnId: 'ms-exclude-btn', panelId: 'ms-exclude-panel',
    searchId: 'ms-exclude-search', optionsId: 'ms-exclude-options', badgeId: 'ms-exclude-badge',
    items: effects, selectedSet: currentExcludeFilters,
    onchange: () => {
      document.getElementById('ms-exclude-btn')?.classList.toggle('ms-has-selection', currentExcludeFilters.size > 0);
      updateClearBtn();
      renderBrowseList();
    },
  });

  document.getElementById('btn-clear-filters')?.addEventListener('click', clearAllFilters);

  document.getElementById('sort-strains-btn')?.addEventListener('click', () => {
    if (!currentSortAlpha) {
      currentSortAlpha = true;
      currentSortAsc = true;
    } else {
      currentSortAsc = !currentSortAsc;
    }
    updateSortIcon();
    renderBrowseList();
  });
}

function renderBrowseList() {
  const list = document.getElementById('strain-list');
  let strains = getAllStrains();

  if (currentFilter !== 'all') {
    strains = strains.filter(s => s.type === currentFilter);
  }
  if (currentEffectFilters.size > 0) {
    strains = strains.filter(s => [...currentEffectFilters].some(e => (s.effects || []).includes(e)));
  }
  if (currentFlavorFilters.size > 0) {
    strains = strains.filter(s => [...currentFlavorFilters].some(f => (s.flavors || []).includes(f)));
  }
  if (currentExcludeFilters.size > 0) {
    strains = strains.filter(s => ![...currentExcludeFilters].some(e => (s.effects || []).includes(e)));
  }
  if (currentSearchQuery) {
    strains = strains.filter(s =>
      s.name.toLowerCase().includes(currentSearchQuery) ||
      (s.effects || []).some(e => e.toLowerCase().includes(currentSearchQuery)) ||
      (s.flavors || []).some(f => f.toLowerCase().includes(currentSearchQuery))
    );
  }
  if (currentSortAlpha) {
    strains = [...strains].sort((a, b) =>
      currentSortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    );
  }

  list.innerHTML = strains.map(strain => {
    const inStash = isInStash(strain.id);
    const hasOverride = !!getStrainEffectOverride(strain.id);
    const effects = (strain.effects || []).slice(0, 3).join(', ');
    const type = strain.type.charAt(0).toUpperCase() + strain.type.slice(1);

    return `
      <div class="strain-card" data-id="${strain.id}">
        <div class="strain-card__type-dot" data-type="${strain.type}"></div>
        <div class="strain-card__info">
          <div class="strain-card__name">${strain.name}${strain.isCustom ? ' 🌱' : ''}</div>
          <div class="strain-card__meta">${type} · ${effects}</div>
        </div>
        <div class="strain-card__actions">
          <button class="strain-card__btn strain-card__btn--edit ${hasOverride ? 'strain-card__btn--active' : ''}"
                  data-action="edit" data-id="${strain.id}" title="Edit effects">✏️</button>
          <button class="strain-card__btn ${inStash ? 'strain-card__btn--active' : ''}"
                  data-action="toggle-stash" data-id="${strain.id}" title="${inStash ? 'Remove from stash' : 'Add to stash'}">
            ${inStash ? '✓' : '+'}
          </button>
        </div>
        ${buildExpandBody(applyAllOverrides(strain))}
      </div>
    `;
  }).join('');

  // Event delegation
  list.querySelectorAll('[data-action="toggle-stash"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (isInStash(id)) {
        removeFromStash(id);
        track('stash_remove', { strain: id });
      } else {
        addToStash(id);
        track('stash_add', { strain: id });
      }
      scheduleSync();
      renderBrowseList();
      updateStashUI();
    });
  });

  list.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openOverrideModal(btn.dataset.id);
    });
  });

  list.querySelectorAll('.strain-card__info').forEach(info => {
    info.addEventListener('click', () => {
      const card = info.closest('.strain-card');
      const isExpanded = card.classList.contains('strain-card--expanded');
      list.querySelectorAll('.strain-card--expanded').forEach(c => c.classList.remove('strain-card--expanded'));
      if (!isExpanded) card.classList.add('strain-card--expanded');
    });
  });
}

function renderMyStashList() {
  const list = document.getElementById('my-stash-list');
  const empty = document.getElementById('empty-stash');
  const stashStrains = getStashStrains();

  if (stashStrains.length === 0) {
    list.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  list.classList.remove('hidden');

  list.innerHTML = stashStrains.map(strain => {
    const effects = (strain.effectOverrides || strain.effects || []).slice(0, 3).join(', ');
    const type = strain.type.charAt(0).toUpperCase() + strain.type.slice(1);

    return `
      <div class="strain-card" data-id="${strain.id}">
        <div class="strain-card__type-dot" data-type="${strain.type}"></div>
        <div class="strain-card__info">
          <div class="strain-card__name">${strain.name}${strain.isCustom ? ' 🌱' : ''}</div>
          <div class="strain-card__meta">${type} · ${effects}</div>
        </div>
        <div class="strain-card__actions">
          <button class="strain-card__btn" data-action="remove" data-id="${strain.id}" title="Remove from stash">✕</button>
        </div>
        ${buildExpandBody(applyAllOverrides(strain))}
      </div>
    `;
  }).join('');

  list.querySelectorAll('[data-action="remove"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromStash(btn.dataset.id);
      scheduleSync();
      renderMyStashList();
      updateStashUI();
    });
  });

  list.querySelectorAll('.strain-card__info').forEach(info => {
    info.addEventListener('click', () => {
      const card = info.closest('.strain-card');
      const isExpanded = card.classList.contains('strain-card--expanded');
      list.querySelectorAll('.strain-card--expanded').forEach(c => c.classList.remove('strain-card--expanded'));
      if (!isExpanded) card.classList.add('strain-card--expanded');
    });
  });

  // Update tab count
  const tabCount = document.getElementById('tab-stash-count');
  if (tabCount) tabCount.textContent = stashStrains.length;
}

// === CUSTOM STRAIN MODAL ===
function openCustomModal() {
  const modal = document.getElementById('custom-modal');
  modal.classList.remove('hidden');

  // Populate effect chips
  const effectsContainer = document.getElementById('custom-effects');
  effectsContainer.innerHTML = ALL_EFFECTS.map(e =>
    `<button type="button" class="chip" data-value="${e}">${e}</button>`
  ).join('');

  // Populate flavor chips
  const flavorsContainer = document.getElementById('custom-flavors');
  flavorsContainer.innerHTML = ALL_FLAVORS.map(f =>
    `<button type="button" class="chip" data-value="${f}">${f}</button>`
  ).join('');

  // Chip toggle
  modal.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('chip--selected'));
  });

  // Cancel
  document.getElementById('custom-cancel').addEventListener('click', () => {
    modal.classList.add('hidden');
    document.getElementById('custom-strain-form').reset();
  });

  // Backdrop close
  modal.querySelector('.modal__backdrop').addEventListener('click', () => {
    modal.classList.add('hidden');
  });
}

function initCustomForm() {
  document.getElementById('custom-strain-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('custom-name').value.trim();
    const type = document.querySelector('input[name="custom-type"]:checked')?.value || 'hybrid';
    const effects = Array.from(document.querySelectorAll('#custom-effects .chip--selected')).map(c => c.dataset.value);
    const flavors = Array.from(document.querySelectorAll('#custom-flavors .chip--selected')).map(c => c.dataset.value);

    if (!name) return;
    if (effects.length === 0) {
      alert('Please select at least one effect.');
      return;
    }

    const strain = addCustomStrain({
      name,
      type,
      effects,
      flavors,
      description: `Custom strain added by user.`,
      rating: 4.0
    });

    addToStash(strain.id);
    scheduleSync();
    document.getElementById('custom-modal').classList.add('hidden');
    document.getElementById('custom-strain-form').reset();
    renderBrowseList();
    renderMyStashList();
    updateStashUI();
  });
}

// === EFFECT OVERRIDE MODAL ===
function openOverrideModal(strainId) {
  overrideStrainId = strainId;
  const modal = document.getElementById('override-modal');
  const strain = getAllStrains().find(s => s.id === strainId);
  if (!strain) return;

  modal.classList.remove('hidden');

  document.getElementById('override-title').textContent = `Edit Effects — ${strain.name}`;

  const currentEffects = getStrainEffectOverride(strainId) || strain.effects || [];

  const container = document.getElementById('override-effects');
  container.innerHTML = ALL_EFFECTS.map(e =>
    `<button type="button" class="chip ${currentEffects.includes(e) ? 'chip--selected' : ''}" data-value="${e}">${e}</button>`
  ).join('');

  container.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('chip--selected'));
  });

  // Save
  document.getElementById('override-save').onclick = () => {
    const selected = Array.from(container.querySelectorAll('.chip--selected')).map(c => c.dataset.value);
    if (selected.length === 0) {
      alert('Select at least one effect.');
      return;
    }
    setEffectOverride(strainId, selected);
    scheduleSync();
    modal.classList.add('hidden');
    renderBrowseList();
  };

  // Reset
  document.getElementById('override-reset').onclick = () => {
    clearEffectOverride(strainId);
    scheduleSync();
    modal.classList.add('hidden');
    renderBrowseList();
  };

  // Backdrop
  modal.querySelector('.modal__backdrop').onclick = () => modal.classList.add('hidden');
}


// === SESSION (4 QUESTIONS) ===
function renderQuestion() {
  const q = questionsData[currentQuestionIndex];
  if (!q) return;

  const content = document.getElementById('session-content');
  const progressFill = document.getElementById('progress-fill');
  const progressLabel = document.getElementById('progress-label');

  progressFill.style.width = `${((currentQuestionIndex + 1) / questionsData.length) * 100}%`;
  progressLabel.textContent = `${currentQuestionIndex + 1} / ${questionsData.length}`;

  content.innerHTML = `
    <div class="session__emoji">${q.emoji}</div>
    <h2 class="session__question">${q.label}</h2>
    <div class="session__options">
      ${q.options.map(opt => `
        <button class="session__option" data-value="${opt.value}">
          <span class="session__option-emoji">${opt.emoji}</span>
          <span>${opt.label}</span>
        </button>
      `).join('')}
    </div>
  `;

  // Animate options in
  content.querySelectorAll('.session__option').forEach((opt, i) => {
    opt.style.opacity = '0';
    opt.style.transform = 'translateY(14px)';
    setTimeout(() => {
      opt.style.transition = 'all 0.5s var(--ease-out)';
      opt.style.opacity = '1';
      opt.style.transform = 'translateY(0)';
    }, 180 + i * 120);
  });

  content.querySelectorAll('.session__option').forEach(opt => {
    opt.addEventListener('click', () => {
      sessionAnswers[q.id] = opt.dataset.value;
      opt.classList.add('session__option--selected');

      setTimeout(() => {
        document.activeElement?.blur();
        currentQuestionIndex++;
        if (currentQuestionIndex >= questionsData.length) {
          startResult();
        } else {
          renderQuestion();
        }
      }, 500);
    });
  });
}

function initSession() {
  document.getElementById('session-back').addEventListener('click', () => {
    if (currentQuestionIndex > 0) {
      currentQuestionIndex--;
      const q = questionsData[currentQuestionIndex];
      delete sessionAnswers[q.id];
      renderQuestion();
    } else {
      showScreen('home');
    }
  });
}

// === RESULT SCREEN ===
function startResult() {
  showScreen('result');

  const stashStrains = getStashStrains();
  const result = matchStrains(stashStrains, sessionAnswers);

  if (!result) {
    showScreen('home');
    return;
  }

  const WEIGH_DURATION = 5000;

  // Show weighing phase
  document.getElementById('weighing-phase').classList.remove('hidden');
  document.getElementById('reveal-phase').classList.add('hidden');

  // Populate quote (visible the full 5s, below the animation)
  const quoteEl = document.getElementById('weighing-quote');
  if (quoteEl) {
    const quote = getNextQuote();
    quoteEl.textContent = quote.author
      ? `"${quote.text}" — ${quote.author}`
      : `"${quote.text}"`;
  }

  // Pick a random animation and render it into the host
  const anim = pickAnimation();
  const host = document.getElementById('animation-host');
  if (host) {
    host.innerHTML = '';
    if (anim) {
      anim.render(host, {
        strainName: result.pickedStrain.name,
        allScores: result.allScores,
      });
    }
  }

  track('questionnaire_completed', {
    stash_size: stashStrains.length,
    animation: anim?.id ?? 'none',
  });

  // After 5 seconds, reveal the result
  setTimeout(() => {
    document.getElementById('weighing-phase').classList.add('hidden');
    document.getElementById('reveal-phase').classList.remove('hidden');
    renderResult(result);
  }, WEIGH_DURATION);
}

function renderSponsoredStrain(allScores) {
  const card = document.getElementById('sponsored-strain-card');
  if (!card) return;

  const { sponsored = [], sponsorSettings = {} } = strainDelta;
  const { threshold = 50, alwaysShow = false } = sponsorSettings;

  if (sponsored.length === 0) { card.classList.add('hidden'); return; }

  const sponsoredScores = allScores.filter(s => sponsored.includes(s.strainId));
  if (sponsoredScores.length === 0) { card.classList.add('hidden'); return; }

  const best = sponsoredScores[0]; // allScores already sorted desc
  if (!alwaysShow && best.score < threshold) { card.classList.add('hidden'); return; }

  const strain = getAllStrains().find(s => s.id === best.strainId);
  if (!strain) { card.classList.add('hidden'); return; }

  document.getElementById('sponsored-strain-name').textContent = strain.name;
  document.getElementById('sponsored-strain-type').textContent =
    strain.type.charAt(0).toUpperCase() + strain.type.slice(1);
  document.getElementById('sponsored-match-score').textContent = `${best.score}% match`;

  const dot = document.getElementById('sponsored-type-dot');
  dot.setAttribute('data-type', strain.type);

  card.classList.remove('hidden');
}

function renderResult(result) {
  const { pickedStrain, matchScore, isPerfectMatch, reasoning } = result;

  track('strain_picked', {
    strain: pickedStrain.name,
    type: pickedStrain.type,
    match_score: matchScore,
    is_perfect_match: isPerfectMatch ?? false,
  });

  addSessionEntry({
    strainId:   pickedStrain.id,
    name:       pickedStrain.name,
    mood:       sessionAnswers.mood       ?? null,
    goal:       sessionAnswers.goal       ?? null,
    intensity:  sessionAnswers.intensity  ?? null,
    vibe:       sessionAnswers.vibe       ?? null,
    matchScore: matchScore,
  });
  scheduleSync();

  document.getElementById('result-strain-name').textContent = pickedStrain.name;

  const typeEl = document.getElementById('result-strain-type');
  typeEl.textContent = pickedStrain.type.charAt(0).toUpperCase() + pickedStrain.type.slice(1);
  typeEl.setAttribute('data-type', pickedStrain.type);

  document.getElementById('result-match-score').innerHTML = `${matchScore}<span>% match</span>`;
  document.getElementById('result-reasoning').textContent = reasoning;

  const effectsEl = document.getElementById('result-effects');
  effectsEl.innerHTML = (pickedStrain.effectOverrides || pickedStrain.effects || []).map(e =>
    `<span class="effect-tag">${e}</span>`
  ).join('');

  // Random neon color for SMOKE text
  const smokeTextEl = document.querySelector('.result__smoke-text');
  if (smokeTextEl) {
    const color = SMOKE_NEON_COLORS[Math.floor(Math.random() * SMOKE_NEON_COLORS.length)];
    smokeTextEl.style.color = color.glow;
    smokeTextEl.style.textShadow = `0 0 30px rgba(${color.rgb}, 0.8), 0 0 60px rgba(${color.rgb}, 0.4), 0 0 90px rgba(${color.rgb}, 0.2)`;
    smokeTextEl.style.animation = 'none';
    // Force reflow then re-apply animation with new color via CSS variable
    smokeTextEl.offsetHeight;
    smokeTextEl.style.setProperty('--neon-rgb', color.rgb);
    smokeTextEl.style.animation = 'pulse-glow-dynamic 2s ease-in-out infinite';
  }


  // --- BETTER MATCH LOGIC ---
  const betterMatchContainer = document.getElementById('better-match-container');
  if (betterMatchContainer) {
    const btnBetterMatch = document.getElementById('btn-better-match');
    betterMatchContainer.classList.add('hidden'); // Reset state

    let topGlobalStrains = [];

    if (matchScore < 100) {
      // Find strains not in stash
      const globalAvailable = getAllStrains().filter(s => !isInStash(s.id));
      const globalResult = matchStrains(globalAvailable, sessionAnswers);
      
      if (globalResult && globalResult.allScores) {
        // Find strains that have a strictly higher score than the current best stash match
        topGlobalStrains = globalResult.allScores.filter(s => s.score > matchScore).slice(0, 5);
        
        if (topGlobalStrains.length > 0) {
          betterMatchContainer.classList.remove('hidden');
        }
      }
    }

    if (btnBetterMatch) {
      btnBetterMatch.onclick = () => {
        showBetterMatchesModal(topGlobalStrains);
      };
    }
  }

  renderSponsoredStrain(result.allScores);

  lastShareData = {
    strainName: pickedStrain.name,
    strainType: pickedStrain.type,
    strainId:   pickedStrain.id,
    matchScore,
    sessionAnswers: { ...sessionAnswers },
  };
}

function showBetterMatchesModal(matchesData) {
  const modal = document.getElementById('better-match-modal');
  const list = document.getElementById('better-match-list');
  const allStrains = getAllStrains();

  // Find the active partner strain
  const partnerStrains = (strainDelta.partnerStrains || []).filter(p => p.active);
  const partner = partnerStrains[0] || null;
  const partnerStrain = partner ? allStrains.find(s => s.id === partner.strainId) : null;

  // Build organic cards (slots 1-3 and 5-6 around the partner)
  const organicCards = matchesData.map((match, i) => {
    const strain = allStrains.find(s => s.id === match.strainId);
    if (!strain) return '';
    const effects = (strain.effectOverrides || strain.effects || []).slice(0, 3).join(', ');
    const type = strain.type.charAt(0).toUpperCase() + strain.type.slice(1);
    return { index: i, html: `
      <div class="strain-card better-match-card">
        <div class="strain-card__type-dot" data-type="${strain.type}"></div>
        <div class="strain-card__info">
          <div class="strain-card__name bm-name-row">
            <span>${strain.name}</span>
            <span class="bm-score-badge">${match.score}% match</span>
          </div>
          <div class="strain-card__meta">${type} · ${effects}</div>
        </div>
      </div>` };
  });

  // Partner card HTML
  const partnerCardHtml = partnerStrain ? (() => {
    const type = partnerStrain.type.charAt(0).toUpperCase() + partnerStrain.type.slice(1);
    const effects = (partnerStrain.effectOverrides || partnerStrain.effects || []).slice(0, 3).join(', ');
    const dispName = partner.dispensaryId ? (DISPENSARY_NAMES[partner.dispensaryId] || partner.dispensaryId) : null;
    const clickAttr = partner.clickUrl ? `href="${partner.clickUrl}" target="_blank" rel="noopener"` : '';
    const tag = partner.clickUrl ? 'a' : 'div';
    return `
      <${tag} ${clickAttr} class="partner-strain-card">
        <div class="partner-strain-card__header">
          <span class="partner-strain-card__badge">✦ Partnered Strain</span>
          <span class="partner-strain-card__brand">${partner.brandName || ''}</span>
        </div>
        <div class="partner-strain-card__body">
          <div class="strain-card__type-dot" data-type="${partnerStrain.type}"></div>
          <div class="partner-strain-card__info">
            <div class="partner-strain-card__name">${partnerStrain.name}</div>
            <div class="partner-strain-card__meta">${type} · ${effects}</div>
            ${dispName ? `<div class="partner-strain-card__disp">📍 ${dispName}</div>` : ''}
          </div>
          ${partner.clickUrl ? '<span class="partner-strain-card__cta">View →</span>' : ''}
        </div>
      </${tag}>`;
  })() : '';

  // Interleave: slots 1-3 organic, slot 4 partner, slots 5-6 organic
  const before = organicCards.slice(0, 3).map(c => c.html).join('');
  const after  = organicCards.slice(3).map(c => c.html).join('');
  list.innerHTML = before + partnerCardHtml + after;

  modal.classList.remove('hidden');

  const closeBtn = document.getElementById('better-match-close');
  if (closeBtn) closeBtn.onclick = () => modal.classList.add('hidden');

  const backdrop = modal.querySelector('.modal__backdrop');
  if (backdrop) backdrop.onclick = () => modal.classList.add('hidden');
}


function initResult() {
  document.getElementById('btn-home').addEventListener('click', () => {
    showScreen('home');
    updateStashUI();
  });

  document.getElementById('btn-share').addEventListener('click', async () => {
    if (!lastShareData) return;
    const btn = document.getElementById('btn-share');
    const original = btn.innerHTML;
    btn.innerHTML = '⏳ Creating card...';
    btn.disabled = true;
    try {
      await shareResult(lastShareData);
    } catch {
      // fallback: plain text share
      try {
        const text = `🌿 CannaPickForMe picked ${lastShareData.strainName} for me! ${lastShareData.matchScore}% match — cannapickforme.com`;
        await navigator.clipboard.writeText(text);
        btn.innerHTML = '✓ Copied!';
        setTimeout(() => { btn.innerHTML = original; btn.disabled = false; }, 2000);
        return;
      } catch { /* silent */ }
    }
    btn.innerHTML = original;
    btn.disabled = false;
  });
}

// === ADS ===
function renderAdSlot(containerId, ads) {
  const container = document.getElementById(containerId);
  if (!container || !ads || ads.length === 0) return;

  // Show the first (highest priority) ad
  const ad = ads[0];
  const displayType = ad.displayType || 'card';
  const posX = Math.max(0, Math.min(100, Number(ad.imagePosition?.x) || 50));
  const posY = Math.max(0, Math.min(100, Number(ad.imagePosition?.y) || 50));
  const imgPos = `object-position: ${posX}% ${posY}%`;

  if (displayType === 'banner') {
    container.innerHTML = `
      <a href="${ad.clickUrl}" target="_blank" rel="noopener noreferrer" class="ad-banner" title="${ad.title || 'Sponsored'}">
        <img src="${ad.imageUrl}" alt="${ad.title || 'Ad'}" class="ad-banner__image" style="${imgPos}" />
        <div class="ad-banner__footer">
          <span class="ad-banner__label">✦ Sponsored</span>
        </div>
      </a>
    `;
  } else {
    // Card style (default)
    container.innerHTML = `
      <a href="${ad.clickUrl}" target="_blank" rel="noopener noreferrer" class="ad-card" title="${ad.title || 'Sponsored'}">
        <span class="ad-card__sponsored">Sponsored</span>
        <img src="${ad.imageUrl}" alt="${ad.title || 'Ad'}" class="ad-card__image" style="${imgPos}" />
        <div class="ad-card__info">
          <div class="ad-card__title">${ad.title || ''}</div>
          ${ad.description ? `<div class="ad-card__description">${ad.description}</div>` : ''}
        </div>
      </a>
    `;
  }
}

async function loadAds() {
  try {
    const { getActiveAds } = await import('./services/adService.js');
    const [homeAds, resultAds] = await Promise.all([
      getActiveAds('home'),
      getActiveAds('result'),
    ]);
    renderAdSlot('ad-slot-home', homeAds);
    renderAdSlot('ad-slot-result', resultAds);
  } catch {
    // No ads configured — that's fine.
  }
}

// === ACCOUNT MODAL ===

function setAccountState(state) {
  ['signedout', 'signedin', 'linksent', 'confirmemail'].forEach(s =>
    document.getElementById(`account-state-${s}`)?.classList.toggle('hidden', s !== state)
  );
}

function showConflictModal(localTs, cloudTs) {
  return new Promise((resolve) => {
    const modal = document.getElementById('conflict-modal');
    document.getElementById('conflict-local-time').textContent =
      localTs > 0 ? new Date(localTs).toLocaleString() : 'No sync history on this device';
    document.getElementById('conflict-cloud-time').textContent =
      cloudTs > 0 ? new Date(cloudTs).toLocaleString() : 'No cloud data';
    modal.classList.remove('hidden');

    document.getElementById('conflict-keep-local').onclick = () => {
      modal.classList.add('hidden');
      resolve('local');
    };
    document.getElementById('conflict-use-cloud').onclick = () => {
      modal.classList.add('hidden');
      resolve('cloud');
    };
  });
}

function initAccountModal() {
  const modal = document.getElementById('account-modal');
  const authLinks = document.getElementById('auth-links');

  // Open modal on log in / sign up link click
  function openAccountModal() {
    modal.classList.remove('hidden');
    const user = getCurrentUser();
    setAccountState(user ? 'signedin' : 'signedout');
    if (user) {
      document.getElementById('account-user-email').textContent = user.email;
    }
  }
  authLinks.addEventListener('click', (e) => { e.preventDefault(); openAccountModal(); });
  document.getElementById('result-signup-btn').addEventListener('click', (e) => { e.preventDefault(); openAccountModal(); });

  // Close on backdrop click
  modal.querySelector('.modal__backdrop').addEventListener('click', () => modal.classList.add('hidden'));

  // Cancel button
  document.getElementById('account-cancel-btn').addEventListener('click', () => modal.classList.add('hidden'));

  // Google sign-in
  document.getElementById('account-google-btn').addEventListener('click', async () => {
    const btn = document.getElementById('account-google-btn');
    const errorEl = document.getElementById('account-google-error');
    errorEl.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      await signInWithGoogle();
      modal.classList.add('hidden');
    } catch (err) {
      const code = err.code || '';
      console.error('Google sign-in error:', code, err);
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        errorEl.textContent = code === 'auth/popup-blocked'
          ? 'Pop-up was blocked — please allow pop-ups for this site and try again.'
          : `Google sign-in failed (${code || 'unknown'}). Please try again.`;
        errorEl.classList.remove('hidden');
      }
      btn.disabled = false;
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/><path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 6.294C4.672 4.167 6.656 3.58 9 3.58z" fill="#EA4335"/></svg> Continue with Google`;
    }
  });

  // Magic link — send
  document.getElementById('account-email-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('account-email-input').value.trim();
    const errEl = document.getElementById('account-email-error');
    const btn   = document.getElementById('account-email-btn');
    if (!email) return;
    errEl.classList.add('hidden');
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      await sendSignInLink(email);
      document.getElementById('account-linksent-email').textContent = email;
      setAccountState('linksent');
    } catch (err) {
      errEl.textContent = 'Could not send link. Check the email and try again.';
      errEl.classList.remove('hidden');
      console.error('sendSignInLink error:', err);
    } finally {
      btn.disabled = false; btn.textContent = 'Send Magic Link';
    }
  });

  // Magic link — back to email form
  document.getElementById('account-linksent-back').addEventListener('click', () => {
    document.getElementById('account-email-input').value = '';
    setAccountState('signedout');
  });

  // Magic link — cross-device email confirm
  document.getElementById('account-confirm-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('account-confirm-input').value.trim();
    const errEl = document.getElementById('account-confirm-error');
    if (!email) return;
    errEl.classList.add('hidden');
    try {
      await completeSignInWithEmail(email);
      modal.classList.add('hidden');
    } catch (err) {
      errEl.textContent = 'Sign-in failed. Make sure this is the same email you used.';
      errEl.classList.remove('hidden');
      console.error('completeSignInWithEmail error:', err);
    }
  });

  // Sign out
  document.getElementById('account-signout-btn').addEventListener('click', async () => {
    await signOutUser();
    modal.classList.add('hidden');
  });

  // Delete account
  document.getElementById('account-delete-btn').addEventListener('click', async () => {
    const confirmed = confirm('Delete your account and all cloud data? Your local data will remain on this device.');
    if (!confirmed) return;
    try {
      await deleteAccount();
      modal.classList.add('hidden');
      alert('Account deleted. Your local data is still on this device.');
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') {
        alert('For security, please sign out and sign back in before deleting your account.');
      } else {
        alert('Something went wrong. Please try again.');
        console.error('deleteAccount error:', err);
      }
    }
  });

  // Profile screen sign-out button
  const profileSignoutBtn = document.getElementById('profile-signout-btn');
  profileSignoutBtn.addEventListener('click', async () => {
    await signOutUser();
    showScreen('home');
  });

  // Auth state listener — updates cloud icon and resolves conflicts on sign-in
  const resultCta = document.getElementById('result-signup-cta');

  initAuth(
    async (user) => {
      authLinks.classList.add('hidden');
      if (resultCta) resultCta.classList.add('hidden');
      profileSignoutBtn.classList.remove('hidden');
      updateProfileAvatar(user);
      modal.classList.add('hidden');
      try {
        await loadAndResolveProfile(showConflictModal);
      } catch (err) {
        console.error('loadAndResolveProfile error:', err);
      }
      try {
        const { syncSettingsFromFirestore } = await import('./services/userService.js');
        await syncSettingsFromFirestore(user.uid);
      } catch (err) {
        console.warn('Settings sync failed:', err);
      }
      // Refresh UI — cloud data may have replaced local
      renderBrowseList();
      renderMyStashList();
      updateStashUI();
    },
    () => {
      authLinks.classList.remove('hidden');
      if (resultCta) resultCta.classList.remove('hidden');
      profileSignoutBtn.classList.add('hidden');
      updateProfileAvatar(null);
    }
  );
}

// === PROFILE AVATAR ===
function getInitials(email) {
  if (!email) return '';
  const local = email.split('@')[0];
  const parts = local.split('.');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

function updateProfileAvatar(user) {
  const btn = document.getElementById('btn-profile');
  const initials = document.getElementById('profile-avatar-initials');
  const wrap = document.getElementById('profile-avatar-wrap');
  const loginLabel = document.getElementById('profile-login-label');
  if (!btn || !initials) return;

  if (user) {
    initials.textContent = getInitials(user.email);
    btn.classList.remove('profile-avatar--signed-out');
    btn.classList.add('profile-avatar--signed-in');
    if (wrap) { wrap.classList.remove('profile-avatar-wrap--signed-out'); wrap.classList.add('profile-avatar-wrap--signed-in'); }
    if (loginLabel) loginLabel.style.display = 'none';
  } else {
    initials.textContent = '';
    btn.classList.add('profile-avatar--signed-out');
    btn.classList.remove('profile-avatar--signed-in');
    if (wrap) { wrap.classList.add('profile-avatar-wrap--signed-out'); wrap.classList.remove('profile-avatar-wrap--signed-in'); }
    if (loginLabel) loginLabel.style.display = '';
  }
}

// === BOOT ===
async function init() {
  loadSavedTheme();
  inject();
  initAgeGate();
  initDisclaimer();
  initHome();
  initStash();
  initCustomForm();
  initSession();
  initResult();
  loadAds();
  initStrainDelta();
  initProfile({ getAllStrains, getStash: getStashStrains });
  setProfileBackHandler(() => showScreen('home'));
  initAccountModal();

  // Handle magic link return — must run after initAccountModal sets up the modal
  try {
    const result = await handleSignInLink();
    if (result === NEEDS_EMAIL_CONFIRMATION) {
      // Opened on a different device — ask for email to complete sign-in
      const modal = document.getElementById('account-modal');
      modal.classList.remove('hidden');
      setAccountState('confirmemail');
    }
    // true = signed in successfully, false = no link in URL — both silent
  } catch (err) {
    console.warn('handleSignInLink error:', err);
  }
}

document.addEventListener('DOMContentLoaded', init);

