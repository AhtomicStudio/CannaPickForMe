/**
 * Local Storage Manager for CannaPickForMe
 * Handles: user stash, custom strains, effect overrides, age verification, session history, cloud sync timestamp
 */

const KEYS = {
  STASH: 'cpfm_stash',
  CUSTOM_STRAINS: 'cpfm_custom_strains',
  EFFECT_OVERRIDES: 'cpfm_effect_overrides',
  DISPENSARY_OVERRIDES: 'cpfm_dispensary_overrides',
  AGE_VERIFIED: 'cpfm_age_verified',
  SESSION_HISTORY: 'cpfm_session_history',
  SYNC_AT: 'cpfm_sync_at',
  THEME: 'cpfm_theme',
  LIGHT_MODE: 'cpfm_light_mode',
};

function getJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// === STASH (strains user has on hand) ===

export function getStash() {
  return getJSON(KEYS.STASH, []);
}

export function addToStash(strainId) {
  const stash = getStash();
  if (!stash.includes(strainId)) {
    stash.push(strainId);
    setJSON(KEYS.STASH, stash);
  }
  return stash;
}

export function removeFromStash(strainId) {
  const stash = getStash().filter(id => id !== strainId);
  setJSON(KEYS.STASH, stash);
  return stash;
}

export function isInStash(strainId) {
  return getStash().includes(strainId);
}

export function clearStash() {
  setJSON(KEYS.STASH, []);
}

// === CUSTOM STRAINS ===

export function getCustomStrains() {
  return getJSON(KEYS.CUSTOM_STRAINS, []);
}

export function addCustomStrain(strain) {
  const customs = getCustomStrains();
  // Generate slug id
  strain.id = strain.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  strain.isCustom = true;
  // Avoid duplicates
  const existing = customs.findIndex(s => s.id === strain.id);
  if (existing >= 0) {
    customs[existing] = strain;
  } else {
    customs.push(strain);
  }
  setJSON(KEYS.CUSTOM_STRAINS, customs);
  return strain;
}

export function removeCustomStrain(strainId) {
  const customs = getCustomStrains().filter(s => s.id !== strainId);
  setJSON(KEYS.CUSTOM_STRAINS, customs);
  removeFromStash(strainId);
  return customs;
}

// === EFFECT OVERRIDES ===

export function getEffectOverrides() {
  return getJSON(KEYS.EFFECT_OVERRIDES, {});
}

export function setEffectOverride(strainId, effects) {
  const overrides = getEffectOverrides();
  overrides[strainId] = effects;
  setJSON(KEYS.EFFECT_OVERRIDES, overrides);
}

export function getStrainEffectOverride(strainId) {
  return getEffectOverrides()[strainId] || null;
}

export function clearEffectOverride(strainId) {
  const overrides = getEffectOverrides();
  delete overrides[strainId];
  setJSON(KEYS.EFFECT_OVERRIDES, overrides);
}

// === DISPENSARY OVERRIDES ===

export function getDispensaryOverrides() {
  return getJSON(KEYS.DISPENSARY_OVERRIDES, {});
}

export function setDispensaryOverride(strainId, dispensaries) {
  const overrides = getDispensaryOverrides();
  overrides[strainId] = dispensaries;
  setJSON(KEYS.DISPENSARY_OVERRIDES, overrides);
}

export function getStrainDispensaries(strainId) {
  const overrides = getDispensaryOverrides();
  return Object.prototype.hasOwnProperty.call(overrides, strainId) ? overrides[strainId] : null;
}

// === AGE VERIFICATION (session only) ===

export function isAgeVerified() {
  return sessionStorage.getItem(KEYS.AGE_VERIFIED) === 'true';
}

export function setAgeVerified() {
  sessionStorage.setItem(KEYS.AGE_VERIFIED, 'true');
}

// === UTILITY: Get strain with overrides applied ===

export function applyOverrides(strain) {
  const override = getStrainEffectOverride(strain.id);
  if (override) {
    return { ...strain, effectOverrides: override };
  }
  return strain;
}

// === SESSION HISTORY ===

