const REEL_SYMBOLS = ['🌿', '💜', '⭐', '🔥', '💚', '🌿', '💜', '⭐'];

const GLITTER_PARTICLES = [
  { color: '#4ade80', top: '50%', left: '20%', gx: '-18px', gy: '-28px' },
  { color: '#c084fc', top: '40%', left: '50%', gx: '12px',  gy: '-24px' },
  { color: '#fbbf24', top: '55%', left: '70%', gx: '22px',  gy: '-20px' },
  { color: '#38bdf8', top: '45%', left: '30%', gx: '-24px', gy: '-18px' },
  { color: '#f472b6', top: '50%', left: '60%', gx: '16px',  gy: '-30px' },
  { color: '#4ade80', top: '35%', left: '45%', gx: '-8px',  gy: '-34px' },
  { color: '#fbbf24', top: '60%', left: '25%', gx: '-28px', gy: '-22px' },
  { color: '#c084fc', top: '45%', left: '80%', gx: '30px',  gy: '-26px' },
];

const STAR_POSITIONS = [
  { top: '8px',  left: '8px'  },
  { top: '8px',  right: '8px' },
  { bottom: '10px', left: '10px'  },
  { bottom: '10px', right: '10px' },
];

export const slotsAnimation = {
  id: 'slots',
  name: 'Slot Machine Pull',

  render(container, { strainName }) {
    const reelHTML = (symbols) => `
      <div class="anim-slots-reel">
        <div class="anim-slots-reel-inner">
          ${symbols.map(s => `<span>${s}</span>`).join('')}
        </div>
      </div>
    `;

    const glitterHTML = GLITTER_PARTICLES.map(
      p => `<div class="anim-slots-glitter"
              style="background:${p.color};top:${p.top};left:${p.left};--gx:${p.gx};--gy:${p.gy}"></div>`
    ).join('');

    const starsHTML = STAR_POSITIONS.map(pos => {
      const style = Object.entries(pos).map(([k, v]) => `${k}:${v}`).join(';');
      return `<span class="anim-slots-star" style="${style}">✦</span>`;
    }).join('');

    container.innerHTML = `
      <div class="anim-slots-scene">
        <div class="anim-slots-machine">
          <div class="anim-slots-top">🍀 Strain Picker</div>
          <div class="anim-slots-reels">
            ${reelHTML(REEL_SYMBOLS.slice(0, 4))}
            ${reelHTML(REEL_SYMBOLS.slice(2, 6))}
            ${reelHTML(REEL_SYMBOLS.slice(4, 8))}
          </div>
          <div class="anim-slots-winline"></div>
          <div class="anim-slots-readout"></div>
          ${glitterHTML}
          ${starsHTML}
        </div>
        <div class="anim-slots-lever"></div>
      </div>
    `;

    const reels = container.querySelectorAll('.anim-slots-reel');

    setTimeout(() => { if (reels[0]) reels[0].classList.add('locked'); }, 2500);
    setTimeout(() => { if (reels[1]) reels[1].classList.add('locked'); }, 3500);
    setTimeout(() => { if (reels[2]) reels[2].classList.add('locked'); }, 4250);

    setTimeout(() => {
      container.querySelectorAll('.anim-slots-glitter').forEach((el, i) => {
        setTimeout(() => el.classList.add('burst'), i * 30);
      });
      container.querySelectorAll('.anim-slots-star').forEach((el, i) => {
        setTimeout(() => el.classList.add('pop'), i * 50);
      });
      const readout = container.querySelector('.anim-slots-readout');
      if (readout) {
        readout.textContent = strainName;
        readout.classList.add('visible');
      }
    }, 4500);
  },
};
