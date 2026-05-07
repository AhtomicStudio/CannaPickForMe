import { burstParticles, shake, flashGlow, screenPunch, confetti } from './_kinetic.js';

const ACT1 = 1000, PULL = 1400, SPIN_END = 2400;
const LOCK1 = 2500, LOCK2 = 3300, LOCK3 = 4200;
const WINDUP = 4200, CLIMAX = 4300, REVEAL = 4600;

const REEL_SYMBOLS = ['🌿', '💜', '⭐', '🔥', '💚', '🌿', '💜', '⭐'];

export const slotsAnimation = {
  id: 'slots',
  name: 'Slot Machine Pull',

  render(container, { strainName, winnerName }) {
    const reelHTML = (symbols) => `
      <div class="anim-slots-reel">
        <div class="anim-slots-reel-inner">
          ${symbols.map(s => `<span>${s}</span>`).join('')}
        </div>
      </div>
    `;

    container.innerHTML = `
      <div class="anim-slots-scene">
        <div class="anim-slots-machine anim-slots-machine--enter">
          <div class="anim-slots-top anim-slots-top--scan">🍀 Strain Picker</div>
          <div class="anim-slots-reels">
            ${reelHTML(REEL_SYMBOLS.slice(0, 4))}
            ${reelHTML(REEL_SYMBOLS.slice(2, 6))}
            ${reelHTML(REEL_SYMBOLS.slice(4, 8))}
          </div>
          <div class="anim-slots-winline"></div>
          <div class="anim-slots-readout"></div>
        </div>
        <div class="anim-slots-lever anim-slots-lever--cocked"></div>
      </div>
    `;

    const machine  = container.querySelector('.anim-slots-machine');
    const lever    = container.querySelector('.anim-slots-lever');
    const reels    = container.querySelectorAll('.anim-slots-reel');
    const inners   = container.querySelectorAll('.anim-slots-reel-inner');
    const readout  = container.querySelector('.anim-slots-readout');
    const winline  = container.querySelector('.anim-slots-winline');
    const top      = container.querySelector('.anim-slots-top');

    // Act 1 — machine drops in
    setTimeout(() => machine.classList.remove('anim-slots-machine--enter'), 50);

    // Pull — lever snaps down, spin starts
    setTimeout(() => {
      lever.classList.remove('anim-slots-lever--cocked');
      lever.classList.add('anim-slots-lever--pull');
      inners.forEach(r => r.classList.add('anim-slots-spinning'));
    }, PULL);
    setTimeout(() => {
      lever.classList.remove('anim-slots-lever--pull');
    }, PULL + 300);

    // Sequential reel locks
    const lockReel = (index, time) => {
      setTimeout(() => {
        const reel  = reels[index];
        const inner = inners[index];
        if (!reel || !inner) return;
        inner.classList.remove('anim-slots-spinning');
        reel.classList.add('anim-slots-reel--locked');
        shake(reel, { magnitude: 3, duration: 200 });
        machine.style.transition = 'transform 80ms var(--ease-thwack)';
        machine.style.transform  = 'translateY(1px)';
        setTimeout(() => {
          machine.style.transform = 'translateY(0)';
        }, 80);
        setTimeout(() => reel.classList.remove('anim-slots-reel--locked'), 300);
      }, time);
    };

    lockReel(0, LOCK1);
    lockReel(1, LOCK2);
    lockReel(2, LOCK3);

    // Wind-up — all locked, stillness
    setTimeout(() => {
      winline.classList.add('anim-slots-winline--dim');
    }, WINDUP);

    // Climax — win-line flares, confetti, burst
    setTimeout(() => {
      winline.classList.remove('anim-slots-winline--dim');
      winline.classList.add('anim-slots-winline--flare');
      // Swap all reels to 🌿
      inners.forEach(inner => {
        inner.querySelectorAll('span').forEach(s => s.textContent = '🌿');
      });
      screenPunch(machine, { scale: 1.06 });
      confetti(container, {
        count: 32,
        palette: ['var(--green-glow)', 'var(--purple-glow)', 'var(--gold-glow)'],
        gravity: 280,
        spread: 80,
      });
      burstParticles(machine, {
        count: 14,
        origin: { x: '50%', y: '55%' },
        palette: ['var(--green-glow)', 'var(--gold-glow)', 'var(--purple-glow)'],
        duration: 900,
      });
      flashGlow(winline, { color: 'var(--green-glow)', duration: 500 });
    }, CLIMAX);

    // Reveal
    let topFlash = false;
    setTimeout(() => {
      readout.textContent = strainName;
      readout.classList.add('visible');
      lever.classList.add('anim-slots-lever--celebrate');
      const flashInterval = setInterval(() => {
        topFlash = !topFlash;
        top.textContent = topFlash ? '🏆 WINNER!' : '🍀 Strain Picker';
      }, 350);
      setTimeout(() => clearInterval(flashInterval), 1200);
    }, REVEAL);
  },
};
