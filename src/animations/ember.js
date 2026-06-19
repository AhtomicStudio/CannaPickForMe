import { burstParticles, shake } from './_kinetic.js';
import { polReveal, _prefersReduced } from './_polish.js';

export const emberAnimation = {
    id: 'ember', name: 'Lightning Strike',
    render(container, { strainName }) {
      container.innerHTML = `
        <div class="pol-st-scene">
          <svg width="0" height="0" class="pol-st-defs"><defs>
            <filter id="pol-st-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.6" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs></svg>
          <div class="pol-st-cloud pol-st-cloud--drift" style="left:4%; width:120px; height:60px; animation-delay:0s"></div>
          <div class="pol-st-cloud pol-st-cloud--drift" style="left:44%; width:150px; height:72px; animation-delay:-3s"></div>
          <div class="pol-st-cloud pol-st-cloud--drift" style="left:74%; width:110px; height:56px; animation-delay:-5s"></div>
          <div class="pol-st-charge" id="pst-charge"></div>
          <div class="pol-st-smolder" id="pst-smolder"></div>
          <div class="pol-st-ring" id="pst-ring"></div>
          <div class="pol-st-fireball" id="pst-fire"></div>
          <div class="pol-st-bloom" id="pst-bloom"></div>
          <div class="pol-st-vignette"></div>
          <div class="pol-st-flash" id="pst-flash"></div>
          <div class="pol-st-name" id="pst-name"></div>
          <div class="pol-st-name-sub" id="pst-sub">— your match —</div>
        </div>`;

      const scene = container.querySelector('.pol-st-scene');
      const flash = container.querySelector('#pst-flash');
      const charge = container.querySelector('#pst-charge');
      const bloom = container.querySelector('#pst-bloom');
      const fire = container.querySelector('#pst-fire');
      const ring = container.querySelector('#pst-ring');
      const smolder = container.querySelector('#pst-smolder');
      const nameEl = container.querySelector('#pst-name');
      const sub = container.querySelector('#pst-sub');

      if (!_prefersReduced()) for (let i = 0; i < 20; i++) {
        const r = document.createElement('div');
        r.className = 'pol-st-rain';
        r.style.left = (Math.random() * 100) + '%';
        r.style.animationDuration = (0.7 + Math.random() * 0.5).toFixed(2) + 's';
        r.style.animationDelay = (Math.random() * 1.6).toFixed(2) + 's';
        scene.insertBefore(r, scene.firstChild);
      }

      const doFlash = (soft) => {
        const cls = soft ? 'pol-st-flash--soft' : 'pol-st-flash--go';
        flash.classList.remove('pol-st-flash--go', 'pol-st-flash--soft'); void flash.offsetWidth; flash.classList.add(cls);
      };

      const makeBolt = (xPct, h, big) => {
        const w = big ? 40 : 26;
        const main = [(w / 2).toFixed(1) + ',0'];
        let y = 0, cx = w / 2; const step = big ? 16 : 13;
        while (y < h) { y += step + Math.random() * 12; cx = Math.max(2, Math.min(w - 2, cx + (Math.random() * 16 - 8))); main.push(cx.toFixed(1) + ',' + Math.min(y, h).toFixed(1)); }
        const mainPts = main.join(' ');
        let forks = '';
        const nForks = big ? 3 : 1;
        for (let f = 0; f < nForks; f++) {
          const bi = 1 + Math.floor(Math.random() * (main.length - 2));
          let [fx, fy] = main[bi].split(',').map(Number);
          const fpts = [fx.toFixed(1) + ',' + fy.toFixed(1)];
          const segs = 2 + Math.floor(Math.random() * 2);
          for (let k = 0; k < segs; k++) { fx += (Math.random() * 18 - 9); fy += 8 + Math.random() * 12; fpts.push(fx.toFixed(1) + ',' + fy.toFixed(1)); }
          forks += `<polyline points="${fpts.join(' ')}" fill="none" stroke="#dcc6ff" stroke-width="${big ? 2 : 1.4}" stroke-linecap="round" stroke-linejoin="round"/>`;
        }
        const el = document.createElement('div');
        el.className = 'pol-st-bolt' + (big ? ' pol-st-bolt--big' : '');
        el.style.left = xPct + '%';
        el.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="overflow:visible">
          <polyline points="${mainPts}" fill="none" stroke="#a855f7" stroke-width="${big ? 9 : 6}" stroke-linejoin="round" stroke-linecap="round" opacity="0.5" filter="url(#pol-st-glow)"/>
          ${forks}
          <polyline points="${mainPts}" fill="none" stroke="#ecdcff" stroke-width="${big ? 3.4 : 2.2}" stroke-linejoin="round" stroke-linecap="round"/>
          <polyline points="${mainPts}" fill="none" stroke="#ffffff" stroke-width="${big ? 1.4 : 1}" stroke-linejoin="round" stroke-linecap="round"/>
        </svg>`;
        scene.appendChild(el);
        requestAnimationFrame(() => el.classList.add('pol-st-bolt--go'));
        setTimeout(() => el.remove(), big ? 1100 : 560);
      };

      const SMOKE = ['rgba(70,82,108,0.95)', 'rgba(98,72,144,0.92)', 'rgba(126,94,180,0.85)', 'rgba(48,40,70,0.95)', 'rgba(156,116,206,0.7)'];
      const rr = () => (34 + Math.random() * 32).toFixed(0) + '%';
      const spawnSmoke = () => {
        for (let i = 0; i < 22; i++) {
          const sm = document.createElement('div');
          sm.className = 'pol-st-puff pol-st-puff--go';
          const sz = 40 + Math.random() * 72, ratio = 0.62 + Math.random() * 0.72;
          sm.style.width = sz.toFixed(0) + 'px'; sm.style.height = (sz * ratio).toFixed(0) + 'px';
          sm.style.borderRadius = `${rr()} ${rr()} ${rr()} ${rr()} / ${rr()} ${rr()} ${rr()} ${rr()}`;
          sm.style.background = `radial-gradient(circle at 45% 40%, ${SMOKE[(Math.random() * SMOKE.length) | 0]}, transparent 72%)`;
          sm.style.filter = `blur(${(2 + Math.random() * 4).toFixed(1)}px)`;
          sm.style.left = 'calc(50% + ' + (Math.random() * 168 - 84).toFixed(0) + 'px)';
          sm.style.top = 'calc(50% + ' + (Math.random() * 116 - 58).toFixed(0) + 'px)';
          sm.style.marginLeft = (-sz / 2).toFixed(0) + 'px'; sm.style.marginTop = (-sz * ratio / 2).toFixed(0) + 'px';
          sm.style.setProperty('--o', (0.6 + Math.random() * 0.35).toFixed(2));
          sm.style.setProperty('--r', (Math.random() * 60 - 30).toFixed(0) + 'deg');
          sm.style.setProperty('--dx', (Math.random() * 64 - 32).toFixed(0) + 'px');
          sm.style.setProperty('--dy', (-28 - Math.random() * 64).toFixed(0) + 'px');
          sm.style.setProperty('--dur', (1.5 + Math.random() * 0.8).toFixed(2) + 's');
          sm.style.animationDelay = (Math.random() * 280).toFixed(0) + 'ms';
          scene.appendChild(sm);
          setTimeout(() => sm.remove(), 2500);
        }
        for (let i = 0; i < 7; i++) {
          const wsp = document.createElement('div');
          wsp.className = 'pol-st-wisp pol-st-wisp--go';
          wsp.style.width = (10 + Math.random() * 16).toFixed(0) + 'px';
          wsp.style.height = (46 + Math.random() * 54).toFixed(0) + 'px';
          wsp.style.left = 'calc(50% + ' + (Math.random() * 120 - 60).toFixed(0) + 'px)';
          wsp.style.top = 'calc(50% - ' + (Math.random() * 22).toFixed(0) + 'px)';
          wsp.style.setProperty('--wx', (Math.random() * 50 - 25).toFixed(0) + 'px');
          wsp.style.setProperty('--wr', (Math.random() * 50 - 25).toFixed(0) + 'deg');
          wsp.style.animationDelay = (Math.random() * 220).toFixed(0) + 'ms';
          scene.appendChild(wsp);
          setTimeout(() => wsp.remove(), 2000);
        }
      };

      // Build — distant flicker then escalating strikes
      setTimeout(() => doFlash(true), 700);
      [[950, 30], [1300, 64], [1650, 18], [2050, 76], [2450, 44], [2880, 56]].forEach(([t, x], i) => setTimeout(() => {
        makeBolt(x, 110 + Math.random() * 90, false);
        doFlash(true);
        if (!_prefersReduced()) shake(scene, { magnitude: 2 + i * 0.6, duration: 140 });
      }, t));

      setTimeout(() => charge.classList.add('pol-st-charge--on'), 3050);

      const BIG = 3450;
      setTimeout(() => {
        makeBolt(50, 182, true);
        doFlash(false);
        fire.classList.add('pol-st-fireball--go');
        bloom.classList.add('pol-st-bloom--go');
        ring.classList.add('pol-st-ring--go');
        smolder.classList.add('pol-st-smolder--go');
        if (!_prefersReduced()) shake(scene, { magnitude: 11, duration: 480 });
        burstParticles(scene, { count: 30, origin: { x: '50%', y: '50%' }, palette: ['#ffffff', '#c084fc', '#ff9d4d'], duration: 1000 });
        if (!_prefersReduced()) for (let i = 0; i < 16; i++) {
          const e = document.createElement('div');
          e.className = 'pol-st-ember';
          e.style.left = '50%'; e.style.top = '50%';
          const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.8, dist = 42 + Math.random() * 70;
          e.style.setProperty('--ex', (Math.cos(ang) * dist).toFixed(0) + 'px');
          e.style.setProperty('--ey', (Math.sin(ang) * dist).toFixed(0) + 'px');
          e.style.animation = 'pol-st-ember 0.95s ease-out forwards';
          e.style.animationDelay = (Math.random() * 130).toFixed(0) + 'ms';
          scene.appendChild(e);
          setTimeout(() => e.remove(), 1150);
        }
        setTimeout(spawnSmoke, 110);
        // aftershock crackles
        setTimeout(() => { makeBolt(40, 90, false); doFlash(true); }, 220);
        setTimeout(() => { makeBolt(60, 80, false); doFlash(true); }, 420);
      }, BIG);

      setTimeout(() => {
        polReveal(scene, strainName);
      }, BIG + 560);
    },
  };
