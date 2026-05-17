import { makeWildEncounter, makeBossEncounter, nextAvailableBoss, BOSSES } from '../encounters.js';
import { getLevel } from '../gameEngine.js';
import { reportQuestProgress } from '../quests.js';
import { checkAchievements } from '../achievements.js';
import { sfx } from '../sfx.js';
import { track } from '@vercel/analytics';

function renderBattleArena(_ctx) {
  // Placeholder while battleScreen takes over the body.
  return `<section class="tab-pane"><div class="dim">Loading arena…</div></section>`;
}

function wireBattleArena(_body, _ctx) { /* battleScreen owns interactions */ }

function onBattleResolved(result, meta, ctx) {
  // result: { won, encounter, expEarned, budsEarned, seedsEarned }
  try { track('battle_finished', { won: !!result.won, kind: meta?.kind || 'wild', bossId: meta?.bossId || null }); } catch (_) {}
  if (result.won) {
    ctx.gameState.wins = (ctx.gameState.wins || 0) + 1;
    if (meta.kind === 'boss' && meta.bossId) {
      if (!ctx.gameState.battle) ctx.gameState.battle = { currentArenaTier: 1, bossesDefeated: [] };
      if (!ctx.gameState.battle.bossesDefeated) ctx.gameState.battle.bossesDefeated = [];
      const arr = ctx.gameState.battle.bossesDefeated;
      if (!arr.includes(meta.bossId)) arr.push(meta.bossId);
    }
    ctx.applyXP(result.expEarned, '⚔️', 'battle', /*silent=*/ true);
    ctx.giveBuds(result.budsEarned, 'battle');
    if (result.seedsEarned) {
      ctx.gameState.seeds = (ctx.gameState.seeds || 0) + result.seedsEarned;
      ctx.toast(`🌱 +${result.seedsEarned} Seeds`, 'gold');
    }
    sfx.victory();
    reportQuestProgress(ctx.gameState, 'win_battle', 1);
  } else {
    ctx.gameState.losses = (ctx.gameState.losses || 0) + 1;
    sfx.defeat();
  }
  ctx.setBattleSession(null);
  checkAchievements(ctx.gameState);
  ctx.onSave();
  ctx.onRefresh(true);
}

export function startBattle(encounter, meta, ctx) {
  // Lazy-import the battle UI
  import('../battleScreen.js').then(mod => {
    ctx.setBattleSession({ encounter, meta });
    ctx.onRefresh(true);
    mod.mountBattle({
      container: ctx.container.querySelector('#game-tab-body'),
      gameState: ctx.gameState,
      encounter,
      meta,
      onResolve: (result) => onBattleResolved(result, meta, ctx),
    });
  });
}

export function renderBattleTab(ctx) {
  if (ctx.getBattleSession()) return renderBattleArena(ctx);
  const lvl = getLevel(ctx.gameState.xp);
  const nextBoss = nextAvailableBoss(ctx.gameState);
  const winsTotal = ctx.gameState.wins || 0;

  return `
    <section class="tab-pane battle-tab">
      <div class="card">
        <div class="card-title">Wild Encounters</div>
        <div class="dim small">Brawl with random Cannabuds in your level range. Quick fights, light rewards.</div>
        <button class="btn-juicy big" id="btn-find-fight">⚡ Find a Fight</button>
      </div>

      <div class="card">
        <div class="card-title">Boss Arena</div>
        ${nextBoss ? `
          <div class="boss-card">
            <div class="boss-card__title">${nextBoss.name}</div>
            <div class="boss-card__flavor dim small">${nextBoss.flavor}</div>
            <div class="dim small">Type: ${nextBoss.type} · Required Lv. ${nextBoss.minPlayerLevel}</div>
            <button class="btn-juicy big danger" id="btn-fight-boss" ${lvl < nextBoss.minPlayerLevel ? 'disabled':''}>
              ${lvl < nextBoss.minPlayerLevel ? `🔒 Reach Lv.${nextBoss.minPlayerLevel}` : `⚔️ Challenge ${nextBoss.name}`}
            </button>
          </div>` : `<div class="dim">All current bosses defeated. New ones unlock as you level.</div>`}
      </div>

      <div class="card">
        <div class="card-title">Record</div>
        <div class="dim">🏆 ${winsTotal} W / ${ctx.gameState.losses || 0} L</div>
        <div class="dim small">Bosses defeated: ${(ctx.gameState.battle?.bossesDefeated?.length) || 0} / ${BOSSES.length}</div>
      </div>
    </section>
  `;
}

export function wireBattleTab(body, ctx) {
  if (ctx.getBattleSession()) return wireBattleArena(body, ctx);
  body.querySelector('#btn-find-fight')?.addEventListener('click', () => {
    sfx.encounter();
    startBattle(makeWildEncounter(getLevel(ctx.gameState.xp)), { kind: 'wild' }, ctx);
  });
  body.querySelector('#btn-fight-boss')?.addEventListener('click', () => {
    const boss = nextAvailableBoss(ctx.gameState);
    if (!boss) return;
    sfx.encounter();
    startBattle(makeBossEncounter(boss, getLevel(ctx.gameState.xp)), { kind: 'boss', bossId: boss.id }, ctx);
  });
}