export function getSessionHistory() {
  return getJSON(KEYS.SESSION_HISTORY, []);
}

export function addSessionEntry(entry) {
  const history = getSessionHistory();
  history.unshift({
    strainId:   entry.strainId   ?? null,
    name:       entry.name       ?? null,
    mood:       entry.mood       ?? null,
    goal:       entry.goal       ?? null,
    intensity:  entry.intensity  ?? null,
    vibe:       entry.vibe       ?? null,
    matchScore: entry.matchScore ?? null,
    timestamp:  Date.now(),
  });
  if (history.length > 50) history.length = 50;
  setJSON(KEYS.SESSION_HISTORY, history);
  return history;
}

export function clearSessionHistory() {
  setJSON(KEYS.SESSION_HISTORY, []);
}

// === SESSION FEEDBACK ===
// Post-session "did it hit?" verdicts. This is the user's own signal about
// their own picks — it personalizes matching over time and is never
// influenced by sponsorship (honest-matching rule).

const FEEDBACK_MIN_AGE_MS = 2 * 60 * 60 * 1000;      // let the session land first
const FEEDBACK_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // don't ask about ancient picks

export function setSessionFeedback(timestamp, verdict) {
  const history = getSessionHistory();
  const entry = history.find((e) => e.timestamp === timestamp);
  if (!entry) return history;
  entry.feedback = verdict; // 'hit' | 'miss' | 'skip'
  setJSON(KEYS.SESSION_HISTORY, history);
  return history;
}

// Most recent entry worth asking about: has a strain, no verdict yet, and
// old enough that the user has actually tried it.
export function getPendingFeedbackEntry(now = Date.now()) {
  return getSessionHistory().find((e) =>
    e.strainId && !e.feedback &&
    now - e.timestamp >= FEEDBACK_MIN_AGE_MS &&
    now - e.timestamp <= FEEDBACK_MAX_AGE_MS
  ) || null;
}

// strainId -> 'hit' | 'miss'. Latest verdict wins (history is newest-first);
// 'skip' carries no signal.
export function getStrainFeedbackMap() {
  const map = {};
  for (const e of getSessionHistory()) {
    if (!e.strainId || !e.feedback || e.feedback === 'skip') continue;
    if (!(e.strainId in map)) map[e.strainId] = e.feedback;
  }
  return map;
}

// === THEME AND LIGHT MODE ===

export function getTheme() {
  return localStorage.getItem(KEYS.THEME) || 'default';
}

export function setTheme(key) {
  localStorage.setItem(KEYS.THEME, key);
}

export function getLightMode() {
  return localStorage.getItem(KEYS.LIGHT_MODE) === 'true';
}

export function setLightMode(on) {
  localStorage.setItem(KEYS.LIGHT_MODE, String(on));
}

// === HAPTIC FEEDBACK ===

export function haptic(style = 'light') {
  try {
    if (navigator.vibrate) {
      const patterns = {
        light: 10,
        medium: 25,
        heavy: 50,
        success: [15, 50, 30],
        reveal: [20, 40, 20, 40, 50],
      };
      navigator.vibrate(patterns[style] || 10);
    }
  } catch {
    // Silent — haptics not supported
  }
}

// === SYNC TIMESTAMP ===
// Stores the Unix ms timestamp of the last successful Firestore sync.
// Used to detect conflicts when signing in on a new device.

export function getUpdatedAt() {
  const raw = localStorage.getItem(KEYS.SYNC_AT);
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function setUpdatedAt(ts) {
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return;
  localStorage.setItem(KEYS.SYNC_AT, String(ts));
}

// === BULK SETTERS (conflict restore — overwrites entire collection) ===

export function setStashBulk(arr) {
  setJSON(KEYS.STASH, arr);
}

export function setCustomStrainsBulk(arr) {
  setJSON(KEYS.CUSTOM_STRAINS, arr);
}

export function setEffectOverridesBulk(obj) {
  setJSON(KEYS.EFFECT_OVERRIDES, obj);
}

export function setSessionHistoryBulk(arr) {
  setJSON(KEYS.SESSION_HISTORY, arr);
}

