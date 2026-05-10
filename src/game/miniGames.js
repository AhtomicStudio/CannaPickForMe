/**
 * CannaGotchi — Care Mini-Games
 *
 * Small skill widgets that pop up briefly when the player taps a care
 * action. Hit "Perfect" → 1.5× restore + small bonus. Hit "OK" → 1× restore.
 * Whiff or no-input → 0.7× restore (still better than nothing).
 *
 * Mini-games:
 *   • Water → "Tap when the can is over the bud"   (timing tap)
 *   • Feed  → "Tap when the leaf is centered"      (timing tap)
 *   • Clean → "Hold to charge, release at peak"    (charge bar)
 *   • Pet   → "Tap rapidly for 1.5s"               (mash counter)
 *
 * Each game returns a result string ('perfect'|'ok'|'miss') asynchronously.
 *
 * The widget is a small canvas-free DOM element that the caller mounts
 * over the Garden viewport — auto-cleans up on completion.
 */

const PERFECT_MULT = 1.5;
const OK_MULT      = 1.0;
const MISS_MULT    = 0.7;

export const RESULT_MULTIPLIERS = {
  perfect: PERFECT_MULT,
  ok:      OK_MULT,
  miss:    MISS_MULT,
};

/** Resolve to one of: 'perfect' | 'ok' | 'miss'. Picks a random variant. */
export function runMiniGame(kind, container) {
  const variants = VARIANTS_BY_KIND[kind];
  if (!variants || variants.length === 0) return Promise.resolve('miss');
  const fn = variants[Math.floor(Math.random() * variants.length)];
  return fn(container);
}

// Three variants per care kind — the active one is rolled at random per tap.
const VARIANTS_BY_KIND = {
  water: [
    (c) => runTimingTap(c, '🚿', 'Tap when the can is over your bud'),
    (c) => runDodgeBubble(c, '💧', 'Catch the falling drop — tap when it crosses the line'),
    (c) => runFillBucket(c, 'Tap to fill the watering can — stop in the green'),
  ],
  feed: [
    (c) => runTimingTap(c, '🥬', 'Tap when the leaf is centered'),
    (c) => runMatchPair(c, '🌿', '🍃', 'Match the food — tap the icon that matches the prompt'),
    (c) => runFillBucket(c, 'Stuff the trough — tap to fill, stop in the green'),
  ],
  clean: [
    (c) => runChargeBar(c, 'Hold to charge — release at peak'),
    (c) => runDragSweep(c, 'Sweep the brush across the bud — tap left, then right'),
    (c) => runTimingTap(c, '🧽', 'Tap when the sponge is over your bud'),
  ],
  pet: [
    (c) => runMashCounter(c, 'Tap fast — show the love!'),
    (c) => runDoubleTap(c, 'Double-tap when the heart is biggest'),
    (c) => runRhythmThree(c, 'Tap on the beat — 3 beats incoming'),
  ],
};

// ── Timing tap (Water/Feed) ──────────────────────────────────
function runTimingTap(container, glyph, hint) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'minigame-overlay';
    wrap.innerHTML = `
      <div class="minigame">
        <div class="minigame__hint">${hint}</div>
        <div class="minigame__track">
          <div class="minigame__zone"></div>
          <div class="minigame__cursor">${glyph}</div>
        </div>
        <button class="btn-juicy big" id="mg-tap">TAP</button>
      </div>`;
    container.appendChild(wrap);
    const cursor = wrap.querySelector('.minigame__cursor');
    const btn = wrap.querySelector('#mg-tap');

    let resolved = false;
    function finish(result) {
      if (resolved) return; resolved = true;
      wrap.classList.add('minigame--' + result);
      setTimeout(() => { wrap.remove(); resolve(result); }, 450);
    }

    btn.addEventListener('click', () => {
      const rect  = cursor.getBoundingClientRect();
      const trackRect = wrap.querySelector('.minigame__track').getBoundingClientRect();
      const cursorCenter = (rect.left + rect.right) / 2 - trackRect.left;
      const trackMid     = trackRect.width / 2;
      const dist = Math.abs(cursorCenter - trackMid);
      const trackWidth = trackRect.width;
      if (dist < trackWidth * 0.07) finish('perfect');
      else if (dist < trackWidth * 0.18) finish('ok');
      else finish('miss');
    });

    // Auto-fail after 2.5s
    setTimeout(() => finish('miss'), 2500);
  });
}

