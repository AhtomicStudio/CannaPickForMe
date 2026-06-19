import './tokens.css';
import './style.css';
import './profile.css';
import './game.css';
import './pages.css';
// Register globals (evolution-path resolver, mythic traits) so they're
// available app-wide without circular imports inside the game module.
import './game/evolutionPaths.js';
import './game/breeding.js';
import { initCompanion, destroyCompanion, hideCompanionForGameScreen, showCompanionAfterGameScreen, reactToEvent } from './game/companion.js';
import { showToast } from './services/toastService.js';
import { openModal, closeModal, closeTopModal, showConfirm } from './services/modalService.js';
import { initRouter } from './router.js';
import { inject, track } from '@vercel/analytics';
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
import { loadSavedTheme } from './services/themeService.js';
import { shareResult } from './shareCard.js';
import { generateArchetype } from './archetypes.js';
import { initProfile, setProfileBackHandler, renderProfileScreen } from './profile.js';
import {
  getDispensaryMap, getDispensaryNameSync, getDispensaryMenuUrlSync,
} from './services/dispensaryService.js';
import { filterByTags } from './engine/tagFilter.mjs';
import {
  getActiveSponsoredEntries, getActivePartnerStrains, getActiveAdsForPlacement,
  recordImpression, recordClick,
} from './services/sponsorshipService.js';

// === FIREBASE / USER SERVICE (lazy) ===
// userService statically imports firebase.js — lazy-loading this keeps the
// entire Firebase SDK out of the critical-path bundle.
let _userSvcPromise = null;
function getUserService() {
  if (!_userSvcPromise) _userSvcPromise = import('./services/userService.js');
  return _userSvcPromise;
}

// Mirrors userService.currentUser so callers in main.js don't need async access.
// Set/cleared by the initAuth callbacks in init().
let currentUser = null;

// Fire-and-forget sync — replaces direct scheduleSync() calls.
function triggerSync() {
  getUserService().then(({ scheduleSync }) => scheduleSync()).catch(() => {});
}

// === STRAINS DATA ===
let strainsData = null;
let strainsReady = false;

async function loadStrains() {
  try {
    const res = await fetch('/data/strains.json');
    if (!res.ok) throw new Error(`strains fetch failed: ${res.status}`);
    strainsData = await res.json();
  } catch (err) {
    console.error('Failed to load strains:', err);
    strainsData = [];
  }
  strainsReady = true;
  updateStashUI();
}

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

// Dispensary names are now Firestore-backed. We prefetch the map at
// boot (see initStrainDelta) so the synchronous lookups below resolve
// against an in-memory cache, then fall back to the raw slug if the
// dispensary doc hasn't loaded or doesn't exist.
function dispensaryLabel(slug) {
  return getDispensaryNameSync(slug);
}

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
        ${dispensaries.map(d => {
          const url = getDispensaryMenuUrlSync(d);
          const label = dispensaryLabel(d);
          return url
            ? `<a class="strain-pill--dispensary strain-pill--dispensary-link" href="${url}" target="_blank" rel="noopener nofollow" data-dispensary="${d}" data-strain="${strain.id}">📍 ${label} ↗</a>`
            : `<span class="strain-pill--dispensary">📍 ${label}</span>`;
        }).join('')}
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

// Track dispensary "buy" click-outs as Vercel Analytics custom events. These
// links are pure navigation to a partner's menu — they never influence the
// recommendation; tracking exists only for partner reporting.
document.addEventListener('click', (e) => {
  const link = e.target.closest ? e.target.closest('a[data-dispensary]') : null;
  if (!link) return;
  try {
    track('dispensary_click', {
      dispensary: link.getAttribute('data-dispensary') || '',
      strain: link.getAttribute('data-strain') || '',
      placement: link.id === 'result-buy-cta' ? 'result'
        : link.id === 'sponsored-buy-link' ? 'sponsored'
        : 'strain-card',
    });
  } catch (_) { /* analytics is best-effort; never block the click */ }
});

// === STATE ===
let currentScreen = 'age-gate';
let sessionAnswers = {};
let currentQuestionIndex = 0;
let lastShareData = null; // set after each result render
let currentSearchQuery = '';
let currentFilter = 'all';
// Tri-state tag filters: each tag is neutral (absent), 'in' (include) or 'ex' (exclude).
const effectStates = new Map();
const flavorStates = new Map();
let currentSortAlpha = false;
let currentSortAsc = true;
let overrideStrainId = null;
let _searchDebounceTimer = null;

// === SCREEN NAVIGATION ===
export function showScreen(id) {
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
  return applyDelta([...(strainsData ?? []), ...customs], strainDelta);
}

