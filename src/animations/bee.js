import { burstParticles, screenPunch, flashGlow } from './_kinetic.js';

const ACT1   = 1000;
const CLIMAX = 4000;
const REVEAL = 4400;

export const beeAnimation = {
  id: 'bee',
  name: 'Bee in the Garden',

  render(container, { strainName, winnerName, allScores }) {
    // Pick 5 strains; place winner at a random index 0-4
    const names = (allScores || []).slice(0, 5).map(s => s.strainName);
    while (names.length < 5) names.push('???');
    const winnerIdx = Math.floor(Math.random() * 5);
    // Swap so winner is at winnerIdx
    const originalWinner = names[0];
    names[0] = names[winnerIdx];
    names[winnerIdx] = originalWinner;

    const flowersHTML = names.map((name, i) => `
      <div class="anim-bee-flower" data-flower="${i}" style="--flower-idx:${i}">
        <div class="anim-bee-flower-stem"></div>
        <div class="anim-bee-flower-head">🌿</div>
        <div class="anim-bee-flower-label">${name}</div>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="anim-bee-scene">
        <div class="anim-bee-sun"></div>
        <div class="anim-bee-sky"></div>
        <div class="anim-bee-flowers">${flowersHTML}</div>
        <div class="anim-bee-wrap">
          <div class="anim-bee">
            <div class="anim-bee-wing anim-bee-wing--l"></div>
            <div class="anim-bee-wing anim-bee-wing--r"></div>
            <div class="anim-bee-body">🐝</div>
          </div>
        </div>
        <div class="anim-bee-name-pillar"></div>
      </div>
    `;

    const scene   = container.querySelector('.anim-bee-scene');
    const bee     = container.querySelector('.anim-bee-wrap');
    const beeEl   = container.querySelector('.anim-bee');
    const flowers = container.querySelectorAll('.anim-bee-flower');
    const pillar  = container.querySelector('.anim-bee-name-pillar');
    const winFlower = flowers[winnerIdx];

    // Act 1 — garden assembles: stems pop up with stagger
    flowers.forEach((f, i) => {
      setTimeout(() => f.classList.add('anim-bee-flower--grown'), 150 + i * 120);
    });

    // Bee enters from left after Act 1
    setTimeout(() => {
      bee.classList.add('anim-bee-wrap--enter');
      beeEl.classList.add('anim-bee--flying');
    }, ACT1);

    // Act 2 — bee hovers over each flower in sequence
    const hoverDuration = 350;
    const travelTime    = (ACT1 + 400);
    flowers.forEach((f, i) => {
      const t = travelTime + i * 480;
      setTimeout(() => {
        // Move bee over flower i via CSS class swap
        bee.style.transition = `transform 300ms var(--ease-snap)`;
        // Positions: flower 0 at ~10%, 1 at 27%, 2 at 44%, 3 at 61%, 4 at 78%
        const xPct = 10 + i * 17;
        bee.style.transform = `translateX(${xPct}%)`;
        f.classList.add('anim-bee-flower--hover');
        setTimeout(() => f.classList.remove('anim-bee-flower--hover'), hoverDuration);
      }, t);
    });

    // Wind-up — bee circles winner (orbit via CSS animation class)
    setTimeout(() => {
      const wx = 10 + winnerIdx * 17;
      bee.style.transition = `transform 400ms var(--ease-snap)`;
      bee.style.transform  = `translateX(${wx}%)`;
      bee.classList.add('anim-bee-wrap--circle');
      flowers.forEach((f, i) => {
        if (i !== winnerIdx) {
          f.classList.add('anim-bee-flower--dim');
        }
      });
    }, 3600);

    // Climax — bee lands, flower blooms
    setTimeout(() => {
      bee.classList.remove('anim-bee-wrap--circle');
      bee.classList.add('anim-bee-wrap--land');
      winFlower.classList.add('anim-bee-flower--bloom');
      burstParticles(scene, {
        count: 16,
        origin: { x: `${10 + winnerIdx * 17 + 8}%`, y: '55%' },
        palette: ['var(--gold-glow)', 'var(--green-glow)', 'var(--gold-primary)'],
        duration: 800,
      });
      screenPunch(scene, { scale: 1.03 });
    }, CLIMAX);

    // Reveal — name pillar rises above winner flower
    setTimeout(() => {
      pillar.textContent = strainName;
      pillar.style.left  = `${10 + winnerIdx * 17 + 4}%`;
      pillar.classList.add('visible');
    }, REVEAL);
  },
};