// ── Charge bar (Clean) ───────────────────────────────────────
function runChargeBar(container, hint) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'minigame-overlay';
    wrap.innerHTML = `
      <div class="minigame">
        <div class="minigame__hint">${hint}</div>
        <div class="minigame__charge">
          <div class="minigame__charge-fill"></div>
          <div class="minigame__charge-zone"></div>
        </div>
        <button class="btn-juicy big" id="mg-hold">HOLD &amp; RELEASE</button>
      </div>`;
    container.appendChild(wrap);
    const fill = wrap.querySelector('.minigame__charge-fill');
    const btn  = wrap.querySelector('#mg-hold');

    let resolved = false, raf = 0, start = 0, holding = false;
    const DURATION = 1400;
    function finish(result) {
      if (resolved) return; resolved = true;
      cancelAnimationFrame(raf);
      wrap.classList.add('minigame--' + result);
      setTimeout(() => { wrap.remove(); resolve(result); }, 450);
    }
    function tick(t) {
      if (!holding) return;
      const elapsed = t - start;
      const frac = (elapsed % DURATION) / DURATION;     // 0..1, oscillating
      const v = frac < 0.5 ? frac * 2 : (1 - frac) * 2; // triangle wave
      fill.style.height = (v * 100) + '%';
      raf = requestAnimationFrame(tick);
    }
    function down() {
      if (holding || resolved) return;
      holding = true;
      start = performance.now();
      raf = requestAnimationFrame(tick);
    }
    function up() {
      if (!holding || resolved) return;
      holding = false;
      cancelAnimationFrame(raf);
      const h = parseFloat(fill.style.height) || 0;
      if (h > 88) finish('perfect');
      else if (h > 65) finish('ok');
      else finish('miss');
    }
    btn.addEventListener('mousedown', down);
    btn.addEventListener('touchstart', e => { e.preventDefault(); down(); });
    btn.addEventListener('mouseup', up);
    btn.addEventListener('mouseleave', up);
    btn.addEventListener('touchend', up);
    setTimeout(() => finish('miss'), 4500);
  });
}

// ── Mash counter (Pet) ───────────────────────────────────────
function runMashCounter(container, hint) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'minigame-overlay';
    wrap.innerHTML = `
      <div class="minigame">
        <div class="minigame__hint">${hint}</div>
        <div class="minigame__count" id="mg-count">0</div>
        <button class="btn-juicy big" id="mg-mash">PET PET PET</button>
        <div class="minigame__timer-bar"><div class="minigame__timer-fill"></div></div>
      </div>`;
    container.appendChild(wrap);
    const btn = wrap.querySelector('#mg-mash');
    const countEl = wrap.querySelector('#mg-count');
    const timerFill = wrap.querySelector('.minigame__timer-fill');

    const DURATION = 1500;
    let count = 0, start = performance.now(), resolved = false, raf = 0;
    function finish(result) {
      if (resolved) return; resolved = true;
      cancelAnimationFrame(raf);
      wrap.classList.add('minigame--' + result);
      setTimeout(() => { wrap.remove(); resolve(result); }, 450);
    }
    btn.addEventListener('click', () => {
      if (resolved) return;
      count++;
      countEl.textContent = String(count);
      btn.classList.add('mash-pulse');
      setTimeout(() => btn.classList.remove('mash-pulse'), 80);
    });
    function tick(t) {
      const left = Math.max(0, DURATION - (t - start));
      timerFill.style.width = (100 * (left / DURATION)) + '%';
      if (left <= 0) {
        if (count >= 14) finish('perfect');
        else if (count >= 8) finish('ok');
        else finish('miss');
        return;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
  });
}

// ── Dodge bubble — drop falls; tap when it crosses the line ─
function runDodgeBubble(container, glyph, hint) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'minigame-overlay';
    wrap.innerHTML = `
      <div class="minigame">
        <div class="minigame__hint">${hint}</div>
        <div class="minigame__drop-track">
          <div class="minigame__drop">${glyph}</div>
          <div class="minigame__drop-line"></div>
        </div>
        <button class="btn-juicy big" id="mg-tap">CATCH</button>
      </div>`;
    container.appendChild(wrap);
    const drop = wrap.querySelector('.minigame__drop');
    const line = wrap.querySelector('.minigame__drop-line');
    const btn  = wrap.querySelector('#mg-tap');

    let resolved = false;
    function finish(result) {
      if (resolved) return; resolved = true;
      wrap.classList.add('minigame--' + result);
      setTimeout(() => { wrap.remove(); resolve(result); }, 450);
    }
    btn.addEventListener('click', () => {
      const dRect = drop.getBoundingClientRect();
      const lRect = line.getBoundingClientRect();
      const dist = Math.abs((dRect.top + dRect.height / 2) - (lRect.top + lRect.height / 2));
      if (dist < 14) finish('perfect');
      else if (dist < 32) finish('ok');
      else finish('miss');
    });
    setTimeout(() => finish('miss'), 2400);
  });
}

