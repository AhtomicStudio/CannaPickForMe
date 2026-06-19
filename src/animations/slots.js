import { burstParticles, shake, flashGlow, screenPunch, confetti } from './_kinetic.js';
import { polReveal, polAmbient } from './_polish.js';

export const slotsAnimation = {
    id: 'slots', name: 'Slot Machine Pull',
    render(container, { strainName }) {
      const ACT1 = 1000, PULL = 1400, LOCK1 = 2500, LOCK2 = 3300, LOCK3 = 4200;
      const WINDUP = 4200, CLIMAX = 4300, REVEAL = 4600;
      const TARGET = '\u{1F33F}';
      const SYMS = ['\u{1F33F}', '\u{1F49C}', '⭐', '\u{1F525}', '\u{1F49A}', '\u{1F347}', '\u{1F338}'];
      const CELL = 18, STRIP = 24, TARGET_IDX = 18;
      const FINAL_Y = -(CELL * (TARGET_IDX - 1));   // centers TARGET on the win-line

      const buildStrip = () => {
        let cells = '';
        for (let k = 0; k < STRIP; k++) {
          const sym = k === TARGET_IDX ? TARGET : SYMS[(Math.random() * SYMS.length) | 0];
          cells += `<span>${sym}</span>`;
        }
        return `<div class="anim-slots-reel pol-slots-reel"><div class="anim-slots-reel-inner pol-slots-reel-inner">${cells}</div></div>`;
      };

      container.innerHTML = `
        <div class="anim-slots-scene pol-slots-scene">
          <div class="anim-slots-machine anim-slots-machine--enter pol-slots-machine">
            <div class="anim-slots-top anim-slots-top--scan">\u{1F340} Strain Picker</div>
            <div class="anim-slots-reels">${buildStrip()}${buildStrip()}${buildStrip()}</div>
            <div class="anim-slots-winline"></div>
            <div class="anim-slots-readout"></div>
          </div>
          <div class="pol-slots-lever-rig">
            <div class="pol-slots-lever-bolt"></div>
            <div class="anim-slots-lever pol-slots-lever anim-slots-lever--cocked"></div>
          </div>
        </div>`;

      polAmbient(container);

      const machine = container.querySelector('.anim-slots-machine');
      const lever   = container.querySelector('.anim-slots-lever');
      const reels   = container.querySelectorAll('.anim-slots-reel');
      const inners  = container.querySelectorAll('.anim-slots-reel-inner');
      const readout = container.querySelector('.anim-slots-readout');
      const winline = container.querySelector('.anim-slots-winline');
      const top     = container.querySelector('.anim-slots-top');

      setTimeout(() => machine.classList.remove('anim-slots-machine--enter'), 50);

      const stops = [LOCK1, LOCK2, LOCK3];
      setTimeout(() => {
        lever.classList.remove('anim-slots-lever--cocked');
        lever.classList.add('anim-slots-lever--pull');
        inners.forEach((inner, i) => {
          inner.style.filter = 'blur(1px)';
          const dur = stops[i] - PULL;
          inner.style.transition = `transform ${dur}ms cubic-bezier(0.15, 0.6, 0.2, 1)`;
          inner.style.transform = `translateY(${FINAL_Y}px)`;   // scrolls down, decelerates, lands on TARGET
        });
      }, PULL);
      setTimeout(() => lever.classList.remove('anim-slots-lever--pull'), PULL + 300);

      const landReel = (i, time) => setTimeout(() => {
        const reel = reels[i], inner = inners[i];
        if (!reel || !inner) return;
        inner.style.filter = 'none';
        reel.classList.add('anim-slots-reel--locked');
        shake(reel, { magnitude: 3, duration: 200 });
        machine.style.transition = 'transform 80ms var(--ease-thwack)';
        machine.style.transform = 'translateY(2px)';
        setTimeout(() => { machine.style.transform = 'translateY(0)'; }, 80);
        setTimeout(() => reel.classList.remove('anim-slots-reel--locked'), 300);
      }, time);
      landReel(0, LOCK1); landReel(1, LOCK2); landReel(2, LOCK3);

      setTimeout(() => winline.classList.add('anim-slots-winline--dim'), WINDUP);

      setTimeout(() => {
        // The three reels already SHOW matching leaves — no swap needed.
        winline.classList.remove('anim-slots-winline--dim');
        winline.classList.add('anim-slots-winline--flare');
        machine.classList.add('pol-slots-machine--win');
        screenPunch(machine, { scale: 1.07 });
        confetti(container, { count: 32, palette: ['var(--green-glow)', 'var(--purple-glow)', 'var(--gold-glow)'], gravity: 280, spread: 80 });
        burstParticles(machine, { count: 14, origin: { x: '50%', y: '55%' }, palette: ['var(--green-glow)', 'var(--gold-glow)', 'var(--purple-glow)'], duration: 900 });
        flashGlow(winline, { color: 'var(--green-glow)', duration: 500 });
      }, CLIMAX);

      setTimeout(() => {
        readout.textContent = '\u2713 MATCH';
        readout.classList.add('visible');
        polReveal(container.querySelector('.anim-slots-scene'), strainName);
        lever.classList.add('pol-slots-lever--cheer');
        setTimeout(() => lever.classList.remove('pol-slots-lever--cheer'), 1400);
        let flash = false;
        const fi = setInterval(() => { flash = !flash; top.textContent = flash ? '\u{1F3C6} WINNER!' : '\u{1F340} Strain Picker'; }, 350);
        setTimeout(() => clearInterval(fi), 1400);
      }, REVEAL);
    },
  };
