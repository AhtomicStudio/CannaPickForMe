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
  panel.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem">Loading activity...</p>';
}

function renderThemesTab() {
  const panel = document.getElementById('profile-themes-panel');
  panel.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem">Loading themes...</p>';
}

function renderSettingsTab() {
  const panel = document.getElementById('profile-settings-panel');
  panel.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem">Loading settings...</p>';
}