async function initStrainDelta() {
  try {
    const { getStrainDelta } = await import('./services/strainService.js');
    // Fan out: strain delta + dispensary map in parallel. Dispensaries
    // are tiny (≤ ~20 docs) and we want them resolved before the result
    // screen renders so partner card labels resolve synchronously.
    const [delta] = await Promise.all([
      getStrainDelta(),
      getDispensaryMap().catch(() => ({})),
    ]);
    strainDelta = delta;
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
  if (pickBtn) pickBtn.disabled = !strainsReady || count < 2;
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
  document.getElementById('btn-pick').addEventListener('click', async () => {
    const draft = localStorage.getItem('cpfm.session.draft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (Date.now() - parsed.timestamp < 30 * 60 * 1000) {
          const progress = Math.min(
            Object.keys(parsed.answers || {}).length,
            questionsData.length
          );
          const resume = await showConfirm({
            icon: '🌿',
            title: 'Pick up where you left off?',
            message: `You have an unfinished session — ${progress} of ${questionsData.length} questions answered.`,
            confirmLabel: 'Resume',
            cancelLabel: 'Start Fresh',
            tone: 'glow',
          });
          if (resume) {
            sessionAnswers = parsed.answers;
            currentQuestionIndex = parsed.index;
            renderQuestion();
            showScreen('session');
            return;
          }
        }
      } catch (e) {}
    }
    localStorage.removeItem('cpfm.session.draft');
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

  // Profile / Sign-in entry — both the icon AND the "Sign In" text label
  // (and the surrounding wrapper) trigger the same flow. Users were
  // missing the click target when they tapped only the text.
  function handleProfileClick() {
    const user = currentUser;
    if (!user) {
      setAccountState('signedout');
      openModal('account-modal');
      return;
    }
    renderProfileScreen();
    showScreen('profile');
  }
  document.getElementById('btn-profile').addEventListener('click', handleProfileClick);
  // Make the entire avatar wrapper (icon + label + theme hint) clickable.
  const avatarWrap = document.getElementById('profile-avatar-wrap');
  if (avatarWrap) {
    avatarWrap.addEventListener('click', (e) => {
      // If the actual button was clicked, its handler already fires — don't double-fire.
      if (e.target.closest('#btn-profile')) return;
      handleProfileClick();
    });
    // Make the wrapper feel tappable
    avatarWrap.style.cursor = 'pointer';
    avatarWrap.setAttribute('role', 'button');
    avatarWrap.setAttribute('tabindex', '0');
    avatarWrap.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleProfileClick(); }
    });
  }

  // Clear Stash
  document.getElementById('btn-clear-stash').addEventListener('click', async () => {
    const count = getStash().length;
    if (count === 0) return;
    const confirmed = await showConfirm({
      icon: '🗑️',
      title: 'Clear your stash?',
      message: `This will remove all ${count} strain${count > 1 ? 's' : ''} from your stash. Custom strains you added will also be deleted.`,
      confirmLabel: `Clear ${count === 1 ? 'It' : 'All'}`,
      cancelLabel: 'Keep Them',
      tone: 'danger',
    });
    if (confirmed) {
      clearStash();
      triggerSync();
      updateStashUI();
      showToast('Stash cleared.', 'success');
    }
  });

  // CannaGotchi button
  document.getElementById('btn-cannagotchi').addEventListener('click', async () => {
    const user = currentUser;
    if (!user) {
      setAccountState('signedout');
      openModal('account-modal');
      return;
    }
    hideCompanionForGameScreen();
    showScreen('game');
    const { initGameScreen } = await import('./game/gameScreen.js');
    const container = document.getElementById('game-screen');
    await initGameScreen(container, user.uid, async () => {
      showScreen('home');
      showCompanionAfterGameScreen();
      // Re-init companion in case user leveled up / evolved
      try { await initCompanion(user.uid); } catch (e) {}
    });
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
    clearTimeout(_searchDebounceTimer);
    _searchDebounceTimer = setTimeout(() => renderBrowseList(), 180);
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

// ── Tri-state tag filters (manga-reader style): tap a chip to include (＋),
// tap again to exclude (－), tap again to clear. Replaces the old separate
// include/exclude multiselects for Effects and Flavors.
const _triStateRebuild = {}; // optionsId -> rebuild fn, so "Clear" can reset visuals

function updateTriStateBadge(badgeId, stateMap) {
  const badge = document.getElementById(badgeId);
  if (!badge) return;
  badge.textContent = stateMap.size;
  badge.classList.toggle('hidden', stateMap.size === 0);
}

function renderTriStateOptions(optionsId, items, stateMap, query = '') {
  const el = document.getElementById(optionsId);
  if (!el) return;
  const q = query.trim().toLowerCase();
  const list = q ? items.filter(i => i.toLowerCase().includes(q)) : items;
  el.innerHTML = list.map(item => {
    const state = stateMap.get(item) || 'neutral';
    const mark = state === 'in' ? '＋' : state === 'ex' ? '－' : '';
    return `<button type="button" class="ms-chip ms-chip--${state}" data-val="${item}" aria-pressed="${state !== 'neutral'}">`
      + (mark ? `<span class="ms-chip__mark">${mark}</span>` : '') + `${item}</button>`;
  }).join('');
}

function setupTriState({ btnId, panelId, searchId, optionsId, badgeId, wrapId, items, stateMap, onchange }) {
  const btn = document.getElementById(btnId);
  const panel = document.getElementById(panelId);
  const searchInput = document.getElementById(searchId);
  const optionsEl = document.getElementById(optionsId);
  if (!btn || !panel || !optionsEl) return;

  const rebuild = () => renderTriStateOptions(optionsId, items, stateMap, searchInput ? searchInput.value : '');
  _triStateRebuild[optionsId] = rebuild;
  rebuild();

  // Cycle a chip's state: neutral -> include -> exclude -> neutral.
  optionsEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.ms-chip');
    if (!chip) return;
    const val = chip.getAttribute('data-val');
    const cur = stateMap.get(val) || 'neutral';
    const next = cur === 'neutral' ? 'in' : cur === 'in' ? 'ex' : 'neutral';
    if (next === 'neutral') stateMap.delete(val); else stateMap.set(val, next);
    rebuild();
    updateTriStateBadge(badgeId, stateMap);
    onchange();
  });

  if (searchInput) searchInput.addEventListener('input', rebuild);

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !panel.classList.contains('hidden');
    document.querySelectorAll('.ms-panel').forEach(p => p.classList.add('hidden'));
    if (!isOpen) { panel.classList.remove('hidden'); if (searchInput) searchInput.focus(); }
  });

  document.addEventListener('click', (e) => {
    const wrap = document.getElementById(wrapId);
    if (wrap && !wrap.contains(e.target)) panel.classList.add('hidden');
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
  const active = effectStates.size > 0 || flavorStates.size > 0;
  document.getElementById('btn-clear-filters')?.classList.toggle('hidden', !active);
}

function clearAllFilters() {
  effectStates.clear();
  flavorStates.clear();
  Object.values(_triStateRebuild).forEach(fn => fn());
  updateTriStateBadge('ms-effect-badge', effectStates);
  updateTriStateBadge('ms-flavor-badge', flavorStates);
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

  setupTriState({
    wrapId: 'ms-effect', btnId: 'ms-effect-btn', panelId: 'ms-effect-panel',
    searchId: 'ms-effect-search', optionsId: 'ms-effect-options', badgeId: 'ms-effect-badge',
    items: effects, stateMap: effectStates,
    onchange: () => { updateClearBtn(); renderBrowseList(); },
  });

  setupTriState({
    wrapId: 'ms-flavor', btnId: 'ms-flavor-btn', panelId: 'ms-flavor-panel',
    searchId: 'ms-flavor-search', optionsId: 'ms-flavor-options', badgeId: 'ms-flavor-badge',
    items: flavors, stateMap: flavorStates,
    onchange: () => { updateClearBtn(); renderBrowseList(); },
  });

  document.getElementById('btn-clear-filters')?.addEventListener('click', clearAllFilters);
  document.getElementById('btn-clear-filters-empty')?.addEventListener('click', clearAllFilters);

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
  strains = filterByTags(strains, effectStates, flavorStates);
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

  const emptyState = document.getElementById('filter-empty-state');
  if (strains.length === 0) {
    list.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
  } else {
    list.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
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
        reactToEvent('stash-add');
      }
      triggerSync();
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
      triggerSync();
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

  const modal = document.getElementById('custom-modal');
  // Chip toggle
  modal.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('chip--selected'));
  });

  // Cancel (listener attached once — modalService handles backdrop + ESC)
  const cancelBtn = document.getElementById('custom-cancel');
  if (!cancelBtn.dataset.bound) {
    cancelBtn.addEventListener('click', () => {
      closeModal('custom-modal');
      document.getElementById('custom-strain-form').reset();
    });
    cancelBtn.dataset.bound = 'true';
  }

  openModal('custom-modal');
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
      showToast('Please select at least one effect.', 'error');
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
    triggerSync();
    reactToEvent('stash-add');
    closeModal('custom-modal');
    document.getElementById('custom-strain-form').reset();
    renderBrowseList();
    renderMyStashList();
    updateStashUI();
  });
}

