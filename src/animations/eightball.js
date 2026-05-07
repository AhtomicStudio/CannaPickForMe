import { burstParticles, shake, flashGlow, screenPunch } from './_kinetic.js';

const ACT1 = 1000, ACT2 = 3600, WINDUP = 3900, CLIMAX = 4100, REVEAL = 4400;

export const eightBallAnimation = {
  id: 'eightball',
  name: 'Magic 8-Ball',

  render(container, { strainName, winnerName }) {
    container.innerHTML = `
      <div class="anim-ball-scene">
        <div class="anim-ball anim-ball--entry">
          <div class="anim-ball-window">
            <div class="anim-ball-mist"></div>
            <div class="anim-ball-reveal"></div>
          </div>
        </div>
        <div class="anim-ball-cloud"></div>
      </div>
    `;

    const scene  = container.querySelector('.anim-ball-scene');
    const ball   = container.querySelector('.anim-ball');
    const mist   = container.querySelector('.anim-ball-mist');
    const reveal = container.querySelector('.anim-ball-reveal');

    // Act 2 — three discrete shake bursts
    setTimeout(() => {
      ball.classList.remove('anim-ball--entry');
      ball.classList.add('anim-ball--idle');
    }, ACT1);

    [ACT1 + 100, ACT1 + 800, ACT1 + 1500].forEach((t) => {
      setTimeout(() => {
        shake(ball, { magnitude: 8, duration: 350 });
        mist.classList.add('anim-ball-mist--fast');
        setTimeout(() => mist.classList.remove('anim-ball-mist--fast'), 350);
      }, t);
    });

    // Wind-up — ball goes dead still, mist clears
    setTimeout(() => {
      ball.classList.remove('anim-ball--idle');
      ball.classList.add('anim-ball--windup');
      mist.classList.add('anim-ball-mist--clear');
    }, WINDUP);

    // Climax — mist snaps green, glow, particles
    setTimeout(() => {
      ball.classList.remove('anim-ball--windup');
      ball.classList.add('anim-ball--climax');
      mist.classList.remove('anim-ball-mist--clear');
      mist.classList.add('anim-ball-mist--hot');
      const win = container.querySelector('.anim-ball-window');
      if (win) {
        flashGlow(win, { color: 'var(--green-glow)', duration: 400 });
        burstParticles(win, {
          count: 8, origin: { x: '50%', y: '80%' },
          palette: ['var(--green-glow)', 'var(--green-primary)'],
          duration: 700,
        });
      }
      screenPunch(scene, { scale: 1.05 });
    }, CLIMAX);

    // Reveal — strain name
    setTimeout(() => {
      reveal.textContent = strainName;
      reveal.classList.add('visible');
      ball.classList.add('anim-ball--wobble');
    }, REVEAL);
  },
};
