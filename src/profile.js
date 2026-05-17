import { getSessionHistory, clearSessionHistory, getTheme } from './storage/store.js';
import { THEMES, saveThemePreference, isThemeUnlocked, isPremiumTheme } from './services/themeService.js';
import { showConfirm } from './services/modalService.js';
import { showToast } from './services/toastService.js';

// Lazy-load companion to avoid pulling game modules into the eager bundle
async function getCompanion() {
  return import('./game/companion.js');
}


let _getAllStrains;
let _getStash;
let _onPickRowClick = null;

export function initProfile({ getAllStrains, getStash, onPickRowClick }) {
  _getAllStrains = getAllStrains;
  _getStash = getStash;
  _onPickRowClick = onPickRowClick || null;

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
  const PICKS_DEFAULT = 5;
  const makePickRow = (s, idx) => {
    const strain = allStrains.find(st => st.id === s.strainId);
    const type = strain?.type || 'hybrid';
    const date = s.timestamp ? new Date(s.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    return `<button type="button" class="history-row history-row--clickable" data-pick-idx="${idx}" data-strain-id="${s.strainId || ''}">
      <span class="history-row__dot" data-type="${type}"></span>
      <span class="history-row__name">${s.name || 'Unknown'}</span>
      <span class="history-row__meta">${date}${s.matchScore != null ? `<br>${s.matchScore}% match` : ''}</span>
      <span class="history-row__chevron">›</span>
    </button>`;
  };

  let historyHTML;
  if (sessions.length === 0) {
    historyHTML = `<div class="empty-state">
      <span class="empty-state__icon">🌿</span>
      <p>No sessions yet.</p>
      <p class="empty-state__sub">Run your first pick to see history here.</p>
    </div>`;
  } else {
    const hasMore = sessions.length > PICKS_DEFAULT;
    const showAllBtn = hasMore
      ? `<button class="history-show-all" id="btn-history-show-all">Show all ${sessions.length} picks</button>`
      : '';
    // Constrain expanded list to a scroll container so the stat strip above
    // stays in view when the user expands a long history.
    historyHTML = `<div class="history-list-wrap" id="history-list-wrap">
      <div class="history-list" id="history-list-inner">${sessions.slice(0, PICKS_DEFAULT).map(makePickRow).join('')}</div>
    </div>${showAllBtn}`;
  }

  panel.innerHTML = `
    ${statStrip}
    <div class="stats-section-label">Recent Picks</div>
    ${historyHTML}
  `;

  function wireRowClicks(scope) {
    scope.querySelectorAll('.history-row--clickable').forEach(row => {
      row.addEventListener('click', () => {
        const idx = parseInt(row.dataset.pickIdx, 10);
        const s = sessions[idx];
        if (!s || !_onPickRowClick) return;
        const strain = allStrains.find(st => st.id === s.strainId);
        if (!strain) return;
        _onPickRowClick({ strain, session: s });
      });
    });
  }
  wireRowClicks(panel);

  const showAllBtn = panel.querySelector('#btn-history-show-all');
  if (showAllBtn) {
    showAllBtn.addEventListener('click', () => {
      const inner = panel.querySelector('#history-list-inner');
      inner.innerHTML = sessions.map(makePickRow).join('');
      // Mark wrap as "expanded" so CSS gives it a scroll container.
      panel.querySelector('#history-list-wrap')?.classList.add('history-list-wrap--expanded');
      wireRowClicks(inner);
      showAllBtn.remove();
    });
  }
}


function renderThemesTab() {
  const panel = document.getElementById('profile-themes-panel');
  const currentTheme = getTheme();

  const cards = THEMES.map(t => {
    const premium = isPremiumTheme(t.key);
    const unlocked = isThemeUnlocked(t.key);
    const locked = premium && !unlocked;
    const active = t.key === currentTheme;

    const priceChip = premium
      ? `<div class="theme-card__price">${t.cur === 'seeds' ? '🌱' : '🪙'} ${t.price}</div>`
      : '';

    return `
      <button class="theme-card ${active ? 'theme-card--active' : ''} ${locked ? 'theme-card--locked' : ''} ${premium ? 'theme-card--premium' : ''}"
              data-theme-key="${t.key}" ${locked ? 'aria-disabled="true"' : ''}>
        <div class="theme-card__preview">${t.preview.join('')}</div>
        <div class="theme-card__name">${t.label}</div>
        <span class="theme-card__check">✓</span>
        ${locked ? `<div class="theme-card__lock-veil"><span class="theme-card__lock">🔒</span>${priceChip}<div class="theme-card__lock-hint">Unlock in Cannagotchi shop</div></div>` : (premium ? priceChip : '')}
      </button>`;
  }).join('');

  panel.innerHTML = `
    <div class="themes-section-label">Free Themes</div>
    <div class="themes-grid">${cards}</div>
    <div class="themes-footer dim small">Premium themes unlock in the <b>Cannagotchi shop</b> using in-game currency only — Buds 🪙 and Seeds 🌱 earned through play.</div>`;

  panel.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', async () => {
      const key = card.dataset.themeKey;
      // Locked premium themes route the user to the Cannagotchi shop instead.
      if (card.classList.contains('theme-card--locked')) {
        showToast(`🔒 Unlock "${THEMES.find(t => t.key === key)?.label}" in the Cannagotchi → Shop tab.`, 'info');
        return;
      }
      await saveThemePreference(key);
      panel.querySelectorAll('.theme-card').forEach(c => c.classList.toggle('theme-card--active', c.dataset.themeKey === key));
    });
  });
}