// === EFFECT OVERRIDE MODAL ===
function openOverrideModal(strainId) {
  overrideStrainId = strainId;
  const strain = getAllStrains().find(s => s.id === strainId);
  if (!strain) return;

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
      showToast('Select at least one effect.', 'error');
      return;
    }
    setEffectOverride(strainId, selected);
    triggerSync();
    closeModal('override-modal');
    renderBrowseList();
  };

  // Reset
  document.getElementById('override-reset').onclick = () => {
    clearEffectOverride(strainId);
    triggerSync();
    closeModal('override-modal');
    renderBrowseList();
  };

  openModal('override-modal');
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

      localStorage.setItem('cpfm.session.draft', JSON.stringify({
        answers: sessionAnswers,
        index: currentQuestionIndex + 1,
        timestamp: Date.now()
      }));

      setTimeout(() => {
        document.activeElement?.blur();
        currentQuestionIndex++;
        if (currentQuestionIndex >= questionsData.length) {
          localStorage.removeItem('cpfm.session.draft');
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
      localStorage.setItem('cpfm.session.draft', JSON.stringify({
        answers: sessionAnswers,
        index: currentQuestionIndex,
        timestamp: Date.now()
      }));
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
        strainName:  result.pickedStrain.name,
        winnerName:  result.allScores[0]?.strainName ?? result.pickedStrain.name,
        allScores:   result.allScores,
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
    reactToEvent('result-revealed');

    // Scroll the result card into view on shorter viewports
    const resultCard = document.querySelector('.result__card');
    if (resultCard) {
      requestAnimationFrame(() => resultCard.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    }

    // Award the user's Cannabud for completing a pick session.
    // Lazy-imported so the game module only loads when needed.
    const user = currentUser;
    if (user) {
      import('./game/gameScreen.js').then(mod => {
        try { mod.grantSessionXP?.(result?.strain || null, user.uid); }
        catch (e) { console.warn('[cannagotchi] pick reward failed', e); }
      }).catch(() => {});
    }
  }, WEIGH_DURATION);
}

async function renderSponsoredStrain(allScores) {
  const card = document.getElementById('sponsored-strain-card');
  if (!card) return;

  // Score threshold below which we don't promote a sponsored strain.
  // This used to live in strainDelta.sponsorSettings; with campaigns
  // taking over, threshold is a global UX guardrail rather than a
  // per-sponsor knob. Honest match scores protect user trust; if no
  // sponsored strain is a good fit, the card stays hidden.
  const THRESHOLD = 50;

  let entries = [];
  try {
    entries = await getActiveSponsoredEntries();
  } catch (err) {
    console.warn('Failed to load sponsored entries:', err);
  }

  if (!entries.length) { card.classList.add('hidden'); return; }

  // For each sponsored strainId, find its match score in allScores and
  // keep the best-scoring one. We also remember which campaign it came
  // from so the impression bumps the right counter.
  const scoreById = new Map(allScores.map(s => [s.strainId, s.score]));
  let best = null;
  for (const e of entries) {
    const score = scoreById.get(e.strainId);
    if (score == null) continue;
    if (!best || score > best.score) best = { ...e, score };
  }

  if (!best || best.score < THRESHOLD) { card.classList.add('hidden'); return; }

  const strain = getAllStrains().find(s => s.id === best.strainId);
  if (!strain) { card.classList.add('hidden'); return; }

  document.getElementById('sponsored-strain-name').textContent = strain.name;
  document.getElementById('sponsored-strain-type').textContent =
    strain.type.charAt(0).toUpperCase() + strain.type.slice(1);
  document.getElementById('sponsored-match-score').textContent = `${Math.min(100, best.score)}% match`;

  const dot = document.getElementById('sponsored-type-dot');
  dot.setAttribute('data-type', strain.type);

  // Sponsored cards stay honest — the match score is real and never altered by
  // payment. If the sponsored strain is in stock at a partner dispensary with a
  // menu URL, surface a tracked "Buy" link to it (clicks bump the campaign).
  const buyLink = document.getElementById('sponsored-buy-link');
  if (buyLink) {
    let url = null, dispSlug = null;
    // Prefer the sponsoring advertiser's dispensary (attribution); otherwise
    // fall back to wherever the strain is in stock.
    if (best.dispensaryId) {
      const u = getDispensaryMenuUrlSync(best.dispensaryId);
      if (u) { url = u; dispSlug = best.dispensaryId; }
    }
    if (!url) {
      const disps = getStrainDispensaries(strain.id) || [];
      for (const d of disps) {
        const u = getDispensaryMenuUrlSync(d);
        if (u) { url = u; dispSlug = d; break; }
      }
    }
    if (url) {
      buyLink.href = url;
      buyLink.setAttribute('data-dispensary', dispSlug);
      buyLink.setAttribute('data-strain', strain.id);
      buyLink.onclick = () => recordClick('sponsored', { campaignId: best.campaignId });
      buyLink.classList.remove('hidden');
    } else {
      buyLink.removeAttribute('data-dispensary');
      buyLink.onclick = null;
      buyLink.classList.add('hidden');
    }
  }

  card.classList.remove('hidden');

  // Bump the campaign impression counter. Fire-and-forget; if the write
  // fails (rules, offline, etc.) the user sees the card regardless.
  recordImpression('sponsored', { campaignId: best.campaignId });
}

/**
 * Re-open the result screen for a strain from the user's history. Doesn't
 * record a new session entry, fire analytics, or change any state — it
 * just paints the result card so the user can re-share it.
 */
function showResultFromHistory(strain, session) {
  if (!strain) return;
  document.getElementById('weighing-phase')?.classList.add('hidden');
  document.getElementById('reveal-phase')?.classList.remove('hidden');

  document.getElementById('result-strain-name').textContent = strain.name;
  const typeEl = document.getElementById('result-strain-type');
  typeEl.textContent = strain.type.charAt(0).toUpperCase() + strain.type.slice(1);
  typeEl.setAttribute('data-type', strain.type);

  const score = session?.matchScore;
  const scoreEl = document.getElementById('result-match-score');
  if (scoreEl) {
    scoreEl.innerHTML = score != null ? `${score}<span>% match</span>` : `<span style="font-size:0.85rem;color:var(--text-muted)">From your history</span>`;
  }
  const reasonEl = document.getElementById('result-reasoning');
  if (reasonEl) reasonEl.textContent = strain.description || '';

  renderBuyCta(strain);

  showScreen('session');
}

// Show a tracked "Buy at <dispensary>" CTA on the result when the picked strain
// is in stock at a partner dispensary that has a menu URL. Entirely separate
// from the honest match — it never changes the pick, only links out to buy.
function renderBuyCta(pickedStrain) {
  const cta = document.getElementById('result-buy-cta');
  if (!cta) return;
  let slug = null, url = null;
  const disps = getStrainDispensaries(pickedStrain.id) || [];
  for (const d of disps) {
    const u = getDispensaryMenuUrlSync(d);
    if (u) { slug = d; url = u; break; }
  }
  if (!url) { cta.classList.add('hidden'); return; }
  cta.href = url;
  cta.setAttribute('data-dispensary', slug);
  cta.setAttribute('data-strain', pickedStrain.id);
  cta.textContent = `📍 In stock at ${getDispensaryNameSync(slug)} — Buy ↗`;
  cta.classList.remove('hidden');
}

async function renderResult(result) {
  const { pickedStrain, matchScore, isPerfectMatch, reasoning } = result;

  // Fetch live partner strains once for this result render. The first
  // active one (if any) occupies slot 4 in the better-match modal.
  // We do this BEFORE deciding maxOrganic below so the modal layout is
  // consistent.
  let activePartner = null;
  try {
    const partners = await getActivePartnerStrains();
    activePartner = partners[0] || null;
  } catch (err) {
    console.warn('Failed to load partner strains:', err);
  }

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
  triggerSync();

  // ── Archetype ───────────────────────────────────────────────────────────
  const archetype = generateArchetype(sessionAnswers);
  const archetypeNameEl     = document.getElementById('result-archetype-name');
  const archetypeSubtitleEl = document.getElementById('result-archetype-subtitle');
  if (archetypeNameEl)     archetypeNameEl.textContent     = archetype.name;
  if (archetypeSubtitleEl) archetypeSubtitleEl.textContent = archetype.subtitle;

  document.getElementById('result-strain-name').textContent = pickedStrain.name;

  const typeEl = document.getElementById('result-strain-type');
  typeEl.textContent = pickedStrain.type.charAt(0).toUpperCase() + pickedStrain.type.slice(1);
  typeEl.setAttribute('data-type', pickedStrain.type);

  // Count-up animation for match score
  const scoreEl = document.getElementById('result-match-score');
  scoreEl.innerHTML = `0<span>% match</span>`;
  const startTime = performance.now();
  const duration = 800;
  function animateScore(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out curve for the counting
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.min(100, Math.round(eased * matchScore));
    scoreEl.innerHTML = `${current}<span>% match</span>`;
    if (progress < 1) requestAnimationFrame(animateScore);
  }
  requestAnimationFrame(animateScore);
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
        // If a partner is active, it occupies one slot in the modal (slot 4)
        const maxOrganic = activePartner ? 4 : 5; // 4 organic + 1 partner = 5 max
        // Find strains that have a strictly higher score than the current best stash match
        topGlobalStrains = globalResult.allScores.filter(s => s.score > matchScore).slice(0, maxOrganic);

        if (topGlobalStrains.length > 0) {
          betterMatchContainer.classList.remove('hidden');
        }
      }
    }

    if (btnBetterMatch) {
      btnBetterMatch.onclick = () => {
        showBetterMatchesModal(topGlobalStrains, activePartner);
      };
    }
  }

  renderBuyCta(pickedStrain);
  renderSponsoredStrain(result.allScores);

  lastShareData = {
    strainName: pickedStrain.name,
    strainType: pickedStrain.type,
    strainId:   pickedStrain.id,
    matchScore,
    sessionAnswers: { ...sessionAnswers },
    archetype,
  };
}

