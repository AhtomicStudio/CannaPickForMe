import { burstParticles, shake, flashGlow, screenPunch } from './_kinetic.js';
import { spawnSwirl, polReveal, _prefersReduced, polAmbient } from './_polish.js';

export const eightBallAnimation = {
    id: 'eightball', name: 'Magic 8-Ball',
    render(container, { strainName, winnerName, allScores }) {
      const ACT1 = 1000, WINDUP = 3900, CLIMAX = 4100, REVEAL = 4400;
      const names = (allScores || []).map(s => s.strainName);

      container.innerHTML = `
        <div class="anim-ball-scene">
          <div class="anim-ball anim-ball--entry">
            <div class="anim-ball-window">
              <div class="anim-ball-mist"></div>
              <div class="anim-ball-reveal"></div>
            </div>
          </div>
          <div class="anim-ball-cloud"></div>
        </div>`;

      polAmbient(container);

      const scene = container.querySelector('.anim-ball-scene');
      const ball = container.querySelector('.anim-ball');
      const mist = container.querySelector('.anim-ball-mist');
      const reveal = container.querySelector('.anim-ball-reveal');
      const win = container.querySelector('.anim-ball-window');

      // names swirl behind the mist
      const swirl = spawnSwirl(win, names, { round: true, prepend: true });

      setTimeout(() => {
        ball.classList.remove('anim-ball--entry');
        // NOTE: do not add anim-ball--idle here. It sets `animation:none !important`,
        // which ties with our wobble and can suppress it. The wobble (higher
        // specificity + !important) already overrides the base shake on its own.
        if (!_prefersReduced()) {
          ball.classList.add('pol-ball--rock');   // continuous dramatic Pokeball wobble
          mist.classList.add('anim-ball-mist--fast');
        }
      }, ACT1);

      // Wind-up — swirl clears, ball goes still
      setTimeout(() => {
        swirl.stop();
        ball.classList.remove('pol-ball--rock', 'anim-ball--idle');
        ball.classList.add('anim-ball--windup');
        mist.classList.remove('anim-ball-mist--fast');
        mist.classList.add('anim-ball-mist--clear');
      }, WINDUP);

      // Climax
      setTimeout(() => {
        ball.classList.remove('anim-ball--windup');
        ball.classList.add('anim-ball--climax');
        mist.classList.remove('anim-ball-mist--clear');
        mist.classList.add('anim-ball-mist--hot');
        if (win) {
          flashGlow(win, { color: 'var(--green-glow)', duration: 400 });
          burstParticles(win, {
            count: 10, origin: { x: '50%', y: '80%' },
            palette: ['var(--green-glow)', 'var(--green-primary)'], duration: 700,
          });
        }
        screenPunch(scene, { scale: 1.05 });
      }, CLIMAX);

      // Reveal
      setTimeout(() => {
        reveal.textContent = '\u{1F33F}';
        reveal.classList.add('visible');
        ball.classList.add('anim-ball--wobble');
        polReveal(scene, strainName);
      }, REVEAL);
    },
  };
