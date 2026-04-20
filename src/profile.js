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

  // ── Stat strip ──
  const withScore = sessions.filter(s => s.matchScore != null);
  const perfectRate = withScore.length >= 3
    ? Math.round(withScore.filter(s => s.matchScore >= 80).length / withScore.length * 100)
    : null;

  const topCounts = {};
  sessions.forEach(s => { if (s.strainId) { topCounts[s.strainId] = (topCounts[s.strainId] || { name: s.name, n: 0 }); topCounts[s.strainId].n++; } });
  const topPick = Object.values(topCounts).sort((a,b) => b.n - a.n)[0];

  const statStrip = `<div class="activity-stats">
    <div class="activity-stat">
      <span class="activity-stat__val">${sessions.length}</span>
      <span class="activity-stat__lbl">Sessions</span>
    </div>
    <div class="activity-stat">
      <span class="activity-stat__val">${perfectRate !== null ? perfectRate + '%' : '—'}</span>
      <span class="activity-stat__lbl">Perfect Match</span>
    </div>
    <div class="activity-stat">
      <span class="activity-stat__val activity-stat__val--sm">${topPick ? topPick.name : '—'}</span>
      <span class="activity-stat__lbl">Top Pick</span>
    </div>
  </div>`;

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
      return `<div class="history-row">
        <span class="history-row__dot" data-type="${type}"></span>
        <span class="history-row__name">${s.name || 'Unknown'}</span>
        <span class="history-row__meta">${date}${s.matchScore != null ? `<br>${s.matchScore}% match` : ''}</span>
      </div>`;
    }).join('');
    historyHTML = `<div class="history-list">${rows}</div>`;
  }

  panel.innerHTML = `
    ${statStrip}
    <div class="stats-section-label">Recent Picks</div>
    ${historyHTML}
  `;
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
    // Switch to Activity tab so the cleared empty state is visible
    document.querySelectorAll('[data-profile-tab]').forEach(t =>
      t.classList.toggle('tab--active', t.dataset.profileTab === 'activity')
    );
    ['activity', 'themes', 'settings'].forEach(name => {
      document.getElementById(`profile-${name}-panel`).classList.toggle('hidden', name !== 'activity');
    });
    renderActivityTab();
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
