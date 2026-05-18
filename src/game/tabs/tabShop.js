import {
  ITEMS, GARDEN_UPGRADES, getEquippedTier, shopList, addItem,
} from '../inventory.js';
import { MOVES_BY_TYPE } from '../moves.js';
import { getLevel } from '../gameEngine.js';
import {
  listCosmeticsForSlot, buyCosmetic, equipCosmetic,
} from '../cosmetics.js';
import {
  THEMES, isThemeUnlocked, isPremiumTheme, unlockTheme, applyTheme,
} from '../../services/themeService.js';
import { reportQuestProgress } from '../quests.js';
import { checkAchievements } from '../achievements.js';
import { sfx } from '../sfx.js';
import { track } from '@vercel/analytics';

// ── Internal helpers ──────────────────────────────────────────

function affordCheck(c, gameState) {
  if (c.cur === 'seeds')     return (gameState.seeds     || 0) >= c.price;
  if (c.cur === 'trichomes') return (gameState.trichomes || 0) >= c.price;
  return (gameState.buds || 0) >= c.price;
}

function currencyGlyph(cur) {
  if (cur === 'seeds')     return '🌱';
  if (cur === 'trichomes') return '✨';
  return '🪙';
}

function renderGardenUpgradeBlock(slot, ctx) {
  const cfg = GARDEN_UPGRADES[slot];
  const equipped = getEquippedTier(ctx.gameState.garden, slot);
  const idx = cfg.tiers.findIndex(t => t.id === equipped.id);
  const next = cfg.tiers[idx + 1];

  return `
    <div class="upgrade-row">
      <span class="upgrade-row__emoji">${cfg.emoji}</span>
      <div class="upgrade-row__info">
        <div class="upgrade-row__label">${cfg.label}</div>
        <div class="upgrade-row__current">${equipped.name}</div>
      </div>
      ${next ? `
        <button class="btn-juicy compact" data-upgrade="${slot}" ${ctx.gameState.buds < next.cost ? 'disabled' : ''}>
          → ${next.name} 🪙 ${ctx.formatN(next.cost)}
        </button>` : `<span class="dim small">MAX</span>`}
    </div>
  `;
}

function renderMoveLibrary(ctx) {
  const lvl = getLevel(ctx.gameState.xp);
  const pool = (MOVES_BY_TYPE[ctx.gameState.monsterType] || MOVES_BY_TYPE.hybrid).filter(m => m.levelReq <= lvl);
  const equipped = ctx.gameState.equippedMoves && ctx.gameState.equippedMoves.length
    ? ctx.gameState.equippedMoves.slice(0, 4)
    : pool.slice(0, 4).map(m => m.id);

  if (pool.length === 0) return `<div class="dim small">Level up to unlock moves.</div>`;

  return `
    <div class="move-lib">
      ${pool.map(m => {
        const eq = equipped.includes(m.id);
        return `
          <div class="move-lib-row ${eq ? 'eq' : ''}">
            <span class="move-lib__emoji">${m.emoji}</span>
            <div class="move-lib__info">
              <div class="move-lib__name">${m.name}</div>
              <div class="dim small">${m.power > 0 ? 'PWR ' + m.power : 'STAT'} · ${m.description}</div>
            </div>
            <button class="btn-juicy compact" data-toggle-move="${m.id}">${eq ? '✓ Equipped' : 'Equip'}</button>
          </div>`;
      }).join('')}
    </div>
    <div class="dim small" style="margin-top:0.4rem">Equipped: ${equipped.length}/4</div>
  `;
}

function renderCosmeticGrid(slot, ctx) {
  const list = listCosmeticsForSlot(slot, ctx.gameState);
  return `
    <div class="cosmetic-grid">
      ${list.map(c => {
        const equipped = ctx.gameState.cosmetics?.equipped?.[slot] === c.id;
        const labelGlyph = c.glyph != null ? c.glyph || '∅' : (c.cssClass ? '🖼️' : '');
        let action;
        if (c.isOwned)              action = `<button class="btn-juicy compact ${equipped?'eq':''}" data-equip="${slot}::${c.id}">${equipped?'✓ Equipped':'Equip'}</button>`;
        else if (c.isAchievement)   action = `<span class="dim small">🏆 ${c.isAchievementMet ? 'Earned' : 'Locked: '+ c.desc}</span>`;
        else                         action = `<button class="btn-juicy compact" data-buy-cos="${c.id}" ${affordCheck(c, ctx.gameState) ? '' : 'disabled'}>${currencyGlyph(c.cur)} ${c.price}</button>`;
        return `
          <div class="cosmetic-card ${c.isOwned?'owned':''} ${c.isAchievement && !c.isOwned ? 'locked' : ''}">
            <div class="cosmetic-card__glyph">${labelGlyph}</div>
            <div class="cosmetic-card__name">${c.name}</div>
            <div class="dim small">${c.desc}</div>
            ${action}
          </div>`;
      }).join('')}
    </div>`;
}

