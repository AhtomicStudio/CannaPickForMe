// Animation registry — add new animations to this array to include them in rotation
export const ANIMATIONS = [];

export function pickAnimation() {
  return ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
}
