import { flashGlow, screenPunch } from './_kinetic.js';
import { spawnSwirl, polMysticBurst, polReveal, polAmbient } from './_polish.js';

export const crystalAnimation = {
    id: 'crystal', name: 'Crystal Ball Oracle',
    render(container, { strainName, winnerName, allScores }) {
      const ACT1 = 1200, WINDUP = 3800, CLIMAX = 3900, REVEAL = 4400;
      const names = (allScores || []).map(s => s.strainName);

      container.innerHTML = `
        <div class="anim-crystal-scene anim-crystal-scene--dim">
          <div class="anim-crystal-haze anim-crystal-haze--1"></div>
          <div class="anim-crystal-haze anim-crystal-haze--2"></div>
          <div class="anim-crystal-haze anim-crystal-haze--3"></div>
          <div class="anim-crystal-wrap anim-crystal-wrap--enter">
            <div class="pol-bob" style="position:relative">
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
        </div>`;

      polAmbient(container);

      const scene = container.querySelector('.anim-crystal-scene');
      const ball = container.querySelector('.anim-crystal-ball');
      const wrap = container.querySelector('.anim-crystal-wrap');
      const nameEl = container.querySelector('.anim-crystal-name');
      const radials = container.querySelector('.anim-crystal-radials');

      // names swirl deep inside the sphere, behind the smoke
      const swirl = spawnSwirl(ball, names, { round: true, prepend: true });

      setTimeout(() => {
        scene.classList.remove('anim-crystal-scene--dim');
        ball.classList.remove('anim-crystal-ball--dark');
        ball.classList.add('anim-crystal-ball--glow1');
        wrap.classList.remove('anim-crystal-wrap--enter');
      }, ACT1);
      setTimeout(() => ball.classList.add('anim-crystal-ball--glow2'), ACT1 + 700);
      setTimeout(() => ball.classList.add('anim-crystal-ball--glow3'), ACT1 + 1400);

      setTimeout(() => {
        swirl.stop();
        ball.classList.remove('anim-crystal-ball--glow1', 'anim-crystal-ball--glow2', 'anim-crystal-ball--glow3');
        ball.classList.add('anim-crystal-ball--breathhold');
      }, WINDUP);

      setTimeout(() => {
        ball.classList.remove('anim-crystal-ball--breathhold');
        ball.classList.add('anim-crystal-ball--flash');
        flashGlow(ball, { color: 'var(--purple-glow)', duration: 400 });
        polMysticBurst(scene);
        radials.classList.add('anim-crystal-radials--burst');
        screenPunch(scene, { scale: 1.04 });
      }, CLIMAX);

      setTimeout(() => {
        nameEl.textContent = '\u{1F33F}';
        nameEl.style.fontSize = '0.9rem';
        nameEl.classList.add('visible');
        polReveal(scene, strainName);
      }, REVEAL);
    },
  };
