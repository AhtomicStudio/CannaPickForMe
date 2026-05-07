import { scalesAnimation }   from './scales.js';
import { eightBallAnimation } from './eightball.js';
import { boxAnimation }       from './box.js';
import { tarotAnimation }     from './tarot.js';
import { slotsAnimation }     from './slots.js';
import { crystalAnimation }   from './crystal.js';
import { beeAnimation }       from './bee.js';
import { wheelAnimation }     from './wheel.js';
import { bingoAnimation }     from './bingo.js';
import { emberAnimation }     from './ember.js';

export const ANIMATIONS = [
  scalesAnimation, eightBallAnimation, boxAnimation, tarotAnimation,
  slotsAnimation, crystalAnimation, beeAnimation, wheelAnimation,
  bingoAnimation, emberAnimation,
];

export function pickAnimation() {
  return ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
}