function showBetterMatchesModal(matchesData, partner = null) {
  const modal = document.getElementById('better-match-modal');
  const list = document.getElementById('better-match-list');
  const allStrains = getAllStrains();

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
            <span class="bm-score-badge">${Math.min(100, match.score)}% match</span>
          </div>
          <div class="strain-card__meta">${type} · ${effects}</div>
          <button class="btn-juicy compact bm-stash-btn${isInStash(strain.id) ? ' btn--in-stash' : ''}" data-strain-id="${strain.id}">
            ${isInStash(strain.id) ? '✓ In Stash' : '＋ Stash'}
          </button>
        </div>
        ${buildExpandBody(strain)}
      </div>` };
  });

  // Partner card HTML
  const partnerCardHtml = partner ? (() => {
    const type = (partner.strainType || 'hybrid').charAt(0).toUpperCase() + (partner.strainType || 'hybrid').slice(1);
    const effects = (partner.effects || []).slice(0, 3).join(', ');
    const dispName = partner.dispensaryId ? dispensaryLabel(partner.dispensaryId) : null;
    const clickAttr = partner.clickUrl ? `href="${partner.clickUrl}" target="_blank" rel="noopener"` : '';
    const tag = partner.clickUrl ? 'a' : 'div';
    return `
      <${tag} ${clickAttr} class="partner-strain-card" data-partner-campaign="${partner.campaignId || ''}">
        <div class="partner-strain-card__header">
          <span class="partner-strain-card__badge">✦ Partnered Strain</span>
          <span class="partner-strain-card__brand">${partner.brandName || ''}</span>
        </div>
        <div class="partner-strain-card__body">
          <div class="strain-card__type-dot" data-type="${partner.strainType || 'hybrid'}"></div>
          <div class="partner-strain-card__info">
            <div class="partner-strain-card__name">${partner.strainName || ''}</div>
            <div class="partner-strain-card__meta">${type}${effects ? ' · ' + effects : ''}</div>
            ${dispName ? `<div class="partner-strain-card__disp">📍 ${dispName}</div>` : ''}
          </div>
          ${partner.clickUrl ? '<span class="partner-strain-card__cta">View →</span>' : ''}
        </div>
      </${tag}>`;
  })() : '';

  // Partner replaces slot 4 (index 3); if fewer than 4 organic, appends after
  const slots = organicCards.map(c => c.html);
  if (partnerCardHtml) slots.splice(3, 0, partnerCardHtml);
  list.innerHTML = slots.join('');

  // Wire stash toggle buttons on organic strain cards.
  list.querySelectorAll('.bm-stash-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // prevent expand/collapse from triggering
      const id = btn.dataset.strainId;
      if (isInStash(id)) {
        removeFromStash(id);
        btn.textContent = '＋ Stash';
        btn.classList.remove('btn--in-stash');
      } else {
        addToStash(id);
        btn.textContent = '✓ In Stash';
        btn.classList.add('btn--in-stash');
      }
      updateStashUI();
    });
  });

  // Wire tap-to-expand on organic strain cards.
  list.querySelectorAll('.strain-card__info').forEach(info => {
    info.addEventListener('click', () => {
      const card = info.closest('.strain-card');
      const isExpanded = card.classList.contains('strain-card--expanded');
      list.querySelectorAll('.strain-card--expanded').forEach(c => c.classList.remove('strain-card--expanded'));
      if (!isExpanded) card.classList.add('strain-card--expanded');
    });
  });

  // Wire impression + click tracking on the partner card (if present).
  // The card lives inside #better-match-list which is rebuilt every time
  // we open the modal, so no listener cleanup is needed.
  if (partner) {
    recordImpression('partner', { campaignId: partner.campaignId });
    const partnerEl = list.querySelector('.partner-strain-card');
    if (partnerEl && partner.clickUrl) {
      partnerEl.addEventListener('click', () => {
        recordClick('partner', { campaignId: partner.campaignId });
      }, { once: true });
    }
  }

  const closeBtn = document.getElementById('better-match-close');
  if (closeBtn) closeBtn.onclick = () => closeModal('better-match-modal');

  openModal('better-match-modal');
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
      btn.innerHTML = '✓ Shared!';
      setTimeout(() => { btn.innerHTML = original; btn.disabled = false; }, 2000);
      return;
    } catch {
      // fallback: plain text share
      try {
        const archetypeName = lastShareData.archetype?.name || 'a CannaPickForMe type';
        const text = `🌿 I'm ${archetypeName} — ${lastShareData.strainName} is my ${lastShareData.matchScore}% match. Find yours at cannapickforme.com`;
        await navigator.clipboard.writeText(text);
        btn.innerHTML = '✓ Copied to clipboard!';
        setTimeout(() => { btn.innerHTML = original; btn.disabled = false; }, 2000);
        return;
      } catch { 
        btn.innerHTML = 'Share failed';
        setTimeout(() => { btn.innerHTML = original; btn.disabled = false; }, 2000);
        return;
      }
    }
  });
}

