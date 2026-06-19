import { burstParticles, shake, screenPunch } from './_kinetic.js';
import { polReveal, polAmbient } from './_polish.js';

export const boxAnimation = {
    id: 'box', name: 'Notes in a Box',
    render(container, { strainName, winnerName, allScores }) {
      const full = allScores || [];
      const CAP = 10;
      const cards = full.slice(0, CAP).map(s => s.strainName);
      const extra = Math.max(0, full.length - CAP);

      container.innerHTML = `
        <div class="pol-box-scene">
          <div class="pol-box pol-box--enter">
            <div class="pol-box-back"></div>
            <div class="pol-box-cards" id="pbx-cards"></div>
            <div class="pol-box-smoke" id="pbx-smoke"></div>
            <div class="pol-box-front"></div>
            <div class="pol-box-lid pol-box-lid--l"></div>
            <div class="pol-box-lid pol-box-lid--r"></div>
          </div>
          <div class="pol-box-winner" id="pbx-winner"></div>
          ${extra ? `<div class="pol-box-counter">+${extra} more in the box</div>` : ''}
        </div>`;

      polAmbient(container);

      const scene = container.querySelector('.pol-box-scene');
      const boxEl = container.querySelector('.pol-box');
      const cardsEl = container.querySelector('#pbx-cards');
      const smokeEl = container.querySelector('#pbx-smoke');
      const winnerEl = container.querySelector('#pbx-winner');

      const ACT1 = 700, flyStart = ACT1 + 200;
      const flyGap = Math.min(180, 1800 / Math.max(cards.length, 1));

      cards.forEach((nm, i) => {
        const card = document.createElement('div');
        card.className = 'pol-box-card';
        card.textContent = nm;
        const sx = Math.random() * 120 - 60, sr = Math.random() * 60 - 30;
        card.style.transform = `translate(${sx.toFixed(0)}px, -130px) rotate(${sr.toFixed(0)}deg)`;
        cardsEl.appendChild(card);
        setTimeout(() => {
          const tx = Math.random() * 54 - 27, ty = 30 + Math.random() * 16, tr = Math.random() * 24 - 12;
          card.style.transition = 'transform 0.5s var(--ease-snap), opacity 0.2s ease';
          card.style.opacity = '1';
          card.style.transform = `translate(${tx.toFixed(0)}px, ${ty.toFixed(0)}px) rotate(${tr.toFixed(0)}deg)`;
          if (i % 2 === 0) screenPunch(boxEl, { scale: 1.03 });
        }, flyStart + i * flyGap);
      });

      const allIn = flyStart + cards.length * flyGap + 300;
      setTimeout(() => shake(boxEl, { magnitude: 6, duration: 400 }), allIn);
      setTimeout(() => shake(boxEl, { magnitude: 5, duration: 350 }), allIn + 320);

      const CLIMAX = Math.max(allIn + 700, 3900);
      setTimeout(() => {
        for (let i = 0; i < 14; i++) {
          const puff = document.createElement('div');
          puff.className = 'pol-box-puff pol-box-puff--go';
          puff.style.left = (Math.random() * 84) + '%';
          const sz = 34 + Math.random() * 28;
          puff.style.width = sz + 'px'; puff.style.height = sz + 'px';
          puff.style.animationDelay = (Math.random() * 380) + 'ms';
          smokeEl.appendChild(puff);
          setTimeout(() => puff.remove(), 1900);
        }
        cardsEl.style.transition = 'opacity 0.4s ease';
        cardsEl.style.opacity = '0.35';
        winnerEl.textContent = '\u{1F33F}';
        winnerEl.classList.add('pol-box-winner--up');
        setTimeout(() => polReveal(scene, strainName), 450);
        burstParticles(scene, { count: 16, origin: { x: '50%', y: '42%' }, palette: ['var(--gold-glow)', 'var(--green-glow)', 'var(--gold-primary)'], duration: 850 });
        screenPunch(boxEl, { scale: 1.06 });
        shake(boxEl, { magnitude: 4, duration: 220 });
      }, CLIMAX);
    },
  };
