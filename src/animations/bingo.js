import { burstParticles, shake, screenPunch } from './_kinetic.js';

const ACT1   = 1000;  // cage drops in
const ACT2   = 3600;  // cage tumbles, balls bounce
const WINDUP = 3600;  // cage stops, red light blinks
const CLIMAX = 4000;  // chute opens, ball drops
const REVEAL = 4500;  // winner ball shows full name

const BALL_COLORS = [
  'rgba(74,222,128,0.85)',
  'rgba(192,132,252,0.85)',
  'rgba(251,191,36,0.85)',
  'rgba(56,189,248,0.85)',
  'rgba(244,114,182,0.85)',
  'rgba(74,222,128,0.7)',
];

export const bingoAnimation = {
  id: 'bingo',
  name: 'Lottery Cage',

  render(container, { strainName, winnerName, allScores }) {
    const names = (allScores || []).slice(0, 6).map(s => s.strainName);
    while (names.length < 6) names.push('???');

    // Winner at random position
    const winnerIdx = Math.floor(Math.random() * 6);
    const orig = names[0];
    names[0] = names[winnerIdx];
    names[winnerIdx] = orig;

    const abbr = name => name.length > 4 ? name.slice(0, 3).toUpperCase() : name.toUpperCase();

    const ballsHTML = names.map((name, i) => `
      <div class="anim-cage-ball anim-cage-ball--${i + 1}" style="background:${BALL_COLORS[i]}">
        <span>${abbr(name)}</span>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="anim-cage-scene">
        <div class="anim-cage-stand"></div>
        <div class="anim-cage-frame anim-cage-frame--enter">
          <div class="anim-cage-light"></div>
          <div class="anim-cage-glass">
            ${ballsHTML}
            <div class="anim-cage-gloss"></div>
          </div>
          <div class="anim-cage-chute">
            <div class="anim-cage-chute-flap"></div>
          </div>
        </div>
        <div class="anim-cage-tray">
          <div class="anim-cage-winner-ball">
            <div class="anim-cage-winner-label"></div>
          </div>
        </div>
      </div>
    `;

    const scene     = container.querySelector('.anim-cage-scene');
    const frame     = container.querySelector('.anim-cage-frame');
    const glass     = container.querySelector('.anim-cage-glass');
    const light     = container.querySelector('.anim-cage-light');
    const flap      = container.querySelector('.anim-cage-chute-flap');
    const tray      = container.querySelector('.anim-cage-tray');
    const winBall   = container.querySelector('.anim-cage-winner-ball');
    const winLabel  = container.querySelector('.anim-cage-winner-label');

    // Act 1 — cage drops in
    setTimeout(() => frame.classList.remove('anim-cage-frame--enter'), 100);

    // Act 2 — cage tumbles, balls animate
    setTimeout(() => {
      glass.classList.add('anim-cage-glass--tumble');
    }, ACT1);

    // Wind-up — cage stops, light blinks
    setTimeout(() => {
      glass.classList.remove('anim-cage-glass--tumble');
      glass.classList.add('anim-cage-glass--settle');
      light.classList.add('anim-cage-light--blink');
    }, WINDUP);

    // Climax — chute opens, ball drops
    setTimeout(() => {
      flap.classList.add('anim-cage-chute-flap--open');
      setTimeout(() => {
        winBall.classList.add('anim-cage-winner-ball--drop');
        burstParticles(tray, {
          count: 10,
          origin: { x: '50%', y: '20%' },
          palette: [BALL_COLORS[winnerIdx], 'var(--gold-glow)', 'var(--green-glow)'],
          duration: 600,
        });
        screenPunch(tray, { scale: 1.05 });
        shake(tray, { magnitude: 4, duration: 200 });
      }, 200);
    }, CLIMAX);

    // Reveal — winner ball shows full name
    setTimeout(() => {
      winBall.classList.add('anim-cage-winner-ball--glow');
      winBall.style.background = BALL_COLORS[winnerIdx];
      winLabel.textContent = strainName;
      winLabel.classList.add('visible');
    }, REVEAL);
  },
};
