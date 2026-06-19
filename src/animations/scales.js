import { burstParticles, shake, screenPunch } from './_kinetic.js';
import { polReveal, _prefersReduced, polAmbient } from './_polish.js';

export const scalesAnimation = {
    id: 'scales', name: 'Weighing Scales',
    render(container, { strainName, winnerName, allScores }) {
      const ACT1 = 1200, ACT2_END = 3600, CLIMAX = 3800, REVEAL = 4400;
      const CAP = 6;
      const full  = allScores || [];
      const shown = full.slice(0, CAP);
      const extra = Math.max(0, full.length - CAP);

      container.innerHTML = `
        <div class="scales scales--enter pol-scales-bob">
          <div class="pol-scales-aura" id="pol-aura"></div>
          <div class="pol-motes" id="pol-motes"></div>
          <div class="scales__beam">
            <div class="scales__pillar scales__pillar--enter"></div>
            <div class="scales__arm scales__arm--level" id="anim-scales-arm">
              <div class="scales__plate scales__plate--left"><div class="scales__names" id="anim-scale-left"></div></div>
              <div class="scales__plate scales__plate--right"><div class="scales__names" id="anim-scale-right"></div></div>
            </div>
          </div>
          <div class="scales__base"></div>
          ${extra ? `<div class="pol-scales-counter">weighing ${full.length} strains &middot; +${extra} more on the scale</div>` : ''}
        </div>`;

      polAmbient(container);

      const arm = container.querySelector('#anim-scales-arm');
      const leftEl = container.querySelector('#anim-scale-left');
      const rightEl = container.querySelector('#anim-scale-right');
      const scene = container.querySelector('.scales');
      const pillar = container.querySelector('.scales__pillar');
      const leftPlate = container.querySelector('.scales__plate--left');
      const rightPlate = container.querySelector('.scales__plate--right');
      const motes = container.querySelector('#pol-motes');
      const aura = container.querySelector('#pol-aura');

      // Act 1 — pillar enters, arm settles
      setTimeout(() => {
        scene.classList.remove('scales--enter');
        pillar.classList.remove('scales__pillar--enter');
        arm.classList.add('scales__arm--settle');
        setTimeout(() => arm.classList.remove('scales__arm--settle'), 400);
      }, 200);

      // Secondary motion — golden motes drift up while weighing
      const palette = ['var(--gold-glow)', 'var(--green-glow)', 'rgba(255,255,255,0.8)'];
      const moteTimer = setInterval(() => {
        if (_prefersReduced()) return;
        const m = document.createElement('div');
        m.className = 'pol-mote';
        m.style.left = (15 + Math.random() * 70) + '%';
        m.style.background = palette[(Math.random() * palette.length) | 0];
        m.style.animationDuration = (1.2 + Math.random() * 0.9) + 's';
        motes.appendChild(m);
        setTimeout(() => m.remove(), 2200);
      }, 140);
      setTimeout(() => clearInterval(moteTimer), ACT2_END);

      // Act 2 — names land (capped) with weight-based tipping
      const SPREAD = ACT2_END - ACT1 - 200;
      const nameDelay = Math.min(220, SPREAD / Math.max(shown.length, 1));
      shown.forEach((s, i) => {
        const isLeft = i % 2 === 0;
        const side = isLeft ? leftEl : rightEl;
        const plate = isLeft ? leftPlate : rightPlate;
        setTimeout(() => {
          if (!side) return;
          const span = document.createElement('span');
          span.className = 'scales__name';
          span.textContent = s.strainName;
          side.appendChild(span);
          screenPunch(plate, { scale: 1.06 });
          const diff = leftEl.children.length - rightEl.children.length;
          const rotation = Math.max(-8, Math.min(8, diff * 2.5));
          arm.style.transition = 'transform 0.4s var(--ease-snap)';
          arm.style.transform = `rotate(${rotation}deg)`;
        }, ACT1 + 200 + i * nameDelay);
      });

      // Climax — settle the aura, beam decides winner
      setTimeout(() => {
        if (aura) aura.classList.add('pol-aura--off');
        arm.classList.remove('scales__arm--level');
        arm.style.transition = 'transform 0.6s var(--ease-snap)';
        const winnerIndex = shown.findIndex(s => s.strainName === winnerName);
        const winnerOnLeft = (winnerIndex < 0 ? 0 : winnerIndex) % 2 === 0;
        // winner is the HEAVIER side, so its plate drops (left down = negative rotation)
        arm.style.transform = winnerOnLeft ? 'rotate(-14deg)' : 'rotate(14deg)';
        const winPlate = winnerOnLeft ? leftPlate : rightPlate;
        const losePlate = winnerOnLeft ? rightPlate : leftPlate;
        const winNames = winnerOnLeft ? leftEl : rightEl;

        setTimeout(() => {
          shake(winPlate, { magnitude: 5, duration: 250 });
          burstParticles(winPlate, {
            count: 14, origin: { x: '50%', y: '20%' },
            palette: ['var(--gold-glow)', 'var(--green-glow)', 'var(--gold-primary)'], duration: 850,
          });
          losePlate.style.opacity = '0.4';
          losePlate.style.transition = 'opacity 0.4s ease';
        }, 200);

        setTimeout(() => {
          const winnerPill = winNames.querySelector('.scales__name:first-child');
          if (winnerPill) winnerPill.classList.add('scales__name--winner');
          polReveal(scene, winnerName);
        }, REVEAL - CLIMAX);
      }, CLIMAX);
    },
  };
