import { sfx } from '../sfx.js';

export function renderVersusTab(ctx) {
  return `
    <section class="tab-pane versus-tab">
      <div class="card">
        <div class="card-title">Versus Mode 🆚</div>
        <div class="dim small">Battle another Cannabud. Local hot-seat works today; Bluetooth nearby-pairing arrives in a follow-up build.</div>
      </div>

      <div class="card">
        <div class="card-title">Quick Match — Local Hot-Seat</div>
        <div class="dim small">Both players take turns picking moves on this device. Best for sharing a smoke session.</div>
        <button class="btn-juicy big" id="btn-versus-local">🤝 Start Hot-Seat Battle</button>
      </div>

      ${(() => {
        // Bluetooth host advertising isn't wired yet on any platform we ship.
        // Disable the button until we wire the platform-specific peripheral
        // plugin. Tooltip + label make it clear this is coming soon.
        return `
          <div class="card">
            <div class="card-title">Bluetooth Nearby <span class="dim small">soon</span></div>
            <div class="dim small">Auto-discover another Cannabud nearby and pair instantly. Coming in a follow-up build — needs a peripheral-mode plugin to advertise.</div>
            <button class="btn-juicy big" id="btn-versus-ble" disabled title="Bluetooth host pairing isn't wired up yet">📡 Find Nearby (soon)</button>
          </div>`;
      })()}

      <div class="card">
        <div class="card-title">QR Code Battle</div>
        <div class="dim small">No Bluetooth needed. Host shows a QR + short code, guest scans/types it; both phones run the same deterministic battle locally.</div>
        <button class="btn-juicy big" id="btn-versus-qr">📷 QR Battle</button>
      </div>

      <div class="card">
        <div class="card-title">🌐 Online Battle</div>
        <div class="dim small">Real-time versus over the internet. Host creates a 6-char room code; Guest types it in. Both pick moves simultaneously.</div>
        <button class="btn-juicy big" id="btn-versus-online">⚡ Online Battle</button>
      </div>

      <div class="card">
        <div class="card-title">🏆 Async Battle League</div>
        <div class="dim small">Publish your Cannabud to a global leaderboard. Pull challengers any time and fight their snapshots — no friend has to be online.</div>
        <button class="btn-juicy big" id="btn-versus-league">📡 Open League</button>
      </div>
    </section>
  `;
}