function renderShopCare(ctx) {
  const items = shopList();
  return `
    <div class="card">
      <div class="card-title">Consumables</div>
      <div class="shop-grid">
        ${items.map(it => `
          <div class="shop-card">
            <div class="shop-card__emoji">${it.emoji}</div>
            <div class="shop-card__name">${it.name}</div>
            <div class="dim small">${it.desc}</div>
            <button class="btn-juicy compact" data-buy="${it.id}" ${ctx.gameState.buds < it.cost ? 'disabled' : ''}>
              🪙 ${it.cost}
            </button>
          </div>`).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-title">Garden Upgrades</div>
      ${['pot','soil'].map(slot => renderGardenUpgradeBlock(slot, ctx)).join('')}
    </div>

    <div class="card">
      <div class="card-title">Move Library</div>
      <div class="dim small">Each Cannabud carries 4 active moves. Swap them here from your unlocked pool.</div>
      ${renderMoveLibrary(ctx)}
    </div>
  `;
}

function renderShopCosmetics(ctx) {
  return `
    <div class="card">
      <div class="card-title">🎩 Hats</div>
      <div class="dim small">Decorate your Cannabud's head with a little something.</div>
      ${renderCosmeticGrid('hat', ctx)}
    </div>
    <div class="card">
      <div class="card-title">🖼️ Frames</div>
      <div class="dim small">Reframe your Cannabud's viewport.</div>
      ${renderCosmeticGrid('frame', ctx)}
    </div>
    <div class="card">
      <div class="card-title">✨ Auras</div>
      <div class="dim small">Animated glow behind your Cannabud.</div>
      ${renderCosmeticGrid('aura', ctx)}
    </div>
  `;
}

