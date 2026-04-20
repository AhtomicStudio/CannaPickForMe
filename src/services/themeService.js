import { getTheme, setTheme, getLightMode, setLightMode } from '../storage/store.js';

const THEME_EMOJIS = {
  default:  ['🍃','🌿','🍃','🌿','🍃','🌿','🌿','🍃','🌿','🍃','🌿','🍃'],
  fall:     ['🍂','🍁','🍂','🍁','🌾','🍂','🍁','🍂','🍁','🌾','🍂','🍁'],
  love:     ['💕','💖','🌹','💕','💖','💕','🌹','💖','💕','🌹','💖','💕'],
  '420':    ['🌿','🔥','💨','🌿','🌿','💨','🔥','🌿','💨','🌿','🔥','🌿'],
  hallows:  ['🎃','👻','💀','🎃','👻','💀','🎃','👻','💀','🎃','👻','💀'],
  bubbles:  ['🫧','⚪','🔵','🫧','⚪','🫧','🔵','🫧','⚪','🔵','🫧','⚪'],
  fire:     ['🌿','🔥','💨','🌿','🔥','💨','🌿','🔥','💨','🌿','🔥','💨'],
  realfire: ['🔥','🔥','🔥','🔥','🔥','🔥','🔥','🔥','🔥','🔥','🔥','🔥'],
};

export const THEMES = [
  { key: 'default',  label: 'Default',   preview: ['🌿','💨','🔥'] },
  { key: 'fall',     label: 'Fall',      preview: ['🍂','🍁','🌾'] },
  { key: 'love',     label: 'Love',      preview: ['💕','💖','🌹'] },
  { key: '420',      label: '4/20',      preview: ['🌿','🔥','💨'] },
  { key: 'hallows',  label: 'Hallows',   preview: ['🎃','👻','💀'] },
  { key: 'bubbles',  label: 'Bubbles',   preview: ['🫧','⚪','🔵'] },
  { key: 'fire',     label: 'Fire',      preview: ['🌿','🔥','💨'] },
  { key: 'realfire', label: 'Real Fire', preview: ['🔥','🔥','🔥'] },
];

const VALID_THEME_KEYS = THEMES.map(t => t.key);

function updateLeafEmojis(key) {
  const emojis = THEME_EMOJIS[key] || THEME_EMOJIS.default;
  document.querySelectorAll('.app-bg__leaf').forEach((el, i) => {
    el.textContent = emojis[i % emojis.length];
  });
}

export function applyTheme(key) {
  const safeKey = VALID_THEME_KEYS.includes(key) ? key : 'default';
  document.documentElement.setAttribute('data-theme', safeKey);
  updateLeafEmojis(safeKey);
  return safeKey;
}

export function applyLightMode(on) {
  document.documentElement.classList.toggle('light-mode', on);
}

export function loadSavedTheme() {
  applyTheme(getTheme());
  applyLightMode(getLightMode());
}

export async function saveThemePreference(key) {
  const safeKey = applyTheme(key);
  setTheme(safeKey);
  try {
    const { getCurrentUser, saveSettingsToFirestore } = await import('./userService.js');
    const user = getCurrentUser();
    if (user) await saveSettingsToFirestore(user.uid, { theme: safeKey });
  } catch (err) {
    console.warn('Failed to save theme to Firestore:', err);
  }
}

export async function saveLightModePreference(on) {
  setLightMode(on);
  applyLightMode(on);
  try {
    const { getCurrentUser, saveSettingsToFirestore } = await import('./userService.js');
    const user = getCurrentUser();
    if (user) await saveSettingsToFirestore(user.uid, { lightMode: on });
  } catch (err) {
    console.warn('Failed to save lightMode to Firestore:', err);
  }
}
