import { scalesAnimation }   from './scales.js';
import { eightBallAnimation } from './eightball.js';
import { plinkoAnimation }    from './plinko.js';
import { boxAnimation }       from './box.js';
import { tarotAnimation }     from './tarot.js';
import { slotsAnimation }     from './slots.js';
import { crystalAnimation }   from './crystal.js';

export const ANIMATIONS = [
  scalesAnimation,
  eightBallAnimation,
  plinkoAnimation,
  boxAnimation,
  tarotAnimation,
  slotsAnimation,
  crystalAnimation,
];

export function pickAnimation() {
  return ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
}