// === ADS ===
//
// Ads flow through the sponsorshipService aggregator (which filters to
// the ads belonging to a currently-live campaign), then we render the
// single highest-priority ad per placement.
//
// Tracking is fire-and-forget: impressions bump on render, clicks bump
// on the anchor click. Failures are silent (counters that don't tick are
// strictly better than ads that don't render).

function renderAdSlot(containerId, ads) {
  const container = document.getElementById(containerId);
  if (!container || !ads || ads.length === 0) return;

  // Show the first (highest priority) ad
  const ad = ads[0];
  const displayType = ad.displayType || 'card';
  const posX = Math.max(0, Math.min(100, Number(ad.imagePosition?.x) || 50));
  const posY = Math.max(0, Math.min(100, Number(ad.imagePosition?.y) || 50));
  const imgPos = `object-position: ${posX}% ${posY}%`;
  const campaignAttr = ad.campaignId ? `data-campaign-id="${ad.campaignId}"` : '';

  if (displayType === 'banner') {
    container.innerHTML = `
      <a href="${ad.clickUrl}" target="_blank" rel="noopener noreferrer" class="ad-banner" title="${ad.title || 'Sponsored'}" data-ad-id="${ad.id}" ${campaignAttr}>
        <img src="${ad.imageUrl}" alt="${ad.title || 'Ad'}" class="ad-banner__image" style="${imgPos}" />
        <div class="ad-banner__footer">
          <span class="ad-banner__label">✦ Sponsored</span>
        </div>
      </a>
    `;
  } else {
    // Card style (default)
    container.innerHTML = `
      <a href="${ad.clickUrl}" target="_blank" rel="noopener noreferrer" class="ad-card" title="${ad.title || 'Sponsored'}" data-ad-id="${ad.id}" ${campaignAttr}>
        <span class="ad-card__sponsored">Sponsored</span>
        <img src="${ad.imageUrl}" alt="${ad.title || 'Ad'}" class="ad-card__image" style="${imgPos}" />
        <div class="ad-card__info">
          <div class="ad-card__title">${ad.title || ''}</div>
          ${ad.description ? `<div class="ad-card__description">${ad.description}</div>` : ''}
        </div>
      </a>
    `;
  }

  // Impression on render.
  recordImpression('ad', { adId: ad.id, campaignId: ad.campaignId });

  // Click handler — once because the anchor reloads on navigation and
  // the container is regenerated next page load anyway.
  const anchor = container.querySelector('a[data-ad-id]');
  if (anchor) {
    anchor.addEventListener('click', () => {
      recordClick('ad', { adId: ad.id, campaignId: ad.campaignId });
    }, { once: true });
  }
}

