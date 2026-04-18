import { getSessionHistory, clearSessionHistory, getTheme, getLightMode } from './storage/store.js';
import { THEMES, saveThemePreference, saveLightModePreference } from './services/themeService.js';
import { deleteAccount } from './services/userService.js';

let _getAllStrains;
let _getStash;

export function initProfile({ getAllStrains, getStash }) {
  _getAllStrains = getAllStrains;
  _getStash = getStash;

  document.getElementById('profile-back').addEventListener('click', () => {
    _onBack();
  });

  document.querySelectorAll('[data-profile-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-profile-tab]').forEach(t => t.classList.remove('tab--active'));
      tab.classList.add('tab--active');

      ['activity', 'themes', 'settings'].forEach(name => {
        document.getElementById(`profile-${name}-panel`).classList.toggle('hidden', name !== tab.dataset.profileTab);
      });

      renderTab(tab.dataset.profileTab);
    });
  });
}

let _onBack = () => {};
export function setProfileBackHandler(fn) { _onBack = fn; }

export function renderProfileScreen() {
  document.querySelectorAll('[data-profile-tab]').forEach(t =>
    t.classList.toggle('tab--active', t.dataset.profileTab === 'activity')
  );
  ['activity', 'themes', 'settings'].forEach(name => {
    document.getElementById(`profile-${name}-panel`).classList.toggle('hidden', name !== 'activity');
  });
  renderTab('activity');
}

function renderTab(name) {
  if (name === 'activity')  renderActivityTab();
  if (name === 'themes')    renderThemesTab();
  if (name === 'settings')  renderSettingsTab();
}

function renderActivityTab() {
  const panel = document.getElementById('profile-activity-panel');

  const sessions = getSessionHistory();
  const allStrains = _getAllStrains();

  // ── Recent Picks ──
  let historyHTML;
  if (sessions.length === 0) {
    historyHTML = `<div class="empty-state">
      <span class="empty-state__icon">🌿</span>
      <p>No sessions yet.</p>
      <p class="empty-state__sub">Run your first pick to see history here.</p>
    </div>`;
  } else {
    const rows = sessions.map(s => {
      const strain = allStrains.find(st => st.id === s.strainId);
      const type = strain?.type || 'hybrid';
      const date = s.timestamp ? new Date(s.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      const metaLine = [s.mood, s.goal].filter(Boolean).join(' · ');
      return `<div class="history-row">
        <span class="history-row__dot" data-type="${type}"></span>
        <span class="history-row__name">${s.name || 'Unknown'}</span>
        <span class="history-row__meta">
          ${date}${metaLine ? `<br>${metaLine}` : ''}
        </span>
      </div>`;
    }).join('');
    historyHTML = `<div class="history-list">${rows}</div>`;
  }

  // ── Stats accordion ──
  const statsHTML = buildStatsHTML(sessions, allStrains);

  panel.innerHTML = `
    <div>
      <div class="stats-section-label">Recent Picks</div>
      ${historyHTML}
    </div>
    <div>
      <div class="stats-section-label">Your Stats</div>
      ${statsHTML}
    </div>
  `;

  wireAccordion(panel);
}

function buildStatsHTML(sessions, allStrains) {
  const stashIds = _getStash().map(s => typeof s === 'string' ? s : s.id || s);
  const stashStrains = stashIds.map(id => allStrains.find(s => s.id === id)).filter(Boolean);

  const sections = [
    buildEffectsChart(stashStrains),
    buildFlavorsChart(stashStrains),
    buildTypeChart(stashStrains),
    buildMoodChart(sessions),
    buildMostPickedChart(sessions),
    buildPerfectMatchRate(sessions),
  ];

  return sections.map(s => `
    <div class="stat-section">
      <div class="stat-section__header">
        <span>${s.title}</span>
        <span class="stat-section__chevron">▾</span>
      </div>
      <div class="stat-section__body">
        <div class="stat-section__content">${s.content}</div>
      </div>
    </div>
  `).join('');
}

function wireAccordion(panel) {
  panel.querySelectorAll('.stat-section__header').forEach(header => {
    header.addEventListener('click', () => {
      const section = header.closest('.stat-section');
      const isOpen = section.classList.contains('stat-section--open');

      panel.querySelectorAll('.stat-section--open').forEach(s => s.classList.remove('stat-section--open'));

      if (!isOpen) {
        section.classList.add('stat-section--open');
        setTimeout(() => {
          section.querySelectorAll('.stat-bar-fill[data-pct]').forEach(bar => {
            bar.style.width = bar.dataset.pct + '%';
          });
        }, 50);
      }
    });
  });
}

function barRow(label, pct, colorClass = '') {
  return `<div class="stat-bar-row">
    <div class="stat-bar-row__label">
      <span>${label}</span>
      <span class="stat-bar-row__pct">${pct}%</span>
    </div>
    <div class="stat-bar-track">
      <div class="stat-bar-fill ${colorClass}" data-pct="${pct}"></div>
    </div>
  </div>`;
}

function buildEffectsChart(stashStrains) {
  const counts = {};
  stashStrains.forEach(s => (s.effectOverrides || s.effects || []).forEach(e => { counts[e] = (counts[e] || 0) + 1; }));
  const total = stashStrains.length;
  if (total < 2) return { title: 'Top Effects', content: `<p class="stat-empty">Add at least 2 strains to your stash to see this stat.</p>` };
  const top = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 6);
  return { title: 'Top Effects', content: top.map(([e, c]) => barRow(e, Math.round(c/total*100))).join('') };
}

