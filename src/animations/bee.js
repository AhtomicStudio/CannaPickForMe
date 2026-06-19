import { burstParticles, shake, screenPunch } from './_kinetic.js';
import { polReveal } from './_polish.js';

export const beeAnimation = {
    id: 'bee', name: 'Claw Machine',
    render(container, { strainName, winnerName, allScores }) {
      const full = allScores || [];
      const CAP = 15;
      const pile = full.slice(0, CAP);
      const extra = Math.max(0, full.length - CAP);
      const COLORS = ['#4ade80', '#c084fc', '#fbbf24', '#38bdf8', '#f472b6', '#34d399', '#fb923c', '#a78bfa'];
      const perRow = 5;
      const caps = pile.map((s, i) => {
        const col = i % perRow, row = Math.floor(i / perRow);
        return { left: 18 + col * 28 + (Math.random() * 4 - 2), bottom: 6 + row * 18, color: COLORS[i % COLORS.length] };
      });
      if (!caps.length) caps.push({ left: 75, bottom: 6, color: COLORS[0] });
      const winIdx = Math.floor(Math.random() * caps.length);
      const targetX = caps[winIdx].left + 15;

      const capsHTML = caps.map((c, i) =>
        `<div class="pol-claw-capsule" data-cap="${i}" style="left:${c.left.toFixed(0)}px; bottom:${c.bottom}px; background:radial-gradient(circle at 35% 30%, rgba(255,255,255,0.6), ${c.color});"></div>`
      ).join('');
      const bulbsHTML = Array.from({ length: 13 }, (_, i) => `<div class="pol-claw-bulb" style="animation-delay:${((i % 3) * 0.3).toFixed(1)}s"></div>`).join('');

      container.innerHTML = `
        <div class="pol-claw-scene">
          <div class="pol-claw-bg"></div>
          <div class="pol-claw-floor"></div>
          <div class="pol-claw-cab pol-claw-cab--enter">
            <div class="pol-claw-glass"><div class="pol-claw-glass-back"></div>${capsHTML}<div class="pol-claw-glass-reflect"></div></div>
            <div class="pol-claw-marquee"><div class="pol-claw-bulbs">${bulbsHTML}</div><span class="pol-claw-sign">CANNA CLAW</span></div>
            <div class="pol-claw-rail"></div>
            <div class="pol-claw-rig" id="pcl-rig">
              <div class="pol-claw-trolley"></div>
              <div class="pol-claw-cord" id="pcl-cord"></div>
              <div class="pol-claw-claw" id="pcl-claw">
                <div class="pol-claw-hub"></div>
                <div class="pol-claw-prong pol-claw-prong--l"></div>
                <div class="pol-claw-prong pol-claw-prong--r"></div>
                <div class="pol-claw-held" id="pcl-held"></div>
              </div>
            </div>
            <div class="pol-claw-deck"></div>
            <div class="pol-claw-chute"></div>
            <div class="pol-claw-coin"></div>
            <div class="pol-claw-joy"></div>
            <div class="pol-claw-prize" id="pcl-prize"></div>
            ${extra ? `<div class="pol-claw-counter">+${extra} more inside</div>` : ''}
          </div>
        </div>`;

      const scene = container.querySelector('.pol-claw-scene');
      const cab = container.querySelector('.pol-claw-cab');
      const rig = container.querySelector('#pcl-rig');
      const cord = container.querySelector('#pcl-cord');
      const claw = container.querySelector('#pcl-claw');
      const held = container.querySelector('#pcl-held');
      const prize = container.querySelector('#pcl-prize');

      // ambient motes drifting behind the cabinet
      for (let i = 0; i < 9; i++) {
        const m = document.createElement('div');
        m.className = 'pol-claw-amote';
        m.style.left = (8 + Math.random() * 84) + '%';
        m.style.top = (18 + Math.random() * 62) + '%';
        m.style.animationDelay = (Math.random() * 6).toFixed(1) + 's';
        scene.insertBefore(m, scene.firstChild);
      }

      const setX = x => { rig.style.transform = `translateX(${(x - 17).toFixed(1)}px)`; };
      const setY = y => { claw.style.transform = `translateY(${y}px)`; cord.style.height = y + 'px'; };
      setX(28); setY(8);

      const ACT1 = 600, DROP = 116;
      setTimeout(() => {
        rig.style.transition = 'transform 0.5s ease';
        claw.style.transition = 'transform 0.45s ease';
        cord.style.transition = 'height 0.45s ease';
        setX(44);
      }, ACT1 + 150);
      setTimeout(() => setX(120), ACT1 + 750);
      setTimeout(() => setX(targetX), ACT1 + 1300);

      setTimeout(() => {
        claw.style.transition = 'transform 0.5s ease-in';
        cord.style.transition = 'height 0.5s ease-in';
        setY(DROP);
      }, ACT1 + 1800);

      setTimeout(() => {
        claw.classList.add('pol-claw--closed');
        shake(claw, { magnitude: 3, duration: 220 });
        const pileWin = container.querySelector(`[data-cap="${winIdx}"]`);
        if (pileWin) { pileWin.style.transition = 'opacity 0.2s ease'; pileWin.style.opacity = '0'; }
        held.textContent = '🌿';
        held.style.opacity = '1';
      }, ACT1 + 2350);

      setTimeout(() => {
        claw.style.transition = 'transform 0.6s ease-out';
        cord.style.transition = 'height 0.6s ease-out';
        setY(8);
      }, ACT1 + 2600);

      setTimeout(() => { rig.style.transition = 'transform 0.5s ease'; setX(90); }, ACT1 + 3150);

      setTimeout(() => {
        held.style.transition = 'transform 0.3s var(--ease-snap), box-shadow 0.3s ease';
        held.style.transform = 'scale(1.35)';
        held.style.boxShadow = '0 0 18px rgba(74,222,128,0.9)';
        polReveal(scene, strainName);
        burstParticles(scene, { count: 18, origin: { x: '50%', y: '22%' }, palette: ['var(--gold-glow)', 'var(--green-glow)', 'rgba(255,255,255,0.85)'], duration: 850 });
        screenPunch(cab, { scale: 1.04 });
      }, ACT1 + 3650);
    },
  };
