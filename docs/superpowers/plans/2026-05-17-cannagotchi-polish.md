# Cannagotchi Polish Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split gameScreen.js into per-tab files, add battle AI difficulty tiers, and expand the prestige multiplier strip.

**Architecture:** A `makeTabContext()` factory in gameScreen.js passes shared state and callbacks to each tab file via a `ctx` argument. Tab files are pure render/wire modules with no module-level globals that reference gameScreen internals. Battle AI gains a `getAITier(playerLevel)` helper gating three behavior tiers. The prestige strip replaces a single XP line with a three-multiplier display.

**Tech Stack:** Vanilla JS ES modules, Vite 8, no test runner (verify with `npm run build` + browser smoke test)

---

## Reference: Context Object Shape

Every tab file's `render` and `wire` functions accept a single `ctx` argument built by this factory (added to `gameScreen.js` in Task 1):

```js
function makeTabContext() {
  return {
    gameState:        _gameState,       // mutable object — mutations persist
    uid:              _uid,
    container:        _container,
    onSave:           debouncedSave,
    onRefresh:        (animate) => refreshActiveTab(animate),
    onTopbar:         syncTopbar,
    onShell:          renderShell,
    onSwitchTab:      switchTab,
    toast,
    formatN,
    getTapReactor:    () => _tapReactor,
    setTapReactor:    (r) => { _tapReactor = r; },
    getVersusSession: () => _versusSession,
    setVersusSession: (v) => { _versusSession = v; },
    getBattleSession: () => _battleSession,
    setBattleSession: (s) => { _battleSession = s; },
    getShopSection:   () => _shopSection,
    setShopSection:   (s) => { _shopSection = s; },
    buyUpgrade,
  };
}
```

## Reference: Substitution Table

When moving a function from gameScreen.js to a tab file, replace every reference in its body using this table:

| gameScreen.js (before) | tab file (after) |
|---|---|
| `_gameState` | `ctx.gameState` |
| `_uid` | `ctx.uid` |
| `_container` | `ctx.container` |
| `debouncedSave()` | `ctx.onSave()` |
| `refreshActiveTab(x)` | `ctx.onRefresh(x)` |
| `syncTopbar()` | `ctx.onTopbar()` |
| `renderShell()` | `ctx.onShell()` |
| `switchTab(x)` | `ctx.onSwitchTab(x)` |
| `toast(...)` | `ctx.toast(...)` |
| `formatN(x)` | `ctx.formatN(x)` |
| `buyUpgrade(x)` | `ctx.buyUpgrade(x)` |
| `_tapReactor` (read) | `ctx.getTapReactor()` |
| `_tapReactor = r` | `ctx.setTapReactor(r)` |
| `_battleSession` (read) | `ctx.getBattleSession()` |
| `_battleSession = s` | `ctx.setBattleSession(s)` |
| `_versusSession` (read) | `ctx.getVersusSession()` |
| `_versusSession = v` | `ctx.setVersusSession(v)` |
| `_shopSection` (read) | `ctx.getShopSection()` |
| `_shopSection = s` | `ctx.setShopSection(s)` |

---

## Task 1: Context factory + tab import wiring in gameScreen.js

**Files:**
- Modify: `src/game/gameScreen.js`

This task makes zero behavior changes. It adds the plumbing that Tasks 2–6 depend on. The tab files don't exist yet — build will fail after this task until all stubs are created in Task 2-6. To avoid that, create empty stub files now.

- [ ] **Step 1: Add `_shopSection` module-level variable if absent**

Find line 1147 in `src/game/gameScreen.js`. If `let _shopSection` is not already declared near the other module-level `let` declarations (lines 88–100), add it immediately after `let _versusSession = null;`:

```js
let _shopSection = 'care'; // 'care' | 'cosmetics' | 'themes'
```

- [ ] **Step 2: Add tab imports at the top of gameScreen.js**

After the last existing `import` statement in `src/game/gameScreen.js`, add:

```js
// ── Tab modules ──────────────────────────────────────────────
import { renderGardenTab, wireGardenTab } from './tabs/tabGarden.js';
import { renderBattleTab, wireBattleTab } from './tabs/tabBattle.js';
import { renderShopTab,   wireShopTab   } from './tabs/tabShop.js';
import { renderQuestsTab, wireQuestsTab } from './tabs/tabQuests.js';
import { renderVersusTab, wireVersusTab } from './tabs/tabVersus.js';
```

- [ ] **Step 3: Add `makeTabContext()` to gameScreen.js**

Add this function immediately before `refreshActiveTab()` (around line 498):

```js
function makeTabContext() {
  return {
    gameState:        _gameState,
    uid:              _uid,
    container:        _container,
    onSave:           debouncedSave,
    onRefresh:        (animate) => refreshActiveTab(animate),
    onTopbar:         syncTopbar,
    onShell:          renderShell,
    onSwitchTab:      switchTab,
    toast,
    formatN,
    getTapReactor:    () => _tapReactor,
    setTapReactor:    (r) => { _tapReactor = r; },
    getVersusSession: () => _versusSession,
    setVersusSession: (v) => { _versusSession = v; },
    getBattleSession: () => _battleSession,
    setBattleSession: (s) => { _battleSession = s; },
    getShopSection:   () => _shopSection,
    setShopSection:   (s) => { _shopSection = s; },
    buyUpgrade,
  };
}
```

- [ ] **Step 4: Update `refreshActiveTab()` to pass ctx**

Replace the current `refreshActiveTab` body's switch block (the 5 `case` lines) with:

```js
  const ctx = makeTabContext();
  switch (_activeTab) {
    case 'garden': body.innerHTML = renderGardenTab(ctx); wireGardenTab(body, ctx); break;
    case 'battle': body.innerHTML = renderBattleTab(ctx); wireBattleTab(body, ctx); break;
    case 'shop':   body.innerHTML = renderShopTab(ctx);   wireShopTab(body, ctx);   break;
    case 'quests': body.innerHTML = renderQuestsTab(ctx); wireQuestsTab(body, ctx); break;
    case 'versus': body.innerHTML = renderVersusTab(ctx); wireVersusTab(body, ctx); break;
  }
```

The full updated `refreshActiveTab` should look like:

```js
function refreshActiveTab(animate = false) {
  if (!_container) return;
  if (_versusSession) { syncTopbar(); return; }
  const body = _container.querySelector('#game-tab-body');
  if (!body) return;
  if (_tapReactor) { _tapReactor.destroy(); _tapReactor = null; }
  if (animate) body.classList.remove('fade-in'), void body.offsetWidth, body.classList.add('fade-in');
  const ctx = makeTabContext();
  switch (_activeTab) {
    case 'garden': body.innerHTML = renderGardenTab(ctx); wireGardenTab(body, ctx); break;
    case 'battle': body.innerHTML = renderBattleTab(ctx); wireBattleTab(body, ctx); break;
    case 'shop':   body.innerHTML = renderShopTab(ctx);   wireShopTab(body, ctx);   break;
    case 'quests': body.innerHTML = renderQuestsTab(ctx); wireQuestsTab(body, ctx); break;
    case 'versus': body.innerHTML = renderVersusTab(ctx); wireVersusTab(body, ctx); break;
  }
  syncTopbar();
}
```

