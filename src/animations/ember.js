import { burstParticles, screenPunch } from './_kinetic.js';

const SETTLE  = 1200;  // joint + lighter slid in
const STRIKE1 = 1400;  // first failed strike
const STRIKE2 = 2000;  // second failed strike
const STRIKE3 = 2600;  // third strike — ignition
const LIGHT   = 3000;  // ember glows
const SMOKE   = 4000;  // smoke + letter reveal starts
const REVEAL  = 4000;

export const emberAnimation = {
  id: 'ember',
  name: 'Ember Spark',

  render(container, { strainName, winnerName }) {
    container.innerHTML = `
      <div class="anim-ember-scene">
        <div class="anim-ember-bg"></div>
        <div class="anim-ember-joint anim-ember-joint--enter">
          <div class="anim-ember-joint-body"></div>
          <div class="anim-ember-joint-tip"></div>
          <div class="anim-ember-joint-filter"></div>
          <div class="anim-ember-joint-glow"></div>
        </div>
        <div class="anim-ember-lighter anim-ember-lighter--enter">
          <div class="anim-ember-lighter-body">
            <div class="anim-ember-lighter-wheel"></div>
          </div>
          <div class="anim-ember-lighter-flame"></div>
          <div class="anim-ember-lighter-sparks"></div>
        </div>
        <div class="anim-ember-smoke-wrap">
          ${[0,1,2,3,4,5].map(i => `<div class="anim-ember-puff" style="--puff-delay:${i*80}ms;--puff-x:${(i%3)*8-8}px"></div>`).join('')}
        </div>
        <div class="anim-ember-name"></div>
      </div>
    `;

    const scene    = container.querySelector('.anim-ember-scene');
    const joint    = container.querySelector('.anim-ember-joint');
    const lighter  = container.querySelector('.anim-ember-lighter');
    const glow     = container.querySelector('.anim-ember-joint-glow');
    const flame    = container.querySelector('.anim-ember-lighter-flame');
    const sparksEl = container.querySelector('.anim-ember-lighter-sparks');
    const smokeWrap = container.querySelector('.anim-ember-smoke-wrap');
    const nameEl   = container.querySelector('.anim-ember-name');
    const bg       = container.querySelector('.anim-ember-bg');

    // Act 1 — joint + lighter slide in
    setTimeout(() => {
      joint.classList.remove('anim-ember-joint--enter');
      lighter.classList.remove('anim-ember-lighter--enter');
      bg.classList.add('anim-ember-bg--warm');
    }, 100);

    // Strike helper — spawns sparks burst
    const doStrike = (t, big = false) => {
      setTimeout(() => {
        lighter.classList.add('anim-ember-lighter--jitter');
        setTimeout(() => lighter.classList.remove('anim-ember-lighter--jitter'), 200);
        burstParticles(sparksEl, {
          count: big ? 12 : 7,
          origin: { x: '50%', y: '0%' },
          palette: ['var(--gold-glow)', 'rgba(255,200,80,0.9)', 'rgba(255,150,50,0.8)'],
          duration: big ? 500 : 350,
          className: 'kfx-spark kfx-spark--ember',
        });
      }, t);
    };

    doStrike(STRIKE1);
    doStrike(STRIKE2);
    doStrike(STRIKE3, true);

    // Third strike — lighter tilts toward joint, flame appears
    setTimeout(() => {
      lighter.classList.add('anim-ember-lighter--tilt');
      flame.classList.add('anim-ember-lighter-flame--on');
    }, STRIKE3 + 100);

    // Ignition — ember catches
    setTimeout(() => {
      glow.classList.add('anim-ember-joint-glow--lit');
      screenPunch(scene, { scale: 1.03 });
      burstParticles(scene, {
        count: 8,
        origin: { x: '28%', y: '50%' },
        palette: ['var(--gold-glow)', 'rgba(255,120,30,0.9)', 'var(--gold-primary)'],
        duration: 600,
      });
      // Lighter pulls away
      setTimeout(() => {
        lighter.classList.remove('anim-ember-lighter--tilt');
        lighter.classList.add('anim-ember-lighter--away');
        flame.classList.remove('anim-ember-lighter-flame--on');
      }, 400);
    }, LIGHT);

    // Smoke rises
    setTimeout(() => {
      smokeWrap.classList.add('anim-ember-smoke-wrap--active');
    }, SMOKE);

    // Letter-by-letter name reveal in smoke
    setTimeout(() => {
      typewriterSmoke(nameEl, strainName, 500);
    }, REVEAL);
  },
};

function typewriterSmoke(el, text, totalDuration) {
  el.innerHTML = '';
  el.style.opacity = '1';
  const chars = text.split('');
  const delay = totalDuration / Math.max(chars.length, 1);
  chars.forEach((ch, i) => {
    setTimeout(() => {
      const span = document.createElement('span');
      span.className = 'anim-ember-letter';
      span.textContent = ch === ' ' ? '\u00a0' : ch;
      el.appendChild(span);
    }, i * delay);
  });
}