export function wireVersusTab(body, ctx) {
  // Guard: marks a versus session active so refreshActiveTab / switchTab
  // won't overwrite the container while a live session is running.
  function enterVersus(tabBody) {
    ctx.setVersusSession(true);
    // Immediately show a loading placeholder so the tab body isn't blank
    // during the async import(). This also prevents a split-second where
    // another call to refreshActiveTab could wipe the tab before the module
    // mounts its own HTML.
    tabBody.innerHTML = `
      <section class="tab-pane pairing-pane" style="display:flex;align-items:center;justify-content:center;min-height:200px">
        <div class="dim small">⏳ Loading versus screen…</div>
      </section>`;
  }
  function exitVersus() {
    ctx.setVersusSession(null);
    ctx.onSwitchTab('versus'); // ensure we land back on the versus tab menu
    // Re-render the versus tab menu cleanly
    const b = ctx.container?.querySelector('#game-tab-body');
    if (b) {
      ctx.container.querySelectorAll('.game-tab').forEach(btn => {
        btn.classList.toggle('game-tab--active', btn.dataset.tab === 'versus');
      });
      b.innerHTML = renderVersusTab(ctx);
      wireVersusTab(b, ctx);
    }
    ctx.onTopbar();
  }

  const tabBody = ctx.container.querySelector('#game-tab-body');

  // Show a visible error card when a versus mode can't load, rather than
  // silently snapping back to the menu with no explanation.
  // NOTE: versusSession stays truthy until the user clicks Back so the
  // idle tick doesn't wipe the error card before they can read it.
  function versusLoadFailed(label, err) {
    console.error(`[Versus] ${label} error:`, err);
    // Do NOT clear versusSession here — keep it truthy so the idle tick
    // can't overwrite the error card with the versus menu before the user
    // has a chance to read it. We clear it only when they click Back.
    ctx.onSwitchTab('versus');
    const b = ctx.container?.querySelector('#game-tab-body');
    if (!b) { ctx.setVersusSession(null); ctx.onTopbar(); return; }
    // Keep the Versus tab button highlighted while showing the error
    ctx.container.querySelectorAll('.game-tab').forEach(btn =>
      btn.classList.toggle('game-tab--active', btn.dataset.tab === 'versus'));
    b.innerHTML = `
      <section class="tab-pane pairing-pane">
        <div class="card">
          <div class="card-title">⚠️ Couldn't Start</div>
          <div class="dim small">${label} failed to load.</div>
          <div class="dim small" style="color:#f87171;font-size:0.6rem;word-break:break-all;margin-top:0.3rem">${err instanceof Error ? (err.message || err.toString()) : (err != null ? String(err) : 'Unknown error')}</div>
          <button class="btn-juicy compact" id="vs-err-back" style="margin-top:0.8rem">← Back</button>
        </div>
      </section>`;
    ctx.onTopbar();
    // Clear versusSession HERE, when the user explicitly dismisses the error.
    b.querySelector('#vs-err-back')?.addEventListener('click', () => {
      ctx.setVersusSession(null);
      b.innerHTML = renderVersusTab(ctx);
      wireVersusTab(b, ctx);
    });
  }

  body.querySelector('#btn-versus-local')?.addEventListener('click', () => {
    enterVersus(tabBody);
    import('../versusScreen.js').then(mod => {
      if (!ctx.getVersusSession()) return; // user exited before module loaded
      mod.mountLocalDuel({
        container: tabBody,
        gameState: ctx.gameState,
        onExit: exitVersus,
      });
    }).catch(err => versusLoadFailed('Hot-seat battle', err));
  });
  body.querySelector('#btn-versus-ble')?.addEventListener('click', () => {
    enterVersus(tabBody);
    import('../versusPairing.js').then(mod => {
      if (!ctx.getVersusSession()) return;
      return mod.mountBlePairing({      // return Promise so async errors reach .catch
        container: tabBody,
        gameState: ctx.gameState,
        onExit: exitVersus,
      });
    }).catch(err => versusLoadFailed('Bluetooth pairing', err));
  });
  body.querySelector('#btn-versus-qr')?.addEventListener('click', () => {
    enterVersus(tabBody);
    import('../versusPairing.js').then(mod => {
      if (!ctx.getVersusSession()) return;
      return mod.mountQrPairing({       // return Promise so async errors reach .catch
        container: tabBody,
        gameState: ctx.gameState,
        onExit: exitVersus,
      });
    }).catch(err => versusLoadFailed('QR pairing', err));
  });
  body.querySelector('#btn-versus-online')?.addEventListener('click', () => {
    enterVersus(tabBody);
    import('../versusPairing.js').then(mod => {
      if (!ctx.getVersusSession()) return;
      return mod.mountOnlineBattle({
        container: tabBody,
        gameState: ctx.gameState,
        uid: ctx.uid,
        displayName: ctx.gameState?.monsterName || 'Trainer',
        onExit: exitVersus,
      });
    }).catch(err => versusLoadFailed('Online Battle', err));
  });
  body.querySelector('#btn-versus-league')?.addEventListener('click', () => {
    enterVersus(tabBody);
    import('../leagueScreen.js').then(mod => {
      if (!ctx.getVersusSession()) return;
      return mod.mountLeague({          // return Promise so async errors reach .catch
        container: tabBody,
        gameState: ctx.gameState,
        uid: ctx.uid,
        onExit: exitVersus,
      });
    }).catch(err => versusLoadFailed('Battle League', err));
  });
}