function renderSettingsTab() {
  const panel = document.getElementById('profile-settings-panel');

  panel.innerHTML = `
    <div class="settings-group">
      <div class="settings-row" id="companion-row">
        <div>
          <div class="settings-row__label">🌱 CannaGuy Companion</div>
          <div class="settings-row__sub">Float your CannaGuy across all screens</div>
        </div>
        <label class="settings-toggle">
          <input type="checkbox" id="toggle-companion" ${localStorage.getItem('cpfm_companion_enabled') !== 'false' ? 'checked' : ''} />
          <span class="settings-toggle__track"></span>
        </label>
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

  const companionToggle = document.getElementById('toggle-companion');
  if (companionToggle) {
    companionToggle.addEventListener('change', async e => {
      const { setCompanionEnabled } = await getCompanion();
      setCompanionEnabled(e.target.checked);
    });
  }

  document.getElementById('btn-clear-history').addEventListener('click', async () => {
    const confirmed = await showConfirm({
      icon: '🧹',
      title: 'Clear session history?',
      message: 'Wipes every past pick on this device. Your stash and account are not affected.',
      confirmLabel: 'Clear History',
      cancelLabel: 'Keep It',
      tone: 'danger',
    });
    if (!confirmed) return;
    clearSessionHistory();
    // Switch to Activity tab so the cleared empty state is visible
    document.querySelectorAll('[data-profile-tab]').forEach(t =>
      t.classList.toggle('tab--active', t.dataset.profileTab === 'activity')
    );
    ['activity', 'themes', 'settings'].forEach(name => {
      document.getElementById(`profile-${name}-panel`).classList.toggle('hidden', name !== 'activity');
    });
    renderActivityTab();
    showToast('Session history cleared.', 'success');
  });

  document.getElementById('btn-reset-tips').addEventListener('click', () => {
    localStorage.removeItem('cpfm_stash_tip_shown');
    const btn = document.getElementById('btn-reset-tips');
    btn.textContent = 'Tips reset ✓';
    setTimeout(() => { btn.textContent = 'Reset App Tips'; }, 2000);
  });

  document.getElementById('btn-delete-account-profile').addEventListener('click', async () => {
    const confirmed = await showConfirm({
      icon: '⚠️',
      title: 'Delete your account?',
      message: 'This deletes your cloud data permanently. Your local stash stays on this device.',
      confirmLabel: 'Delete Account',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      const { deleteAccount } = await import('./services/userService.js');
      await deleteAccount();
      _onBack();
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') {
        showToast('For security, sign out and sign back in before deleting.', 'error');
      } else {
        showToast('Something went wrong. Please try again.', 'error');
      }
    }
  });
}