async function loadAds() {
  try {
    const [homeAds, resultAds] = await Promise.all([
      getActiveAdsForPlacement('home'),
      getActiveAdsForPlacement('result'),
    ]);
    renderAdSlot('ad-slot-home', homeAds);
    renderAdSlot('ad-slot-result', resultAds);
  } catch {
    // No ads configured — that's fine.
  }
}

// === ACCOUNT MODAL ===

function setAccountState(state) {
  ['signedout', 'signedin', 'linksent', 'confirmemail', 'code'].forEach(s =>
    document.getElementById(`account-state-${s}`)?.classList.toggle('hidden', s !== state)
  );
}

/**
 * Request an OTP code for the given email and transition to the code-entry state.
 * Used both by the "Get a code instead" link and the "Resend" link.
 */
async function requestCodeAndShowEntry(email, errorEl) {
  errorEl?.classList.add('hidden');
  try {
    const { requestSignInCode } = await getUserService();
    await requestSignInCode(email);
    document.getElementById('account-code-email').textContent = email;
    document.getElementById('account-code-input').value = '';
    setAccountState('code');
    setTimeout(() => document.getElementById('account-code-input')?.focus(), 50);
  } catch (err) {
    const msg = err?.message || 'Could not send the code. Please try again.';
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.classList.remove('hidden');
    } else {
      alert(msg);
    }
    console.error('requestSignInCode error:', err);
  }
}

