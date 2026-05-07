import { burstParticles, screenPunch, shake } from './_kinetic.js';

const ACT1 = 1000, SHUFFLE_END = 3800, WINDUP = 3800, CLIMAX = 4000, REVEAL = 4400;

export const boxAnimation = {
  id: 'box',
  name: 'Notes in a Box',

  render(container, { strainName, winnerName, allScores }) {
    const competitors = (allScores || []).slice(1, 4).map(s => s.strainName);
    while (competitors.length < 3) competitors.push('???');

    container.innerHTML = `
      <div class="anim-box-scene">
        <div class="anim-box-body anim-box-body--enter">
          <div class="anim-box-lid anim-box-lid--closed"></div>
          <div class="anim-box-note anim-box-note--1">${competitors[0]}</div>
          <div class="anim-box-note anim-box-note--2">${competitors[1]}</div>
          <div class="anim-box-note anim-box-note--3">${competitors[2]}</div>
          <div class="anim-box-chosen"></div>
        </div>
      </div>
    `;

    const scene  = container.querySelector('.anim-box-scene');
    const body   = container.querySelector('.anim-box-body');
    const lid    = container.querySelector('.anim-box-lid');
    const chosen = container.querySelector('.anim-box-chosen');
    const notes  = container.querySelectorAll('.anim-box-note');

    // Act 1 — box drops in, lid opens once
    setTimeout(() => {
      body.classList.remove('anim-box-body--enter');
    }, 100);
    setTimeout(() => {
      lid.classList.remove('anim-box-lid--closed');
      lid.classList.add('anim-box-lid--open');
      notes.forEach(n => n.classList.add('anim-box-note--active'));
    }, ACT1);

    // Act 2 — notes shuffle twice
    setTimeout(() => notes.forEach(n => n.classList.add('anim-box-note--shuffle1')), 1400);
    setTimeout(() => {
      notes.forEach(n => {
        n.classList.remove('anim-box-note--shuffle1');
        n.classList.add('anim-box-note--shuffle2');
      });
    }, 2200);
    setTimeout(() => notes.forEach(n => n.classList.remove('anim-box-note--shuffle2')), 3000);

    // Wind-up — notes fade, one pulses
    setTimeout(() => {
      notes[0].classList.add('anim-box-note--chosen-glow');
      notes[1].classList.add('anim-box-note--dim');
      notes[2].classList.add('anim-box-note--dim');
    }, WINDUP);

    // Climax — chosen note shoots up, lid slams
    setTimeout(() => {
      notes[0].classList.add('anim-box-note--launch');
      chosen.textContent = strainName;
      chosen.classList.add('visible');
      burstParticles(body, {
        count: 12,
        origin: { x: '35%', y: '30%' },
        palette: ['var(--gold-glow)', 'var(--green-glow)', 'var(--gold-primary)'],
        duration: 700,
      });
      setTimeout(() => {
        lid.classList.remove('anim-box-lid--open');
        lid.classList.add('anim-box-lid--slam');
        screenPunch(body, { scale: 1.05 });
        shake(body, { magnitude: 4, duration: 200 });
        notes[1].classList.add('anim-box-note--sink');
        notes[2].classList.add('anim-box-note--sink');
      }, 200);
    }, CLIMAX);
  },
};
