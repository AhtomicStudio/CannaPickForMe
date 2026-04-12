import { scalesAnimation }   from './scales.js';
import { eightBallAnimation } from './eightball.js';

export const ANIMATIONS = [
  scalesAnimation,
  eightBallAnimation,
];

export function pickAnimation() {
  if (ANIMATIONS.length === 0) return null;
  return ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
}
