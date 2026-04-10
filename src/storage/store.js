/**
 * Local Storage Manager for CannaPickForMe
 * Handles: user stash, custom strains, effect overrides, age verification
 */

const KEYS = {
  STASH: 'cpfm_stash',
  CUSTOM_STRAINS: 'cpfm_custom_strains',
  EFFECT_OVERRIDES: 'cpfm_effect_overrides',
  AGE_VERIFIED: 'cpfm_age_verified',
  SESSION_HISTORY: 'cpfm_session_history',
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
    ...entry,
    timestamp: Date.now(),
  });
  // Keep last 50 entries
  if (history.length > 50) history.length = 50;
  setJSON(KEYS.SESSION_HISTORY, history);
  return history;
}

export function clearSessionHistory() {
  setJSON(KEYS.SESSION_HISTORY, []);
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

