/**
 * CannaGotchi — Versus Pairing UI
 *
 * Drives the connection flow for the three networked transports:
 *
 *   • Bluetooth (Capacitor BLE) — native iOS/Android.
 *   • Web Bluetooth             — Chrome/Edge desktop.
 *   • QR / short-code           — universal fallback.
 *
 * For BLE: shows scan progress; on connect, hands off to the deterministic
 * engine via createSession() and the live battle UI lives inside this same
 * container. If something goes wrong (no plugin, no permission, no host)
 * the user gets a clear message instead of a silent fail.
 *
 * For QR: the host shows a QR + 6-char code that encodes their Cannabud
 * snapshot + the agreed RNG seed. The guest reads it, both run the
 * deterministic engine locally; no network needed after the exchange.
 */

import { detectTransports, exportMySnapshot, createSession } from './multiplayer.js';
import { mpBleAdapter, mpWebBleAdapter, mpQrAdapter } from './mpAdapters.js';
import { renderSprite } from './pixelArt.js';
import { createBattle, submitRound, isOver, pickAIAction } from './battle.js';
import { sfx } from './sfx.js';
import { getTrait } from './traits.js';
import QRCode from 'qrcode';

let _container = null;
let _gameState = null;
let _onExit = () => {};

// ── Public entry points ─────────────────────────────────────
export async function mountBlePairing(opts) {
  _container = opts.container;
  _gameState = opts.gameState;
  _onExit    = opts.onExit || (() => {});
  const cap = detectTransports();
  drawScanScreen({
    title: cap.capBle ? '📡 Bluetooth (Native)' :
           cap.webBle ? '📡 Web Bluetooth'       :
                        '❌ Bluetooth Unavailable',
    available: cap.capBle || cap.webBle,
    transport: cap.capBle ? 'cap' : (cap.webBle ? 'web' : 'none'),
  });
}

export async function mountQrPairing(opts) {
  _container = opts.container;
  _gameState = opts.gameState;
  _onExit    = opts.onExit || (() => {});
  drawQrChooser();
}

// ── BLE pairing ─────────────────────────────────────────────
function drawScanScreen({ title, available, transport }) {
  _container.innerHTML = `
    <section class="tab-pane pairing-pane">
      <div class="card">
        <div class="card-title">${title}</div>
        ${available ? `
          <div class="dim small">Choose a role. The Host advertises; the Guest scans nearby.</div>
          <div class="action-row">
            <button class="btn-juicy big" id="ble-host"  ${transport === 'web' ? 'disabled' : ''}>📡 Host (Advertise)</button>
            <button class="btn-juicy big" id="ble-guest">🔎 Guest (Find)</button>
          </div>
          ${transport === 'web' ? `<div class="dim small">⚠️ Web browsers can't host — open the native app to advertise.</div>` : ''}
        ` : `
          <div class="dim small">Bluetooth isn't available in this browser. Install the iOS/Android app for native BLE pairing, or use the QR option from the Versus tab.</div>
        `}
        <div id="ble-status" class="dim small" style="margin-top:0.5rem"></div>
        <button class="btn-juicy compact" id="ble-cancel" style="margin-top:0.6rem">← Back</button>
      </div>
    </section>
  `;
  _container.querySelector('#ble-cancel').addEventListener('click', _onExit);
  _container.querySelector('#ble-host')?.addEventListener('click', () => startBle('host', transport));
  _container.querySelector('#ble-guest')?.addEventListener('click', () => startBle('guest', transport));
}

async function startBle(role, transport) {
  const status = _container.querySelector('#ble-status');
  status.textContent = role === 'host' ? '📡 Advertising… waiting for a guest.' : '🔎 Scanning for nearby Cannabuds…';
  sfx.encounter();

  const adapter = transport === 'cap' ? mpBleAdapter() : mpWebBleAdapter();
  try {
    await adapter.open({ role });
  } catch (err) {
    sfx.error();
    let msg;
    if (err.code === 'PLUGIN_MISSING')          msg = '⚙️ Native Bluetooth plugin not installed. Run `npm i @capacitor-community/bluetooth-le && npx cap sync`, then rebuild the native app.';
    else if (err.code === 'HOST_NOT_AVAILABLE_HERE') msg = '🚫 Hosting from this platform isn\'t available yet. Try Guest mode, or use QR pairing.';
    else if (err.code === 'NO_WEB_BT')           msg = '🚫 Web Bluetooth isn\'t supported in this browser. Try Chrome/Edge desktop or the native app.';
    else                                          msg = `❌ ${err.message || 'Pairing failed.'}`;
    status.innerHTML = msg;
    return;
  }

  status.textContent = '🤝 Connected! Exchanging snapshots…';
  const mySnap = exportMySnapshot(_gameState);
  const session = createSession({ transport: adapter, mySnapshot: mySnap, role });
  session.on('state', (e) => { if (e.phase === 'started') drawLiveBattle(session); });
  session.on('end',   () => drawEndScreen(session.battle));
}

