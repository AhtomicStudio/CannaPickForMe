import './style.css';
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
  isAgeVerified, setAgeVerified, applyOverrides
} from './storage/store.js';

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
};

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
        ${dispensaries.map(d => `<span class="strain-pill--dispensary">📍 Available at ${DISPENSARY_NAMES[d] || d}</span>`).join('')}
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
let currentSearchQuery = '';
let currentFilter = 'all';
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

  // Filters
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('filter-chip--active'));
      chip.classList.add('filter-chip--active');
      currentFilter = chip.dataset.filter;
      renderBrowseList();
    });
  });

  // Add custom
  document.getElementById('btn-add-custom').addEventListener('click', openCustomModal);

  // Done button
  document.getElementById('btn-stash-done').addEventListener('click', () => {
    showScreen('home');
    updateStashUI();
  });
}

function renderBrowseList() {
  const list = document.getElementById('strain-list');
  let strains = getAllStrains();

  // Filter by type
  if (currentFilter !== 'all') {
    strains = strains.filter(s => s.type === currentFilter);
  }

  // Filter by search
  if (currentSearchQuery) {
    strains = strains.filter(s =>
      s.name.toLowerCase().includes(currentSearchQuery) ||
      (s.effects || []).some(e => e.toLowerCase().includes(currentSearchQuery)) ||
      (s.flavors || []).some(f => f.toLowerCase().includes(currentSearchQuery))
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
        ${buildExpandBody(applyOverrides(strain))}
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
        ${buildExpandBody(strain)}
      </div>
    `;
  }).join('');

  list.querySelectorAll('[data-action="remove"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromStash(btn.dataset.id);
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
    modal.classList.add('hidden');
    renderBrowseList();
  };

  // Reset
  document.getElementById('override-reset').onclick = () => {
    clearEffectOverride(strainId);
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

function renderResult(result) {
  const { pickedStrain, matchScore, isPerfectMatch, reasoning } = result;

  track('strain_picked', {
    strain: pickedStrain.name,
    type: pickedStrain.type,
    match_score: matchScore,
    is_perfect_match: isPerfectMatch ?? false,
  });

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

  // 25% chance for sparkles around the SMOKE text
  if (Math.random() < 0.25) {
    addSparkles(smokeTextEl);
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
        topGlobalStrains = globalResult.allScores.filter(s => s.score > matchScore).slice(0, 3);
        
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
}

function showBetterMatchesModal(matchesData) {
  const modal = document.getElementById('better-match-modal');
  const list = document.getElementById('better-match-list');
  const allStrains = getAllStrains();

  list.innerHTML = matchesData.map(match => {
    const strain = allStrains.find(s => s.id === match.strainId);
    if (!strain) return '';
    const effects = (strain.effectOverrides || strain.effects || []).slice(0, 3).join(', ');
    const type = strain.type.charAt(0).toUpperCase() + strain.type.slice(1);
    
    return `
      <div class="strain-card">
        <div class="strain-card__type-dot" data-type="${strain.type}"></div>
        <div class="strain-card__info">
          <div class="strain-card__name" style="display: flex; justify-content: space-between; align-items: center;">
            ${strain.name}
            <span style="font-size: 0.8rem; color: #4ade80; padding: 2px 6px; background: rgba(74, 222, 128, 0.1); border-radius: 4px;">
              ${match.score}% match
            </span>
          </div>
          <div class="strain-card__meta">${type} · ${effects}</div>
        </div>
      </div>
    `;
  }).join('');

  modal.classList.remove('hidden');

  const closeBtn = document.getElementById('better-match-close');
  if (closeBtn) {
    closeBtn.onclick = () => modal.classList.add('hidden');
  }
  
  const backdrop = modal.querySelector('.modal__backdrop');
  if (backdrop) {
    backdrop.onclick = () => modal.classList.add('hidden');
  }
}

function addSparkles(targetEl) {
  if (!targetEl) return;
  const container = targetEl.parentElement;
  if (!container) return;
  container.style.position = 'relative';

  const sparkleCount = 12;
  for (let i = 0; i < sparkleCount; i++) {
    const sparkle = document.createElement('span');
    sparkle.className = 'sparkle';
    sparkle.textContent = '✦';

    // Random position around the SMOKE text
    const angle = (i / sparkleCount) * 360;
    const radius = 40 + Math.random() * 50;
    const x = Math.cos(angle * Math.PI / 180) * radius;
    const y = Math.sin(angle * Math.PI / 180) * radius;

    sparkle.style.setProperty('--sparkle-x', `${x}px`);
    sparkle.style.setProperty('--sparkle-y', `${y}px`);
    sparkle.style.animationDelay = `${Math.random() * 2}s`;

    container.appendChild(sparkle);
  }
}

function initResult() {
  document.getElementById('btn-home').addEventListener('click', () => {
    showScreen('home');
    updateStashUI();
  });

  document.getElementById('btn-share').addEventListener('click', async () => {
    const strain = document.getElementById('result-strain-name').textContent;
    const score = document.getElementById('result-match-score').textContent;
    const text = `🌿 CannaPickForMe chose "${strain}" for me! ${score} — Let the universe decide what you smoke! 🔥`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'CannaPickForMe', text });
      } catch {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(text);
        const btn = document.getElementById('btn-share');
        const original = btn.innerHTML;
        btn.innerHTML = '✓ Copied!';
        setTimeout(() => btn.innerHTML = original, 2000);
      } catch {
        // Silent fail
      }
    }
  });
}

// === ADS ===
function renderAdSlot(containerId, ads) {
  const container = document.getElementById(containerId);
  if (!container || !ads || ads.length === 0) return;

  // Show the first (highest priority) ad
  const ad = ads[0];
  const displayType = ad.displayType || 'card';

  if (displayType === 'banner') {
    container.innerHTML = `
      <a href="${ad.clickUrl}" target="_blank" rel="noopener noreferrer" class="ad-banner" title="${ad.title || 'Sponsored'}">
        <img src="${ad.imageUrl}" alt="${ad.title || 'Ad'}" class="ad-banner__image" loading="lazy" />
        <span class="ad-banner__sponsored">Sponsored</span>
      </a>
    `;
  } else {
    // Card style (default)
    container.innerHTML = `
      <a href="${ad.clickUrl}" target="_blank" rel="noopener noreferrer" class="ad-card" title="${ad.title || 'Sponsored'}">
        <span class="ad-card__sponsored">Sponsored</span>
        <img src="${ad.imageUrl}" alt="${ad.title || 'Ad'}" class="ad-card__image" loading="lazy" />
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

// === BOOT ===
function init() {
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
}

document.addEventListener('DOMContentLoaded', init);
// If DOM is already ready
if (document.readyState !== 'loading') init();