function showConflictModal(localTs, cloudTs) {
  return new Promise((resolve) => {
    document.getElementById('conflict-local-time').textContent =
      localTs > 0 ? new Date(localTs).toLocaleString() : 'No sync history on this device';
    document.getElementById('conflict-cloud-time').textContent =
      cloudTs > 0 ? new Date(cloudTs).toLocaleString() : 'No cloud data';

    document.getElementById('conflict-keep-local').onclick = () => {
      closeModal('conflict-modal');
      resolve('local');
    };
    document.getElementById('conflict-use-cloud').onclick = () => {
      closeModal('conflict-modal');
      resolve('cloud');
    };

    // Forcing a choice — no backdrop dismiss.
    openModal('conflict-modal', { preventBackdropClose: true });
  });
}

function initAccountModal() {
  const authLinks = document.getElementById('auth-links');

  // Open modal on log in / sign up link click
  function openAccountModal() {
    const user = currentUser;
    setAccountState(user ? 'signedin' : 'signedout');
    if (user) {
      document.getElementById('account-user-email').textContent = user.email;
    }
    openModal('account-modal');
  }
  authLinks.addEventListener('click', (e) => { e.preventDefault(); openAccountModal(); });
  document.getElementById('result-signup-btn').addEventListener('click', (e) => { e.preventDefault(); openAccountModal(); });

  // Cancel button (backdrop + ESC handled by modalService)
  document.getElementById('account-cancel-btn').addEventListener('click', () => closeModal('account-modal'));

  // Google sign-in
  document.getElementById('account-google-btn').addEventListener('click', async () => {
    const btn = document.getElementById('account-google-btn');
    const errorEl = document.getElementById('account-google-error');
    errorEl.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      const { signInWithGoogle } = await getUserService();
      await signInWithGoogle();
      closeModal('account-modal');
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
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/><path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962l3.007 1.332C4.672 4.167 6.656 3.58 9 3.58z" fill="#EA4335"/></svg> Continue with Google`;
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
      const { sendSignInLink } = await getUserService();
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

  // OTP — switch from "link sent" view to code entry. Sends a fresh code.
  document.getElementById('account-use-code-link').addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('account-linksent-email').textContent.trim();
    if (!email) return;
    await requestCodeAndShowEntry(email, document.getElementById('account-code-error'));
  });

  // OTP — submit code
  document.getElementById('account-code-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('account-code-input').value.trim();
    const errEl = document.getElementById('account-code-error');
    const btn = document.getElementById('account-code-btn');
    if (!/^\d{6}$/.test(code)) {
      errEl.textContent = 'Please enter the 6-digit code from your email.';
      errEl.classList.remove('hidden');
      return;
    }
    errEl.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Verifying…';
    try {
      const { verifySignInCode } = await getUserService();
      await verifySignInCode(code);
      closeModal('account-modal');
    } catch (err) {
      const msg = err?.message || 'Incorrect or expired code.';
      errEl.textContent = msg;
      errEl.classList.remove('hidden');
      console.error('verifySignInCode error:', err);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });

  // OTP — resend
  document.getElementById('account-resend-code-link').addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('account-code-email').textContent.trim();
    if (!email) return;
    await requestCodeAndShowEntry(email, document.getElementById('account-code-error'));
  });

  // OTP — back to "link sent" view
  document.getElementById('account-code-back').addEventListener('click', () => {
    setAccountState('linksent');
  });

  // Magic link — cross-device email confirm
  document.getElementById('account-confirm-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('account-confirm-input').value.trim();
    const errEl = document.getElementById('account-confirm-error');
    if (!email) return;
    errEl.classList.add('hidden');
    try {
      const { completeSignInWithEmail } = await getUserService();
      await completeSignInWithEmail(email);
      closeModal('account-modal');
    } catch (err) {
      errEl.textContent = 'Sign-in failed. Make sure this is the same email you used.';
      errEl.classList.remove('hidden');
      console.error('completeSignInWithEmail error:', err);
    }
  });

  // Sign out
  document.getElementById('account-signout-btn').addEventListener('click', async () => {
    const { signOutUser } = await getUserService();
    await signOutUser();
    closeModal('account-modal');
  });

  // Delete account
  document.getElementById('account-delete-btn').addEventListener('click', async () => {
    const confirmed = await showConfirm({
      icon: '⚠️',
      title: 'Delete your account?',
      message: 'This deletes your cloud data permanently. Your local data stays on this device.',
      confirmLabel: 'Delete Account',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      const { deleteAccount } = await getUserService();
      await deleteAccount();
      closeModal('account-modal');
      showToast('Account deleted. Your local data is still on this device.', 'success');
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') {
        showToast('For security, please sign out and sign back in before deleting your account.', 'error');
      } else {
        showToast('Something went wrong. Please try again.', 'error');
        console.error('deleteAccount error:', err);
      }
    }
  });

  // Profile screen sign-out button
  const profileSignoutBtn = document.getElementById('profile-signout-btn');
  profileSignoutBtn.addEventListener('click', async () => {
    const { signOutUser } = await getUserService();
    await signOutUser();
    showScreen('home');
  });

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

