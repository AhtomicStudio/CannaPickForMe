import { scalesAnimation }   from './scales.js';
import { eightBallAnimation } from './eightball.js';
import { plinkoAnimation }    from './plinko.js';
import { boxAnimation }       from './box.js';
import { tarotAnimation }     from './tarot.js';

export const ANIMATIONS = [
  scalesAnimation,
  eightBallAnimation,
  plinkoAnimation,
  boxAnimation,
  tarotAnimation,
];

export function pickAnimation() {
  if (ANIMATIONS.length === 0) return null;
  return ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
}
