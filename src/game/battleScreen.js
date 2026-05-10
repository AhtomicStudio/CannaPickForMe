/**
 * CannaGotchi — Battle Screen
 *
 * Renders a turn-based battle for the deterministic engine in battle.js.
 * Used for: wild encounters, boss fights, rival fights.
 * Same UI/protocol is reused by versusScreen for hot-seat PvP.
 */

import { createBattle, submitRound, pickAIAction, isOver } from './battle.js';
import { makePlayerCombatant } from './encounters.js';
import { renderSprite, renderHat } from './pixelArt.js';
import { sfx } from './sfx.js';
import { ITEMS, consumeItem } from './inventory.js';
import { getTrait } from './traits.js';
import { encodeReplay } from './replay.js';

let _container = null;
let _gameState = null;
let _onResolve = () => {};
let _state = null;
let _meta = null;
let _busy = false;
let _initialPlayer = null;
let _initialOpponent = null;
let _initialSeed = null;
let _actionLog = [];   // [[playerAction, opponentAction], ...] — used for replay codes

export function mountBattle({ container, gameState, encounter, meta, onResolve }) {
  _container = container;
  _gameState = gameState;
  _meta = meta;
  _onResolve = onResolve;

  const me = makePlayerCombatant(gameState);
  _initialSeed = Date.now();
  _initialPlayer = me;
  _initialOpponent = encounter;
  _actionLog = [];
  _state = createBattle({ player: me, opponent: encounter, seed: _initialSeed });

  sfx.battleStart();
  draw();
}

function draw() {
  const p = _state.player, o = _state.opponent;
  const envClass = _state.env?.bgClass || '';
  const envBanner = _state.env ? `
    <div class="env-banner">
      <span>${_state.env.emoji} ${_state.env.name}</span>
      <span class="dim small">${_state.env.desc}</span>
    </div>` : '';

  _container.innerHTML = `
    <section class="tab-pane battle-arena ${envClass}">
      ${envBanner}
      <div class="battler battler--opponent" data-side="opponent">
        <div class="battler__head">
          <span class="battler__name">${o.name}${o.trait ? ` <span class="trait-chip">${traitChip(o.trait)}</span>` : ''}</span>
          <span class="battler__lv">Lv.${o.level}</span>
        </div>
        <div class="battler__hp"><div class="battler__hp-fill" style="width:${(o.hp/o.hpMax)*100}%;background:${o.color}"></div></div>
        <div class="battler__hpnum">${o.hp} / ${o.hpMax}</div>
        <div class="battler__sprite" id="opp-sprite" style="filter: hue-rotate(${o.hueShift || 0}deg);"></div>
        <div class="battler__statuses">${statusChips(o)}</div>
      </div>

      <div class="battle-log card" id="battle-log"></div>

      <div class="battler battler--player" data-side="player">
        <div class="battler__head">
          <span class="battler__name">${p.name}${p.trait ? ` <span class="trait-chip">${traitChip(p.trait)}</span>` : ''}</span>
          <span class="battler__lv">Lv.${p.level}</span>
        </div>
        <div class="battler__hp"><div class="battler__hp-fill" style="width:${(p.hp/p.hpMax)*100}%;background:${p.color}"></div></div>
        <div class="battler__hpnum">${p.hp} / ${p.hpMax}</div>
        <div class="battler__sprite" id="me-sprite"></div>
        <div class="battler__statuses">${statusChips(p)}</div>
      </div>

      <div class="battle-actions">
        <div class="moves-grid">
          ${(p.moves || []).slice(0, 4).map(m => `
            <button class="move-btn" data-move="${m.id}" ${_state.winner ? 'disabled' : ''}>
              <span class="move-btn__emoji">${m.emoji ?? '⚔️'}</span>
              <span class="move-btn__name">${m.name}</span>
              <span class="move-btn__pwr">${m.power > 0 ? 'PWR ' + m.power : 'STAT'}</span>
            </button>`).join('')}
        </div>
        <div class="battle-secondary">
          <button class="btn-juicy compact" id="btn-item">🧪 Item</button>
          <button class="btn-juicy compact danger" id="btn-flee">🏃 Flee</button>
        </div>
      </div>
    </section>
  `;
  renderSprite(_container.querySelector('#opp-sprite'), o.sprite, 6, { paletteRemap: o.paletteRemap, hueShift: o.hueShift });
  renderSprite(_container.querySelector('#me-sprite'),  p.sprite, 6, { paletteRemap: p.paletteRemap });
  // Show the player's equipped hat in battle too
  const eqHatId = _gameState?.cosmetics?.equipped?.hat;
  if (eqHatId && eqHatId !== 'hat_none') {
    renderHat(_container.querySelector('#me-sprite'), eqHatId, 6);
  }

  // Wire moves
  _container.querySelectorAll('[data-move]').forEach(btn => {
    btn.addEventListener('click', () => playerPicks({ kind: 'move', moveId: btn.dataset.move }));
  });
  _container.querySelector('#btn-flee')?.addEventListener('click', () => playerPicks({ kind: 'flee' }));
  _container.querySelector('#btn-item')?.addEventListener('click', () => openItemMenu());

  paintLog();
}