function buildFlavorsChart(stashStrains) {
  const counts = {};
  stashStrains.forEach(s => (s.flavors || []).forEach(f => { counts[f] = (counts[f] || 0) + 1; }));
  const total = stashStrains.length;
  if (total < 2) return { title: 'Top Flavors', content: `<p class="stat-empty">Add at least 2 strains to your stash to see this stat.</p>` };
  const top = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 6);
  return { title: 'Top Flavors', content: top.map(([f, c]) => barRow(f, Math.round(c/total*100))).join('') };
}

function buildTypeChart(stashStrains) {
  const counts = { indica: 0, hybrid: 0, sativa: 0 };
  stashStrains.forEach(s => { const t = (s.type || 'hybrid').toLowerCase(); if (counts[t] !== undefined) counts[t]++; });
  const total = stashStrains.length;
  if (total < 1) return { title: 'Strain Type Split', content: `<p class="stat-empty">Add strains to your stash to see this stat.</p>` };
  const content = [
    barRow('Indica', Math.round(counts.indica/total*100), 'stat-bar-fill--indica'),
    barRow('Hybrid', Math.round(counts.hybrid/total*100), 'stat-bar-fill--hybrid'),
    barRow('Sativa', Math.round(counts.sativa/total*100), 'stat-bar-fill--sativa'),
  ].join('');
  return { title: 'Strain Type Split', content };
}

function buildMoodChart(sessions) {
  const counts = {};
  sessions.forEach(s => { if (s.mood) counts[s.mood] = (counts[s.mood] || 0) + 1; });
  const total = Object.values(counts).reduce((a,b) => a+b, 0);
  if (total < 3) return { title: 'Mood Breakdown', content: `<p class="stat-empty">Complete at least 3 sessions to see this stat.</p>` };
  const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]);
  const labels = { chill:'Chill', social:'Social', creative:'Creative', energetic:'Energetic', introspective:'Introspective' };
  return { title: 'Mood Breakdown', content: sorted.map(([m,c]) => barRow(labels[m] || m, Math.round(c/total*100), 'stat-bar-fill--mood')).join('') };
}

function buildMostPickedChart(sessions) {
  const counts = {};
  sessions.forEach(s => {
    if (!s.strainId) return;
    if (!counts[s.strainId]) counts[s.strainId] = { name: s.name, count: 0 };
    counts[s.strainId].count++;
  });
  const total = sessions.length;
  if (total < 3) return { title: 'Your Most Picked', content: `<p class="stat-empty">Complete at least 3 sessions to see this stat.</p>` };
  const top = Object.values(counts).sort((a,b) => b.count-a.count).slice(0, 5);
  const content = `<p class="stat-empty" style="margin-bottom:0.5rem;text-align:left;">From your sessions only</p>` +
    top.map(({ name, count }) => barRow(name, Math.round(count/total*100), 'stat-bar-fill--picked')).join('');
  return { title: 'Your Most Picked', content };
}

