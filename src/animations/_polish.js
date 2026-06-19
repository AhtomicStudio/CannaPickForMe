import { burstParticles } from './_kinetic.js';

export const _prefersReduced = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Strain names scrolling past a window/sphere — "choosing among all". */
export function spawnSwirl(hostEl, names, { round = false, prepend = false } = {}) {
  if (_prefersReduced()) return { stop() {} };
  // The swirl element clips its own names (inset:0 + overflow:hidden), so we
  // don't touch the host's overflow (that would crop its smoke/glow). We only
  // ensure the host is a positioning context for the absolutely-placed swirl.
  if (getComputedStyle(hostEl).position === 'static') hostEl.style.position = 'relative';
  const list = (names && names.length) ? names : ['???'];
  const swirl = document.createElement('div');
  swirl.className = 'pol-swirl' + (round ? ' pol-swirl--round' : '');
  const track = document.createElement('div');
  track.className = 'pol-swirl-track';
  track.style.setProperty('--swirl-dur', Math.max(1.1, list.length * 0.16).toFixed(2) + 's');
  [...list, ...list].forEach(n => {
    const s = document.createElement('div');
    s.className = 'pol-swirl-name';
    s.textContent = n;
    track.appendChild(s);
  });
  swirl.appendChild(track);
  if (prepend) hostEl.insertBefore(swirl, hostEl.firstChild);
  else hostEl.appendChild(swirl);
  return { stop() { swirl.classList.add('pol-swirl--out'); setTimeout(() => swirl.remove(), 450); } };
}


/* --- wheel geometry helpers (module scope; unique names) --- */
export function polWedge(cx, cy, r, a0, a1) {
  const rad = d => (d - 90) * Math.PI / 180;
  const x0 = cx + r * Math.cos(rad(a0)), y0 = cy + r * Math.sin(rad(a0));
  const x1 = cx + r * Math.cos(rad(a1)), y1 = cy + r * Math.sin(rad(a1));
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}
export function polEase(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

/* Full-radial mystical burst: sparks + expanding rings + mist puff, spawned on
   the scene (not the narrow wrap) so particles radiate in every direction. */
export function polMysticBurst(scene) {
  burstParticles(scene, {
    count: 22, origin: { x: '50%', y: '44%' },
    palette: ['var(--purple-glow)', 'var(--green-glow)', 'rgba(255,255,255,0.9)'], duration: 1000,
  });
  if (_prefersReduced()) return;
  const puff = document.createElement('div');
  puff.className = 'pol-mist-puff';
  scene.appendChild(puff);
  setTimeout(() => puff.remove(), 1250);
  [0, 150, 300].forEach(d => setTimeout(() => {
    const r = document.createElement('div');
    r.className = 'pol-ring';
    scene.appendChild(r);
    setTimeout(() => r.remove(), 1000);
  }, d));
}

/* Shared faint ambient motes — one common atmosphere behind every scene. */
export function polAmbient(host) {
  if (_prefersReduced()) return;
  const root = host.firstElementChild;
  if (!root) return;
  if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
  const layer = document.createElement('div');
  layer.className = 'pol-ambient';
  const COLORS = ['var(--green-glow)', 'var(--gold-glow)', 'var(--purple-glow)'];
  for (let i = 0; i < 11; i++) {
    const m = document.createElement('div');
    m.className = 'pol-ambient-mote';
    m.style.left = (Math.random() * 100).toFixed(1) + '%';
    m.style.top = (Math.random() * 100).toFixed(1) + '%';
    m.style.color = COLORS[i % COLORS.length];
    m.style.animationDelay = (Math.random() * 7).toFixed(1) + 's';
    m.style.animationDuration = (5 + Math.random() * 4).toFixed(1) + 's';
    layer.appendChild(m);
  }
  root.insertBefore(layer, root.firstChild);
}

/* Shared winner-reveal card — consistent styling, placed clear of each graphic. */
const POL_REVEAL_POS = {
  'scales': 'above', 'anim-ball-scene': 'above', 'anim-slots-scene': 'above',
  'anim-crystal-scene': 'top-in',
  'anim-wheel-scene': 'bottom-in', 'pol-box-scene': 'bottom-in', 'pol-th-scene': 'bottom-in', 'pol-claw-scene': 'bottom-in',
  'pol-st-scene': 'center', 'anim-cage-scene': 'bottom-in',
};
export function polReveal(sceneEl, strainName, pos) {
  if (!pos) { for (const k in POL_REVEAL_POS) { if (sceneEl.classList.contains(k)) { pos = POL_REVEAL_POS[k]; break; } } }
  pos = pos || 'above';
  if (getComputedStyle(sceneEl).position === 'static') sceneEl.style.position = 'relative';
  const card = document.createElement('div');
  card.className = 'pol-reveal pol-reveal--' + pos;
  card.innerHTML = '<span class="pol-reveal-leaf">\u{1F33F}</span><span class="pol-reveal-text"><span class="pol-reveal-name"></span><span class="pol-reveal-sub">your match</span></span>';
  card.querySelector('.pol-reveal-name').textContent = strainName;
  sceneEl.appendChild(card);
  requestAnimationFrame(() => card.classList.add('pol-reveal--show'));
  return card;
}

export function polTypewriter(el, text, totalDuration) {
  el.innerHTML = '';
  el.style.opacity = '1';
  const chars = text.split('');
  const delay = totalDuration / Math.max(chars.length, 1);
  chars.forEach((ch, i) => {
    setTimeout(() => {
      const span = document.createElement('span');
      span.textContent = ch === ' ' ? ' ' : ch;
      span.className = 'anim-crystal-letter';
      el.appendChild(span);
    }, i * delay);
  });
}