// Remembered identity for instant pre-paint on app launch — eliminates the
// "Sign In" flash that fired before Firebase hydrated its IndexedDB session.
const REMEMBER_KEY = 'cpfm_last_user_email';
function rememberLastUser(user) {
  try {
    if (user?.email) localStorage.setItem(REMEMBER_KEY, user.email);
    else             localStorage.removeItem(REMEMBER_KEY);
  } catch (_) {}
}
function getRememberedUserEmail() {
  try { return localStorage.getItem(REMEMBER_KEY) || null; }
  catch (_) { return null; }
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
    rememberLastUser(user);
  } else {
    initials.textContent = '';
    btn.classList.add('profile-avatar--signed-out');
    btn.classList.remove('profile-avatar--signed-in');
    if (wrap) { wrap.classList.add('profile-avatar-wrap--signed-out'); wrap.classList.remove('profile-avatar-wrap--signed-in'); }
    if (loginLabel) loginLabel.style.display = '';
    rememberLastUser(null);
  }
}

/**
 * Pre-paint the avatar as signed-in on page load BEFORE Firebase Auth hydrates
 * the cached session. Eliminates the "logged out" flash for returning users.
 * Firebase's onAuthStateChanged will overwrite this in ~100-1500ms — if we
 * had a stale cache, the UI flips to signed-out at that point. The key UX
 * win: returning users never see "Sign In" if they're actually signed in.
 */
function prePaintRememberedAvatar() {
  const email = getRememberedUserEmail();
  if (!email) return;
  // Build a fake "user" shape for updateProfileAvatar; only `email` is used.
  updateProfileAvatar({ email });
  // Also unlock the Cannagotchi button so it doesn't flicker locked → unlocked.
  const gotchiBtn = document.getElementById('btn-cannagotchi');
  if (gotchiBtn) {
    gotchiBtn.disabled = false;
    gotchiBtn.classList.remove('btn--game-locked');
    gotchiBtn.classList.add('btn--game-unlocked');
  }
}

// === GLOBAL MODAL ESCAPE ===
// One listener closes whichever ad-hoc modal is currently visible.
// Escape only dismisses one layer at a time.
function initModalEscape() {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (closeTopModal()) {
      e.stopPropagation();
    }
  });
}

// === BOOT ===
async function init() {
  loadStrains(); // start fetch immediately — no await, button stays disabled until ready
  loadSavedTheme();
  inject();
  // Pre-paint as signed-in if we have a remembered email — kills the flash of
  // "Sign In" while Firebase Auth hydrates its session from IndexedDB.
  prePaintRememberedAvatar();
  initAgeGate();
  initDisclaimer();
  initHome();
  initStash();
  initCustomForm();
  initSession();
  initResult();
  loadAds();
  initStrainDelta();
  initProfile({
    getAllStrains,
    getStash: getStashStrains,
    onPickRowClick: ({ strain, session }) => showResultFromHistory(strain, session),
  });
  setProfileBackHandler(() => showScreen('home'));
  initAccountModal();
  initModalEscape();
  initRouter();

  // Load Firebase / userService after synchronous UI setup — keeps it off
  // the critical path. handleSignInLink needs it to detect magic-link URLs.
  const userSvc = await getUserService();

  // Handle magic link return — must run after initAccountModal sets up the modal
  try {
    const result = await userSvc.handleSignInLink();
    if (result === userSvc.NEEDS_EMAIL_CONFIRMATION) {
      setAccountState('confirmemail');
      openModal('account-modal');
    }
  } catch (err) {
    console.warn('handleSignInLink error:', err);
  }

  // Auth state observer — updates avatar and syncs profile on sign-in.
  const authLinks = document.getElementById('auth-links');
  const resultCta = document.getElementById('result-signup-cta');
  const profileSignoutBtn = document.getElementById('profile-signout-btn');

  userSvc.initAuth(
    async (user) => {
      currentUser = user;
      authLinks.classList.add('hidden');
      if (resultCta) resultCta.classList.add('hidden');
      profileSignoutBtn.classList.remove('hidden');
      updateProfileAvatar(user);
      closeModal('account-modal');
      const gotchiBtn = document.getElementById('btn-cannagotchi');
      if (gotchiBtn) { gotchiBtn.disabled = false; gotchiBtn.classList.remove('btn--game-locked'); gotchiBtn.classList.add('btn--game-unlocked'); }
      try {
        await userSvc.loadAndResolveProfile(showConflictModal);
      } catch (err) {
        console.error('loadAndResolveProfile error:', err);
      }
      try {
        const { syncSettingsFromFirestore } = await getUserService();
        await syncSettingsFromFirestore(user.uid);
      } catch (err) {
        console.warn('Settings sync failed:', err);
      }
      try { await initCompanion(user.uid); } catch (e) { console.warn('companion init failed', e); }
      renderBrowseList();
      renderMyStashList();
      updateStashUI();
    },
    () => {
      currentUser = null;
      authLinks.classList.remove('hidden');
      if (resultCta) resultCta.classList.remove('hidden');
      profileSignoutBtn.classList.add('hidden');
      updateProfileAvatar(null);
      const gotchiBtn = document.getElementById('btn-cannagotchi');
      if (gotchiBtn) { gotchiBtn.disabled = true; gotchiBtn.classList.add('btn--game-locked'); gotchiBtn.classList.remove('btn--game-unlocked'); }
      destroyCompanion();
    }
  );
}

document.addEventListener('DOMContentLoaded', init);