- [ ] **Step 5: Create stub tab files so the build resolves**

Create the directory `src/game/tabs/` and create all five stub files. Each stub just re-exports the real function from gameScreen.js's existing body — but since gameScreen.js still has those functions, the stubs are temporary bridges. Use this pattern:

Create `src/game/tabs/tabGarden.js`:
```js
// Temporary stub — will be filled in Task 2
export function renderGardenTab(ctx) { return ''; }
export function wireGardenTab(body, ctx) {}
```

Create `src/game/tabs/tabBattle.js`:
```js
// Temporary stub — will be filled in Task 3
export function renderBattleTab(ctx) { return ''; }
export function wireBattleTab(body, ctx) {}
```

Create `src/game/tabs/tabShop.js`:
```js
// Temporary stub — will be filled in Task 4
export function renderShopTab(ctx) { return ''; }
export function wireShopTab(body, ctx) {}
```

Create `src/game/tabs/tabQuests.js`:
```js
// Temporary stub — will be filled in Task 5
export function renderQuestsTab(ctx) { return ''; }
export function wireQuestsTab(body, ctx) {}
```

Create `src/game/tabs/tabVersus.js`:
```js
// Temporary stub — will be filled in Task 6
export function renderVersusTab(ctx) { return ''; }
export function wireVersusTab(body, ctx) {}
```

- [ ] **Step 6: Build**

```
npm run build
```

