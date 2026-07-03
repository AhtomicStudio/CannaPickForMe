import effectMap from '../data/effect-map.json';

/**
 * Deterministic Strain Matching Engine
 * Scores each strain in the user's stash against their session answers.
 * No randomness, no LLM — pure weighted scoring.
 */

const PERFECT_MATCH_THRESHOLD = 80;

/**
 * Commonly reported effect associations per terpene (experience language,
 * not medical claims). Used only as a small additive bonus — strains
 * without terpene data (most of the library) are never penalized.
 */
const TERPENE_AFFINITY = {
  Myrcene: ['Relaxed', 'Sleepy', 'Body High'],
  Limonene: ['Uplifted', 'Happy', 'Energetic'],
  Pinene: ['Focused', 'Creative'],
  Caryophyllene: ['Relaxed', 'Body High'],
  Terpinolene: ['Energetic', 'Creative', 'Uplifted'],
  Linalool: ['Relaxed', 'Sleepy'],
  Humulene: ['Relaxed'],
  Ocimene: ['Uplifted', 'Energetic'],
};

// Max points a fully-aligned terpene profile can add. Kept well below the
// effect-match scale (0–100) so terpenes refine the ranking, not drive it.
const TERPENE_BONUS_MAX = 8;

// Dominant-first weighting: profiles are stored most-dominant first.
const TERPENE_DOMINANCE_WEIGHTS = [1.0, 0.6, 0.3];

/**
 * Score how well a strain's terpene profile aligns with the desired effects.
 * Returns 0 for strains without terpene data (neutral, not a penalty).
 */
function terpeneBonus(strain, desiredEffects) {
  const terpenes = strain.terpenes || [];
  if (terpenes.length === 0) return 0;

  const totalDesired = Object.values(desiredEffects).reduce((a, b) => a + b, 0);
  if (totalDesired === 0) return 0;

  const maxWeight = TERPENE_DOMINANCE_WEIGHTS.reduce((a, b) => a + b, 0);
  let aligned = 0;

  terpenes.slice(0, TERPENE_DOMINANCE_WEIGHTS.length).forEach((t, i) => {
    const affinities = TERPENE_AFFINITY[t.name];
    if (!affinities) return;
    // Fraction of the desired-effect weight this terpene's associations cover
    const covered = affinities.reduce((sum, eff) => sum + (desiredEffects[eff] || 0), 0);
    aligned += TERPENE_DOMINANCE_WEIGHTS[i] * (covered / totalDesired);
  });

  return TERPENE_BONUS_MAX * (aligned / maxWeight);
}

/**
 * Intensity ↔ THC alignment. The intensity scoreMultiplier scales every
 * strain equally and so never changes the ranking; this is what makes the
 * "How high do you wanna fly?" answer actually matter. Bands are % total THC
 * (shelf-sourced ranges in strains.json). Strains without potency data are
 * untouched — the adjustment only differentiates where we have real numbers.
 */
const INTENSITY_THC_BANDS = {
  low: { max: 20 },
  moderate: { min: 18, max: 26 },
  high: { min: 25 },
};

// Max points potency alignment can add; off-band tapers 1 point per % THC
// away from the band, capped at the same magnitude.
const POTENCY_ADJUST_MAX = 6;

function potencyAdjust(strain, intensity) {
  const band = INTENSITY_THC_BANDS[intensity];
  const thc = strain.thc;
  if (!band || !thc || !Number.isFinite(thc.min) || !Number.isFinite(thc.max)) return 0;
  const mid = (thc.min + thc.max) / 2;
  const below = band.min != null && mid < band.min ? band.min - mid : 0;
  const above = band.max != null && mid > band.max ? mid - band.max : 0;
  const dist = Math.max(below, above);
  if (dist === 0) return POTENCY_ADJUST_MAX;
  return -Math.min(POTENCY_ADJUST_MAX, dist);
}

/**
 * Build the desired effects profile from session answers
 */
function buildDesiredProfile(answers) {
  const desiredEffects = {};
  let typeBonus = { indica: 1.0, hybrid: 1.0, sativa: 1.0 };
  let scoreMultiplier = 1.0;

  for (const [questionId, answerValue] of Object.entries(answers)) {
    const mapping = effectMap[questionId]?.[answerValue];
    if (!mapping) continue;

    // Accumulate effect weights
    if (mapping.effects) {
      for (const [effect, weight] of Object.entries(mapping.effects)) {
        desiredEffects[effect] = (desiredEffects[effect] || 0) + weight;
      }
    }

    // Accumulate type bonuses (multiply)
    if (mapping.typeBonus) {
      typeBonus.indica *= mapping.typeBonus.indica || 1.0;
      typeBonus.hybrid *= mapping.typeBonus.hybrid || 1.0;
      typeBonus.sativa *= mapping.typeBonus.sativa || 1.0;
    }

    // Score multiplier from intensity
    if (mapping.scoreMultiplier) {
      scoreMultiplier = mapping.scoreMultiplier;
    }
  }

  return { desiredEffects, typeBonus, scoreMultiplier, intensity: answers.intensity };
}

