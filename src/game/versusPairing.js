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

import { detectTransports, exportMySnapshot, createSession, mpBleAdapter, mpWebBleAdapter, mpQrAdapter } from './multiplayer.js';
import { renderSprite } from './pixelArt.js';
import { createBattle, submitRound, isOver, pickAIAction } from './battle.js';
import { sfx } from './sfx.js';
import { getTrait } from './traits.js';
import {
  createRoom, joinRoom, listenRoom,
  submitAction, advanceRound, endRoom, sendEmote, cleanupRoom,
} from '../services/battleRoomService.js';

// Lazy-loaded so the module still works even if qrcode has bundler issues
let _QRCode = null;
async function getQRCode() {
  if (!_QRCode) {
    try {
      const mod = await import('qrcode');
      _QRCode = mod.default || mod;
    } catch (err) {
      console.warn('[QR] qrcode library failed to load:', err);
      _QRCode = null;
    }
  }
  return _QRCode;
}

let _container = null;
let _gameState = null;
let _onExit = () => {};

// Guard: returns false if _container has been detached from the document
// (i.e. the tab body was re-rendered while a versus session was loading).
function isAlive() {
  return _container && document.body.contains(_container);
}

// ── Online battle state ─────────────────────────────────────
let _onlineUid = null;
let _onlineDisplayName = null;
let _roomCode = null;
let _isHostOnline = false;
let _unsubRoom = null;       // Firestore onSnapshot unsubscribe
let _onlineBattle = null;    // deterministic battle state (local)
let _localRound = 0;         // round we're currently on (tracks room.round)
let _submittedThisRound = false;  // prevents double-submit
let _currentRoom = null;     // latest snapshot from Firestore

function _cleanupOnline() {
  if (_unsubRoom) { _unsubRoom(); _unsubRoom = null; }
  _roomCode = null;
  _onlineBattle = null;
  _localRound = 0;
  _submittedThisRound = false;
  _currentRoom = null;
}

const EMOTES = ['🔥', '💨', '😎', '😴', '💪', '🌿', '👏', '💀'];

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
  if (!isAlive()) return;
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
    if (!isAlive()) return;
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
  if (!battle || !isAlive()) return;
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
  if (!isAlive()) return;
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
  if (!isAlive()) return;
  const payload = buildQrPayload();
  const code = shortCodeFor(payload);
  _container.innerHTML = `
    <section class="tab-pane pairing-pane">
      <div class="card">
        <div class="card-title">📤 Host — Show This QR</div>
        <div class="dim small" style="text-align:center">Have your friend scan this with their camera</div>
        <div class="qr-wrap" style="margin:0.5rem auto">
          <canvas id="qr-canvas" width="200" height="200" aria-label="Pairing QR"></canvas>
        </div>
        <div class="qr-manual-row">
          <span class="dim small">Can't scan?</span>
          <button class="btn-juicy compact" id="qr-copy">📋 Copy Code</button>
          <button class="btn-juicy compact" id="qr-reveal">👁 Show Text</button>
        </div>
        <div id="qr-code-reveal" style="display:none;margin:0.4rem 0">
          <textarea id="qr-shortcode" class="qr-input" rows="3" readonly
            style="font-size:0.35rem;cursor:text;word-break:break-all;user-select:all"
            onclick="this.select()">${code}</textarea>
          <div class="dim small" style="opacity:0.6;font-size:0.42rem">Paste this into the Guest's "Enter Code" box</div>
        </div>
        <div class="dim small" style="margin-top:0.4rem;text-align:center">Once your friend connects, tap Ready to start!</div>
        <button class="btn-juicy big" id="qr-confirm" style="margin-top:0.5rem">▶️ I'm Ready — Start Battle</button>
        <button class="btn-juicy compact" id="qr-back" style="margin-top:0.4rem">← Back</button>
      </div>
    </section>
  `;

  // Render QR
  const canvas = _container.querySelector('#qr-canvas');
  try {
    const QRCode = await getQRCode();
    if (QRCode) {
      await QRCode.toCanvas(canvas, code, { errorCorrectionLevel: 'L', margin: 1, width: 220 });
    } else {
      canvas.style.display = 'none';
    }
  } catch (err) {
    console.warn('[QR] Canvas render failed:', err);
    canvas.style.display = 'none';
  }

  _container.querySelector('#qr-back').addEventListener('click', drawQrChooser);
  _container.querySelector('#qr-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code);
      sfx.click?.();
      const btn = _container.querySelector('#qr-copy');
      if (btn) { btn.textContent = '✅ Copied!'; setTimeout(() => { if (isAlive()) btn.textContent = '📋 Copy Code'; }, 2000); }
    } catch (_) {
      // Clipboard failed — reveal the text area as fallback
      const rev = _container.querySelector('#qr-code-reveal');
      if (rev) rev.style.display = 'block';
    }
  });
  _container.querySelector('#qr-reveal').addEventListener('click', () => {
    const rev = _container.querySelector('#qr-code-reveal');
    const btn = _container.querySelector('#qr-reveal');
    if (rev) {
      const visible = rev.style.display !== 'none';
      rev.style.display = visible ? 'none' : 'block';
      if (btn) btn.textContent = visible ? '👁 Show Text' : '🙈 Hide Text';
      if (!visible) _container.querySelector('#qr-shortcode')?.select();
    }
  });
  _container.querySelector('#qr-confirm').addEventListener('click', () => {
    runQrBattle(payload, /*isHost=*/true);
  });
}

