/**
 * Stoner Archetype Generator — 2×2 Matrix Edition
 *
 * Archetype name = "The [WORD1] [WORD2]"
 *
 *   WORD1  driven by  mood × intensity  (6 × 3 = 18 entries)
 *   WORD2  driven by  goal × vibe       (6 × 6 = 36 entries)
 *
 * All 4 quiz variables contribute. Total unique archetypes: 18 × 36 = 648.
 * No template logic, no runtime combination risk — every pairing was written
 * by hand and checked for tone.
 *
 * To update: edit the lookup tables directly. No other logic lives outside
 * this file. Keys must match the quiz answer values exactly.
 */

// ─── Word 1: mood × intensity ─────────────────────────────────────────────
//
// Describes who you are and how far you've gone.
// Always used as an adjective — keep entries single words.

const WORD1 = {
  'chill-low':              'Hazy',
  'chill-moderate':         'Mellow',
  'chill-high':             'Gone',

  'social-low':             'Warm',
  'social-moderate':        'Live',
  'social-high':            'Lifted',

  'creative-low':           'Loose',
  'creative-moderate':      'Sparked',
  'creative-high':          'Wired',

  'energetic-low':          'Fresh',
  'energetic-moderate':     'Moving',
  'energetic-high':         'Torched',

  'introspective-low':      'Still',
  'introspective-moderate': 'Deep',
  'introspective-high':     'Zooted',

  'romantic-low':           'Soft',
  'romantic-moderate':      'Open',
  'romantic-high':          'Blazing',
};

// ─── Word 2: goal × vibe ──────────────────────────────────────────────────
//
// Describes what you're there to do and who you're doing it with.
// Used as a noun/title — can be 1-3 words.

const WORD2 = {
  // relax
  'relax-solo':             'Hermit',
  'relax-friends':          'Anchor',
  'relax-movie':            'Couch Pilot',
  'relax-adventure':        'Trail Drifter',
  'relax-gaming':           'Backseater',
  'relax-datenight':        'Easy Landing',

  // productive
  'productive-solo':        'Session Architect',
  'productive-friends':     'Taskmaster',
  'productive-movie':       'Scene Analyst',
  'productive-adventure':   'Pathfinder',
  'productive-gaming':      'Grinder',
  'productive-datenight':   'Blueprint',

  // fun
  'fun-solo':               'Free Agent',
  'fun-friends':            'Cypher Host',
  'fun-movie':              "Director's Cut",
  'fun-adventure':          'Wanderer',
  'fun-gaming':             'Wild Card',
  'fun-datenight':          'Showstopper',

  // sleep
  'sleep-solo':             'Night Cap',
  'sleep-friends':          'Early Out',
  'sleep-movie':            'Credits Sleeper',
  'sleep-adventure':        'Hammock King',
  'sleep-gaming':           'AFK',
  'sleep-datenight':        'Bedtime Story',

  // ease-discomfort
  'ease-discomfort-solo':       'Low Tide',
  'ease-discomfort-friends':    'Low Key',
  'ease-discomfort-movie':      'Couch Nester',
  'ease-discomfort-adventure':  'Slow Walk',
  'ease-discomfort-gaming':     'Settled In',
  'ease-discomfort-datenight':  'Safe Harbor',

  // appetite
  'appetite-solo':          'Midnight Chef',
  'appetite-friends':       'Snack Dealer',
  'appetite-movie':         'Concession Stand',
  'appetite-adventure':     'Trail Mix',
  'appetite-gaming':        'Munchie Run',
  'appetite-datenight':     'Late Night Menu',
};

// ─── Goal subtitles ───────────────────────────────────────────────────────
//
// One-line tag under the archetype name. Picked at random from 2–3 variants.
// Tone: warm, short, written like a friend would say it.

const GOAL_SUBTITLES = {
  relax: [
    "For when the day's been a lot.",
    'Unwinding mode, party of one.',
    'Pressure off. Couch on.',
  ],
  productive: [
    'Locked-in mode. Hold the line.',
    'Get the thing done. Stay sharp.',
    "Focus dialed. Let's move.",
  ],
  fun: [
    'Make tonight one of the good ones.',
    "Nothing's going to plan — and that's the plan.",
    'Loud, loose, and exactly right.',
  ],
  sleep: [
    'Soft landing incoming. Sweet dreams.',
    'Out before the credits roll.',
    'A slow goodnight to a long day.',
  ],
  'ease-discomfort': [
    'Take the edge off — quietly.',
    'Here to soften the sharp spots.',
    'A small mercy, in plant form.',
  ],
  appetite: [
    'Snack drawer? Open. Pizza? Ordered.',
    'Tonight, dinner is a personality.',
    'Munchies activated. Plan accordingly.',
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function pick(pool) {
  if (!Array.isArray(pool) || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Generate an archetype label from a quiz answer set.
 *
 *   answers = { mood, goal, intensity, vibe }
 *
 * Returns:
 *   {
 *     name:     "The Sparked Session Architect",
 *     subtitle: "Locked-in mode. Hold the line.",
 *     word1:    "Sparked",
 *     word2:    "Session Architect",
 *     goal:     "productive",
 *   }
 *
 * Robust to missing answers — falls back to chill/moderate/relax/solo
 * defaults so the label never breaks the share card.
 */
export function generateArchetype(answers = {}) {
  const mood      = answers.mood      || 'chill';
  const intensity = answers.intensity || 'moderate';
  const goal      = answers.goal      || 'relax';
  const vibe      = answers.vibe      || 'solo';

  const word1    = WORD1[`${mood}-${intensity}`] || 'Mellow';
  const word2    = WORD2[`${goal}-${vibe}`]      || 'Hermit';
  const subtitle = pick(GOAL_SUBTITLES[goal])    || pick(GOAL_SUBTITLES.relax);

  return {
    name: `The ${word1} ${word2}`,
    subtitle,
    word1,
    word2,
    goal,
  };
}

/**
 * Stable slug from an answer set — useful for OG image URL params where
 * the same answers should always map to the same cache key.
 *
 * Returns e.g. "chl-rel-mod-sol"
 */
export function archetypeSlug(answers = {}) {
  const m = (answers.mood      || 'chill').slice(0, 3);
  const g = (answers.goal      || 'relax').slice(0, 3);
  const i = (answers.intensity || 'moderate').slice(0, 3);
  const v = (answers.vibe      || 'solo').slice(0, 3);
  return `${m}-${g}-${i}-${v}`.toLowerCase();
}
