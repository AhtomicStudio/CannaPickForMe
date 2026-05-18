import { getMonsterType, getVariant } from '../monsters.js';
import { getLevel, getStats, getCurrentEvolution } from '../gameEngine.js';
import { renderSprite, renderHat } from '../pixelArt.js';
import { NEEDS, PACING } from '../economyConfig.js';
import { moodSummary, mostNeedy, NEED_META, NEED_KEYS, applyDecay, restoreNeed, pet } from '../needs.js';
import {
  ITEMS, GARDEN_UPGRADES, getEquippedTier,
  consumeItem,
} from '../inventory.js';
import { reportQuestProgress } from '../quests.js';
import { describeTrait } from '../traits.js';
import { getEquipped } from '../cosmetics.js';
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
import { startTutorial, resetTutorial } from '../tutorial.js';

// ── Mini-game preference ──────────────────────────────────────
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

function reactToCare(animClass, ctx) {
  const el = ctx.container?.querySelector('#garden-sprite');
  if (!el) return;
  const evo = getCurrentEvolution(getMonsterType(ctx.gameState.monsterType).evolutions, getLevel(ctx.gameState.xp));
  const idle = idleAnimFor(evo.sprite);
  el.className = 'game-monster ' + animClass;
  setTimeout(() => { el.className = 'game-monster ' + idle; }, 1100);
}