function drawQrGuest() {
  if (!isAlive()) return;
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
  sfx.battleStart();
  draw();

  function draw() {
    if (!isAlive()) return;
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
            <div class="battle-secondary">
              <button class="btn-juicy compact danger" id="qb-forfeit">🏃 Forfeit</button>
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
      _container.querySelector('#qb-forfeit')?.addEventListener('click', () => {
        sfx.defeat();
        _onExit();
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

// ═══════════════════════════════════════════════════════════════
// ONLINE BATTLE — Firebase Firestore real-time rooms
// ═══════════════════════════════════════════════════════════════

/**
 * Entry point called from gameScreen.js wireVersusTab.
 * uid + displayName come from the game's auth / gameState.
 */
export async function mountOnlineBattle({ container, gameState, uid, displayName, onExit }) {
  _container  = container;
  _gameState  = gameState;
  _onlineUid  = uid;
  _onlineDisplayName = displayName || 'Trainer';
  _onExit     = onExit || (() => {});
  _cleanupOnline();
  drawOnlineChooser();
}

// ── Chooser: Host or Guest ───────────────────────────────────
function drawOnlineChooser() {
  if (!isAlive()) return;
  _container.innerHTML = `
    <section class="tab-pane pairing-pane">
      <div class="card">
        <div class="card-title">🌐 Online Battle</div>
        <div class="dim small">Real-time versus over the internet. Host creates a room code; Guest types it in. Both pick moves simultaneously.</div>
        <div class="action-row" style="margin-top:0.8rem">
          <button class="btn-juicy big" id="ob-host">🏠 Host a Room</button>
          <button class="btn-juicy big" id="ob-join">🚪 Join a Room</button>
        </div>
        <button class="btn-juicy compact" id="ob-back" style="margin-top:0.6rem">← Back</button>
      </div>
    </section>`;
  _container.querySelector('#ob-back').addEventListener('click', () => { _cleanupOnline(); _onExit(); });
  _container.querySelector('#ob-host').addEventListener('click', startHosting);
  _container.querySelector('#ob-join').addEventListener('click', drawJoinScreen);
}

// ── HOST: create room + wait ──────────────────────────────────
async function startHosting() {
  if (!isAlive()) return;
  _isHostOnline = true;
  const mySnap = exportMySnapshot(_gameState);

  // Show spinner while Firestore creates the doc
  _container.innerHTML = `
    <section class="tab-pane pairing-pane">
      <div class="card">
        <div class="card-title">🏠 Creating Room…</div>
        <div class="dim small">Connecting to server…</div>
        <button class="btn-juicy compact" id="ob-back2" style="margin-top:0.6rem">← Cancel</button>
      </div>
    </section>`;
  _container.querySelector('#ob-back2').addEventListener('click', () => { _cleanupOnline(); drawOnlineChooser(); });

  try {
    const { code } = await createRoom({
      hostUid: _onlineUid || 'anon',
      hostName: _onlineDisplayName,
      hostSnapshot: mySnap,
    });
    _roomCode = code;
  } catch (err) {
    if (!isAlive()) return;
    _container.innerHTML = `
      <section class="tab-pane pairing-pane">
        <div class="card">
          <div class="card-title">⚠️ Couldn't Create Room</div>
          <div class="dim small" style="color:#f87171">${err?.message || String(err)}</div>
          <button class="btn-juicy compact" id="ob-back3" style="margin-top:0.6rem">← Back</button>
        </div>
      </section>`;
    _container.querySelector('#ob-back3').addEventListener('click', drawOnlineChooser);
    return;
  }

  drawWaitingHost();

  // Start listening — when guest joins (status → 'active'), kick off battle
  _unsubRoom = listenRoom(_roomCode, (room) => {
    _currentRoom = room;
    if (room.status === 'active' && room.guestSnapshot && !_onlineBattle) {
      // Guest arrived — start the battle
      _startOnlineBattle(room);
    } else if (room.status === 'active' && _onlineBattle) {
      _handleRoomUpdate(room);
    } else if (room.status === 'ended') {
      _handleRoomUpdate(room);
    }
  });
}

async function drawWaitingHost() {
  if (!isAlive()) return;
  _container.innerHTML = `
    <section class="tab-pane pairing-pane">
      <div class="card">
        <div class="card-title">⏳ Waiting for Opponent</div>
        <div class="dim small" style="text-align:center">Share this code with your friend:</div>
        <div class="room-code-display" id="ob-code-display" title="Tap to copy">${_roomCode}</div>
        <div id="ob-qr-wrap" style="display:flex;justify-content:center;margin:0.4rem 0 0.2rem"></div>
        <button class="btn-juicy compact" id="ob-copy-code" style="width:100%;margin-bottom:0.4rem">📋 Copy Code</button>
        <div class="dim small ob-waiting">🟢 Waiting for someone to join…</div>
        <button class="btn-juicy compact danger" id="ob-cancel-host" style="margin-top:0.6rem">✕ Cancel</button>
      </div>
    </section>`;

  // Generate a small QR for the room code — purely the 6-char code so it's
  // tiny, clean, and easy to scan with any QR app or camera.
  const qrWrap = _container.querySelector('#ob-qr-wrap');
  try {
    const QR = await getQRCode();
    if (QR && qrWrap && isAlive()) {
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'border-radius:6px;image-rendering:pixelated;width:96px;height:96px';
      await QR.toCanvas(canvas, _roomCode, {
        width: 96, margin: 1,
        color: { dark: '#4ade80', light: '#0a0a0a' },
      });
      qrWrap.appendChild(canvas);
    }
  } catch (_) { /* QR optional */ }

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(_roomCode);
      sfx.tap?.();
      const btn = _container.querySelector('#ob-copy-code');
      if (btn) { btn.textContent = '✅ Copied!'; setTimeout(() => { if (isAlive()) btn.textContent = '📋 Copy Code'; }, 1800); }
    } catch (_) {}
  };
  _container.querySelector('#ob-copy-code').addEventListener('click', copyRoomCode);
  _container.querySelector('#ob-code-display')?.addEventListener('click', copyRoomCode);
  _container.querySelector('#ob-cancel-host').addEventListener('click', async () => {
    _unsubRoom?.(); _unsubRoom = null;
    await cleanupRoom(_roomCode);
    _cleanupOnline();
    drawOnlineChooser();
  });
}

// ── GUEST: enter code + join ──────────────────────────────────
function drawJoinScreen() {
  if (!isAlive()) return;
  _isHostOnline = false;
  _container.innerHTML = `
    <section class="tab-pane pairing-pane">
      <div class="card">
        <div class="card-title">🚪 Join a Room</div>
        <div class="dim small">Type the 6-character room code your friend shared:</div>
        <input id="ob-code-input" class="ob-code-input" maxlength="6" placeholder="ABC123" autocomplete="off" autocorrect="off" spellcheck="false">
        <button class="btn-juicy big" id="ob-connect">▶️ Connect</button>
        <div id="ob-join-err" class="dim small" style="color:#f87171;min-height:1.2em;margin-top:0.3rem"></div>
        <button class="btn-juicy compact" id="ob-back-join" style="margin-top:0.6rem">← Back</button>
      </div>
    </section>`;
  const inp = _container.querySelector('#ob-code-input');
  inp.focus();
  inp.addEventListener('input', () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptJoin(); });
  _container.querySelector('#ob-back-join').addEventListener('click', drawOnlineChooser);
  _container.querySelector('#ob-connect').addEventListener('click', attemptJoin);
}

async function attemptJoin() {
  if (!isAlive()) return;
  const code = _container.querySelector('#ob-code-input')?.value.trim().toUpperCase();
  const errEl = _container.querySelector('#ob-join-err');
  if (!code || code.length !== 6) { if (errEl) errEl.textContent = '❌ Enter the full 6-character code.'; return; }

  const btn = _container.querySelector('#ob-connect');
  if (btn) { btn.disabled = true; btn.textContent = 'Connecting…'; }
  if (errEl) errEl.textContent = '';

  // Peek at the room first (via a one-shot listen to check existence + status)
  let resolved = false;
  const unsub = listenRoom(code, async (room) => {
    if (resolved) return;
    resolved = true;
    unsub();

    if (!room) { if (errEl && isAlive()) errEl.textContent = '❌ Room not found. Check the code.'; if (btn) { btn.disabled = false; btn.textContent = '▶️ Connect'; } return; }
    if (room.status !== 'waiting') { if (errEl && isAlive()) errEl.textContent = '❌ That room is already ' + room.status + '.'; if (btn) { btn.disabled = false; btn.textContent = '▶️ Connect'; } return; }

    _roomCode = code;
    const mySnap = exportMySnapshot(_gameState);
    try {
      await joinRoom({ code, guestUid: _onlineUid || 'anon', guestName: _onlineDisplayName, guestSnapshot: mySnap });
    } catch (err) {
      if (!isAlive()) return;
      if (errEl) errEl.textContent = '❌ Failed to join: ' + (err?.message || String(err));
      if (btn) { btn.disabled = false; btn.textContent = '▶️ Connect'; }
      return;
    }

    // Start listening for updates
    _unsubRoom = listenRoom(_roomCode, (r) => {
      _currentRoom = r;
      if (r.status === 'active' && !_onlineBattle && r.hostSnapshot && r.guestSnapshot) {
        _startOnlineBattle(r);
      } else if (_onlineBattle) {
        _handleRoomUpdate(r);
      } else if (r.status === 'ended') {
        _handleRoomUpdate(r);
      }
    });
  });

  // If Firestore doesn't respond in 6 s, surface a useful error
  setTimeout(() => {
    if (!resolved) {
      resolved = true;
      unsub();
      if (isAlive() && errEl) errEl.textContent = '❌ Timed out. Check your connection.';
      if (btn) { btn.disabled = false; btn.textContent = '▶️ Connect'; }
    }
  }, 6000);
}

// ── Battle start ─────────────────────────────────────────────
function _startOnlineBattle(room) {
  if (!isAlive()) return;
  // Host is always 'player', guest is always 'opponent' in the engine.
  _onlineBattle = createBattle({
    player:   room.hostSnapshot,
    opponent: room.guestSnapshot,
    seed:     room.seed,
  });
  _localRound = room.round;  // should be 0
  _submittedThisRound = false;
  sfx.battleStart?.();

  // Show VS splash for 1.6 s then cut to the battle
  const mySnap  = _isHostOnline ? room.hostSnapshot : room.guestSnapshot;
  const foeSnap = _isHostOnline ? room.guestSnapshot : room.hostSnapshot;
  _container.innerHTML = `
    <section class="tab-pane pairing-pane ob-vs-splash">
      <div class="ob-vs-me">
        <div class="battler__sprite" id="vs-me-sprite"></div>
        <div class="ob-vs-name">${mySnap.name}</div>
        <div class="dim small">Lv.${mySnap.level}</div>
      </div>
      <div class="ob-vs-badge">⚔️</div>
      <div class="ob-vs-foe">
        <div class="battler__sprite" id="vs-foe-sprite" style="filter:hue-rotate(${foeSnap.hueShift||0}deg)"></div>
        <div class="ob-vs-name">${foeSnap.name}</div>
        <div class="dim small">Lv.${foeSnap.level}</div>
      </div>
    </section>`;
  renderSprite(_container.querySelector('#vs-me-sprite'),  mySnap.sprite,  5);
  renderSprite(_container.querySelector('#vs-foe-sprite'), foeSnap.sprite, 5);
  setTimeout(() => { if (isAlive() && _onlineBattle) drawOnlineBattleScreen(); }, 1600);
}

// ── Firestore update handler ─────────────────────────────────
function _handleRoomUpdate(room) {
  if (!_onlineBattle || !isAlive()) return;

  // Both actions arrived for the round we're waiting on → resolve locally
  if (
    room.round === _localRound &&
    room.hostAction != null &&
    room.guestAction != null
  ) {
    const result = submitRound(_onlineBattle, room.hostAction, room.guestAction);
    _onlineBattle = result.state;
    _submittedThisRound = false;
    _localRound += 1;

    // Host advances the counter in Firestore (clears actions, bumps round)
    if (_isHostOnline) {
      advanceRound({ code: _roomCode, nextRound: _localRound }).catch(() => {});
    }

    if (_onlineBattle.winner) {
      const firestoreWinner = _onlineBattle.winner === 'player' ? 'host' : 'guest';
      if (_isHostOnline) endRoom({ code: _roomCode, winner: firestoreWinner }).catch(() => {});
      drawOnlineEndScreen();
      return;
    }

    drawOnlineBattleScreen();
    return;
  }

  // Room ended externally (opponent forfeited or disconnected)
  if (room.status === 'ended' && !_onlineBattle.winner) {
    _onlineBattle = { ..._onlineBattle, winner: _isHostOnline ? 'player' : 'opponent' };
    drawOnlineEndScreen();
    return;
  }

  // Just emotes arriving — refresh to show them without disrupting moves UI
  if (_onlineBattle && !_onlineBattle.winner) {
    _refreshEmotes(room);
  }
}

// ── Battle draw ───────────────────────────────────────────────
function drawOnlineBattleScreen() {
  if (!isAlive() || !_onlineBattle) return;
  const b = _onlineBattle;
  // From this client's perspective: "me" = host → player, guest → opponent
  const me  = _isHostOnline ? b.player   : b.opponent;
  const foe = _isHostOnline ? b.opponent : b.player;
  const room = _currentRoom || {};
  const myEmote  = _isHostOnline ? room.hostEmote : room.guestEmote;
  const foeEmote = _isHostOnline ? room.guestEmote : room.hostEmote;

  _container.innerHTML = `
    <section class="tab-pane battle-arena ${b.env?.bgClass || ''}">
      ${b.env ? `<div class="env-banner"><span>${b.env.emoji} ${b.env.name}</span><span class="dim small">🌐 Online</span></div>` : ''}

      <div class="battler battler--opponent" style="position:relative">
        <div class="battler__head">
          <span class="battler__name">${foe.name}${foe.trait ? ` <span class="trait-chip">${getTrait(foe.trait)?.emoji||''} ${getTrait(foe.trait)?.name||''}</span>` : ''}</span>
          <span class="battler__lv">Lv.${foe.level}</span>
        </div>
        <div class="battler__hp"><div class="battler__hp-fill" style="width:${Math.max(0,(foe.hp/foe.hpMax)*100)}%;background:${foe.color}"></div></div>
        <div class="battler__hpnum">${foe.hp} / ${foe.hpMax}</div>
        <div class="battler__sprite" id="ob-opp" style="filter:hue-rotate(${foe.hueShift||0}deg)"></div>
        ${foeEmote ? `<div class="online-emote online-emote--foe">${foeEmote}</div>` : ''}
      </div>

      <div class="battle-log card" id="ob-log">
        ${(b.log||[]).slice(-5).map(l=>`<div class="battle-log__line">${l}</div>`).join('')}
      </div>

      <div class="battler battler--player" style="position:relative">
        <div class="battler__head">
          <span class="battler__name">${me.name}${me.trait ? ` <span class="trait-chip">${getTrait(me.trait)?.emoji||''} ${getTrait(me.trait)?.name||''}</span>` : ''}</span>
          <span class="battler__lv">Lv.${me.level}</span>
        </div>
        <div class="battler__hp"><div class="battler__hp-fill" style="width:${Math.max(0,(me.hp/me.hpMax)*100)}%;background:${me.color}"></div></div>
        <div class="battler__hpnum">${me.hp} / ${me.hpMax}</div>
        <div class="battler__sprite" id="ob-me"></div>
        ${myEmote ? `<div class="online-emote online-emote--me">${myEmote}</div>` : ''}
      </div>

      ${_submittedThisRound ? `
        <div class="card" style="text-align:center;padding:0.8rem">
          <div class="dim small">⏳ Waiting for opponent to pick…</div>
        </div>
      ` : `
        <div class="battle-actions">
          <div class="moves-grid">
            ${(me.moves||[]).slice(0,4).map(m=>`
              <button class="move-btn" data-ob-move="${m.id}">
                <span class="move-btn__emoji">${m.emoji??'⚔️'}</span>
                <span class="move-btn__name">${m.name}</span>
                <span class="move-btn__pwr">${m.power>0?'PWR '+m.power:'STAT'}</span>
              </button>`).join('')}
          </div>
          <div class="battle-secondary">
            <div class="emote-bar" id="ob-emote-bar">
              ${EMOTES.map(e=>`<button class="emote-btn" data-emote="${e}" title="Send emote">${e}</button>`).join('')}
            </div>
            <button class="btn-juicy compact danger" id="ob-forfeit">🏃 Forfeit</button>
          </div>
        </div>
      `}
    </section>`;

  renderSprite(_container.querySelector('#ob-opp'), foe.sprite, 6);
  renderSprite(_container.querySelector('#ob-me'),  me.sprite,  6);

  // Scroll log to bottom
  const logEl = _container.querySelector('#ob-log');
  if (logEl) logEl.scrollTop = logEl.scrollHeight;

  if (!_submittedThisRound) {
    _container.querySelectorAll('[data-ob-move]').forEach(btn => {
      btn.addEventListener('click', () => _pickOnlineMove({ kind: 'move', moveId: btn.dataset.obMove }));
    });
    _container.querySelectorAll('[data-emote]').forEach(btn => {
      btn.addEventListener('click', () => {
        sendEmote({ code: _roomCode, role: _isHostOnline ? 'host' : 'guest', emote: btn.dataset.emote });
        sfx.tap?.();
      });
    });
    _container.querySelector('#ob-forfeit')?.addEventListener('click', () => _forfeit());
  }
}

function _refreshEmotes(room) {
  if (!isAlive()) return;
  const myEmote  = _isHostOnline ? room.hostEmote : room.guestEmote;
  const foeEmote = _isHostOnline ? room.guestEmote : room.hostEmote;

  // Swap emote overlays without re-rendering the whole screen
  const foeSlot = _container.querySelector('.online-emote--foe');
  const meSlot  = _container.querySelector('.online-emote--me');
  const foeParent = _container.querySelector('.battler--opponent');
  const meParent  = _container.querySelector('.battler--player');

  function setEmote(parent, slot, emote) {
    if (!parent) return;
    if (emote) {
      if (slot) { slot.textContent = emote; }
      else {
        const el = document.createElement('div');
        el.className = parent.classList.contains('battler--opponent') ? 'online-emote online-emote--foe' : 'online-emote online-emote--me';
        el.textContent = emote;
        parent.appendChild(el);
      }
    } else if (slot) {
      slot.remove();
    }
  }
  setEmote(foeParent, foeSlot, foeEmote);
  setEmote(meParent,  meSlot,  myEmote);
}

async function _pickOnlineMove(action) {
  if (_submittedThisRound || !isAlive()) return;
  _submittedThisRound = true;
  sfx.tap?.();
  // Optimistically re-render to show "Waiting…"
  drawOnlineBattleScreen();
  try {
    await submitAction({ code: _roomCode, role: _isHostOnline ? 'host' : 'guest', action });
  } catch (err) {
    // Submission failed — roll back and let them retry
    _submittedThisRound = false;
    if (isAlive()) drawOnlineBattleScreen();
  }
}

async function _forfeit() {
  if (!isAlive()) return;
  _unsubRoom?.(); _unsubRoom = null;
  const winner = _isHostOnline ? 'guest' : 'host';
  await endRoom({ code: _roomCode, winner }).catch(() => {});
  _onlineBattle = { ..._onlineBattle, winner: _isHostOnline ? 'opponent' : 'player' };
  drawOnlineEndScreen();
}

// ── End screen ────────────────────────────────────────────────
function drawOnlineEndScreen() {
  if (!isAlive()) return;
  _unsubRoom?.(); _unsubRoom = null;

  const b = _onlineBattle;
  const myWin = _isHostOnline
    ? b?.winner === 'player'
    : b?.winner === 'opponent';

  myWin ? sfx.victory() : sfx.defeat();

  const me  = _isHostOnline ? b?.player   : b?.opponent;
  const foe = _isHostOnline ? b?.opponent : b?.player;

  _container.innerHTML = `
    <section class="tab-pane pairing-pane">
      <div class="card">
        <div class="card-title" style="font-size:1.6rem">${myWin ? '🏆 You Won!' : '💀 You Lost'}</div>
        ${me && foe ? `
          <div style="display:flex;gap:1rem;align-items:center;justify-content:center;margin:0.5rem 0">
            <div style="text-align:center">
              <div class="battler__sprite" id="ob-end-me" style="margin:0 auto"></div>
              <div class="dim small">${me.name}</div>
              <div style="font-weight:700;color:${myWin?'var(--gv-accent,#4ade80)':'#f87171'}">${me.hp}/${me.hpMax} HP</div>
            </div>
            <div style="font-size:1.4rem;opacity:0.5">⚔️</div>
            <div style="text-align:center">
              <div class="battler__sprite" id="ob-end-foe" style="margin:0 auto;filter:hue-rotate(${foe.hueShift||0}deg)"></div>
              <div class="dim small">${foe.name}</div>
              <div style="font-weight:700;color:${!myWin?'var(--gv-accent,#4ade80)':'#f87171'}">${foe.hp}/${foe.hpMax} HP</div>
            </div>
          </div>` : ''}
        <div class="dim small">Online match — friendly only, no XP or Buds risked.</div>
        <div style="display:flex;gap:0.6rem;margin-top:0.8rem">
          <button class="btn-juicy big" id="ob-play-again" style="flex:1">🔄 Play Again</button>
          <button class="btn-juicy compact" id="ob-done" style="flex:0 0 auto">✅ Done</button>
        </div>
      </div>
    </section>`;

  if (me)  renderSprite(_container.querySelector('#ob-end-me'),  me.sprite,  5);
  if (foe) renderSprite(_container.querySelector('#ob-end-foe'), foe.sprite, 5);

  _container.querySelector('#ob-play-again').addEventListener('click', () => {
    _cleanupOnline();
    drawOnlineChooser();
  });
  _container.querySelector('#ob-done').addEventListener('click', () => {
    _cleanupOnline();
    _onExit();
  });
}