// ── Fill bucket — tap to fill, stop in the green zone ──────
function runFillBucket(container, hint) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'minigame-overlay';
    wrap.innerHTML = `
      <div class="minigame">
        <div class="minigame__hint">${hint}</div>
        <div class="minigame__charge">
          <div class="minigame__charge-fill"></div>
          <div class="minigame__charge-zone"></div>
        </div>
        <button class="btn-juicy big" id="mg-tap-fill">TAP TO FILL</button>
        <button class="btn-juicy compact" id="mg-tap-stop">STOP</button>
      </div>`;
    container.appendChild(wrap);
    const fill = wrap.querySelector('.minigame__charge-fill');
    const fillBtn = wrap.querySelector('#mg-tap-fill');
    const stopBtn = wrap.querySelector('#mg-tap-stop');

    let level = 0, resolved = false;
    function finish(result) {
      if (resolved) return; resolved = true;
      wrap.classList.add('minigame--' + result);
      setTimeout(() => { wrap.remove(); resolve(result); }, 450);
    }
    fillBtn.addEventListener('click', () => {
      if (resolved) return;
      level = Math.min(100, level + 6);
      fill.style.height = level + '%';
    });
    stopBtn.addEventListener('click', () => {
      if (resolved) return;
      // Green zone is 70-90% (charge-zone CSS sits at top:6%, height:14%)
      // We use bottom-up so green = filled to ~80%
      if (level >= 76 && level <= 92) finish('perfect');
      else if (level >= 60 && level <= 95) finish('ok');
      else finish('miss');
    });
    setTimeout(() => finish('miss'), 4500);
  });
}

// ── Match pair — tap the icon that matches the prompt ──────
function runMatchPair(container, glyphA, glyphB, hint) {
  return new Promise(resolve => {
    const target = Math.random() < 0.5 ? glyphA : glyphB;
    const order = Math.random() < 0.5 ? [glyphA, glyphB] : [glyphB, glyphA];
    const wrap = document.createElement('div');
    wrap.className = 'minigame-overlay';
    wrap.innerHTML = `
      <div class="minigame">
        <div class="minigame__hint">${hint}</div>
        <div class="minigame__match-prompt">Tap the ${target}</div>
        <div class="minigame__match-row">
          <button class="minigame__match-btn" data-pick="${order[0]}">${order[0]}</button>
          <button class="minigame__match-btn" data-pick="${order[1]}">${order[1]}</button>
        </div>
        <div class="minigame__timer-bar"><div class="minigame__timer-fill"></div></div>
      </div>`;
    container.appendChild(wrap);
    const fill = wrap.querySelector('.minigame__timer-fill');
    const start = performance.now();
    const DURATION = 1800;
    let resolved = false, raf = 0;
    function finish(result) {
      if (resolved) return; resolved = true;
      cancelAnimationFrame(raf);
      wrap.classList.add('minigame--' + result);
      setTimeout(() => { wrap.remove(); resolve(result); }, 450);
    }
    wrap.querySelectorAll('[data-pick]').forEach(b => {
      b.addEventListener('click', () => {
        if (resolved) return;
        const right = b.dataset.pick === target;
        const elapsed = performance.now() - start;
        if (!right) finish('miss');
        else if (elapsed < 700) finish('perfect');
        else finish('ok');
      });
    });
    function tick(t) {
      const left = Math.max(0, DURATION - (t - start));
      fill.style.width = (100 * (left / DURATION)) + '%';
      if (left <= 0) { finish('miss'); return; }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
  });
}

// ── Drag sweep — tap left then right (broom motion) ────────
function runDragSweep(container, hint) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'minigame-overlay';
    wrap.innerHTML = `
      <div class="minigame">
        <div class="minigame__hint">${hint}</div>
        <div class="minigame__match-row">
          <button class="minigame__match-btn" id="mg-left">⬅️</button>
          <button class="minigame__match-btn" id="mg-right" disabled style="opacity:0.4">➡️</button>
        </div>
        <div class="minigame__timer-bar"><div class="minigame__timer-fill"></div></div>
      </div>`;
    container.appendChild(wrap);
    const fill = wrap.querySelector('.minigame__timer-fill');
    const start = performance.now();
    const DURATION = 1800;
    let leftAt = 0, resolved = false, raf = 0;
    function finish(result) {
      if (resolved) return; resolved = true;
      cancelAnimationFrame(raf);
      wrap.classList.add('minigame--' + result);
      setTimeout(() => { wrap.remove(); resolve(result); }, 450);
    }
    const rightBtn = wrap.querySelector('#mg-right');
    wrap.querySelector('#mg-left').addEventListener('click', () => {
      if (resolved || leftAt) return;
      leftAt = performance.now();
      rightBtn.disabled = false; rightBtn.style.opacity = '1';
    });
    rightBtn.addEventListener('click', () => {
      if (resolved || !leftAt) return;
      const gap = performance.now() - leftAt;
      if (gap >= 200 && gap <= 700) finish('perfect');
      else if (gap < 1100) finish('ok');
      else finish('miss');
    });
    function tick(t) {
      const left = Math.max(0, DURATION - (t - start));
      fill.style.width = (100 * (left / DURATION)) + '%';
      if (left <= 0) { finish('miss'); return; }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
  });
}