function openItemMenu() {
  const inv = _gameState.inventory || {};
  const usable = Object.entries(inv).filter(([id, n]) => n > 0 && ITEMS[id]);
  if (!usable.length) { sfx.error(); return; }

  const overlay = document.createElement('div');
  overlay.className = 'item-menu-overlay';
  overlay.innerHTML = `
    <div class="item-menu">
      <div class="card-title">Use an item</div>
      <div class="inventory-grid">
        ${usable.map(([id, n]) => {
          const it = ITEMS[id];
          return `<button class="inv-item" data-use="${id}">
            <span class="inv-item__emoji">${it.emoji}</span>
            <span class="inv-item__name">${it.name}</span>
            <span class="inv-item__count">×${n}</span>
          </button>`;
        }).join('')}
      </div>
      <button class="btn-juicy compact" id="item-cancel">Cancel</button>
    </div>`;
  _container.appendChild(overlay);
  overlay.querySelector('#item-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelectorAll('[data-use]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.use;
      const it = ITEMS[id];
      const r = consumeItem(_gameState, id);
      if (!r) return;
      overlay.remove();
      sfx.buy();

      // In-battle HP potions heal directly, then your turn ends.
      if (it.battleHeal && _state.player) {
        const before = _state.player.hp;
        _state.player.hp = Math.min(_state.player.hpMax, _state.player.hp + it.battleHeal);
        const healed = _state.player.hp - before;
        _state.log.push(`${it.emoji} ${_state.player.name} healed ${healed} HP.`);
        _container.querySelector('#me-sprite')?.classList.add('battler-buff');
        setTimeout(() => _container.querySelector('#me-sprite')?.classList.remove('battler-buff'), 600);
        updateHP();
      }

      // Item still costs your turn; the AI gets a free swing.
      const aiAct = pickAIAction(_state, 'opponent');
      const res = submitRound(_state, { kind: 'item', itemId: id }, aiAct);
      _state = res.state;
      animateEvents(res.events);
      paintLog();
      checkEnd();
    });
  });
}

function playerPicks(action) {
  if (_busy || _state.winner) return;
  _busy = true;
  // AI picks simultaneously
  const aiAct = pickAIAction(_state, 'opponent');
  _actionLog.push([action, aiAct]);
  const res = submitRound(_state, action, aiAct);
  _state = res.state;
  animateEvents(res.events);
  paintLog();
  setTimeout(() => { _busy = false; checkEnd(); }, 700);
}

function animateEvents(events) {
  for (const ev of events) {
    if (ev.kind === 'damage') {
      const sel = ev.foeSide === 'player' ? '#me-sprite' : '#opp-sprite';
      const el = _container.querySelector(sel);
      if (el) {
        el.classList.add('battler-hit');
        setTimeout(() => el.classList.remove('battler-hit'), 320);
      }
      if (ev.crit) {
        sfx.crit();
        spawnFx('💥 CRIT!', ev.foeSide, 'fx-crit');
      } else {
        sfx.hit();
      }
      spawnDamageNumber(ev.dmg, ev.foeSide, ev.crit);
      updateHP();
    }
    if (ev.kind === 'dodge') {
      spawnFx('💨 Miss', ev.side, 'fx-dodge');
      sfx.miss();
    }
    if (ev.kind === 'status') {
      spawnFx('💫', ev.side, 'fx-confuse');
    }
    if (ev.kind === 'heal' || ev.kind === 'buff') {
      const sel = ev.side === 'player' ? '#me-sprite' : '#opp-sprite';
      _container.querySelector(sel)?.classList.add('battler-buff');
      setTimeout(() => _container.querySelector(sel)?.classList.remove('battler-buff'), 600);
      updateHP();
    }
    if (ev.kind === 'ko') {
      const sel = ev.side === 'player' ? '#me-sprite' : '#opp-sprite';
      _container.querySelector(sel)?.classList.add('battler-ko');
    }
    if (ev.kind === 'move-used') {
      const sel = ev.side === 'player' ? '#me-sprite' : '#opp-sprite';
      _container.querySelector(sel)?.classList.add('battler-attack');
      setTimeout(() => _container.querySelector(sel)?.classList.remove('battler-attack'), 350);
    }
  }
}

function spawnFx(text, side, cls) {
  const target = side === 'player' ? '.battler--player' : '.battler--opponent';
  const wrap = _container.querySelector(target);
  if (!wrap) return;
  const fx = document.createElement('div');
  fx.className = `battle-fx ${cls}`;
  fx.textContent = text;
  wrap.appendChild(fx);
  setTimeout(() => fx.remove(), 900);
}

