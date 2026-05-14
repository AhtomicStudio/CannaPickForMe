/**
 * CannaGotchi — Versus Screen (local hot-seat)
 *
 * Two players share one device. Each picks moves on their turn while
 * the other looks away. Once both have picked, the round resolves and
 * the screen flips back to the first player's turn.
 *
 * Uses the SAME deterministic engine as singleplayer battles, so it
 * doubles as the local-side runner for future BLE/QR multiplayer.
 *
 * Player 2's Cannabud is generated as a Lv-matched random opponent today —
 * later, when both players have accounts, this will swap to their actual
 * Cannabud snapshot received over the network.
 */

import { createBattle, submitRound, isOver } from './battle.js';
import { makePlayerCombatant, makeWildEncounter } from './encounters.js';
import { renderSprite } from './pixelArt.js';
import { sfx } from './sfx.js';

let _container = null;
let _gameState = null;
let _state = null;
let _onExit = () => {};
let _phase = 'p1-pick';      // 'p1-pick' | 'p2-pick' | 'resolve' | 'end'
let _p1Action = null;
let _p2Action = null;

function isAlive() {
  return _container && document.body.contains(_container);
}

export function mountLocalDuel({ container, gameState, onExit }) {
  _container = container;
  _gameState = gameState;
  _onExit = onExit || (() => {});

  // Player 1 = the player. Player 2 = a level-matched random Cannabud
  // (placeholder for the second player's real Cannabud once BLE is wired).
  const me = makePlayerCombatant(gameState);
  const opp = makeWildEncounter(me.level);
  opp.name = `${opp.name} (P2)`;

  _state = createBattle({ player: me, opponent: opp, seed: Date.now() });
  _phase = 'p1-pick';
  _p1Action = null; _p2Action = null;
  sfx.battleStart();
  draw();
}

function draw() {
  if (!isAlive()) return;
  const p = _state.player, o = _state.opponent;
  const isP1Turn = _phase === 'p1-pick';
  const activeSide = isP1Turn ? 'player' : 'opponent';
  const activeBuddy = isP1Turn ? p : o;

  _container.innerHTML = `
    <section class="tab-pane versus-arena">
      <div class="versus-banner">
        ${_phase === 'end' ? `🏁 Battle Over`
          : isP1Turn ? `👤 Player 1 — choose a move`
          : `👥 Player 2 — pass the device`}
      </div>

      <div class="battler battler--opponent" data-side="opponent">
        <div class="battler__head">
          <span class="battler__name">${o.name}</span>
          <span class="battler__lv">Lv.${o.level}</span>
        </div>
        <div class="battler__hp"><div class="battler__hp-fill" style="width:${(o.hp/o.hpMax)*100}%;background:${o.color}"></div></div>
        <div class="battler__hpnum">${o.hp} / ${o.hpMax}</div>
        <div class="battler__sprite" id="vp-opp"></div>
      </div>

      <div class="battle-log card" id="vp-log"></div>

      <div class="battler battler--player" data-side="player">
        <div class="battler__head">
          <span class="battler__name">${p.name}</span>
          <span class="battler__lv">Lv.${p.level}</span>
        </div>
        <div class="battler__hp"><div class="battler__hp-fill" style="width:${(p.hp/p.hpMax)*100}%;background:${p.color}"></div></div>
        <div class="battler__hpnum">${p.hp} / ${p.hpMax}</div>
        <div class="battler__sprite" id="vp-me"></div>
      </div>

      ${_phase === 'end' ? renderEnd() : renderActionRow(activeBuddy)}
    </section>
  `;
  renderSprite(_container.querySelector('#vp-opp'), o.sprite, 6);
  renderSprite(_container.querySelector('#vp-me'),  p.sprite, 6);

  if (_phase !== 'end') {
    _container.querySelectorAll('[data-vp-move]').forEach(btn => {
      btn.addEventListener('click', () => onPick({ kind: 'move', moveId: btn.dataset.vpMove }));
    });
    _container.querySelector('#vp-flee')?.addEventListener('click', () => {
      // P2 is the opponent side; the battle engine's flee only short-circuits
      // for side === 'player'. Manually handle P2 forfeit so it actually ends
      // the battle instead of silently using their first move.
      if (_phase === 'p2-pick') {
        _state = { ..._state, winner: 'player',
          log: [...(_state.log || []), '🏃 Player 2 forfeited!'] };
        _phase = 'end';
        sfx.defeat();
        draw();
        return;
      }
      onPick({ kind: 'flee' });
    });
  } else {
    _container.querySelector('#vp-exit')?.addEventListener('click', () => _onExit());
  }
  paintLog();
}

function renderActionRow(actor) {
  return `
    <div class="battle-actions">
      <div class="moves-grid">
        ${(actor.moves || []).slice(0, 4).map(m => `
          <button class="move-btn" data-vp-move="${m.id}">
            <span class="move-btn__emoji">${m.emoji ?? '⚔️'}</span>
            <span class="move-btn__name">${m.name}</span>
            <span class="move-btn__pwr">${m.power > 0 ? 'PWR ' + m.power : 'STAT'}</span>
          </button>`).join('')}
      </div>
      <div class="battle-secondary">
        <button class="btn-juicy compact danger" id="vp-flee">🏃 Forfeit</button>
      </div>
    </div>
  `;
}

function renderEnd() {
  const winnerName = _state.winner === 'player' ? 'Player 1' : 'Player 2';
  return `
    <div class="card">
      <div class="card-title">${winnerName} wins! 🏆</div>
      <div class="dim small">Local match — no rewards or stat changes are saved (this is a friendly).</div>
      <button class="btn-juicy big" id="vp-exit">Done</button>
    </div>
  `;
}

function onPick(action) {
  if (_phase === 'p1-pick') {
    _p1Action = action;
    _phase = 'p2-pick';
    sfx.tap();
    draw(); // render the P2 pick screen first …
    flashBanner('🔄 Pass to Player 2…', 'orange'); // … then overlay the flash on top
    return;
  }
  if (_phase === 'p2-pick') {
    _p2Action = action;
    _phase = 'resolve';
    const res = submitRound(_state, _p1Action, _p2Action);
    _state = res.state;
    _p1Action = null;
    _p2Action = null;
    if (isOver(_state)) {
      _phase = 'end';
      sfx.victory();
    } else {
      _phase = 'p1-pick';
    }
    draw();
  }
}

function paintLog() {
  const log = _container.querySelector('#vp-log');
  if (!log) return;
  log.innerHTML = (_state.log || []).slice(-5).map(l => `<div class="battle-log__line">${l}</div>`).join('');
  log.scrollTop = log.scrollHeight;
}

function flashBanner(text, color) {
  if (!isAlive()) return;
  const el = document.createElement('div');
  el.className = 'versus-flash';
  el.textContent = text;
  if (color === 'orange') el.style.color = '#fb923c';
  _container.appendChild(el);
  setTimeout(() => el.remove(), 800);
}
