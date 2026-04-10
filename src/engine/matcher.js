import effectMap from '../data/effect-map.json';

/**
 * Deterministic Strain Matching Engine
 * Scores each strain in the user's stash against their session answers.
 * No randomness, no LLM — pure weighted scoring.
 */

const PERFECT_MATCH_THRESHOLD = 65;

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

  return { desiredEffects, typeBonus, scoreMultiplier };
}

/**
 * Score a single strain against the desired profile
 */
function scoreStrain(strain, profile) {
  const { desiredEffects, typeBonus, scoreMultiplier } = profile;

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

  // Bonus for higher-rated strains (small, max +5)
  if (strain.rating) {
    score += (strain.rating / 5) * 5;
  }

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
 * Main matching function
 * @param {Array} stashStrains - Array of strain objects from user's stash
 * @param {Object} answers - { mood, goal, intensity, vibe }
 * @returns {Object} Recommendation result
 */
export function matchStrains(stashStrains, answers) {
  if (!stashStrains || stashStrains.length === 0) {
    return null;
  }

  const profile = buildDesiredProfile(answers);

  // Score all strains
  const allScores = stashStrains.map(strain => ({
    strain,
    score: scoreStrain(strain, profile)
  }));

  // Sort descending by score
  allScores.sort((a, b) => b.score - a.score);

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
