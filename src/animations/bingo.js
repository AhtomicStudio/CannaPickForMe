import { burstParticles, shake, screenPunch, confetti } from './_kinetic.js';
import { polReveal, polAmbient } from './_polish.js';

export const bingoAnimation = {
    id: 'bingo', name: 'Lottery Cage',
    render(container, { strainName, winnerName, allScores }) {
      const ACT1 = 1000, WINDUP = 3600, CLIMAX = 4000, REVEAL = 4500;
      const BALL_COLORS = ['rgba(74,222,128,0.85)','rgba(192,132,252,0.85)','rgba(251,191,36,0.85)','rgba(56,189,248,0.85)','rgba(244,114,182,0.85)','rgba(74,222,128,0.7)'];
      const full = allScores || [];
      const names = full.slice(0, 6).map(s => s.strainName);
      while (names.length < 6) names.push('???');
      const extra = Math.max(0, full.length - 6);
      const winnerIdx = Math.floor(Math.random() * 6);
      const orig = names[0]; names[0] = names[winnerIdx]; names[winnerIdx] = orig;
      const abbr = n => n.length > 4 ? n.slice(0, 3).toUpperCase() : n.toUpperCase();
      const ballsHTML = names.map((n, i) => `<div class="anim-cage-ball anim-cage-ball--${i + 1}" style="background:${BALL_COLORS[i]}"><span>${abbr(n)}</span></div>`).join('');

      container.innerHTML = `
        <div class="anim-cage-scene">
          <div class="anim-cage-stand"></div>
          <div class="anim-cage-frame anim-cage-frame--enter">
            <div class="anim-cage-light"></div>
            <div class="anim-cage-glass">${ballsHTML}<div class="anim-cage-gloss"></div></div>
            <div class="anim-cage-chute"><div class="anim-cage-chute-flap"></div></div>
          </div>
          <div class="anim-cage-tray"><div class="anim-cage-winner-ball"><span class="pol-cage-leaf">\u{1F33F}</span></div></div>
          ${extra ? `<div class="pol-cage-counter">+${extra} more in the cage</div>` : ''}
        </div>`;

      polAmbient(container);

      const scene = container.querySelector('.anim-cage-scene');
      const frame = container.querySelector('.anim-cage-frame');
      const glass = container.querySelector('.anim-cage-glass');
      const light = container.querySelector('.anim-cage-light');
      const flap = container.querySelector('.anim-cage-chute-flap');
      const tray = container.querySelector('.anim-cage-tray');
      const winBall = container.querySelector('.anim-cage-winner-ball');

      setTimeout(() => frame.classList.remove('anim-cage-frame--enter'), 100);
      setTimeout(() => glass.classList.add('anim-cage-glass--tumble'), ACT1);
      setTimeout(() => {
        glass.classList.remove('anim-cage-glass--tumble');
        glass.classList.add('anim-cage-glass--settle');
        light.classList.add('anim-cage-light--blink');
      }, WINDUP);

      setTimeout(() => {
        flap.classList.add('anim-cage-chute-flap--open');
        setTimeout(() => {
          winBall.classList.add('anim-cage-winner-ball--drop');
          burstParticles(tray, { count: 12, origin: { x: '50%', y: '20%' }, palette: [BALL_COLORS[winnerIdx], 'var(--gold-glow)', 'var(--green-glow)'], duration: 700 });
          screenPunch(tray, { scale: 1.06 });
          shake(tray, { magnitude: 4, duration: 220 });
          frame.classList.add('pol-cage-frame--win');
          confetti(scene, { count: 26, palette: ['var(--green-glow)', 'var(--purple-glow)', 'var(--gold-glow)'], gravity: 260, spread: 78 });
        }, 200);
      }, CLIMAX);

      setTimeout(() => {
        winBall.classList.add('anim-cage-winner-ball--glow');
        winBall.style.background = BALL_COLORS[winnerIdx];
        polReveal(scene, strainName);
      }, REVEAL);
    },
  };
