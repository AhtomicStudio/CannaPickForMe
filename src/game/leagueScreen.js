/**
 * CannaGotchi — Async Battle League screen
 *
 * Three states:
 *   1. Browsing — published challengers list with "Fight" buttons
 *   2. Fighting — runs the deterministic battle vs a fetched snapshot
 *   3. Result   — win/lose card; option to publish your latest snapshot
 *
 * Publishing is a single tap that snapshots your active Cannabud and stores
 * it under your uid in `leagueChallengers`. Re-publishing overwrites your
 * previous snapshot so opponents always see your latest bud.
 */

import { fetchLeaderboard, publishChallenger, recordMyResult } from '../services/leagueService.js';
import { exportMySnapshot } from './multiplayer.js';
import { createBattle, submitRound, isOver, pickAIAction } from './battle.js';
import { renderSprite } from './pixelArt.js';
import { sfx } from './sfx.js';
import { getMonsterType } from './monsters.js';
import { getLevel } from './gameEngine.js';
import { getTrait } from './traits.js';

let _container = null;
let _gameState = null;
let _uid = null;
let _onExit = () => {};
let _battle = null;

export async function mountLeague(opts) {
  _container = opts.container;
  _gameState = opts.gameState;
  _uid       = opts.uid;
  _onExit    = opts.onExit || (() => {});
  drawList();
}

async function drawList() {
  _container.innerHTML = `
    <section class="tab-pane">
      <div class="card">
        <div class="card-title">🏆 Battle League</div>
        <div class="dim small">Async leaderboard. Publish your bud, browse challengers, fight any time.</div>
        <div class="action-row" style="margin-top:0.5rem">
          <button class="btn-juicy" id="lg-publish">📤 Publish My Cannabud</button>
          <button class="btn-juicy compact" id="lg-refresh">🔄 Refresh</button>
        </div>
      </div>
      <div class="card" id="lg-list-card">
        <div class="card-title">Top Challengers</div>
        <div class="dim small">Loading…</div>
      </div>
      <button class="btn-juicy compact" id="lg-back">← Back</button>
    </section>`;

  _container.querySelector('#lg-back').addEventListener('click', _onExit);
  _container.querySelector('#lg-publish').addEventListener('click', publishMine);
  _container.querySelector('#lg-refresh').addEventListener('click', drawList);

  let list = [];
  let fetchError = null;
  try {
    list = await fetchLeaderboard(25);
  } catch (err) {
    fetchError = err;
    console.warn('[league] fetchLeaderboard failed:', err);
  }
  const card = _container.querySelector('#lg-list-card');
  if (!card) return;

  if (fetchError) {
    card.innerHTML = `
      <div class="card-title">Top Challengers</div>
      <div class="dim small" style="color:#f87171">⚠️ Couldn't reach the league right now.</div>
      <div class="dim small">Check your connection and tap 🔄 Refresh, or try again in a moment.</div>`;
    return;
  }

  if (list.length === 0) {
    card.innerHTML = `
      <div class="card-title">Top Challengers</div>
      <div class="dim small">No challengers yet. Be the first — tap <b>📤 Publish My Cannabud</b> above.</div>`;
    return;
  }

  card.innerHTML = `
    <div class="card-title">Top Challengers <span class="dim small">${list.length}</span></div>
    <div class="lg-list">
      ${list.map(c => {
        const mt = getMonsterType(c.type) || {};
        const traitGlyph = c.traitId ? (getTrait(c.traitId)?.emoji || '') : '';
        const isMe = c.uid === _uid;
        return `
          <div class="lg-row ${isMe ? 'lg-row--me' : ''}">
            <div class="lg-row__head">
              <span class="lg-row__type">${mt.emoji || '🌿'}</span>
              <span class="lg-row__name">${c.snapshot?.name || 'Bud'}</span>
              <span class="lg-row__lvl dim small">Lv.${c.level || 1}</span>
              ${traitGlyph ? `<span class="lg-row__trait">${traitGlyph}</span>` : ''}
            </div>
            <div class="lg-row__by dim small">by ${c.displayName || 'Anonymous'} · 🏆 ${c.wins || 0} / 💤 ${c.losses || 0}</div>
            ${isMe ? '<div class="dim small">★ This is your published bud</div>'
                   : `<button class="btn-juicy compact" data-fight="${c.uid}">⚔️ Fight</button>`}
          </div>`;
      }).join('')}
    </div>`;

  card.querySelectorAll('[data-fight]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetUid = btn.dataset.fight;
      const challenger = list.find(c => c.uid === targetUid);
      if (challenger) startLeagueBattle(challenger);
    });
  });
}