function renderShopThemes(ctx) {
  return `
    <div class="card">
      <div class="card-title">🎨 Premium Themes</div>
      <div class="dim small">Unlock app-wide themes. Locked themes appear greyed-out in the Profile → Themes page until you buy them here.</div>
      <div class="cosmetic-grid">
        ${THEMES.filter(t => isPremiumTheme(t.key)).map(t => {
          const unlocked = isThemeUnlocked(t.key);
          const canAfford = t.cur === 'seeds' ? (ctx.gameState.seeds||0) >= t.price : (ctx.gameState.buds||0) >= t.price;
          return `
            <div class="cosmetic-card ${unlocked?'owned':''}">
              <div class="cosmetic-card__theme-preview">${t.preview.join('')}</div>
              <div class="cosmetic-card__name">${t.label}</div>
              <div class="dim small">${t.desc || ''}</div>
              ${unlocked
                ? `<button class="btn-juicy compact eq" data-apply-theme="${t.key}">Apply</button>`
                : `<button class="btn-juicy compact" data-buy-theme="${t.key}" ${canAfford?'':'disabled'}>${t.cur==='seeds'?'🌱':'🪙'} ${t.price}</button>`}
            </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

// ── Action handlers ───────────────────────────────────────────

function buyItem(itemId, ctx) {
  const it = ITEMS[itemId]; if (!it) return;
  if ((ctx.gameState.buds || 0) < it.cost) { sfx.error(); ctx.toast(`Need ${it.cost} 🪙`, 'red'); return; }
  ctx.gameState.buds -= it.cost;
  addItem(ctx.gameState, itemId, 1);
  if (!ctx.gameState.lifetime) ctx.gameState.lifetime = {};
  ctx.gameState.lifetime.itemsBought = (ctx.gameState.lifetime.itemsBought || 0) + 1;
  reportQuestProgress(ctx.gameState, 'spend_buds', it.cost);
  sfx.buy(); ctx.toast(`${it.emoji} +1 ${it.name}`);
  checkAchievements(ctx.gameState);
  ctx.onRefresh();
  ctx.onSave();
}

function buyCosmeticBtn(id, ctx) {
  const r = buyCosmetic(ctx.gameState, id);
  if (!r.ok) {
    sfx.error();
    if (r.reason === 'broke')              ctx.toast('Not enough currency', 'red');
    else if (r.reason === 'achievement_only') ctx.toast('Earn this through achievements', 'red');
    else if (r.reason === 'owned')         ctx.toast('Already owned', 'red');
    return;
  }
  sfx.buy();
  ctx.toast(`${r.cosmetic.glyph || '🎨'} Got ${r.cosmetic.name}!`, 'gold');
  ctx.onTopbar();
  ctx.onRefresh();
  ctx.onSave();
}

function equipCosmeticBtn(slotAndId, ctx) {
  const [slot, id] = slotAndId.split('::');
  if (!equipCosmetic(ctx.gameState, slot, id)) { sfx.error(); return; }
  sfx.tap();
  ctx.onRefresh();
  ctx.onSave();
}

function buyThemeBtn(themeKey, ctx) {
  const t = THEMES.find(x => x.key === themeKey);
  if (!t) return;
  const cur = t.cur || 'buds';
  const have = cur === 'seeds' ? (ctx.gameState.seeds || 0) : (ctx.gameState.buds || 0);
  if (have < t.price) { sfx.error(); ctx.toast('Not enough currency', 'red'); return; }
  if (cur === 'seeds') ctx.gameState.seeds -= t.price;
  else                  ctx.gameState.buds  -= t.price;
  unlockTheme(themeKey);
  ctx.gameState.unlockedThemes = Array.from(new Set([...(ctx.gameState.unlockedThemes||[]), themeKey]));
  sfx.buy();
  try { track('theme_unlocked', { theme: themeKey, currency: cur, price: t.price }); } catch (_) {}
  ctx.toast(`🎨 Unlocked theme: ${t.label}!`, 'gold', 3000);
  ctx.onTopbar();
  ctx.onRefresh();
  ctx.onSave();
}

function applyThemeBtn(themeKey, ctx) {
  applyTheme(themeKey);
  import('../../services/themeService.js').then(m => m.saveThemePreference(themeKey));
  sfx.click();
  ctx.toast(`Applied: ${THEMES.find(t=>t.key===themeKey)?.label}`, 'gold');
}

function toggleMove(moveId, ctx) {
  const lvl = getLevel(ctx.gameState.xp);
  const pool = (MOVES_BY_TYPE[ctx.gameState.monsterType] || MOVES_BY_TYPE.hybrid).filter(m => m.levelReq <= lvl);
  let eq = ctx.gameState.equippedMoves && ctx.gameState.equippedMoves.length
    ? ctx.gameState.equippedMoves.slice(0, 4)
    : pool.slice(0, 4).map(m => m.id);
  if (eq.includes(moveId)) {
    if (eq.length <= 1) { sfx.error(); ctx.toast('Need at least 1 equipped', 'red'); return; }
    eq = eq.filter(x => x !== moveId);
  } else {
    if (eq.length >= 4) { sfx.error(); ctx.toast('Already 4 equipped', 'red'); return; }
    eq.push(moveId);
  }
  ctx.gameState.equippedMoves = eq;
  sfx.tap();
  ctx.onRefresh(false);
  ctx.onSave();
}

// ── Exported tab API ──────────────────────────────────────────

export function renderShopTab(ctx) {
  const section = ctx.getShopSection();
  return `
    <section class="tab-pane shop-tab">
      <div class="card shop-currency-banner">
        <div class="card-title">Cannagotchi Shop</div>
        <div class="dim small">
          Everything here is paid for with <b>in-game currency only</b>:
          🪙 Buds (earned from picks, idle, battles) and 🌱 Seeds (earned from
          quests, evolutions, bosses, prestige). <b>No real money — ever.</b>
        </div>
      </div>

      <nav class="shop-subtabs">
        <button class="shop-subtab ${section==='care'?'active':''}"      data-shop-tab="care">🌿 Care</button>
        <button class="shop-subtab ${section==='cosmetics'?'active':''}" data-shop-tab="cosmetics">🎩 Cosmetics</button>
        <button class="shop-subtab ${section==='themes'?'active':''}"    data-shop-tab="themes">🎨 Themes</button>
      </nav>

      <div id="shop-section-body">
        ${section === 'care'      ? renderShopCare(ctx)
         : section === 'cosmetics' ? renderShopCosmetics(ctx)
         :                           renderShopThemes(ctx)}
      </div>
    </section>
  `;
}

export function wireShopTab(body, ctx) {
  // Sub-tab switching
  body.querySelectorAll('[data-shop-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      ctx.setShopSection(btn.dataset.shopTab);
      sfx.click();
      ctx.onRefresh(false);
    });
  });
  // Care
  body.querySelectorAll('[data-buy]').forEach(btn => {
    btn.addEventListener('click', () => buyItem(btn.dataset.buy, ctx));
  });
  body.querySelectorAll('[data-upgrade]').forEach(btn => {
    btn.addEventListener('click', () => ctx.buyUpgrade(btn.dataset.upgrade));
  });
  body.querySelectorAll('[data-toggle-move]').forEach(btn => {
    btn.addEventListener('click', () => toggleMove(btn.dataset.toggleMove, ctx));
  });
  // Cosmetics
  body.querySelectorAll('[data-buy-cos]').forEach(btn => {
    btn.addEventListener('click', () => buyCosmeticBtn(btn.dataset.buyCos, ctx));
  });
  body.querySelectorAll('[data-equip]').forEach(btn => {
    btn.addEventListener('click', () => equipCosmeticBtn(btn.dataset.equip, ctx));
  });
  // Themes
  body.querySelectorAll('[data-buy-theme]').forEach(btn => {
    btn.addEventListener('click', () => buyThemeBtn(btn.dataset.buyTheme, ctx));
  });
  body.querySelectorAll('[data-apply-theme]').forEach(btn => {
    btn.addEventListener('click', () => applyThemeBtn(btn.dataset.applyTheme, ctx));
  });
}
