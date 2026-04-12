import { scalesAnimation }   from './scales.js';
import { eightBallAnimation } from './eightball.js';
import { plinkoAnimation }    from './plinko.js';

export const ANIMATIONS = [
  scalesAnimation,
  eightBallAnimation,
  plinkoAnimation,
];

export function pickAnimation() {
  if (ANIMATIONS.length === 0) return null;
  return ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
}