function spawnDamageNumber(dmg, side, crit) {
  const target = side === 'player' ? '.battler--player' : '.battler--opponent';
  const wrap = _container.querySelector(target);
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = `dmg-pop ${crit ? 'dmg-pop--crit' : ''}`;
  el.textContent = `-${dmg}`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

function updateHP() {
  const p = _state.player, o = _state.opponent;
  const pf = _container.querySelector('.battler--player .battler__hp-fill');
  const of = _container.querySelector('.battler--opponent .battler__hp-fill');
  if (pf) pf.style.width = `${(p.hp/p.hpMax)*100}%`;
  if (of) of.style.width = `${(o.hp/o.hpMax)*100}%`;
  const ph = _container.querySelector('.battler--player .battler__hpnum');
  const oh = _container.querySelector('.battler--opponent .battler__hpnum');
  if (ph) ph.textContent = `${p.hp} / ${p.hpMax}`;
  if (oh) oh.textContent = `${o.hp} / ${o.hpMax}`;
}

function paintLog() {
  const log = _container.querySelector('#battle-log');
  if (!log) return;
  // Show last 5 lines for clean UX
  log.innerHTML = (_state.log || []).slice(-5).map(l => `<div class="battle-log__line">${l}</div>`).join('');
  log.scrollTop = log.scrollHeight;
}

function statusChips(c) {
  const chips = [];
  if (c.statuses?.confused > 0) chips.push('💫 Confused');
  if (c.buffMods?.atk > 1) chips.push('📈 Atk+');
  if (c.buffMods?.def > 1) chips.push('🛡️ Def+');
  if (c.buffMods?.spd < 1) chips.push('🐌 Spd-');
  return chips.map(c => `<span class="status-chip">${c}</span>`).join('');
}

function traitChip(traitId) {
  const t = getTrait(traitId);
  if (!t) return '';
  return `${t.emoji} ${t.name}`;
}

function checkEnd() {
  const winner = isOver(_state);
  if (!winner) return;

  setTimeout(() => {
    const result = winner === 'player' ? buildWinResult() : buildLoseResult();
    showResultOverlay(result);
  }, 1100);
}

function buildWinResult() {
  const enc = _state.opponent;
  // Trait bonuses on rewards
  const greedy = _state.player?.traitMods?.budRewardMult ?? 1;
  const photoXp = _state.pendingPlayerXP ?? 0;
  return {
    won: true,
    encounter: enc,
    expEarned:   (enc.rewardXP   ?? 0) + photoXp,
    budsEarned:  Math.floor((enc.rewardBuds ?? 0) * greedy),
    seedsEarned: enc.rewardSeeds ?? 0,
  };
}
function buildLoseResult() {
  const photoXp = _state.pendingPlayerXP ?? 0;
  return { won: false, encounter: _state.opponent, expEarned: photoXp, budsEarned: 0, seedsEarned: 0 };
}

function showResultOverlay(result) {
  const overlay = document.createElement('div');
  overlay.className = 'battle-result-overlay';
  overlay.innerHTML = `
    <div class="battle-result-card">
      <h3 class="game-retro-title">${result.won ? '🏆 Victory!' : '💤 Defeat'}</h3>
      ${result.won ? `
        <p>You defeated <b>${result.encounter.name}</b>.</p>
        <div class="rewards">
          ${result.expEarned   ? `<div>⚡ +${result.expEarned} XP</div>` : ''}
          ${result.budsEarned  ? `<div>🪙 +${result.budsEarned} Buds</div>` : ''}
          ${result.seedsEarned ? `<div>🌱 +${result.seedsEarned} Seeds</div>` : ''}
        </div>
      ` : `<p><b>${result.encounter.name}</b> got the better of you. Better luck next time.</p>`}
      <div class="result-buttons">
        ${result.won ? `<button class="btn-juicy compact" id="result-share">📋 Brag Code</button>` : ''}
        <button class="btn-juicy" id="result-ok">Continue</button>
      </div>
    </div>`;
  _container.appendChild(overlay);
  overlay.querySelector('#result-ok').addEventListener('click', () => {
    overlay.remove();
    _onResolve(result);
  });
  overlay.querySelector('#result-share')?.addEventListener('click', async () => {
    const code = encodeReplay({
      player: _initialPlayer,
      opponent: _initialOpponent,
      seed: _initialSeed,
      actions: _actionLog,
      envId: _state.env?.id,
    });
    try {
      await navigator.clipboard?.writeText(code);
      const btn = overlay.querySelector('#result-share');
      btn.textContent = '✅ Copied — share with friends!';
      setTimeout(() => { btn.textContent = '📋 Brag Code'; }, 2200);
    } catch (_) {
      prompt('Copy your brag code (a friend can paste this to re-watch the fight):', code);
    }
  });
}