/**
 * Score a single strain against the desired profile
 */
function scoreStrain(strain, profile) {
  const { desiredEffects, typeBonus, scoreMultiplier, intensity } = profile;

  // Get strain's effective effects (overrides take priority)
  const strainEffects = strain.effectOverrides || strain.effects || [];

  // Calculate effect match score
  let matchedWeight = 0;
  let totalWeight = 0;

  for (const [effect, weight] of Object.entries(desiredEffects)) {
    totalWeight += weight;
    if (strainEffects.includes(effect)) {
      matchedWeight += weight;
    }
  }

  // Base score as percentage
  let score = totalWeight > 0 ? (matchedWeight / totalWeight) * 100 : 50;

  // Apply strain type bonus
  const strainType = (strain.type || 'hybrid').toLowerCase();
  score *= typeBonus[strainType] || 1.0;

  // Apply intensity multiplier
  score *= scoreMultiplier;

  // Terpene alignment refinement (0 for strains without terpene data)
  score += terpeneBonus(strain, desiredEffects);

  // Potency ↔ intensity alignment (0 for strains without THC data)
  score += potencyAdjust(strain, intensity);

  // Clamp to 0-100
  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Generate a 2-sentence reasoning for why this strain was picked
 */
function generateReasoning(strain, answers, score, isPerfectMatch) {
  const type = strain.type.charAt(0).toUpperCase() + strain.type.slice(1);
  const typeLower = type.toLowerCase();
  const article = /^[aeiou]/i.test(typeLower) ? 'an' : 'a';
  const topEffects = (strain.effectOverrides || strain.effects || []).slice(0, 3).join(', ');
  const topFlavors = (strain.flavors || []).slice(0, 2).join(' and ');

  const moodLabels = { chill: 'chill', social: 'social', creative: 'creative', energetic: 'energetic' };
  const goalLabels = { relax: 'relaxing', productive: 'productive', fun: 'fun', sleep: 'sleepy' };
  const vibeLabels = { solo: 'solo', friends: 'hanging with friends', movie: 'movie night', adventure: 'adventure' };

  const mood = moodLabels[answers.mood] || 'current';
  const goal = goalLabels[answers.goal] || '';
  const vibe = vibeLabels[answers.vibe] || '';

  if (!isPerfectMatch) {
    return `There wasn't a perfect match, but ${strain.name} comes closest to your ${mood} mood. This ${typeLower} brings ${topEffects} effects${topFlavors ? ` with ${topFlavors} flavors` : ''} — the best fit for your ${vibe} vibe.`;
  }

  return `${strain.name} is ${article} ${typeLower} that nails your ${mood} mood with its ${topEffects} effects. ${topFlavors ? `Expect ${topFlavors} flavors — ` : ''}perfect for a ${goal} ${vibe} session.`;
}

/**
 * Tie-breaker hash (FNV-1a) over strain id + the answer combo.
 * Score ties would otherwise resolve to stash/JSON order, structurally
 * favoring strains earlier in the file. Seeding on the answers keeps the
 * result deterministic for a given quiz while spreading ties across the
 * library — and makes the winner independent of input array order.
 */
function tieBreak(strainId, answersKey) {
  const str = `${strainId}|${answersKey}`;
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Personal post-session feedback ('hit'/'miss' on the user's own past picks).
// User signal only — never sponsorship — per the honest-matching rule.
const FEEDBACK_ADJUST = { hit: 5, miss: -5 };

/**
 * Main matching function
 * @param {Array} stashStrains - Array of strain objects from user's stash
 * @param {Object} answers - { mood, goal, intensity, vibe }
 * @param {Object} [opts] - { feedback: { [strainId]: 'hit'|'miss' } }
 * @returns {Object} Recommendation result
 */
export function matchStrains(stashStrains, answers, opts = {}) {
  if (!stashStrains || stashStrains.length === 0) {
    return null;
  }

  const profile = buildDesiredProfile(answers);
  const feedback = opts.feedback || {};

  const answersKey = Object.entries(answers || {})
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}:${v}`)
    .join(',');

  // Score all strains
  const allScores = stashStrains.map(strain => {
    const adjust = FEEDBACK_ADJUST[feedback[strain.id]] || 0;
    return {
      strain,
      score: Math.min(100, Math.max(0, scoreStrain(strain, profile) + adjust)),
      tie: tieBreak(strain.id, answersKey)
    };
  });

  // Sort descending by score; break ties with the seeded hash
  allScores.sort((a, b) => b.score - a.score || a.tie - b.tie);

  const winner = allScores[0];
  const isPerfectMatch = winner.score >= PERFECT_MATCH_THRESHOLD;

  return {
    pickedStrain: winner.strain,
    matchScore: winner.score,
    isPerfectMatch,
    reasoning: generateReasoning(winner.strain, answers, winner.score, isPerfectMatch),
    allScores: allScores.map(s => ({
      strainId: s.strain.id,
      strainName: s.strain.name,
      score: s.score
    }))
  };
}
