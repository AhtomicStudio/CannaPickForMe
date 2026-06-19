import { burstParticles, flashGlow, screenPunch } from './_kinetic.js';
import { polWedge, polEase, polReveal, polAmbient } from './_polish.js';

export const wheelAnimation = {
    id: 'wheel', name: 'Wheel of Buds',
    render(container, { strainName, winnerName, allScores }) {
      const SPIN_START = 900, SPIN_DUR = 3100, CLIMAX = 4200, REVEAL = 4500, N = 8;
      const names = (allScores || []).slice(0, N).map(s => s.strainName);
      while (names.length < N) names.push('???');
      const winnerIdx = Math.floor(Math.random() * N);
      const ow = names[0]; names[0] = names[winnerIdx]; names[winnerIdx] = ow;

      const cx = 110, cy = 110, R = 90;
      let wedges = '';
      for (let i = 0; i < N; i++) {
        const a0 = i * 360 / N, a1 = (i + 1) * 360 / N;
        const fill = i % 2 === 0 ? 'url(#polWedgeA)' : 'url(#polWedgeB)';
        const path = polWedge(cx, cy, R, a0, a1);
        const mid = ((a0 + a1) / 2) * Math.PI / 180;
        const lr = R * 0.6;
        const lx = cx + lr * Math.cos(mid - Math.PI / 2);
        const ly = cy + lr * Math.sin(mid - Math.PI / 2);
        const nm = names[i];
        const abbr = nm.length > 8 ? nm.slice(0, 7) + '…' : nm;
        wedges += `<path d="${path}" fill="${fill}" stroke="url(#polDivider)" stroke-width="1.5" data-wedge="${i}" class="anim-wheel-wedge"/>`
          + `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${((a0 + a1) / 2).toFixed(1)}, ${lx.toFixed(1)}, ${ly.toFixed(1)})" class="anim-wheel-label pol-wheel-label" data-wedge="${i}">${abbr}</text>`;
      }
      let lights = '';
      for (let i = 0; i < 24; i++) {
        const a = i * 15 * Math.PI / 180;
        const lx = cx + 96 * Math.cos(a), ly = cy + 96 * Math.sin(a);
        lights += `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2.1" fill="${i % 2 ? 'rgba(251,191,36,0.95)' : 'rgba(255,255,255,0.55)'}"/>`;
      }

      container.innerHTML = `
        <div class="anim-wheel-scene pol-wheel-scene">
          <div class="anim-wheel-stand"></div>
          <div class="anim-wheel-pointer pol-wheel-pointer">
            <svg viewBox="0 0 30 34" width="28" height="32"><path d="M15 31 L3 5 Q15 13 27 5 Z" fill="url(#polPtr)" stroke="#6a4800" stroke-width="1"/></svg>
          </div>
          <div class="anim-wheel-wrap anim-wheel-wrap--enter">
            <svg viewBox="0 0 220 220" class="anim-wheel-svg" id="pol-wheel-svg">
              <defs>
                <radialGradient id="polWedgeA" cx="50%" cy="28%" r="85%"><stop offset="0%" stop-color="#43227a"/><stop offset="100%" stop-color="#1c0f38"/></radialGradient>
                <radialGradient id="polWedgeB" cx="50%" cy="28%" r="85%"><stop offset="0%" stop-color="#16713f"/><stop offset="100%" stop-color="#06311c"/></radialGradient>
                <linearGradient id="polDivider" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(251,191,36,0.95)"/><stop offset="100%" stop-color="rgba(251,191,36,0.35)"/></linearGradient>
                <radialGradient id="polRim" cx="50%" cy="32%" r="72%"><stop offset="0%" stop-color="#7a5a16"/><stop offset="55%" stop-color="#d8b252"/><stop offset="100%" stop-color="#5a3d00"/></radialGradient>
                <radialGradient id="polHub" cx="40%" cy="34%" r="72%"><stop offset="0%" stop-color="#ffffff"/><stop offset="38%" stop-color="#ecc862"/><stop offset="100%" stop-color="#7a5a10"/></radialGradient>
                <linearGradient id="polPtr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffe79a"/><stop offset="55%" stop-color="#f7b733"/><stop offset="100%" stop-color="#b97e10"/></linearGradient>
                <filter id="polShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="rgba(0,0,0,0.6)"/></filter>
              </defs>
              <circle cx="110" cy="110" r="103" fill="none" stroke="url(#polRim)" stroke-width="8"/>
              <circle cx="110" cy="110" r="98" fill="#0a0e17"/>
              ${wedges}
              ${lights}
              <circle cx="110" cy="110" r="16" fill="url(#polHub)" stroke="#5a3d00" stroke-width="1.5" filter="url(#polShadow)"/>
              <circle cx="110" cy="110" r="5" fill="#3a2900"/>
            </svg>
          </div>
        </div>`;

      polAmbient(container);

      const svgEl = container.querySelector('#pol-wheel-svg');
      const wrap = container.querySelector('.anim-wheel-wrap');
      const pointer = container.querySelector('.anim-wheel-pointer');
      const scene = container.querySelector('.anim-wheel-scene');

      setTimeout(() => wrap.classList.add('anim-wheel-wrap--enter'), 100);

      const targetOffset = -(winnerIdx * 45 + 22.5);
      const totalDeg = 5 * 360 + targetOffset + 360;
      setTimeout(() => {
        wrap.classList.add('anim-wheel-wrap--dim');
        svgEl.style.transition = `transform ${SPIN_DUR}ms cubic-bezier(0.12, 0.6, 0.18, 1)`;
        svgEl.style.transform = `rotate(${totalDeg}deg)`;
        let lastWedge = -1; const start = performance.now();
        const frame = (now) => {
          const progress = Math.min((now - start) / SPIN_DUR, 1);
          const cur = polEase(progress) * totalDeg;
          const norm = ((cur % 360) + 360) % 360;
          const w = Math.floor(norm / 45) % 8;
          if (w !== lastWedge) {
            lastWedge = w;
            pointer.classList.add('anim-wheel-pointer--tick');
            setTimeout(() => pointer.classList.remove('anim-wheel-pointer--tick'), 80);
          }
          if (progress < 1) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }, SPIN_START);

      setTimeout(() => {
        wrap.classList.remove('anim-wheel-wrap--dim');
        const winWedge = container.querySelector(`[data-wedge="${winnerIdx}"].anim-wheel-wedge`);
        const winLabel = container.querySelector(`[data-wedge="${winnerIdx}"].anim-wheel-label`);
        if (winWedge) winWedge.classList.add('anim-wheel-wedge--winner');
        if (winLabel) winLabel.classList.add('anim-wheel-label--winner');
        container.querySelectorAll('.anim-wheel-wedge').forEach((w, i) => { if (i !== winnerIdx) w.classList.add('anim-wheel-wedge--dim'); });
        flashGlow(pointer, { color: 'var(--gold-glow)', duration: 500 });
        burstParticles(scene, { count: 12, origin: { x: '50%', y: '8%' }, palette: ['var(--gold-glow)', 'var(--green-glow)', 'var(--purple-glow)'], duration: 900 });
        screenPunch(wrap, { scale: 1.04 });
      }, CLIMAX);

      setTimeout(() => {
        const winLabel = container.querySelector(`[data-wedge="${winnerIdx}"].anim-wheel-label`);
        if (winLabel) winLabel.classList.add('anim-wheel-label--pop');
        wrap.classList.add('anim-wheel-wrap--wobble');
        polReveal(scene, strainName);
      }, REVEAL);
    },
  };
