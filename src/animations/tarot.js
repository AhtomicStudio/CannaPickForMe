import { burstParticles, flashGlow, screenPunch } from './_kinetic.js';

const ACT1 = 1000, ACT2 = 3600, WINDUP = 3600, FLIP = 4000, CLIMAX = 4300, REVEAL = 4500;

const SPARK_POSITIONS = [
  { top: '18%', left: '12%' },
  { top: '14%', left: '78%' },
  { top: '58%', left: '6%'  },
  { top: '62%', left: '82%' },
  { top: '8%',  left: '46%' },
];

export const tarotAnimation = {
  id: 'tarot',
  name: 'Tarot Card Draw',

  render(container, { strainName, winnerName }) {
    const sparksHTML = SPARK_POSITIONS.map(
      pos => `<span class="anim-tarot-spark" style="top:${pos.top};left:${pos.left}">✦</span>`
    ).join('');

    container.innerHTML = `
      <div class="anim-tarot-scene">
        ${sparksHTML}
        <div class="anim-tarot-card anim-tarot-card--c1 anim-tarot-card--deal1"></div>
        <div class="anim-tarot-card anim-tarot-card--c2 anim-tarot-card--deal2"></div>
        <div class="anim-tarot-card anim-tarot-card--c3 anim-tarot-card--deal3" style="z-index:3"></div>
        <div class="anim-tarot-card anim-tarot-card--c4 anim-tarot-card--deal4"></div>
        <div class="anim-tarot-card anim-tarot-card--c5 anim-tarot-card--deal5"></div>
        <div class="anim-tarot-glow"></div>
        <div class="anim-tarot-label"></div>
      </div>
    `;

    const scene   = container.querySelector('.anim-tarot-scene');
    const cards   = container.querySelectorAll('.anim-tarot-card');
    const glow    = container.querySelector('.anim-tarot-glow');
    const label   = container.querySelector('.anim-tarot-label');
    const centerCard = container.querySelector('.anim-tarot-card--c3');

    // Remove deal classes after stagger
    [120, 240, 360, 480, 600].forEach((delay, i) => {
      setTimeout(() => {
        cards[i]?.classList.remove(`anim-tarot-card--deal${i + 1}`);
        cards[i]?.classList.add('anim-tarot-card--fanned');
      }, delay);
    });

    // Act 2 — fan hover animation
    setTimeout(() => {
      glow.classList.add('anim-tarot-glow--active');
      cards.forEach(c => c.classList.add('anim-tarot-card--hover'));
    }, ACT1);

    // Wind-up — outer cards recede
    setTimeout(() => {
      cards.forEach((c, i) => {
        if (i !== 2) {
          c.classList.add('anim-tarot-card--recede');
          c.classList.remove('anim-tarot-card--hover');
        } else {
          c.classList.add('anim-tarot-card--focus');
        }
      });
    }, WINDUP);

    // Flip at 4.0s (center card edge-on, swap to winner face, then front)
    setTimeout(() => {
      centerCard.classList.add('anim-tarot-card--flip');
    }, FLIP);

    setTimeout(() => {
      centerCard.classList.add('anim-tarot-card--winner');
    }, FLIP + 150);

    // Climax
    setTimeout(() => {
      flashGlow(centerCard, { color: 'var(--green-glow)', duration: 400 });
      burstParticles(scene, {
        count: 10,
        origin: { x: '50%', y: '45%' },
        palette: ['var(--green-glow)', 'var(--gold-glow)', 'var(--purple-glow)'],
        duration: 800,
        className: 'kfx-spark kfx-spark--large',
      });
      screenPunch(scene, { scale: 1.03 });
      container.querySelectorAll('.anim-tarot-spark').forEach((spark, i) => {
        setTimeout(() => spark.classList.add('pop'), i * 60);
      });
    }, CLIMAX);

    // Reveal
    setTimeout(() => {
      label.textContent = strainName;
      label.classList.add('visible');
      centerCard.classList.add('anim-tarot-card--sway');
    }, REVEAL);
  },
};