function drawLiveBattle(session) {
  const refresh = () => {
    const b = session.battle;
    if (!b) return;
    const p = session.isHost ? b.player : b.opponent;
    const o = session.isHost ? b.opponent : b.player;
    _container.innerHTML = `
      <section class="tab-pane battle-arena">
        <div class="env-banner">
          <span>${b.env?.emoji || '⚔️'} ${b.env?.name || 'Versus'}</span>
          <span class="dim small">Live Bluetooth Match</span>
        </div>
        <div class="battler battler--opponent">
          <div class="battler__head"><span class="battler__name">${o.name}${o.trait ? ` <span class="trait-chip">${getTrait(o.trait)?.emoji || ''} ${getTrait(o.trait)?.name || ''}</span>` : ''}</span><span class="battler__lv">Lv.${o.level}</span></div>
          <div class="battler__hp"><div class="battler__hp-fill" style="width:${(o.hp/o.hpMax)*100}%;background:${o.color}"></div></div>
          <div class="battler__hpnum">${o.hp} / ${o.hpMax}</div>
          <div class="battler__sprite" id="lv-opp" style="filter:hue-rotate(${o.hueShift||0}deg);"></div>
        </div>
        <div class="battle-log card">${(b.log || []).slice(-5).map(l => `<div class="battle-log__line">${l}</div>`).join('')}</div>
        <div class="battler battler--player">
          <div class="battler__head"><span class="battler__name">${p.name}${p.trait ? ` <span class="trait-chip">${getTrait(p.trait)?.emoji || ''} ${getTrait(p.trait)?.name || ''}</span>` : ''}</span><span class="battler__lv">Lv.${p.level}</span></div>
          <div class="battler__hp"><div class="battler__hp-fill" style="width:${(p.hp/p.hpMax)*100}%;background:${p.color}"></div></div>
          <div class="battler__hpnum">${p.hp} / ${p.hpMax}</div>
          <div class="battler__sprite" id="lv-me"></div>
        </div>
        <div class="battle-actions">
          <div class="moves-grid">
            ${(p.moves || []).slice(0, 4).map(m => `
              <button class="move-btn" data-mv="${m.id}">
                <span class="move-btn__emoji">${m.emoji ?? '⚔️'}</span>
                <span class="move-btn__name">${m.name}</span>
                <span class="move-btn__pwr">${m.power > 0 ? 'PWR ' + m.power : 'STAT'}</span>
              </button>`).join('')}
          </div>
          <div class="battle-secondary">
            <button class="btn-juicy compact danger" id="lv-flee">🏃 Forfeit</button>
          </div>
        </div>
      </section>
    `;
    renderSprite(_container.querySelector('#lv-opp'), o.sprite, 6);
    renderSprite(_container.querySelector('#lv-me'),  p.sprite, 6);
    _container.querySelectorAll('[data-mv]').forEach(btn => {
      btn.addEventListener('click', () => session.chooseAction({ kind: 'move', moveId: btn.dataset.mv }));
    });
    _container.querySelector('#lv-flee')?.addEventListener('click', () => session.chooseAction({ kind: 'flee' }));
  };
  session.on('state', refresh);
  refresh();
}

function drawEndScreen(battle) {
  if (!battle) return;
  const win = battle.winner;
  _container.innerHTML = `
    <section class="tab-pane">
      <div class="card">
        <div class="card-title">${win === 'player' ? '🏆 Match Won' : '💤 Match Lost'}</div>
        <div class="dim small">Live Bluetooth match — bragging rights only, no XP/Buds risked.</div>
        <button class="btn-juicy" id="lv-exit">Done</button>
      </div>
    </section>
  `;
  _container.querySelector('#lv-exit').addEventListener('click', _onExit);
  win === 'player' ? sfx.victory() : sfx.defeat();
}