function buildPerfectMatchRate(sessions) {
  const withScore = sessions.filter(s => s.matchScore !== null && s.matchScore !== undefined);
  if (withScore.length < 3) return { title: 'Perfect Match Rate', content: `<p class="stat-empty">Complete at least 3 sessions to see this stat.</p>` };
  const perfect = withScore.filter(s => s.matchScore >= 80).length;
  const rate = Math.round(perfect / withScore.length * 100);
  return {
    title: 'Perfect Match Rate',
    content: `<div class="perfect-match-rate">
      <div class="perfect-match-rate__number">${rate}%</div>
      <div class="perfect-match-rate__label">of your sessions scored ≥ 80% match</div>
    </div>`
  };
}

function renderThemesTab() {
  const panel = document.getElementById('profile-themes-panel');
  const currentTheme = getTheme();

  const cards = THEMES.map(t => `
    <button class="theme-card ${t.key === currentTheme ? 'theme-card--active' : ''}" data-theme-key="${t.key}">
      <div class="theme-card__preview">${t.preview.join('')}</div>
      <div class="theme-card__name">${t.label}</div>
      <span class="theme-card__check">✓</span>
    </button>
  `).join('');

  panel.innerHTML = `<div class="themes-grid">${cards}</div>`;

  panel.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', async () => {
      const key = card.dataset.themeKey;
      await saveThemePreference(key);
      panel.querySelectorAll('.theme-card').forEach(c => c.classList.toggle('theme-card--active', c.dataset.themeKey === key));
    });
  });
}

function renderSettingsTab() {
  const panel = document.getElementById('profile-settings-panel');
  const lightOn = getLightMode();

  panel.innerHTML = `
    <div class="settings-group">
      <div class="settings-row" id="bright-mode-row">
        <div>
          <div class="settings-row__label">Bright Mode</div>
        </div>
        <label class="settings-toggle">
          <input type="checkbox" id="toggle-light-mode" ${lightOn ? 'checked' : ''} />
          <span class="settings-toggle__track"></span>
        </label>
        <div class="settings-tooltip">wtf what stoner uses light mode sus 👀</div>
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-row__label">Email Alerts</div>
          <div class="settings-row__sub">Personalised picks and updates</div>
        </div>
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <span class="settings-badge">Coming Soon</span>
          <label class="settings-toggle settings-toggle--disabled">
            <input type="checkbox" disabled />
            <span class="settings-toggle__track"></span>
          </label>
        </div>
      </div>
    </div>

    <div class="settings-group">
      <div class="settings-btn-row">
        <button class="btn--settings-action" id="btn-clear-history">🗑 Clear Session History</button>
      </div>
      <div class="settings-btn-row">
        <button class="btn--settings-action" id="btn-reset-tips">Reset App Tips</button>
      </div>
    </div>

    <div class="settings-divider"></div>

    <div class="settings-danger-zone">
      <button class="btn--settings-action btn--danger" id="btn-delete-account-profile">Delete Account</button>
    </div>
  `;

  document.getElementById('toggle-light-mode').addEventListener('change', e => {
    saveLightModePreference(e.target.checked);
  });

  document.getElementById('btn-clear-history').addEventListener('click', () => {
    if (!confirm('Clear all session history on this device? Your stash and account are not affected.')) return;
    clearSessionHistory();
    renderActivityTab();
    const btn = document.getElementById('btn-clear-history');
    if (btn) { btn.textContent = 'History cleared ✓'; setTimeout(() => { btn.textContent = '🗑 Clear Session History'; }, 2000); }
  });

  document.getElementById('btn-reset-tips').addEventListener('click', () => {
    localStorage.removeItem('cpfm_stash_tip_shown');
    const btn = document.getElementById('btn-reset-tips');
    btn.textContent = 'Tips reset ✓';
    setTimeout(() => { btn.textContent = 'Reset App Tips'; }, 2000);
  });

  document.getElementById('btn-delete-account-profile').addEventListener('click', async () => {
    const confirmed = confirm('This will delete your account and all cloud data. Your local stash stays on this device.');
    if (!confirmed) return;
    try {
      await deleteAccount();
      _onBack();
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') {
        alert('For security, please sign out and sign back in before deleting your account.');
      } else {
        alert('Something went wrong. Please try again.');
      }
    }
  });
}
