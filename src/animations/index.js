import { scalesAnimation } from './scales.js';

export const ANIMATIONS = [
  scalesAnimation,
];

export function pickAnimation() {
  if (ANIMATIONS.length === 0) return null;
  return ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
}