async function publishMine() {
  if (!_uid) { sfx.error(); return; }
  sfx.buy();
  const snapshot = exportMySnapshot(_gameState);
  const r = await publishChallenger({
    uid: _uid,
    displayName: _gameState.monsterName,
    snapshot,
    level: getLevel(_gameState.xp),
    type:    _gameState.monsterType,
    variant: _gameState.monsterVariant || 'classic',
    traitId: _gameState.trait || null,
  });
  if (r.ok) drawList();
  else { sfx.error(); }
}

function startLeagueBattle(challenger) {
  const me = exportMySnapshot(_gameState);
  const opp = challenger.snapshot;
  if (!opp) { sfx.error(); return; }
  _battle = createBattle({ player: me, opponent: opp, seed: Date.now() });
  sfx.battleStart();
  drawBattle(challenger);
}

function drawBattle(challenger) {
  if (!_battle) return;
  const p = _battle.player, o = _battle.opponent;
  _container.innerHTML = `
    <section class="tab-pane battle-arena ${_battle.env?.bgClass || ''}">
      ${_battle.env ? `<div class="env-banner"><span>${_battle.env.emoji} ${_battle.env.name}</span><span class="dim small">vs ${challenger.displayName}</span></div>` : ''}
      <div class="battler battler--opponent">
        <div class="battler__head">
          <span class="battler__name">${o.name}${o.trait ? ` <span class="trait-chip">${getTrait(o.trait)?.emoji || ''} ${getTrait(o.trait)?.name || ''}</span>` : ''}</span>
          <span class="battler__lv">Lv.${o.level}</span>
        </div>
        <div class="battler__hp"><div class="battler__hp-fill" style="width:${(o.hp/o.hpMax)*100}%;background:${o.color}"></div></div>
        <div class="battler__hpnum">${o.hp} / ${o.hpMax}</div>
        <div class="battler__sprite" id="lg-opp"></div>
      </div>
      <div class="battle-log card">${(_battle.log || []).slice(-5).map(l => `<div class="battle-log__line">${l}</div>`).join('')}</div>
      <div class="battler battler--player">
        <div class="battler__head"><span class="battler__name">${p.name}</span><span class="battler__lv">Lv.${p.level}</span></div>
        <div class="battler__hp"><div class="battler__hp-fill" style="width:${(p.hp/p.hpMax)*100}%;background:${p.color}"></div></div>
        <div class="battler__hpnum">${p.hp} / ${p.hpMax}</div>
        <div class="battler__sprite" id="lg-me"></div>
      </div>
      ${_battle.winner ? `
        <div class="card">
          <div class="card-title">${_battle.winner === 'player' ? '🏆 Victory!' : '💤 Defeat'}</div>
          <div class="dim small">League match vs <b>${challenger.displayName}</b>.</div>
          <button class="btn-juicy" id="lg-done">Done</button>
        </div>` : `
        <div class="battle-actions">
          <div class="moves-grid">
            ${(p.moves || []).slice(0,4).map(m => `
              <button class="move-btn" data-mv="${m.id}">
                <span class="move-btn__emoji">${m.emoji ?? '⚔️'}</span>
                <span class="move-btn__name">${m.name}</span>
                <span class="move-btn__pwr">${m.power > 0 ? 'PWR ' + m.power : 'STAT'}</span>
              </button>`).join('')}
          </div>
        </div>`}
    </section>`;
  renderSprite(_container.querySelector('#lg-opp'), o.sprite, 6, { paletteRemap: o.paletteRemap });
  renderSprite(_container.querySelector('#lg-me'),  p.sprite, 6, { paletteRemap: p.paletteRemap });

  if (!_battle.winner) {
    _container.querySelectorAll('[data-mv]').forEach(btn => {
      btn.addEventListener('click', () => stepBattle({ kind: 'move', moveId: btn.dataset.mv }, challenger));
    });
  } else {
    _container.querySelector('#lg-done').addEventListener('click', _onExit);
    if (_battle.winner === 'player') sfx.victory(); else sfx.defeat();
    recordMyResult(_uid, _battle.winner === 'player').catch(() => {});
  }
}

function stepBattle(action, challenger) {
  const aiAct = pickAIAction(_battle, 'opponent');
  const r = submitRound(_battle, action, aiAct);
  _battle = r.state;
  drawBattle(challenger);
}
