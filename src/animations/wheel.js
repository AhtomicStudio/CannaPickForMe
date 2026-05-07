import { burstParticles, flashGlow, screenPunch } from './_kinetic.js';

const SPIN_START = 900;
const SPIN_DUR   = 3100; // transition duration ms
const CLIMAX     = 4200; // wheel has stopped by here
const REVEAL     = 4500;
const WEDGE_COUNT = 8;

export const wheelAnimation = {
  id: 'wheel',
  name: 'Wheel of Buds',

  render(container, { strainName, winnerName, allScores }) {
    const names = (allScores || []).slice(0, WEDGE_COUNT).map(s => s.strainName);
    while (names.length < WEDGE_COUNT) names.push('???');

    // Place winner at a random wedge index
    const winnerIdx = Math.floor(Math.random() * WEDGE_COUNT);
    const originalWinner = names[0];
    names[0] = names[winnerIdx];
    names[winnerIdx] = originalWinner;

    // Build SVG wedges
    const R = 100; // radius (viewBox 0 0 200 200, center 100,100)
    const wedges = names.map((name, i) => {
      const startAngle = (i * 360) / WEDGE_COUNT;
      const endAngle   = ((i + 1) * 360) / WEDGE_COUNT;
      const fill = i % 2 === 0
        ? 'rgba(160,80,255,0.45)'
        : 'rgba(34,197,94,0.35)';
      const path = describeWedge(100, 100, R - 2, startAngle, endAngle);
      const midAngle = ((startAngle + endAngle) / 2) * (Math.PI / 180);
      const labelR   = R * 0.62;
      const lx = 100 + labelR * Math.cos(midAngle - Math.PI / 2);
      const ly = 100 + labelR * Math.sin(midAngle - Math.PI / 2);
      const abbr = name.length > 7 ? name.slice(0, 6) + '…' : name;
      return `
        <path d="${path}" fill="${fill}" stroke="rgba(255,255,255,0.08)" stroke-width="1" data-wedge="${i}" class="anim-wheel-wedge"/>
        <text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle"
          transform="rotate(${startAngle + 360 / WEDGE_COUNT / 2}, ${lx}, ${ly})"
          class="anim-wheel-label" data-wedge="${i}">${abbr}</text>
      `;
    }).join('');

    container.innerHTML = `
      <div class="anim-wheel-scene">
        <div class="anim-wheel-stand"></div>
        <div class="anim-wheel-pointer">▼</div>
        <div class="anim-wheel-wrap" id="anim-wheel-svg-wrap">
          <svg viewBox="0 0 200 200" class="anim-wheel-svg" id="anim-wheel-svg">
            <circle cx="100" cy="100" r="98" fill="rgba(10,14,23,0.6)" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
            ${wedges}
            <circle cx="100" cy="100" r="14" fill="var(--bg-deep)" stroke="rgba(255,255,255,0.2)" stroke-width="2" class="anim-wheel-hub"/>
            <circle cx="100" cy="100" r="6" fill="var(--gold-glow)"/>
          </svg>
        </div>
      </div>
    `;

    const svgEl   = container.querySelector('#anim-wheel-svg');
    const wrap    = container.querySelector('.anim-wheel-wrap');
    const pointer = container.querySelector('.anim-wheel-pointer');
    const scene   = container.querySelector('.anim-wheel-scene');

    // Act 1 — wheel scales up
    setTimeout(() => {
      wrap.classList.add('anim-wheel-wrap--enter');
    }, 100);

    // Pull — start spin
    // Compute totalDeg: 5 full rotations + alignment to put winner wedge under top pointer
    // Pointer is at top (0°). Winner wedge i starts at i*(360/8).
    // We want winner wedge midpoint at top → rotate by -(i * 45 + 22.5) + extra full turns
    const targetOffset = -(winnerIdx * 45 + 22.5);
    const totalDeg     = 5 * 360 + targetOffset + 360; // always positive spin

    setTimeout(() => {
      wrap.classList.add('anim-wheel-wrap--dim');
      svgEl.style.transition = `transform ${SPIN_DUR}ms cubic-bezier(0.12, 0.6, 0.18, 1)`;
      svgEl.style.transform  = `rotate(${totalDeg}deg)`;

      // Tick-tick-tick via rAF watching rotation
      tickPointer(svgEl, pointer, totalDeg, SPIN_DUR, SPIN_START);
    }, SPIN_START);

    // Climax — wheel stopped
    setTimeout(() => {
      wrap.classList.remove('anim-wheel-wrap--dim');

      // Flash the winner wedge
      const winWedge = container.querySelector(`[data-wedge="${winnerIdx}"].anim-wheel-wedge`);
      const winLabel = container.querySelector(`[data-wedge="${winnerIdx}"].anim-wheel-label`);
      if (winWedge) winWedge.classList.add('anim-wheel-wedge--winner');
      if (winLabel) winLabel.classList.add('anim-wheel-label--winner');

      // Dim other wedges
      container.querySelectorAll('.anim-wheel-wedge').forEach((w, i) => {
        if (i !== winnerIdx) w.classList.add('anim-wheel-wedge--dim');
      });

      flashGlow(pointer, { color: 'var(--gold-glow)', duration: 500 });
      burstParticles(scene, {
        count: 12,
        origin: { x: '50%', y: '8%' },
        palette: ['var(--gold-glow)', 'var(--green-glow)', 'var(--purple-glow)'],
        duration: 900,
      });
      screenPunch(wrap, { scale: 1.04 });
    }, CLIMAX);

    // Reveal — winner label scales up, name appears below
    setTimeout(() => {
      const winLabel = container.querySelector(`[data-wedge="${winnerIdx}"].anim-wheel-label`);
      if (winLabel) winLabel.classList.add('anim-wheel-label--pop');
      wrap.classList.add('anim-wheel-wrap--wobble');

      const nameEl = document.createElement('div');
      nameEl.className = 'anim-wheel-name';
      nameEl.textContent = strainName;
      scene.appendChild(nameEl);
      requestAnimationFrame(() => nameEl.classList.add('visible'));
    }, REVEAL);
  },
};

function describeWedge(cx, cy, r, startDeg, endDeg) {
  const toRad = d => (d - 90) * (Math.PI / 180);
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

function tickPointer(svgEl, pointer, totalDeg, spinDur, startTime) {
  let lastWedge = -1;
  const start   = performance.now();

  function frame(now) {
    const elapsed  = now - start;
    const progress = Math.min(elapsed / spinDur, 1);
    // Mirror the cubic-bezier(0.12,0.6,0.18,1) easing
    const eased    = cubicBezierProgress(progress, 0.12, 0.6, 0.18, 1);
    const currentDeg = eased * totalDeg;
    const normalized  = ((currentDeg % 360) + 360) % 360;
    const wedgeIdx    = Math.floor(normalized / (360 / 8)) % 8;

    if (wedgeIdx !== lastWedge) {
      lastWedge = wedgeIdx;
      pointer.classList.add('anim-wheel-pointer--tick');
      setTimeout(() => pointer.classList.remove('anim-wheel-pointer--tick'), 80);
    }

    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Approximate cubic-bezier via simple numeric easing
function cubicBezierProgress(t, p1x, p1y, p2x, p2y) {
  // Simple approximation sufficient for tick timing
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
