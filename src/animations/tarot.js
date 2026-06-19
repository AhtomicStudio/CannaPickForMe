import { burstParticles, flashGlow, screenPunch } from './_kinetic.js';
import { polReveal, polAmbient } from './_polish.js';

export const tarotAnimation = {
    id: 'tarot', name: 'Tarot Card Draw',
    render(container, { strainName }) {
      const HAND = 5, mid = 2;
      let html = '';
      for (let i = 0; i < HAND; i++) {
        if (i === mid) {
          html += `<div class="pol-th-card pol-th-flip" id="pth-pull">
              <div class="pol-th-back2 pol-th-backface">✦</div>
              <div class="pol-th-face2" id="pth-face"></div>
            </div>`;
        } else {
          html += `<div class="pol-th-card pol-th-backface">✦</div>`;
        }
      }
      container.innerHTML = `
        <div class="pol-th-scene">
          <div class="pol-th-glow" id="pth-glow"></div>
          <div class="pol-th" id="pth-hand">${html}</div>
          <div class="pol-th-label" id="pth-label"></div>
        </div>`;

      polAmbient(container);

      const scene = container.querySelector('.pol-th-scene');
      const cards = [...container.querySelectorAll('.pol-th-card')];
      const pull  = container.querySelector('#pth-pull');
      const face  = container.querySelector('#pth-face');
      const glow  = container.querySelector('#pth-glow');
      const label = container.querySelector('#pth-label');

      const fan = (i, spread = 1) => {
        const off = i - mid;
        return `translateX(${(off * 20 * spread).toFixed(1)}px) translateY(${(Math.abs(off) * 7 * spread).toFixed(1)}px) rotate(${(off * 13 * spread).toFixed(1)}deg)`;
      };
      const setFan = (spread, dur) => cards.forEach((c, i) => { c.style.transition = `transform ${dur}s var(--ease-snap)`; c.style.transform = fan(i, spread); });
      const stack = (dur) => cards.forEach((c, i) => { c.style.transition = `transform ${dur}s var(--ease-snap)`; c.style.transform = `translateX(0) translateY(${Math.abs(i - mid) * 1.5}px) rotate(${(i - mid) * 2}deg)`; });

      // Deal into the fan
      cards.forEach((c, i) => {
        c.style.opacity = '0';
        c.style.transform = 'translateY(-70px) scale(0.8) rotate(0deg)';
        setTimeout(() => {
          c.style.transition = 'transform 0.45s var(--ease-snap), opacity 0.3s ease';
          c.style.opacity = '1';
          c.style.transform = fan(i, 1);
        }, 120 + i * 70);
      });

      // Exaggerated shuffle: spread WIDE -> collapse -> riffle cascade -> spread -> settle
      const ACT1 = 900;
      setTimeout(() => setFan(1.7, 0.32), ACT1);
      setTimeout(() => stack(0.28), ACT1 + 430);
      setTimeout(() => cards.forEach((c, i) => setTimeout(() => {
        const dir = i % 2 ? 1 : -1;
        c.style.transition = 'transform 0.15s ease';
        c.style.transform = `translateX(${dir * 34}px) translateY(-10px) rotate(${dir * 12}deg)`;
        setTimeout(() => { c.style.transform = `translateX(0) translateY(${Math.abs(i - mid) * 1.5}px) rotate(${(i - mid) * 2}deg)`; }, 150);
      }, i * 45)), ACT1 + 800);
      setTimeout(() => setFan(1.7, 0.3), ACT1 + 1280);
      setTimeout(() => setFan(1, 0.34), ACT1 + 1680);
      setTimeout(() => glow.classList.add('pol-th-glow--on'), ACT1 + 1700);

      // Pull the centre card UP and clear of the hand, then flip
      const PULL = 3700;
      setTimeout(() => {
        cards.forEach(c => { if (c !== pull) { c.style.transition = 'transform 0.4s ease, opacity 0.4s ease'; c.style.opacity = '0.35'; } });
        face.textContent = '\u{1F33F}';
        pull.parentElement.appendChild(pull);   // last in DOM -> top of the 3D paint order
        pull.style.transition = 'transform 0.7s var(--ease-snap)';
        pull.style.zIndex = '30';
        pull.style.transform = 'translateY(-104px) translateZ(40px) scale(1.42) rotateY(180deg)';
      }, PULL);

      setTimeout(() => {
        flashGlow(pull, { color: 'var(--gold-glow)', duration: 400 });
        burstParticles(scene, { count: 16, origin: { x: '50%', y: '28%' }, palette: ['var(--gold-glow)', 'var(--purple-glow)', 'rgba(255,255,255,0.9)'], duration: 850 });
        screenPunch(scene, { scale: 1.03 });
      }, PULL + 540);

      setTimeout(() => { polReveal(scene, strainName); }, PULL + 740);
    },
  };
