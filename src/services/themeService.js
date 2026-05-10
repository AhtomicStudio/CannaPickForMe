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
  // ── Premium themes (unlocked through the Cannagotchi shop) ──
  galaxy:    ['🌌','✨','🌠','🪐','💫','🌌','⭐','✨','🌠','💫','🪐','🌌'],
  cyberpunk: ['💾','🟣','🔵','🟢','💜','🩻','🟣','🔵','💾','💜','🩻','🟢'],
  zen:       ['🌸','🍵','🪷','🌸','🍃','🪷','🍵','🌸','🪷','🍃','🌸','🪷'],
  prismatic: ['🌈','💎','✨','🌈','💎','🔷','✨','🌈','🔷','💎','🌈','✨'],
};

export const THEMES = [
  // Free themes
  { key: 'default',  label: 'Default',   preview: ['🌿','💨','🔥'] },
  { key: 'fall',     label: 'Fall',      preview: ['🍂','🍁','🌾'] },
  { key: 'love',     label: 'Love',      preview: ['💕','💖','🌹'] },
  { key: '420',      label: '4/20',      preview: ['🌿','🔥','💨'] },
  { key: 'hallows',  label: 'Hallows',   preview: ['🎃','👻','💀'] },
  { key: 'bubbles',  label: 'Bubbles',   preview: ['🫧','⚪','🔵'] },
  { key: 'fire',     label: 'Fire',      preview: ['🌿','🔥','💨'] },
  { key: 'realfire', label: 'Real Fire', preview: ['🔥','🔥','🔥'] },
  // Premium / unlockable through the Cannagotchi shop. `cur` is in-game
  // currency only — Buds or Seeds, never real money.
  { key: 'galaxy',    label: 'Galaxy',     preview: ['🌌','✨','🌠'], premium: true, price: 800,  cur: 'buds',  desc: 'Animated nebula backdrop with drifting stars.' },
  { key: 'cyberpunk', label: 'Cyberpunk',  preview: ['💾','🟣','🔵'], premium: true, price: 1200, cur: 'buds',  desc: 'Neon grid horizons and chromatic glitch borders.' },
  { key: 'zen',       label: 'Zen Garden', preview: ['🌸','🍵','🪷'], premium: true, price: 12,   cur: 'seeds', desc: 'Soft cherry-blossom palette with calm motion.' },
  { key: 'prismatic', label: 'Prismatic',  preview: ['🌈','💎','✨'], premium: true, price: 18,   cur: 'seeds', desc: 'Shifting rainbow gradient — endgame flex.' },
];

export const PREMIUM_THEME_KEYS = THEMES.filter(t => t.premium).map(t => t.key);
export function isPremiumTheme(key) {
  return PREMIUM_THEME_KEYS.includes(key);
}

const VALID_THEME_KEYS = THEMES.map(t => t.key);

// ── Unlock state ─────────────────────────────────────────────
// Premium themes are unlocked by purchase in the Cannagotchi shop. We persist
// the unlocked-set in localStorage for instant access on app load and mirror
// it onto gameState.unlockedThemes when the game module is around.
const UNLOCK_KEY = 'cpfm_unlocked_themes';

function readUnlockedFromStorage() {
  try {
    const raw = localStorage.getItem(UNLOCK_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (_) { return new Set(); }
}
function writeUnlockedToStorage(set) {
  try { localStorage.setItem(UNLOCK_KEY, JSON.stringify([...set])); } catch (_) {}
}

export function isThemeUnlocked(key) {
  if (!isPremiumTheme(key)) return true;
  return readUnlockedFromStorage().has(key);
}

export function unlockTheme(key) {
  if (!isPremiumTheme(key)) return;
  const s = readUnlockedFromStorage();
  s.add(key);
  writeUnlockedToStorage(s);
}

/** Hydrate the unlock-set from a gameState.unlockedThemes array (Firestore-backed). */
export function syncUnlockedThemesFromGame(gameState) {
  if (!gameState?.unlockedThemes) return;
  const s = readUnlockedFromStorage();
  for (const k of gameState.unlockedThemes) s.add(k);
  writeUnlockedToStorage(s);
}

function updateLeafEmojis(key) {
  const emojis = THEME_EMOJIS[key] || THEME_EMOJIS.default;
  document.querySelectorAll('.app-bg__leaf').forEach((el, i) => {
    el.textContent = emojis[i % emojis.length];
  });
}

export function applyTheme(key) {
  let safeKey = VALID_THEME_KEYS.includes(key) ? key : 'default';
  // Premium themes that haven't been unlocked silently fall back to default.
  if (isPremiumTheme(safeKey) && !isThemeUnlocked(safeKey)) safeKey = 'default';
  document.documentElement.setAttribute('data-theme', safeKey);
  updateLeafEmojis(safeKey);
  return safeKey;
}

export function applyLightMode(on) {
  document.documentElement.classList.toggle('light-mode', on);
}

export function loadSavedTheme() {
  applyTheme(getTheme());
  // Light mode is intentionally disabled — the app's visual identity
  // (neon glows, glassmorphism, smoke/leaf background) is tuned for dark.
  // We force it off here so anyone who enabled it in a previous build
  // is returned to the default experience.
  applyLightMode(false);
}

export async function saveThemePreference(key) {
  const safeKey = applyTheme(key);
  setTheme(safeKey);
  // Companion reacts to theme flip
  try {
    const { reactToEvent } = await import('../game/companion.js');
    reactToEvent('theme-change');
  } catch (_) { /* companion is non-critical */ }
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
