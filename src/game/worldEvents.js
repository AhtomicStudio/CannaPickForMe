/**
 * CannaGotchi — Daily World Events
 *
 * One event is in effect each calendar day, deterministically chosen from a
 * weighted pool seeded by the date. The event ripples into:
 *   • Idle XP rate          (xpMult)
 *   • Idle Bud rate         (budMult)
 *   • Care decay rate       (decayMult — < 1 = slower decay)
 *   • Battle reward Buds    (battleBudMult)
 *
 * Surfaced as a small banner under the topbar so the player sees today's flag.
 */

const EVENTS = [
  { id: 'sunny',     emoji: '🌞', name: 'Sunny Day',
    desc: 'A perfect grow day. +20% idle XP for everyone.',
    mods: { xpMult: 1.20 }, weight: 14 },
  { id: 'damp',      emoji: '🌧',  name: 'Damp Weather',
    desc: 'Cleanliness drops 50% faster — keep your bud tidy.',
    mods: { decayMult: { cleanliness: 1.50 } }, weight: 8 },
  { id: 'festival',  emoji: '🎉', name: 'Cultivator Festival',
    desc: 'Wild Cannabuds drop 50% more Buds today.',
    mods: { battleBudMult: 1.50 }, weight: 10 },
  { id: 'bloom_breeze', emoji: '🌸', name: 'Bloom Breeze',
    desc: 'Care needs decay 25% slower. Your bud chills.',
    mods: { decayMult: { all: 0.75 } }, weight: 10 },
  { id: 'market_day', emoji: '🛒', name: 'Market Day',
    desc: 'Idle Buds production +35%. Stock that wallet.',
    mods: { budMult: 1.35 }, weight: 10 },
  { id: 'eclipse',   emoji: '🌑', name: 'Eclipse',
    desc: 'Idle XP -20% but battle XP +50%. Fight, don\'t farm.',
    mods: { xpMult: 0.80, battleXpMult: 1.50 }, weight: 6 },
  { id: 'photonic',  emoji: '🌈', name: 'Photonic Surge',
    desc: 'Sativas thrive: +30% damage in battles for Sativa buds.',
    mods: { battleTypeMult: { sativa: 1.30 } }, weight: 6 },
  { id: 'mossy',     emoji: '🌫', name: 'Mossy Air',
    desc: 'Indicas thrive: +30% damage in battles for Indica buds.',
    mods: { battleTypeMult: { indica: 1.30 } }, weight: 6 },
  { id: 'crossbreeze', emoji: '🧬', name: 'Crossbreeze',
    desc: 'Hybrids thrive: +30% damage for Hybrid buds.',
    mods: { battleTypeMult: { hybrid: 1.30 } }, weight: 6 },
  { id: 'normal',    emoji: '🌿', name: 'Normal Day',
    desc: 'Nothing unusual in the air. Just a regular grow day.',
    mods: {}, weight: 30 },
];

function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/** Get the event for a given date (default: today). Deterministic. */
export function getEventForDate(d = new Date()) {
  const key = dateKey(d);
  const total = EVENTS.reduce((s, e) => s + e.weight, 0);
  const r = (hashStr(key) % total) + 1;
  let acc = 0;
  for (const e of EVENTS) {
    acc += e.weight;
    if (r <= acc) return { ...e, dateKey: key };
  }
  return EVENTS[EVENTS.length - 1];
}

/** Today's event — short alias. */
export function getTodaysEvent() {
  return getEventForDate(new Date());
}