// ── QR pairing ──────────────────────────────────────────────
function drawQrChooser() {
  _container.innerHTML = `
    <section class="tab-pane pairing-pane">
      <div class="card">
        <div class="card-title">📷 QR Battle</div>
        <div class="dim small">Two devices, no Bluetooth needed. Host generates a QR; Guest scans (or types) the code. Both run the same battle locally with synchronized RNG.</div>
        <div class="action-row">
          <button class="btn-juicy big" id="qr-host">📤 Host (Show QR)</button>
          <button class="btn-juicy big" id="qr-guest">📥 Guest (Enter Code)</button>
        </div>
        <button class="btn-juicy compact" id="qr-cancel" style="margin-top:0.6rem">← Back</button>
      </div>
    </section>
  `;
  _container.querySelector('#qr-cancel').addEventListener('click', _onExit);
  _container.querySelector('#qr-host').addEventListener('click', drawQrHost);
  _container.querySelector('#qr-guest').addEventListener('click', drawQrGuest);
}

function buildQrPayload() {
  const snap = exportMySnapshot(_gameState);
  const seed = Math.floor(Math.random() * 0xFFFFFFFF);
  return { v: 1, type: 'hello', seed, payload: snap };
}

function shortCodeFor(payload) {
  // Compact ~120-char Base64 of the JSON. Trim trailing padding for tidiness.
  try {
    const json = JSON.stringify(payload);
    return btoa(unescape(encodeURIComponent(json))).replace(/=+$/, '');
  } catch (_) { return ''; }
}

function decodeShortCode(code) {
  try {
    const json = decodeURIComponent(escape(atob(code)));
    return JSON.parse(json);
  } catch (_) { return null; }
}

async function drawQrHost() {
  const payload = buildQrPayload();
  const code = shortCodeFor(payload);
  _container.innerHTML = `
    <section class="tab-pane pairing-pane">
      <div class="card">
        <div class="card-title">📤 Host — Show This Code</div>
        <div class="qr-wrap">
          <canvas id="qr-canvas" width="220" height="220" aria-label="Pairing QR"></canvas>
        </div>
        <div class="dim small">Or have your friend type this code:</div>
        <div class="qr-shortcode" id="qr-shortcode">${code.slice(0, 64)}…</div>
        <div class="dim small">When they confirm, both phones run the same battle locally.</div>
        <div class="action-row">
          <button class="btn-juicy" id="qr-copy">📋 Copy Full Code</button>
          <button class="btn-juicy" id="qr-confirm">▶️ I'm Ready — Start</button>
        </div>
        <button class="btn-juicy compact" id="qr-back" style="margin-top:0.6rem">← Back</button>
      </div>
    </section>
  `;

  // Render QR
  const canvas = _container.querySelector('#qr-canvas');
  try {
    await QRCode.toCanvas(canvas, code, { errorCorrectionLevel: 'L', margin: 1, width: 220 });
  } catch (err) {
    canvas.style.display = 'none';
  }

  _container.querySelector('#qr-back').addEventListener('click', drawQrChooser);
  _container.querySelector('#qr-copy').addEventListener('click', () => {
    navigator.clipboard?.writeText(code).then(() => sfx.click());
  });
  _container.querySelector('#qr-confirm').addEventListener('click', () => {
    runQrBattle(payload, /*isHost=*/true);
  });
}

function drawQrGuest() {
  _container.innerHTML = `
    <section class="tab-pane pairing-pane">
      <div class="card">
        <div class="card-title">📥 Guest — Enter Host's Code</div>
        <div class="dim small">Paste the long code your friend shared. (QR camera scanning will arrive when we add the Capacitor Camera plugin.)</div>
        <textarea id="qr-input" class="qr-input" rows="4" placeholder="Paste pairing code here…"></textarea>
        <div class="action-row">
          <button class="btn-juicy" id="qr-paste">📥 Paste from Clipboard</button>
          <button class="btn-juicy" id="qr-decode">▶️ Connect</button>
        </div>
        <div id="qr-error" class="dim small" style="color:#f87171"></div>
        <button class="btn-juicy compact" id="qr-back" style="margin-top:0.6rem">← Back</button>
      </div>
    </section>
  `;
  _container.querySelector('#qr-back').addEventListener('click', drawQrChooser);
  _container.querySelector('#qr-paste').addEventListener('click', async () => {
    try { _container.querySelector('#qr-input').value = await navigator.clipboard.readText(); }
    catch (_) {}
  });
  _container.querySelector('#qr-decode').addEventListener('click', () => {
    const txt = _container.querySelector('#qr-input').value.trim();
    const decoded = decodeShortCode(txt);
    if (!decoded || decoded.type !== 'hello') {
      sfx.error();
      _container.querySelector('#qr-error').textContent = '❌ That doesn\'t look like a valid code. Try paste again.';
      return;
    }
    runQrBattle(decoded, /*isHost=*/false);
  });
}