// ── Double tap — heart pulses, double-tap when biggest ─────
function runDoubleTap(container, hint) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'minigame-overlay';
    wrap.innerHTML = `
      <div class="minigame">
        <div class="minigame__hint">${hint}</div>
        <div class="minigame__heart" id="mg-heart">💖</div>
        <button class="btn-juicy big" id="mg-tap">TAP TAP</button>
      </div>`;
    container.appendChild(wrap);
    const heartEl = wrap.querySelector('#mg-heart');
    const btn = wrap.querySelector('#mg-tap');

    let resolved = false, taps = 0, lastTap = 0;
    function finish(result) {
      if (resolved) return; resolved = true;
      wrap.classList.add('minigame--' + result);
      setTimeout(() => { wrap.remove(); resolve(result); }, 450);
    }
    function readScale() {
      const t = getComputedStyle(heartEl).transform;
      if (!t || t === 'none') return 1;
      const m = t.match(/matrix\(([^)]+)\)/);
      if (!m) return 1;
      const parts = m[1].split(',').map(s => parseFloat(s));
      // 2-D matrix(a, b, c, d, tx, ty) — scaleY is parts[3]
      return parts[3] || 1;
    }
    btn.addEventListener('click', () => {
      const now = performance.now();
      if (now - lastTap < 320) taps++;
      else                      taps = 1;
      lastTap = now;
      if (taps >= 2) {
        const scale = readScale();
        if (scale >= 1.30) finish('perfect');
        else if (scale >= 1.12) finish('ok');
        else finish('miss');
      }
    });
    setTimeout(() => finish('miss'), 2600);
  });
}

// ── Rhythm three — tap on 3 beats ──────────────────────────
function runRhythmThree(container, hint) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'minigame-overlay';
    wrap.innerHTML = `
      <div class="minigame">
        <div class="minigame__hint">${hint}</div>
        <div class="minigame__beats">
          <span class="minigame__beat" data-i="0">●</span>
          <span class="minigame__beat" data-i="1">●</span>
          <span class="minigame__beat" data-i="2">●</span>
        </div>
        <button class="btn-juicy big" id="mg-tap">PAT</button>
      </div>`;
    container.appendChild(wrap);
    const beats = wrap.querySelectorAll('.minigame__beat');
    const btn = wrap.querySelector('#mg-tap');

    const start = performance.now();
    const beatTimes = [600, 1200, 1800];     // ms relative to start
    const TOLERANCE_PERFECT = 130, TOLERANCE_OK = 260;
    let beatIdx = 0;
    let scores = [];
    let resolved = false;
    function finish() {
      if (resolved) return; resolved = true;
      const perfectCount = scores.filter(s => s === 'perfect').length;
      const okCount      = scores.filter(s => s === 'ok').length;
      const missCount    = scores.filter(s => s === 'miss').length;
      let result;
      if (perfectCount >= 3) result = 'perfect';
      else if (perfectCount + okCount >= 2 && missCount <= 1) result = 'ok';
      else result = 'miss';
      wrap.classList.add('minigame--' + result);
      setTimeout(() => { wrap.remove(); resolve(result); }, 450);
    }
    // Visual pulse on each beat
    beatTimes.forEach((t, i) => {
      setTimeout(() => beats[i].classList.add('minigame__beat--lit'), t);
    });
    btn.addEventListener('click', () => {
      if (resolved || beatIdx >= 3) return;
      const elapsed = performance.now() - start;
      const target = beatTimes[beatIdx];
      const diff = Math.abs(elapsed - target);
      if (diff < TOLERANCE_PERFECT)      scores.push('perfect');
      else if (diff < TOLERANCE_OK)      scores.push('ok');
      else                                scores.push('miss');
      beatIdx++;
      if (beatIdx >= 3) finish();
    });
    setTimeout(() => {
      // Auto-fill any missed beats
      while (beatIdx < 3) { scores.push('miss'); beatIdx++; }
      finish();
    }, 2600);
  });
}