function spawnCareEffect(kind, ctx) {
  const viewport = ctx.container?.querySelector('.garden-viewport');
  if (!viewport) return;
  let html = '';
  switch (kind) {
    case 'water':
      html = `
        <div class="care-fx care-fx--water">
          <span class="care-fx__tool">🚿</span>
          <span class="care-fx__drop care-fx__drop--1">💧</span>
          <span class="care-fx__drop care-fx__drop--2">💧</span>
          <span class="care-fx__drop care-fx__drop--3">💧</span>
          <span class="care-fx__drop care-fx__drop--4">💧</span>
        </div>`;
      break;
    case 'feed':
      html = `
        <div class="care-fx care-fx--feed">
          <span class="care-fx__tool">🥬</span>
          <span class="care-fx__bit care-fx__bit--1">🌿</span>
          <span class="care-fx__bit care-fx__bit--2">🍃</span>
          <span class="care-fx__bit care-fx__bit--3">🌿</span>
        </div>`;
      break;
    case 'clean':
      html = `
        <div class="care-fx care-fx--clean">
          <span class="care-fx__tool">🧹</span>
          <span class="care-fx__sparkle care-fx__sparkle--1">✨</span>
          <span class="care-fx__sparkle care-fx__sparkle--2">✨</span>
          <span class="care-fx__sparkle care-fx__sparkle--3">✨</span>
        </div>`;
      break;
    case 'pet':
      html = `
        <div class="care-fx care-fx--pet">
          <span class="care-fx__tool">🤚</span>
          <span class="care-fx__heart care-fx__heart--1">💚</span>
          <span class="care-fx__heart care-fx__heart--2">💚</span>
        </div>`;
      break;
    default:
      return;
  }
  const el = document.createElement('div');
  el.innerHTML = html;
  const node = el.firstElementChild;
  viewport.appendChild(node);
  setTimeout(() => node.remove(), 1300);
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
        // Occupied
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
  switch (kind) {
    case 'water': {
      const amt = Math.round(NEEDS.RESTORE_TAP_WATER * mult);
      restoreNeed(ctx.gameState.needs, 'hydration', amt);
      sfx.water(); reactToCare('game-anim--sip', ctx); spawnCareEffect('water', ctx);
      reportQuestProgress(ctx.gameState, 'action_water', 1);
      ctx.applyXP(Math.max(1, Math.round(2 * mult)), '💧', 'water');
      break;
    }
    case 'feed': {
      const amt = Math.round(NEEDS.RESTORE_TAP_FEED * mult);
      restoreNeed(ctx.gameState.needs, 'nutrition', amt);
      sfx.feed(); reactToCare('game-anim--munch', ctx); spawnCareEffect('feed', ctx);
      reportQuestProgress(ctx.gameState, 'action_feed', 1);
      ctx.applyXP(Math.max(1, Math.round(2 * mult)), '🌿', 'feed');
      break;
    }
    case 'clean': {
      const amt = Math.round(10 * mult);
      restoreNeed(ctx.gameState.needs, 'cleanliness', amt);
      sfx.tap(); reactToCare('cg-react--happy', ctx); spawnCareEffect('clean', ctx);
      ctx.applyXP(Math.max(1, Math.round(1 * mult)), '✨', 'clean');
      break;
    }
    case 'pet': {
      pet(ctx.gameState.needs, Math.round(6 * mult));
      sfx.pet(); reactToCare('cg-react--excited', ctx); spawnCareEffect('pet', ctx);
      reportQuestProgress(ctx.gameState, 'action_pet', 1);
      ctx.applyXP(Math.max(1, Math.round(1 * mult)), '🤚', 'pet');
      break;
    }
  }
  if (result) {
    if (result === 'perfect') ctx.toast(`🌟 PERFECT! ${Math.round(mult * 100)}%`, 'gold');
    else if (result === 'ok') ctx.toast(`👍 OK · 100%`, '');
    else                      ctx.toast(`Missed · 70%`, 'red');
  }
  ctx.registerStreak();
  checkAchievements(ctx.gameState);
  ctx.onRefresh(false);
  ctx.onSave();
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
  // Re-init derived state for the newly active bud
  refreshLevelCache(ctx.gameState);
  applyDecay(ctx.gameState.needs);
  sfx.tap();
  ctx.toast(`🪴 Switched to ${PLOT_LABELS[plotId]}`, 'gold');
  ctx.onShell();           // re-render topbar with new bud
  ctx.onSwitchTab('garden');     // re-render Garden tab
  // Refresh the floating companion to mirror the new bud + variant
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
  // Show an in-place onboarding overlay reusing the existing flow
  const overlay = document.createElement('div');
  overlay.className = 'plot-plant-overlay';
  overlay.innerHTML = `
    <div class="plot-plant-card">
      <button class="plot-plant-close" id="plot-plant-close" aria-label="Cancel">✕</button>
      <div id="plot-plant-onboard"></div>
    </div>`;
  ctx.container.appendChild(overlay);

  overlay.querySelector('#plot-plant-close').addEventListener('click', () => overlay.remove());

  // Lazy-import onboarding so we don't load it until needed
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
      // Re-init companion for the new active bud
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
  const monType   = getMonsterType(ctx.gameState.monsterType);
  const lvl       = getLevel(ctx.gameState.xp);
  const evolution = getCurrentEvolution(monType.evolutions, lvl);
  const stats     = getStats(monType.baseStats, lvl);
  const mood      = moodSummary(ctx.gameState.needs);
  const lowest    = mostNeedy(ctx.gameState.needs);
  const prestigeMul = getPrestigeMultipliers(ctx.gameState);
  const prestigeCount = ctx.gameState.prestige?.count || 0;
  const xpBoost   = Math.round(prestigeMul.xpMult  * 100 - 100);
  const budBoost  = Math.round(prestigeMul.budMult  * 100 - 100);
  const statBoost = Math.round(prestigeMul.statMult * 100 - 100);

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
  const moodXpStr   = mood.xpMult >= 1
    ? `+${Math.round((mood.xpMult-1)*100)}% XP`
    : `${Math.round((mood.xpMult-1)*100)}% XP`;

  const hat   = getEquipped(ctx.gameState, 'hat');
  const frame = getEquipped(ctx.gameState, 'frame');
  const aura  = getEquipped(ctx.gameState, 'aura');
  const frameClass = frame?.cssClass || '';
  const auraClass  = aura?.cssClass  || '';

  // Garden upgrades — paint into the background so the player SEES their setup
  const potTier   = getEquippedTier(ctx.gameState.garden, 'pot');
  const soilTier  = getEquippedTier(ctx.gameState.garden, 'soil');

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
        <div class="card-title">Stats <span class="dim small">x${combinedStatMult(ctx).toFixed(2)}</span></div>
        ${statBar('HP',  Math.floor(stats.hp  * combinedStatMult(ctx)), monType.color)}
        ${statBar('ATK', Math.floor(stats.atk * combinedStatMult(ctx)), '#f87171')}
        ${statBar('DEF', Math.floor(stats.def * combinedStatMult(ctx)), '#38bdf8')}
        ${statBar('SPD', Math.floor(stats.spd * combinedStatMult(ctx)), '#fbbf24')}
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
          const xpPct    = tier.xpMult   > 1 ? Math.round((tier.xpMult-1)*100)     : 0;
          const budPct   = tier.budMult  > 1 ? Math.round((tier.budMult-1)*100)    : 0;
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
                ${xpPct    ? `<span class="bonus-pill">⚡ +${xpPct}% XP</span>`     : ''}
                ${budPct   ? `<span class="bonus-pill">🪙 +${budPct}% Buds</span>`  : ''}
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
  const variant = getVariant(ctx.gameState.monsterType, ctx.gameState.monsterVariant || 'classic');
  const path    = getPath(ctx.gameState.monsterType, ctx.gameState.evolutionPath);
  const remap   = combinedPaletteRemap(variant?.paletteRemap, path?.paletteOverlay);
  renderSprite(spriteEl, evolution.sprite, 7, { paletteRemap: remap });
  // Equipped hat — pixel-art overlay anchored to the top of the bud sprite
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
    resetTutorial();
    sfx.tap();
    startTutorial();
  });

  // Inline garden upgrades on the Garden tab
  body.querySelectorAll('[data-garden-upgrade]').forEach(btn => {
    btn.addEventListener('click', () => ctx.buyUpgrade(btn.dataset.gardenUpgrade));
  });

  // Plot picker
  body.querySelectorAll('[data-plot]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.plot;
      const action = btn.dataset.action;
      if (action === 'switch') handlePlotSwitch(pid, ctx);
      else if (action === 'plant') handlePlotPlant(pid, ctx);
      else if (action === 'unlock') handlePlotUnlock(ctx);
    });
  });
}