/**
 * Both peers reach this with the same payload (host built it, guest decoded it).
 * They run the same deterministic battle locally; the AI plays the absent peer
 * for now. To make it truly synchronous (each side's actions chosen by the
 * actual human), we'd need an ongoing transport — that's the BLE path.
 */
function runQrBattle(payload, isHost) {
  const mySnap  = exportMySnapshot(_gameState);
  const theirSnap = payload.payload;
  const seed = payload.seed;

  let battle = createBattle({
    player:   isHost ? mySnap   : theirSnap,
    opponent: isHost ? theirSnap : mySnap,
    seed,
  });

  // The local-side player picks moves; the AI picks for the other side.
  // (Full live-sync requires an open transport — BLE.)
  draw();

  function draw() {
    const me  = isHost ? battle.player : battle.opponent;
    const foe = isHost ? battle.opponent : battle.player;
    _container.innerHTML = `
      <section class="tab-pane battle-arena ${battle.env?.bgClass || ''}">
        ${battle.env ? `<div class="env-banner"><span>${battle.env.emoji} ${battle.env.name}</span><span class="dim small">QR async match</span></div>` : ''}
        <div class="battler battler--opponent">
          <div class="battler__head"><span class="battler__name">${foe.name}${foe.trait ? ` <span class="trait-chip">${getTrait(foe.trait)?.emoji || ''} ${getTrait(foe.trait)?.name || ''}</span>` : ''}</span><span class="battler__lv">Lv.${foe.level}</span></div>
          <div class="battler__hp"><div class="battler__hp-fill" style="width:${(foe.hp/foe.hpMax)*100}%;background:${foe.color}"></div></div>
          <div class="battler__hpnum">${foe.hp} / ${foe.hpMax}</div>
          <div class="battler__sprite" id="qb-opp" style="filter:hue-rotate(${foe.hueShift||0}deg);"></div>
        </div>
        <div class="battle-log card">${(battle.log || []).slice(-5).map(l => `<div class="battle-log__line">${l}</div>`).join('')}</div>
        <div class="battler battler--player">
          <div class="battler__head"><span class="battler__name">${me.name}${me.trait ? ` <span class="trait-chip">${getTrait(me.trait)?.emoji || ''} ${getTrait(me.trait)?.name || ''}</span>` : ''}</span><span class="battler__lv">Lv.${me.level}</span></div>
          <div class="battler__hp"><div class="battler__hp-fill" style="width:${(me.hp/me.hpMax)*100}%;background:${me.color}"></div></div>
          <div class="battler__hpnum">${me.hp} / ${me.hpMax}</div>
          <div class="battler__sprite" id="qb-me"></div>
        </div>
        ${battle.winner ? `
          <div class="card">
            <div class="card-title">${(battle.winner === 'player') === isHost ? '🏆 Match Won' : '💤 Match Lost'}</div>
            <div class="dim small">QR async match — both devices ran the same deterministic seed.</div>
            <button class="btn-juicy" id="qb-exit">Done</button>
          </div>` : `
          <div class="battle-actions">
            <div class="moves-grid">
              ${(me.moves || []).slice(0, 4).map(m => `
                <button class="move-btn" data-qb="${m.id}">
                  <span class="move-btn__emoji">${m.emoji ?? '⚔️'}</span>
                  <span class="move-btn__name">${m.name}</span>
                  <span class="move-btn__pwr">${m.power > 0 ? 'PWR ' + m.power : 'STAT'}</span>
                </button>`).join('')}
            </div>
          </div>`}
      </section>
    `;
    renderSprite(_container.querySelector('#qb-opp'), foe.sprite, 6);
    renderSprite(_container.querySelector('#qb-me'),  me.sprite, 6);
    if (battle.winner) {
      _container.querySelector('#qb-exit').addEventListener('click', _onExit);
      ((battle.winner === 'player') === isHost) ? sfx.victory() : sfx.defeat();
    } else {
      _container.querySelectorAll('[data-qb]').forEach(btn => {
        btn.addEventListener('click', () => playerStep(btn.dataset.qb));
      });
    }
  }

  function playerStep(moveId) {
    const playerAct   = isHost ? { kind: 'move', moveId } : pickAIAction(battle, 'player');
    const opponentAct = isHost ? pickAIAction(battle, 'opponent') : { kind: 'move', moveId };
    const r = submitRound(battle, playerAct, opponentAct);
    battle = r.state;
    draw();
  }
}
