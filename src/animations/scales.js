import { burstParticles, shake, screenPunch } from './_kinetic.js';

const ACT1 = 1200, ACT2_END = 3600, CLIMAX = 3800, REVEAL = 4400;

export const scalesAnimation = {
  id: 'scales',
  name: 'Weighing Scales',

  render(container, { strainName, winnerName, allScores }) {
    container.innerHTML = `
      <div class="scales scales--enter">
        <div class="scales__beam">
          <div class="scales__pillar scales__pillar--enter"></div>
          <div class="scales__arm scales__arm--level" id="anim-scales-arm">
            <div class="scales__plate scales__plate--left">
              <div class="scales__names" id="anim-scale-left"></div>
            </div>
            <div class="scales__plate scales__plate--right">
              <div class="scales__names" id="anim-scale-right"></div>
            </div>
          </div>
        </div>
        <div class="scales__base"></div>
      </div>
    `;

    const arm      = container.querySelector('#anim-scales-arm');
    const leftEl   = container.querySelector('#anim-scale-left');
    const rightEl  = container.querySelector('#anim-scale-right');
    const scene    = container.querySelector('.scales');
    const pillar   = container.querySelector('.scales__pillar');
    const leftPlate  = container.querySelector('.scales__plate--left');
    const rightPlate = container.querySelector('.scales__plate--right');

    // Act 1 — pillar enters, arm settles
    setTimeout(() => {
      scene.classList.remove('scales--enter');
      pillar.classList.remove('scales__pillar--enter');
      arm.classList.add('scales__arm--settle');
      setTimeout(() => arm.classList.remove('scales__arm--settle'), 400);
    }, 200);

    // Act 2 — add names with weight-based tipping
    const SPREAD = ACT2_END - ACT1 - 200;
    const nameDelay = Math.min(220, SPREAD / Math.max(allScores.length, 1));

    allScores.forEach((s, i) => {
      const isLeft = i % 2 === 0;
      const side   = isLeft ? leftEl : rightEl;
      const plate  = isLeft ? leftPlate : rightPlate;

      setTimeout(() => {
        if (!side) return;
        const span = document.createElement('span');
        span.className = 'scales__name';
        span.textContent = s.strainName;
        side.appendChild(span);

        // Micro-punch on the plate that got a name
        screenPunch(plate, { scale: 1.06 });

        // Tip beam proportional to name count
        const leftCount  = leftEl.children.length;
        const rightCount = rightEl.children.length;
        const diff       = leftCount - rightCount;
        const rotation   = Math.max(-8, Math.min(8, diff * 2.5));
        arm.style.transition = 'transform 0.4s var(--ease-snap)';
        arm.style.transform  = `rotate(${rotation}deg)`;
      }, ACT1 + 200 + i * nameDelay);
    });

    // Climax — beam decides winner
    setTimeout(() => {
      arm.classList.remove('scales__arm--level');
      arm.style.transition = 'transform 0.6s var(--ease-snap)';

      // Winner is allScores[0]. Check which side it lands on.
      const winnerIndex = allScores.findIndex(s => s.strainName === winnerName);
      const winnerOnLeft = winnerIndex % 2 === 0;
      arm.style.transform = winnerOnLeft ? 'rotate(14deg)' : 'rotate(-14deg)';

      const winPlate = winnerOnLeft ? leftPlate : rightPlate;
      const losePlate = winnerOnLeft ? rightPlate : leftPlate;
      const winNames  = winnerOnLeft ? leftEl : rightEl;

      setTimeout(() => {
        shake(winPlate, { magnitude: 5, duration: 250 });
        burstParticles(winPlate, {
          count: 12,
          origin: { x: '50%', y: '20%' },
          palette: ['var(--gold-glow)', 'var(--green-glow)', 'var(--gold-primary)'],
          duration: 800,
        });
        losePlate.style.opacity = '0.4';
        losePlate.style.transition = 'opacity 0.4s ease';
      }, 200);

      // Golden winner pill
      setTimeout(() => {
        const winnerPill = winNames.querySelector('.scales__name:first-child');
        if (winnerPill) {
          winnerPill.classList.add('scales__name--winner');
        }
      }, REVEAL - CLIMAX);
    }, CLIMAX);
  },
};
