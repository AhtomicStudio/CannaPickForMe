// src/animations/_kinetic.js
// Shared kinetic effects toolkit — import from every scene.

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Spawn N particle divs at a center point, each flying to a random
 * angle/distance. Particles clean up after themselves.
 */
export function burstParticles(container, {
  count   = 14,
  origin  = { x: '50%', y: '50%' },
  palette = ['var(--green-glow)', 'var(--purple-glow)', 'var(--gold-glow)'],
  duration = 800,
  className = 'kfx-spark',
} = {}) {
  if (reducedMotion()) return;
  for (let i = 0; i < count; i++) {
    const angle    = (i / count) * 2 * Math.PI + Math.random() * 0.5;
    const distance = 40 + Math.random() * 40;
    const dx       = Math.cos(angle) * distance;
    const dy       = Math.sin(angle) * distance;
    const color    = palette[Math.floor(Math.random() * palette.length)];
    const p        = document.createElement('div');
    p.className    = className;
    p.style.cssText = `left:${origin.x};top:${origin.y};background:${color};--dx:${dx.toFixed(1)}px;--dy:${dy.toFixed(1)}px;animation-duration:${duration}ms;`;
    container.style.position = container.style.position || 'relative';
    container.appendChild(p);
    setTimeout(() => p.remove(), duration + 100);
  }
}

/**
 * Brief positional jitter on el. Adds/removes a class.
 */
export function shake(el, { magnitude = 6, duration = 250 } = {}) {
  if (reducedMotion()) return;
  el.style.setProperty('--shake-mag', `${magnitude}px`);
  el.style.setProperty('--shake-dur', `${duration}ms`);
  el.classList.add('kfx-shake');
  setTimeout(() => el.classList.remove('kfx-shake'), duration + 50);
}

/**
 * One-shot box-shadow pulse on el.
 */
export function flashGlow(el, { color = 'var(--green-glow)', duration = 400 } = {}) {
  if (reducedMotion()) return;
  el.style.setProperty('--flash-color', color);
  el.style.setProperty('--flash-dur', `${duration}ms`);
  el.classList.add('kfx-flash');
  setTimeout(() => el.classList.remove('kfx-flash'), duration + 50);
}

/**
 * Scale the whole container up slightly then back — tactile "thud".
 */
export function screenPunch(container, { scale = 1.04 } = {}) {
  if (reducedMotion()) return;
  container.style.transition = `transform 120ms var(--ease-snap)`;
  container.style.transform  = `scale(${scale})`;
  setTimeout(() => {
    container.style.transition = `transform 240ms var(--ease-out)`;
    container.style.transform  = `scale(1)`;
    setTimeout(() => {
      container.style.transition = '';
      container.style.transform  = '';
    }, 260);
  }, 130);
}

/**
 * Top-down falling confetti. Reserve for slots (the only scene that earns it).
 */
export function confetti(container, {
  count   = 30,
  palette = ['var(--green-glow)', 'var(--purple-glow)', 'var(--gold-glow)'],
  gravity = 280,
  spread  = 80,
} = {}) {
  if (reducedMotion()) return;
  for (let i = 0; i < count; i++) {
    const piece   = document.createElement('div');
    piece.className = 'kfx-confetti';
    const x       = 10 + Math.random() * spread;
    const color   = palette[Math.floor(Math.random() * palette.length)];
    const delay   = Math.random() * 400;
    piece.style.cssText = `left:${x}%;background:${color};--fall-dist:${gravity + Math.random() * 80}px;--fall-delay:${delay}ms;--fall-rotate:${Math.random() * 720 - 360}deg;`;
    container.appendChild(piece);
    setTimeout(() => piece.remove(), 1300 + delay);
  }
}
