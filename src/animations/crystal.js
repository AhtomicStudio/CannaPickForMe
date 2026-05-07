import { burstParticles, flashGlow, screenPunch } from './_kinetic.js';

const ACT1 = 1200, ACT2 = 3400, WINDUP = 3800, CLIMAX = 3900, REVEAL = 4400;

export const crystalAnimation = {
  id: 'crystal',
  name: 'Crystal Ball Oracle',

  render(container, { strainName, winnerName }) {
    container.innerHTML = `
      <div class="anim-crystal-scene anim-crystal-scene--dim">
        <div class="anim-crystal-haze anim-crystal-haze--1"></div>
        <div class="anim-crystal-haze anim-crystal-haze--2"></div>
        <div class="anim-crystal-haze anim-crystal-haze--3"></div>
        <div class="anim-crystal-wrap anim-crystal-wrap--enter">
          <div style="position:relative">
            <div class="anim-crystal-tendril anim-crystal-tendril--1"></div>
            <div class="anim-crystal-tendril anim-crystal-tendril--2"></div>
            <div class="anim-crystal-tendril anim-crystal-tendril--3"></div>
            <div class="anim-crystal-ball anim-crystal-ball--dark">
              <div class="anim-crystal-smoke anim-crystal-smoke--1"></div>
              <div class="anim-crystal-smoke anim-crystal-smoke--2"></div>
              <div class="anim-crystal-smoke anim-crystal-smoke--3"></div>
              <div class="anim-crystal-shine"></div>
              <div class="anim-crystal-name"></div>
            </div>
          </div>
          <div class="anim-crystal-base"></div>
        </div>
        <div class="anim-crystal-radials"></div>
      </div>
    `;

    const scene  = container.querySelector('.anim-crystal-scene');
    const ball   = container.querySelector('.anim-crystal-ball');
    const wrap   = container.querySelector('.anim-crystal-wrap');
    const nameEl = container.querySelector('.anim-crystal-name');
    const radials = container.querySelector('.anim-crystal-radials');

    // Act 1: lighten scene, ball wakes
    setTimeout(() => {
      scene.classList.remove('anim-crystal-scene--dim');
      ball.classList.remove('anim-crystal-ball--dark');
      ball.classList.add('anim-crystal-ball--glow1');
      wrap.classList.remove('anim-crystal-wrap--enter');
    }, ACT1);

    // Act 2: intensify glow in stages
    setTimeout(() => ball.classList.add('anim-crystal-ball--glow2'), ACT1 + 700);
    setTimeout(() => ball.classList.add('anim-crystal-ball--glow3'), ACT1 + 1400);

    // Wind-up: held breath — ball dims
    setTimeout(() => {
      ball.classList.remove('anim-crystal-ball--glow1','anim-crystal-ball--glow2','anim-crystal-ball--glow3');
      ball.classList.add('anim-crystal-ball--breathhold');
    }, WINDUP);

    // Climax: flash, radial lines, burst
    setTimeout(() => {
      ball.classList.remove('anim-crystal-ball--breathhold');
      ball.classList.add('anim-crystal-ball--flash');
      flashGlow(ball, { color: 'var(--purple-glow)', duration: 400 });
      burstParticles(wrap, {
        count: 12,
        origin: { x: '50%', y: '45%' },
        palette: ['var(--purple-glow)', 'var(--green-glow)', 'rgba(255,255,255,0.8)'],
        duration: 900,
      });
      radials.classList.add('anim-crystal-radials--burst');
      screenPunch(scene, { scale: 1.04 });
    }, CLIMAX);

    // Reveal: typewriter letter-by-letter
    setTimeout(() => {
      typewriterReveal(nameEl, strainName, 400);
    }, REVEAL);
  },
};

function typewriterReveal(el, text, totalDuration) {
  el.innerHTML = '';
  el.style.opacity = '1';
  const chars  = text.split('');
  const delay  = totalDuration / Math.max(chars.length, 1);
  chars.forEach((ch, i) => {
    setTimeout(() => {
      const span = document.createElement('span');
      span.textContent = ch === ' ' ? '\u00a0' : ch;
      span.className = 'anim-crystal-letter';
      el.appendChild(span);
    }, i * delay);
  });
}