Expected: build succeeds (stubs satisfy imports; existing inline functions are still present and unused — that's fine for now).

- [ ] **Step 7: Commit**

```
git add src/game/gameScreen.js src/game/tabs/
git commit -m "refactor: add tab context factory and stub tab files"
```

---

## Task 2: Extract tabGarden.js

**Files:**
- Create: `src/game/tabs/tabGarden.js`
- Modify: `src/game/gameScreen.js` (delete moved code)

The garden tab is the most complex. It owns: the viewport, needs bars, care actions, plot picker, garden upgrades, inventory, prestige strip, mini-game toggle, and the companion tap reactor.

**Functions/state moving OUT of gameScreen.js → tabGarden.js:**

| Symbol | Current lines in gameScreen.js |
|---|---|
| `MINIGAME_PREF_KEY` constant | ~line 68 |
| `miniGamesEnabled()` | ~line 70 |
| `setMiniGamesEnabled()` | ~line 71 |
| `_cd` object | ~line 101 |
| `_streakCount` | ~line 102 |
| `_streakTimer` | ~line 103 |
| `combinedStatMult()` | lines 405–409 |
| `renderPlotPicker()` | lines 931–967 |
| `statBar()` | lines 2026–2034 |
| `idleAnimFor()` | lines 2036–2042 |
| `shakeButton()` | lines 2062–2065 |
| `applyCareResolution()` | search in file — called by doCare |
| `doCare()` | lines 867–884 |
| `handlePlotSwitch()` | lines 759–773 |
| `handlePlotPlant()` | lines 836–865 |
| `handlePlotUnlock()` | lines 820–834 |
| `useItemFromInventory()` | lines 1034–1043 |
| `renderGardenTab()` | lines 537–689 |
| `wireGardenTab()` | lines 691–757 |

- [ ] **Step 1: Write the complete tabGarden.js**

Replace the stub content of `src/game/tabs/tabGarden.js` with:

```js
import { getMonsterType } from '../monsters.js';
import { getLevel, getStats, getCurrentEvolution } from '../gameEngine.js';
import { renderSprite, renderHat } from '../pixelArt.js';
import { NEEDS, PACING } from '../economyConfig.js';
import { moodSummary, mostNeedy, NEED_META, NEED_KEYS } from '../needs.js';
import {
  ITEMS, GARDEN_UPGRADES, getEquippedTier,
  consumeItem, addItem,
} from '../inventory.js';
import { reportQuestProgress } from '../quests.js';
import { describeTrait } from '../traits.js';
import { getEquipped } from '../cosmetics.js';
import { getVariant } from '../monsters.js';
import {
  PLOT_IDS, PLOT_LABELS,
  getActivePlotId, switchToPlot, unlockNextPlot, plantBudInEmptyPlot,
  readPlotMeta,
} from '../plots.js';
import { getPrestigeMultipliers } from '../prestige.js';
import { combinedPaletteRemap, getPath } from '../evolutionPaths.js';
import { checkAchievements } from '../achievements.js';
import { refreshLevelCache } from '../../services/gameService.js';
import { sfx } from '../sfx.js';
import { runMiniGame, RESULT_MULTIPLIERS } from '../miniGames.js';
import { track } from '@vercel/analytics';
import { createTapReactor } from '../companion.js';

// ── Mini-game preference (garden-local state) ─────────────────
const MINIGAME_PREF_KEY = 'cpfm_cg_minigames_enabled';
function miniGamesEnabled() {
  const v = localStorage.getItem(MINIGAME_PREF_KEY);
  return v === null ? true : v === 'true';
}
function setMiniGamesEnabled(on) { localStorage.setItem(MINIGAME_PREF_KEY, String(!!on)); }

// ── Care cooldowns (persist across re-renders within a session) ─
const _cd = { feed: 0, water: 0, clean: 0, pet: 0 };

// ── Helpers ───────────────────────────────────────────────────
function statBar(label, value, color) {
  const pct = Math.min(100, (value / 200) * 100);
  return `
    <div class="game-stat-row">
      <span class="game-stat-row__label">${label}</span>
      <div class="game-stat-row__bar"><div class="game-stat-row__fill" style="width:${pct}%;background:${color}"></div></div>
      <span class="game-stat-row__val">${value}</span>
    </div>`;
}

function idleAnimFor(spriteName) {
  if (spriteName.includes('ancient')) return 'game-anim--ancient';
  if (spriteName.includes('bloom'))   return 'game-anim--bloom';
  if (spriteName.includes('sapling')) return 'game-anim--sapling';
  if (spriteName.includes('sprout'))  return 'game-anim--sprout';
  return 'game-anim--seed';
}

function shakeButton(btn) {
  btn.classList.add('game-btn-shake');
  setTimeout(() => btn.classList.remove('game-btn-shake'), 400);
}

function combinedStatMult(ctx) {
  const m = moodSummary(ctx.gameState.needs);
  const p = getPrestigeMultipliers(ctx.gameState);
  return m.statMult * p.statMult;
}

function renderPlotPicker(ctx) {
  const active = getActivePlotId(ctx.gameState);
  return `
    <div class="plot-picker">
      ${PLOT_IDS.map(pid => {
        const meta = readPlotMeta(ctx.gameState, pid);
        const isActive = pid === active;
        if (meta.state === 'locked') {
          return `
            <button class="plot-slot plot-slot--locked" data-plot="${pid}" data-action="unlock">
              <div class="plot-slot__head">${PLOT_LABELS[pid]}</div>
              <div class="plot-slot__body">🔒 Unlock</div>
              <div class="plot-slot__cost">🌱 ${meta.cost}</div>
            </button>`;
        }
        if (meta.state === 'empty') {
          return `
            <button class="plot-slot plot-slot--empty" data-plot="${pid}" data-action="plant">
              <div class="plot-slot__head">${PLOT_LABELS[pid]}</div>
              <div class="plot-slot__body">＋ Plant</div>
              <div class="plot-slot__cost dim small">a Cannabud</div>
            </button>`;
        }
        const variant = getVariant(meta.type, meta.variant);
        const monType = getMonsterType(meta.type);
        const lvl = getLevel(meta.xp);
        return `
          <button class="plot-slot ${isActive ? 'plot-slot--active' : ''}" data-plot="${pid}" data-action="switch">
            <div class="plot-slot__head">${PLOT_LABELS[pid]}${isActive ? ' ✓' : ''}</div>
            <div class="plot-slot__bud" style="color:${variant?.color || monType.color}">${monType.emoji} ${meta.name}</div>
            <div class="plot-slot__cost dim small">Lv. ${lvl}</div>
          </button>`;
      }).join('')}
    </div>
  `;
}

// ── Care actions ──────────────────────────────────────────────

function applyCareResolution(kind, mult, result, ctx) {
  // NOTE: this function body must be copied verbatim from gameScreen.js
  // (search for "function applyCareResolution" — it is called by doCare).
  // After copying, apply the substitution table: replace _gameState with
  // ctx.gameState, debouncedSave() with ctx.onSave(), etc.
  // Pass ctx through to every sub-call that needs it.
}

function doCare(e, kind, ctx) {
  const now = Date.now();
  if (now - _cd[kind] < PACING.ACTION_COOLDOWN_MS) {
    sfx.error(); shakeButton(e.currentTarget); return;
  }
  _cd[kind] = now;
  if (!ctx.gameState.lifetime) ctx.gameState.lifetime = {};
  ctx.gameState.lifetime.totalActions = (ctx.gameState.lifetime.totalActions || 0) + 1;

  if (miniGamesEnabled()) {
    runMiniGame(kind, ctx.container).then(result => {
      const mult = RESULT_MULTIPLIERS[result] ?? 1;
      applyCareResolution(kind, mult, result, ctx);
    });
    return;
  }
  applyCareResolution(kind, 1, null, ctx);
}

function handlePlotSwitch(plotId, ctx) {
  if (plotId === getActivePlotId(ctx.gameState)) return;
  const r = switchToPlot(ctx.gameState, plotId);
  if (!r.ok) { sfx.error(); ctx.toast('Cannot switch to that plot.', 'red'); return; }
  refreshLevelCache(ctx.gameState);
  sfx.tap();
  ctx.toast(`🪴 Switched to ${PLOT_LABELS[plotId]}`, 'gold');
  ctx.onShell();
  ctx.onSwitchTab('garden');
  import('../companion.js').then(m => m.initCompanion(ctx.uid)).catch(() => {});
  ctx.onSave();
}

function handlePlotUnlock(ctx) {
  const r = unlockNextPlot(ctx.gameState);
  if (!r.ok) {
    sfx.error();
    if (r.reason === 'broke') ctx.toast(`Need ${r.cost} 🌱 Seeds`, 'red');
    else if (r.reason === 'maxed') ctx.toast('All plots already unlocked', 'red');
    return;
  }
  sfx.buy();
  try { track('plot_unlocked', { plotId: r.plotId, cost: r.cost }); } catch (_) {}
  ctx.toast(`🌱 ${PLOT_LABELS[r.plotId]} unlocked! Plant a Cannabud now.`, 'gold', 3200);
  ctx.onRefresh();
  ctx.onTopbar();
  ctx.onSave();
}

function handlePlotPlant(plotId, ctx) {
  const overlay = document.createElement('div');
  overlay.className = 'plot-plant-overlay';
  overlay.innerHTML = `
    <div class="plot-plant-card">
      <button class="plot-plant-close" id="plot-plant-close" aria-label="Cancel">✕</button>
      <div id="plot-plant-onboard"></div>
    </div>`;
  ctx.container.appendChild(overlay);
  overlay.querySelector('#plot-plant-close').addEventListener('click', () => overlay.remove());
  import('../onboardingScreen.js').then(({ renderOnboarding }) => {
    renderOnboarding(overlay.querySelector('#plot-plant-onboard'), (choice) => {
      const ok = plantBudInEmptyPlot(ctx.gameState, plotId, choice);
      if (!ok) { sfx.error(); overlay.remove(); return; }
      sfx.evolution();
      ctx.toast(`🌱 Planted ${choice.monsterName} in ${PLOT_LABELS[plotId]}!`, 'gold', 3200);
      refreshLevelCache(ctx.gameState);
      overlay.remove();
      ctx.onShell();
      ctx.onSwitchTab('garden');
      import('../companion.js').then(m => m.initCompanion(ctx.uid)).catch(() => {});
      ctx.onSave();
    });
  });
}

function useItemFromInventory(id, ctx) {
  const result = consumeItem(ctx.gameState, id);
  if (!result) { sfx.error(); return; }
  sfx.buy();
  reportQuestProgress(ctx.gameState, 'use_item', 1);
  ctx.toast(`${result.item.emoji} ${result.desc}`);
  checkAchievements(ctx.gameState);
  ctx.onRefresh(false);
  ctx.onSave();
}

// ── Render ────────────────────────────────────────────────────

export function renderGardenTab(ctx) {
  const monType     = getMonsterType(ctx.gameState.monsterType);
  const lvl         = getLevel(ctx.gameState.xp);
  const evolution   = getCurrentEvolution(monType.evolutions, lvl);
  const stats       = getStats(monType.baseStats, lvl);
  const mood        = moodSummary(ctx.gameState.needs);
  const lowest      = mostNeedy(ctx.gameState.needs);
  const prestigeMul = getPrestigeMultipliers(ctx.gameState);
  const statMult    = combinedStatMult(ctx);

  const needsHTML = NEED_KEYS.map(k => {
    const meta = NEED_META[k];
    const v = ctx.gameState.needs[k] ?? 100;
    const pct = Math.max(0, Math.min(100, v));
    const lowGlow = v < NEEDS.THRESHOLD_BAD ? ' need-row--low' : v < NEEDS.THRESHOLD_OK ? ' need-row--mid' : '';
    return `
      <div class="need-row${lowGlow}">
        <span class="need-row__icon" title="${meta.label}">${meta.emoji}</span>
        <div class="need-row__bar"><div class="need-row__fill" style="width:${pct}%;background:${meta.color}"></div></div>
        <span class="need-row__val">${Math.round(pct)}</span>
      </div>`;
  }).join('');

  const moodMultStr = mood.statMult >= 1
    ? `+${Math.round((mood.statMult-1)*100)}% stats`
    : `${Math.round((mood.statMult-1)*100)}% stats`;
  const moodXpStr = mood.xpMult >= 1
    ? `+${Math.round((mood.xpMult-1)*100)}% XP`
    : `${Math.round((mood.xpMult-1)*100)}% XP`;

  const hat   = getEquipped(ctx.gameState, 'hat');
  const frame = getEquipped(ctx.gameState, 'frame');
  const aura  = getEquipped(ctx.gameState, 'aura');
  const frameClass = frame?.cssClass || '';
  const auraClass  = aura?.cssClass  || '';
  const potTier  = getEquippedTier(ctx.gameState.garden, 'pot');
  const soilTier = getEquippedTier(ctx.gameState.garden, 'soil');

  const prestigeCount = ctx.gameState.prestige?.count || 0;
  const xpBoost   = Math.round(prestigeMul.xpMult  * 100 - 100);
  const budBoost  = Math.round(prestigeMul.budMult  * 100 - 100);
  const statBoost = Math.round(prestigeMul.statMult * 100 - 100);

  return `
    <section class="tab-pane">
      ${renderPlotPicker(ctx)}

      <div class="garden-viewport ${frameClass} ${auraClass}"
           data-pot="${potTier.id}" data-soil="${soilTier.id}"
           role="button" tabindex="0" aria-label="Pet ${ctx.gameState.monsterName}">
        <div class="garden-pot-layer"></div>
        <div class="garden-soil-layer"></div>
        <div class="game-viewport__scanlines"></div>
        <div class="aura-layer"></div>
        <div class="cg-stress" id="garden-stress">💢</div>
        <div class="cg-bubble hidden" id="garden-bubble"></div>
        <div class="game-monster" id="garden-sprite"></div>
        <div class="garden-viewport__caption">
          <span>${mood.emoji} ${mood.label}</span>
          <span class="dim">${moodMultStr} · ${moodXpStr}</span>
        </div>
      </div>

      <div class="needs-card">
        <div class="card-title">Needs</div>
        ${needsHTML}
        ${lowest.value < NEEDS.THRESHOLD_OK ? `
          <div class="needs-hint">${NEED_META[lowest.key].emoji} ${ctx.gameState.monsterName} could really use some ${NEED_META[lowest.key].label.toLowerCase()}.</div>` : ''}
      </div>

      <div class="action-row">
        <button class="btn-juicy" id="act-water">💧 Water<span class="dim small">+${NEEDS.RESTORE_TAP_WATER}</span></button>
        <button class="btn-juicy" id="act-feed">🌿 Feed<span class="dim small">+${NEEDS.RESTORE_TAP_FEED}</span></button>
        <button class="btn-juicy" id="act-clean">✨ Clean<span class="dim small">+10</span></button>
        <button class="btn-juicy" id="act-pet">🤚 Pet<span class="dim small">+6 😊</span></button>
      </div>

      <label class="minigame-toggle">
        <input type="checkbox" id="minigame-toggle" ${miniGamesEnabled() ? 'checked' : ''} />
        <span>🎮 Skill mini-games on care actions <span class="dim small">(Perfect = 1.5× restore)</span></span>
      </label>

      <button class="btn-juicy compact" id="btn-replay-tutorial" style="margin-top:0.4rem">📖 Replay tutorial</button>

      <div class="stats-card">
        <div class="card-title">Stats <span class="dim small">x${statMult.toFixed(2)}</span></div>
        ${statBar('HP',  Math.floor(stats.hp  * statMult), monType.color)}
        ${statBar('ATK', Math.floor(stats.atk * statMult), '#f87171')}
        ${statBar('DEF', Math.floor(stats.def * statMult), '#38bdf8')}
        ${statBar('SPD', Math.floor(stats.spd * statMult), '#fbbf24')}
      </div>

      ${ctx.gameState.trait ? `
        <div class="card trait-card">
          <div class="card-title">Trait</div>
          <div class="trait-line">${describeTrait(ctx.gameState.trait)}</div>
        </div>` : ''}

      <div class="garden-card">
        <div class="card-title">Garden Setup <span class="dim small">tap to upgrade</span></div>
        ${['pot','soil'].map(slot => {
          const cfg = GARDEN_UPGRADES[slot];
          const tier = getEquippedTier(ctx.gameState.garden, slot);
          const idx = cfg.tiers.findIndex(t => t.id === tier.id);
          const next = cfg.tiers[idx + 1];
          const canAfford = next ? (ctx.gameState.buds || 0) >= next.cost : false;
          const decayPct = tier.decayMult < 1 ? Math.round((1-tier.decayMult)*100) : 0;
          const xpPct    = tier.xpMult   > 1 ? Math.round((tier.xpMult-1)*100)    : 0;
          const budPct   = tier.budMult  > 1 ? Math.round((tier.budMult-1)*100)   : 0;
          return `
            <div class="garden-slot-row">
              <div class="garden-slot-row__head">
                <span class="garden-slot-row__emoji">${cfg.emoji}</span>
                <div class="garden-slot-row__info">
                  <div class="garden-slot-row__label">${cfg.label} <span class="dim small">(${idx+1}/${cfg.tiers.length})</span></div>
                  <div class="garden-slot-row__name">${tier.name}</div>
                </div>
              </div>
              <div class="garden-slot-row__bonuses">
                ${decayPct ? `<span class="bonus-pill">⏳ -${decayPct}% decay</span>` : ''}
                ${xpPct    ? `<span class="bonus-pill">⚡ +${xpPct}% XP</span>`    : ''}
                ${budPct   ? `<span class="bonus-pill">🪙 +${budPct}% Buds</span>` : ''}
              </div>
              ${next ? `
                <button class="btn-juicy compact" data-garden-upgrade="${slot}" ${canAfford ? '' : 'disabled'}>
                  → ${next.name} <span class="dim small">🪙 ${ctx.formatN(next.cost)}</span>
                </button>` : `<div class="dim small" style="text-align:center">⭐ MAX</div>`}
            </div>`;
        }).join('')}
      </div>

      ${prestigeCount > 0 ? `
        <div class="prestige-strip">
          <div class="prestige-strip__title">✦ Prestige Lv.${prestigeCount}</div>
          <div class="prestige-strip__mults dim small">+${xpBoost}% XP · +${budBoost}% Buds · +${statBoost}% Stats</div>
        </div>` : ''}

      <div class="inventory-card">
        <div class="card-title">Inventory</div>
        ${(() => {
          const owned = Object.entries(ctx.gameState.inventory || {}).filter(([_,n]) => n>0);
          if (owned.length === 0) {
            return `<div class="inventory-empty">📦 No items yet — visit the <b>Shop</b> tab to stock up.</div>`;
          }
          return `<div class="inventory-grid">
            ${owned.map(([id, n]) => {
              const it = ITEMS[id]; if (!it) return '';
              return `<button class="inv-item" data-item="${id}" title="${it.desc}">
                <span class="inv-item__emoji">${it.emoji}</span>
                <span class="inv-item__name">${it.name}</span>
                <span class="inv-item__count">×${n}</span>
              </button>`;
            }).join('')}
          </div>`;
        })()}
      </div>
    </section>
  `;
}

// ── Wire ──────────────────────────────────────────────────────

export function wireGardenTab(body, ctx) {
  const monType   = getMonsterType(ctx.gameState.monsterType);
  const lvl       = getLevel(ctx.gameState.xp);
  const evolution = getCurrentEvolution(monType.evolutions, lvl);

  const spriteEl = body.querySelector('#garden-sprite');
  const variant  = getVariant(ctx.gameState.monsterType, ctx.gameState.monsterVariant || 'classic');
  const path     = getPath(ctx.gameState.monsterType, ctx.gameState.evolutionPath);
  const remap    = combinedPaletteRemap(variant?.paletteRemap, path?.paletteOverlay);
  renderSprite(spriteEl, evolution.sprite, 7, { paletteRemap: remap });

  const hatEq = getEquipped(ctx.gameState, 'hat');
  if (hatEq && hatEq.id !== 'hat_none') {
    renderHat(spriteEl, hatEq.id, 7);
  }
  const idleAnim = idleAnimFor(evolution.sprite);
  spriteEl.className = 'game-monster ' + idleAnim;

  const viewport = body.querySelector('.garden-viewport');
  ctx.setTapReactor(createTapReactor({
    wrapper: viewport,
    sprite:  spriteEl,
    bubble:  body.querySelector('#garden-bubble'),
    stress:  body.querySelector('#garden-stress'),
    idleAnim, idleTimer: false,
  }));
  viewport.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ctx.getTapReactor()?.handleTap(); }
  });

  body.querySelector('#act-water').addEventListener('click', (e) => doCare(e, 'water', ctx));
  body.querySelector('#act-feed').addEventListener('click',  (e) => doCare(e, 'feed', ctx));
  body.querySelector('#act-clean').addEventListener('click', (e) => doCare(e, 'clean', ctx));
  body.querySelector('#act-pet').addEventListener('click',   (e) => doCare(e, 'pet', ctx));

  body.querySelectorAll('.inv-item').forEach(btn => {
    btn.addEventListener('click', () => useItemFromInventory(btn.dataset.item, ctx));
  });

  body.querySelector('#minigame-toggle')?.addEventListener('change', (e) => {
    setMiniGamesEnabled(e.target.checked);
    sfx.tap();
    ctx.toast(e.target.checked ? '🎮 Mini-games ON' : '🎮 Mini-games OFF', 'gold');
  });

  body.querySelector('#btn-replay-tutorial')?.addEventListener('click', () => {
    import('../tutorial.js').then(({ resetTutorial, startTutorial }) => {
      resetTutorial();
      sfx.tap();
      startTutorial();
    });
  });

  body.querySelectorAll('[data-garden-upgrade]').forEach(btn => {
    btn.addEventListener('click', () => ctx.buyUpgrade(btn.dataset.gardenUpgrade));
  });

  body.querySelectorAll('[data-plot]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid    = btn.dataset.plot;
      const action = btn.dataset.action;
      if (action === 'switch') handlePlotSwitch(pid, ctx);
      else if (action === 'plant') handlePlotPlant(pid, ctx);
      else if (action === 'unlock') handlePlotUnlock(ctx);
    });
  });
}
```

**Important:** `applyCareResolution` is missing from the extraction above (its body was not captured). Before writing the file, search gameScreen.js for `function applyCareResolution` and copy its complete body into `tabGarden.js`, applying the substitution table.

- [ ] **Step 2: Delete moved code from gameScreen.js**

In `src/game/gameScreen.js`, delete:
- `MINIGAME_PREF_KEY`, `miniGamesEnabled`, `setMiniGamesEnabled` (around lines 68–71)
- `_cd`, `_streakCount`, `_streakTimer` from the module-level state block
- `combinedStatMult` (lines 405–409)
- `applyCareResolution` (wherever it lives)
- `doCare` (lines 867–884)
- `renderPlotPicker` (lines 931–967)
- `handlePlotSwitch`, `handlePlotUnlock`, `handlePlotPlant` (lines 759–865)
- `useItemFromInventory` (lines 1034–1043)
- `renderGardenTab` (lines 537–689)
- `wireGardenTab` (lines 691–757)
- `statBar` (lines 2026–2034)
- `idleAnimFor` (lines 2036–2042)
- `shakeButton` (lines 2062–2065)

- [ ] **Step 3: Build**

```
npm run build
```

Expected: build succeeds with no "is not defined" or import errors.

- [ ] **Step 4: Smoke test in browser**

Run `npm run dev`, open the app, sign in, open Cannagotchi. Verify: garden tab renders, care buttons work, plot picker shows, needs bars display.

- [ ] **Step 5: Commit**

```
git add src/game/tabs/tabGarden.js src/game/gameScreen.js
git commit -m "refactor: extract garden tab into tabGarden.js"
```

---

## Task 3: Extract tabBattle.js

**Files:**
- Create: `src/game/tabs/tabBattle.js`
- Modify: `src/game/gameScreen.js`

**Functions moving OUT of gameScreen.js → tabBattle.js:**

| Symbol | Current lines |
|---|---|
| `renderBattleArena()` | ~line 1111 |
| `wireBattleArena()` | ~line 1113 |
| `startBattle()` | lines 1096–1109 |
| `onBattleResolved()` | search — called in startBattle's onResolve callback |
| `renderBattleTab()` | lines 1046–1080 |
| `wireBattleTab()` | lines 1082–1094 |

- [ ] **Step 1: Write tabBattle.js**

Replace the stub with:

```js
import { makeWildEncounter, makeBossEncounter, nextAvailableBoss, BOSSES } from '../encounters.js';
import { getLevel } from '../gameEngine.js';
import { PRESTIGE } from '../economyConfig.js';
import { reportQuestProgress } from '../quests.js';
import { checkAchievements } from '../achievements.js';
import { sfx } from '../sfx.js';
import { track } from '@vercel/analytics';
```

After the imports, copy the following functions from gameScreen.js verbatim, applying the substitution table to every reference:

- `renderBattleArena()` → `renderBattleArena(ctx)` (no substitutions needed — it returns a static string)
- `wireBattleArena()` → `wireBattleArena(body, ctx)` (no substitutions needed)
- `onBattleResolved(result, meta)` → `onBattleResolved(result, meta, ctx)` — apply substitution table throughout
- `startBattle(encounter, meta)` → `startBattle(encounter, meta, ctx)` — replace `_battleSession =` with `ctx.setBattleSession(...)`, `_container` with `ctx.container`, `refreshActiveTab` with `ctx.onRefresh`, and pass `ctx` into `onBattleResolved` callback
- `renderBattleTab()` → `export function renderBattleTab(ctx)` — apply substitution table; note `_battleSession` reads become `ctx.getBattleSession()`
- `wireGardenTab(body)` → `export function wireBattleTab(body, ctx)` — apply substitution table; the `startBattle(...)` call becomes `startBattle(..., ctx)`

- [ ] **Step 2: Delete moved code from gameScreen.js**

Delete `renderBattleArena`, `wireBattleArena`, `startBattle`, `onBattleResolved`, `renderBattleTab`, `wireBattleTab`.

- [ ] **Step 3: Build**

```
npm run build
```

Expected: no errors.

- [ ] **Step 4: Smoke test in browser**

Open Cannagotchi → Battle tab. Verify "Find a Fight" and boss challenge buttons appear. Start a wild battle and confirm it loads.

- [ ] **Step 5: Commit**

```
git add src/game/tabs/tabBattle.js src/game/gameScreen.js
git commit -m "refactor: extract battle tab into tabBattle.js"
```

---

## Task 4: Extract tabShop.js

**Files:**
- Create: `src/game/tabs/tabShop.js`
- Modify: `src/game/gameScreen.js`

**Functions moving OUT of gameScreen.js → tabShop.js:**

| Symbol | Current lines |
|---|---|
| `renderShopCare()` | lines 1176–1205 |
| `renderShopCosmetics()` | lines 1207–1225 |
| `renderShopThemes()` | lines 1260–1282 |
| `renderGardenUpgradeBlock()` | search — called in renderShopCare |
| `renderMoveLibrary()` | search — called in renderShopCare |
| `renderCosmeticGrid()` | search — called in renderShopCosmetics |
| `buyItem()` | lines 1439–1451 |
| `buyCosmeticBtn()` | lines 1369–1383 |
| `equipCosmeticBtn()` | lines 1385–1391 |
| `buyThemeBtn()` | lines 1393–1410 |
| `applyThemeBtn()` | lines 1412–1418 |
| `toggleMove()` | lines 1420–1437 |
| `renderShopTab()` | lines 1149–1148 |
| `wireShopTab()` | lines 1334–1367 |

- [ ] **Step 1: Write tabShop.js**

Replace the stub with:

```js
import {
  ITEMS, GARDEN_UPGRADES, getEquippedTier, addItem, shopList,
} from '../inventory.js';
import { MOVES_BY_TYPE } from '../moves.js';
import { getLevel } from '../gameEngine.js';
import {
  HATS, FRAMES, AURAS, COSMETICS_BY_ID, COSMETIC_SLOTS,
  listCosmeticsForSlot, buyCosmetic, equipCosmetic, getEquipped,
} from '../cosmetics.js';
import {
  THEMES, isThemeUnlocked, isPremiumTheme, unlockTheme, applyTheme,
} from '../../services/themeService.js';
import { reportQuestProgress } from '../quests.js';
import { checkAchievements } from '../achievements.js';
import { sfx } from '../sfx.js';
import { track } from '@vercel/analytics';
```

After the imports, copy the following functions from gameScreen.js verbatim, applying the substitution table:
- `renderGardenUpgradeBlock`, `renderMoveLibrary`, `renderCosmeticGrid` (internal helpers — no export)
- `renderShopCare`, `renderShopCosmetics`, `renderShopThemes` (internal helpers — no export)
- `buyItem(itemId)` → `buyItem(itemId, ctx)` with substitutions
- `buyCosmeticBtn(id)` → `buyCosmeticBtn(id, ctx)` with substitutions
- `equipCosmeticBtn(slotAndId)` → `equipCosmeticBtn(slotAndId, ctx)` with substitutions
- `buyThemeBtn(themeKey)` → `buyThemeBtn(themeKey, ctx)` with substitutions
- `applyThemeBtn(themeKey)` → `applyThemeBtn(themeKey, ctx)` with substitutions; `refreshActiveTab()` becomes `ctx.onRefresh()`; `toast` becomes `ctx.toast`
- `toggleMove(moveId)` → `toggleMove(moveId, ctx)` with substitutions
- `renderShopTab()` → `export function renderShopTab(ctx)` — `_shopSection` reads become `ctx.getShopSection()`; pass `ctx` into render sub-calls
- `wireShopTab(body)` → `export function wireShopTab(body, ctx)` — `_shopSection =` becomes `ctx.setShopSection(...)`; all action handlers gain `ctx` arg; `buyUpgrade` calls use `ctx.buyUpgrade`

- [ ] **Step 2: Delete moved code from gameScreen.js**

Delete all functions listed in the table above plus `let _shopSection = 'care'` (it now lives as a getter/setter in the context).

- [ ] **Step 3: Build**

```
npm run build
```

- [ ] **Step 4: Smoke test**

Open Cannagotchi → Shop. Switch between Care / Cosmetics / Themes subtabs. Buy an item.

- [ ] **Step 5: Commit**

```
git add src/game/tabs/tabShop.js src/game/gameScreen.js
git commit -m "refactor: extract shop tab into tabShop.js"
```

---

## Task 5: Extract tabQuests.js

**Files:**
- Create: `src/game/tabs/tabQuests.js`
- Modify: `src/game/gameScreen.js`

**Functions moving OUT of gameScreen.js → tabQuests.js:**

| Symbol | Current lines |
|---|---|
| `formatDateShort()` | search — called in renderMemoriesCard |
| `renderLoginStreakCard()` | lines 1606–1624 |
| `renderBreedingCard()` | lines 1548–1604 |
| `renderTitlesCard()` | lines 1626–1646 |
| `renderMemoriesCard()` | lines 1648–1669 |
| `renderStrainDexCard()` | lines 1671–1684 |
| `claimAndPlantOffspring()` | lines 775–818 |
| `renderQuestsTab()` | lines 1469–1546 |
| `wireQuestsTab()` | lines 1692–1794 |

- [ ] **Step 1: Write tabQuests.js**

Replace the stub with:

```js
import {
  ACHIEVEMENTS, checkAchievements,
} from '../achievements.js';
import { ensureDaily, reportQuestProgress, claimQuest } from '../quests.js';
import {
  getPrestigeMultipliers, canPrestige, previewPrestige, doPrestige,
} from '../prestige.js';
import { PRESTIGE } from '../economyConfig.js';
import {
  checkTitles, getEquippedTitle, listEarnedTitles, equipTitle,
} from '../titles.js';
import { processLoginStreak, STREAK_REWARDS } from '../loginStreak.js';
import {
  PLOT_IDS, PLOT_LABELS, plantBudInEmptyPlot, getActivePlotId, snapshotActiveTo,
} from '../plots.js';
import {
  canBreed, isBreeding, isOffspringReady, getBreedingProgress,
  collectLivingBuds, startBreeding, skipBreedingWithSeeds,
  claimOffspring, cancelBreeding,
} from '../breeding.js';
import { getMonsterType, MONSTER_TYPES } from '../monsters.js';
import { getVariant } from '../monsters.js';
import { renderSprite } from '../pixelArt.js';
import { getLevel } from '../gameEngine.js';
import { sfx } from '../sfx.js';
import { track } from '@vercel/analytics';
import { refreshLevelCache } from '../../services/gameService.js';
```

After imports, copy the following from gameScreen.js applying the substitution table:
- `formatDateShort()` — no substitutions needed
- `renderLoginStreakCard()` → `renderLoginStreakCard(ctx)` — replace `_gameState` with `ctx.gameState`
- `renderBreedingCard()` → `renderBreedingCard(ctx)` — apply substitutions throughout
- `renderTitlesCard()` → `renderTitlesCard(ctx)` — apply substitutions
- `renderMemoriesCard()` → `renderMemoriesCard(ctx)` — `formatN` calls become `ctx.formatN`; `_gameState` becomes `ctx.gameState`
- `renderStrainDexCard()` → `renderStrainDexCard(ctx)` — apply substitutions
- `claimAndPlantOffspring()` → `claimAndPlantOffspring(ctx)` — apply substitution table; `renderShell()` becomes `ctx.onShell()`; `switchTab` becomes `ctx.onSwitchTab`
- `renderQuestsTab()` → `export function renderQuestsTab(ctx)` — pass `ctx` into each `render*Card(ctx)` call; apply substitutions for `_gameState`, `PRESTIGE`
- `wireQuestsTab(body)` → `export function wireQuestsTab(body, ctx)` — apply substitutions throughout; `claimAndPlantOffspring()` becomes `claimAndPlantOffspring(ctx)`

- [ ] **Step 2: Delete moved code from gameScreen.js**

Delete all functions listed in the table.

- [ ] **Step 3: Build**

```
npm run build
```

- [ ] **Step 4: Smoke test**

Open Cannagotchi → Quests. Verify daily quests render, achievements grid renders, prestige section renders.

- [ ] **Step 5: Commit**

```
git add src/game/tabs/tabQuests.js src/game/gameScreen.js
git commit -m "refactor: extract quests tab into tabQuests.js"
```

---

## Task 6: Extract tabVersus.js

**Files:**
- Create: `src/game/tabs/tabVersus.js`
- Modify: `src/game/gameScreen.js`

**Functions moving OUT of gameScreen.js → tabVersus.js:**

| Symbol | Current lines |
|---|---|
| `renderVersusTab()` | lines 1797–1842 |
| `wireVersusTab()` | lines 1844–1966 |

- [ ] **Step 1: Write tabVersus.js**

Replace the stub with:

```js
import { sfx } from '../sfx.js';
```

Copy `renderVersusTab()` → `export function renderVersusTab(ctx)`. No substitutions needed (it returns static HTML).

Copy `wireVersusTab(body)` → `export function wireVersusTab(body, ctx)`. Apply substitution table:
- `_versusSession = true` → `ctx.setVersusSession(true)`
- `_versusSession = null` → `ctx.setVersusSession(null)`
- `_activeTab = 'versus'` → no change needed (this is the internal `switchTab` mechanism — leave the `_container.querySelector` pattern as-is, but replace `_container` with `ctx.container`)
- `_gameState` → `ctx.gameState`
- `_uid` → `ctx.uid`
- `syncTopbar()` → `ctx.onTopbar()`

The `exitVersus` inner function rebuilds the tab — replace its `_container` reference with `ctx.container`.

- [ ] **Step 2: Delete moved code from gameScreen.js**

Delete `renderVersusTab` and `wireVersusTab`.

- [ ] **Step 3: Build**

```
npm run build
```

- [ ] **Step 4: Smoke test**

Open Cannagotchi → Versus tab. Verify all four battle mode buttons render. Start a Hot-Seat battle and verify it launches.

- [ ] **Step 5: Verify gameScreen.js line count**

```
(Get-Content src\game\gameScreen.js).Count
```

Expected: under 300 lines. If over 300, scan for any tab render/wire functions that weren't deleted.

- [ ] **Step 6: Commit**

```
git add src/game/tabs/tabVersus.js src/game/gameScreen.js
git commit -m "refactor: extract versus tab into tabVersus.js — gameScreen.js is now a thin coordinator"
```

---

## Task 7: Battle AI tier system

**Files:**
- Modify: `src/game/battle.js`

This task adds `getAITier()` and updates `pickAIAction()` with three behavior tiers. The player level is read from `state.player.level` — no caller signature change needed.

- [ ] **Step 1: Add `getAITier` helper to battle.js**

Find `src/game/battle.js`. Add this function immediately before `pickAIAction`:

```js
function getAITier(playerLevel) {
  if (playerLevel >= 31) return 'advanced';
  if (playerLevel >= 16) return 'intermediate';
  return 'basic';
}
```

- [ ] **Step 2: Replace `pickAIAction` body**

The current `pickAIAction` is at lines 356–383. Replace the entire function body with:

```js
export function pickAIAction(state, side) {
  const me  = state[side];
  const foe = state[side === 'player' ? 'opponent' : 'player'];
  const moves = me.moves || [];
  if (moves.length === 0) return { kind: 'flee' };

  const playerLevel = state.player?.level || 1;
  const tier = getAITier(playerLevel);

  // ── Basic (Lv1–15): original behaviour ───────────────────────
  if (tier === 'basic') {
    if (me.hp / me.hpMax < 0.35) {
      const heal = moves.find(m => m.effect && m.effect.startsWith('heal_'));
      if (heal && rng(state) < 0.7) return { kind: 'move', moveId: heal.id };
    }
    if (me.buffMods.atk === 1 && me.buffMods.def === 1) {
      const buff = moves.find(m => m.effect === 'atk_up' || m.effect === 'def_up');
      if (buff && rng(state) < 0.35) return { kind: 'move', moveId: buff.id };
    }
    const dmgMoves = moves.filter(m => m.power > 0);
    if (dmgMoves.length === 0) return { kind: 'move', moveId: moves[0].id };
    const scored = dmgMoves.map(m => ({
      m,
      score: m.power * (me.atk / Math.max(1, foe.def)) * (0.85 + rng(state) * 0.30),
    }));
    scored.sort((a, b) => b.score - a.score);
    return { kind: 'move', moveId: scored[0].m.id };
  }

  // ── Intermediate (Lv16–30): raised heal threshold, responds to player buffs ─
  if (tier === 'intermediate') {
    // Heal sooner
    if (me.hp / me.hpMax < 0.50) {
      const heal = moves.find(m => m.effect && m.effect.startsWith('heal_'));
      if (heal && rng(state) < 0.7) return { kind: 'move', moveId: heal.id };
    }
    // Counter player's attack buff with a defense buff
    const playerBoostedAtk = foe.buffMods?.atk > 1;
    if (playerBoostedAtk && me.buffMods.def === 1) {
      const defBuff = moves.find(m => m.effect === 'def_up');
      if (defBuff && rng(state) < 0.65) return { kind: 'move', moveId: defBuff.id };
    }
    // Buff if no buffs active (same as basic)
    if (me.buffMods.atk === 1 && me.buffMods.def === 1) {
      const buff = moves.find(m => m.effect === 'atk_up' || m.effect === 'def_up');
      if (buff && rng(state) < 0.35) return { kind: 'move', moveId: buff.id };
    }
    // Pick top damage move, but 20% of the time use the second-best (unpredictable)
    const dmgMoves = moves.filter(m => m.power > 0);
    if (dmgMoves.length === 0) return { kind: 'move', moveId: moves[0].id };
    const scored = dmgMoves.map(m => ({
      m,
      score: m.power * (me.atk / Math.max(1, foe.def)) * (0.85 + rng(state) * 0.30),
    }));
    scored.sort((a, b) => b.score - a.score);
    const pick = scored.length > 1 && rng(state) < 0.20 ? scored[1] : scored[0];
    return { kind: 'move', moveId: pick.m.id };
  }

  // ── Advanced (Lv31+): reads player's last move, debuffs, exploits weaknesses ─
  // Heal aggressively
  if (me.hp / me.hpMax < 0.60) {
    const heal = moves.find(m => m.effect && m.effect.startsWith('heal_'));
    if (heal && rng(state) < 0.75) return { kind: 'move', moveId: heal.id };
  }
  // If player buffed last turn, go all-out attack
  const playerJustBuffed = state._lastFoeAction?.kind === 'move' &&
    (state._lastFoeAction?.effect === 'atk_up' || state._lastFoeAction?.effect === 'def_up');
  if (playerJustBuffed) {
    const dmgMoves = moves.filter(m => m.power > 0);
    if (dmgMoves.length > 0) {
      const best = dmgMoves.reduce((a, b) =>
        (b.power * (me.atk / Math.max(1, foe.def))) > (a.power * (me.atk / Math.max(1, foe.def))) ? b : a
      );
      return { kind: 'move', moveId: best.id };
    }
  }
  // If player healed last turn, hit hardest
  const playerJustHealed = state._lastFoeAction?.kind === 'move' &&
    state._lastFoeAction?.effect?.startsWith('heal_');
  if (playerJustHealed) {
    const dmgMoves = moves.filter(m => m.power > 0);
    if (dmgMoves.length > 0) {
      const best = dmgMoves.reduce((a, b) =>
        b.power > a.power ? b : a
      );
      return { kind: 'move', moveId: best.id };
    }
  }
  // Apply debuff when player is healthy
  if ((foe.hp / foe.hpMax) > 0.70) {
    const debuff = moves.find(m => m.effect === 'atk_down' || m.effect === 'def_down' || m.effect === 'spd_down');
    if (debuff && rng(state) < 0.50) return { kind: 'move', moveId: debuff.id };
  }
  // Buff self if no buffs active
  if (me.buffMods.atk === 1 && me.buffMods.def === 1) {
    const buff = moves.find(m => m.effect === 'atk_up' || m.effect === 'def_up');
    if (buff && rng(state) < 0.40) return { kind: 'move', moveId: buff.id };
  }
  // Exploit weakness: weight moves by ATK vs foe DEF ratio
  const dmgMoves = moves.filter(m => m.power > 0);
  if (dmgMoves.length === 0) return { kind: 'move', moveId: moves[0].id };
  const scored = dmgMoves.map(m => ({
    m,
    score: m.power * (me.atk / Math.max(1, foe.def)) * (0.85 + rng(state) * 0.30),
  }));
  scored.sort((a, b) => b.score - a.score);
  return { kind: 'move', moveId: scored[0].m.id };
}
```

- [ ] **Step 3: Build**

```
npm run build
```

Expected: no errors.

- [ ] **Step 4: Smoke test**

Open Cannagotchi → Battle → Find a Fight. Play through a battle. Confirm no JS errors in console. No behavior difference is visible yet at low levels — that's correct.

- [ ] **Step 5: Commit**

```
git add src/game/battle.js
git commit -m "feat: add three-tier battle AI difficulty scaling by player level"
```

---

## Task 8: Wild encounter stat scaling

**Files:**
- Modify: `src/game/encounters.js`

Wild enemies gain a stat multiplier that grows with player level, capped at +25% at Lv.50+. Bosses are unaffected.

- [ ] **Step 1: Locate `makeWildEncounter` in encounters.js**

Find `function makeWildEncounter(playerLevel)` (around line 69). The function currently computes `stats` like this:

```js
const stats = getStats(def.baseStats, lvl, def.statGrowth);
```

- [ ] **Step 2: Add stat bonus after the stats line**

Replace:

```js
const stats = getStats(def.baseStats, lvl, def.statGrowth);
```

With:

```js
const rawStats = getStats(def.baseStats, lvl, def.statGrowth);
const statBonus = 1 + Math.min(Math.floor(playerLevel / 10), 5) * 0.05;
const stats = {
  hp:  Math.round(rawStats.hp  * statBonus),
  atk: Math.round(rawStats.atk * statBonus),
  def: Math.round(rawStats.def * statBonus),
  spd: Math.round(rawStats.spd * statBonus),
};
```

This gives:
- Lv.1–9: ×1.00 (no change)
- Lv.10–19: ×1.05
- Lv.20–29: ×1.10
- Lv.30–39: ×1.15
- Lv.40–49: ×1.20
- Lv.50+: ×1.25 (capped)

- [ ] **Step 3: Build**

```
npm run build
```

- [ ] **Step 4: Smoke test**

Open Cannagotchi → Battle → Find a Fight. Confirm a battle starts without errors.

- [ ] **Step 5: Commit**

```
git add src/game/encounters.js
git commit -m "feat: wild encounter stats scale +5% per 10 player levels up to Lv.50"
```

---

## Task 9: Prestige strip expansion

**Files:**
- Modify: `src/game/tabs/tabGarden.js`

The prestige strip in `renderGardenTab` was already written with the three-multiplier layout in Task 2. Verify it matches the spec and confirm the `budMult` property name is correct.

- [ ] **Step 1: Verify `getPrestigeMultipliers` return shape**

Open `src/game/prestige.js` and find `getPrestigeMultipliers`. Confirm it returns an object with keys `xpMult`, `budMult`, and `statMult`. If the property names differ (e.g., `budRate` instead of `budMult`), update the references in `renderGardenTab` accordingly.

- [ ] **Step 2: Confirm strip HTML in tabGarden.js**

In `src/game/tabs/tabGarden.js`, find the prestige strip block. It should look like:

```js
${prestigeCount > 0 ? `
  <div class="prestige-strip">
    <div class="prestige-strip__title">✦ Prestige Lv.${prestigeCount}</div>
    <div class="prestige-strip__mults dim small">+${xpBoost}% XP · +${budBoost}% Buds · +${statBoost}% Stats</div>
  </div>` : ''}
```

If it instead shows the old single-line format (from before Task 2), replace it with the block above and ensure `xpBoost`, `budBoost`, `statBoost` are calculated in `renderGardenTab`:

```js
const prestigeCount = ctx.gameState.prestige?.count || 0;
const xpBoost   = Math.round(prestigeMul.xpMult  * 100 - 100);
const budBoost  = Math.round(prestigeMul.budMult  * 100 - 100);
const statBoost = Math.round(prestigeMul.statMult * 100 - 100);
```

- [ ] **Step 3: Build**

```
npm run build
```

- [ ] **Step 4: Smoke test prestige strip**

To verify the strip without actually prestiging: temporarily set `ctx.gameState.prestige = { count: 2 }` in the browser console, then call `window.__refreshTab?.()` or navigate away and back to garden. Confirm the strip shows `✦ Prestige Lv.2` and `+20% XP · +24% Buds · +10% Stats`.

Alternatively, if a save with prestige already exists, just open the garden tab.

- [ ] **Step 5: Commit**

```
git add src/game/tabs/tabGarden.js
git commit -m "feat: prestige strip shows all three multipliers (XP, Buds, Stats)"
```

---

## Final verification

- [ ] Run `npm run build` — clean build, no warnings about undefined symbols
- [ ] Confirm `src/game/gameScreen.js` is under 300 lines
- [ ] Each of the 5 tab files exists under `src/game/tabs/`
- [ ] Open Cannagotchi, cycle through all 5 tabs — no blank screens, no JS errors in console
- [ ] Battle a wild encounter — AI responds, battle resolves
- [ ] If a prestige save exists: garden tab shows all three multipliers
