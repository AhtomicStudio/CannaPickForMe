import {
  ACHIEVEMENTS, checkAchievements,
} from '../achievements.js';
import { ensureDaily, claimQuest } from '../quests.js';
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
  plotIsEmpty,
} from '../plots.js';
import {
  canBreed, isBreeding, isOffspringReady, getBreedingProgress,
  collectLivingBuds, startBreeding, skipBreedingWithSeeds,
  claimOffspring, cancelBreeding,
} from '../breeding.js';
import { MONSTER_TYPES, getVariant } from '../monsters.js';
import { renderSprite } from '../pixelArt.js';
import { sfx } from '../sfx.js';
import { track } from '@vercel/analytics';

function formatDateShort(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getMonth()+1}/${d.getDate()}`;
}

function renderLoginStreakCard(ctx) {
  const day = ctx.gameState.loginStreak?.day || 0;
  return `
    <div class="card">
      <div class="card-title">Daily Streak <span class="dim small">Day ${day} / 7</span></div>
      <div class="streak-row">
        ${STREAK_REWARDS.map(r => {
          const reached = r.day <= day;
          const today   = r.day === day;
          return `
            <div class="streak-cell ${reached ? 'reached' : ''} ${today ? 'today' : ''}" title="${r.label}">
              <div class="streak-cell__day">D${r.day}</div>
              <div class="streak-cell__reward">${r.kind === 'hat' ? '🎁' : r.kind === 'xp' ? '⚡' : r.kind === 'buds' ? '🪙' : '🌱'}</div>
            </div>`;
        }).join('')}
      </div>
      <div class="dim small" style="margin-top:0.4rem">Show up daily to climb the chain. Cycle resets on Day 7 — hat next round.</div>
    </div>`;
}

function renderBreedingCard(ctx) {
  // Active gestation in progress?
  if (isBreeding(ctx.gameState)) {
    const a = ctx.gameState.breeding.active;
    const prog = getBreedingProgress(ctx.gameState);
    const ready = isOffspringReady(ctx.gameState);
    const msLeft = prog?.msLeft || 0;
    const hh = Math.floor(msLeft / 3600000);
    const mm = Math.floor((msLeft % 3600000) / 60000);
    const offType = MONSTER_TYPES[a.offspring.type];
    return `
      <div class="card breed-card">
        <div class="card-title">🧬 Breeding Lab ${a.offspring.mythic ? '<span class="mythic-tag">✨ MYTHIC</span>' : ''}</div>
        <div class="dim small">${a.parentA.name} × ${a.parentB.name}</div>
        <div class="breed-progress">
          <div class="breed-progress__bar"><div class="breed-progress__fill" style="width:${(prog.pct*100).toFixed(1)}%"></div></div>
          <div class="dim small">${ready ? '🎉 Offspring ready!' : `${hh}h ${mm}m remaining`}</div>
        </div>
        <div class="breed-preview">
          <div class="dim small">Preview: ${offType?.emoji || ''} <b>${a.offspring.name}</b> — ${offType?.name || ''} · ${a.offspring.variant}</div>
        </div>
        <div class="breed-actions">
          ${ready
            ? `<button class="btn-juicy" id="breed-claim">🎁 Claim Offspring</button>`
            : `<button class="btn-juicy compact" id="breed-skip">⏩ Skip (5 🌱)</button>
               <button class="btn-juicy compact danger" id="breed-cancel">Cancel</button>`}
        </div>
      </div>`;
  }

  // Empty state — can the player breed?
  const eligible = collectLivingBuds(ctx.gameState).filter(b => b.level >= 15);
  if (eligible.length < 2) {
    return `
      <div class="card breed-card">
        <div class="card-title">🧬 Breeding Lab</div>
        <div class="dim small">Cross two of your Cannabuds (both Lv.15+) into an offspring with mixed traits. <b>5% chance for a Mythic mutation.</b></div>
        <div class="dim small" style="margin-top:0.4rem">You need at least <b>2 buds at Lv.15+</b>. ${eligible.length}/2 ready.</div>
      </div>`;
  }

  // Eligible — show parent picker
  return `
    <div class="card breed-card">
      <div class="card-title">🧬 Breeding Lab</div>
      <div class="dim small">Pick two parents — both must be Lv.15+. Gestation is 24 hours. Offspring inherits a mix of traits, with a <b>5% chance to mutate</b> into a Mythic trait that's only obtainable here.</div>
      <div class="breed-parents">
        ${eligible.map(b => `
          <label class="breed-parent">
            <input type="checkbox" data-breed-parent="${b.plotId}" />
            <span class="breed-parent__name">${MONSTER_TYPES[b.type]?.emoji || ''} ${b.name}</span>
            <span class="dim small">Lv.${b.level} · ${b.type}</span>
          </label>`).join('')}
      </div>
      <button class="btn-juicy" id="breed-start" disabled>🧬 Start Breeding</button>
    </div>`;
}

function renderTitlesCard(ctx) {
  const earned = listEarnedTitles(ctx.gameState);
  const eq = getEquippedTitle(ctx.gameState);
  if (earned.length === 0) {
    return `
      <div class="card">
        <div class="card-title">Titles</div>
        <div class="dim small">Earn epithets through play. They display next to your Cannabud's name.</div>
      </div>`;
  }
  return `
    <div class="card">
      <div class="card-title">Titles <span class="dim small">${earned.length} earned</span></div>
      <div class="titles-grid">
        ${earned.map(t => `
          <button class="title-chip ${eq?.id === t.id ? 'eq' : ''}" data-title="${t.id}">${t.label}</button>
        `).join('')}
        <button class="title-chip ${eq == null ? 'eq' : ''}" data-title="">∅ None</button>
      </div>
    </div>`;
}

function renderMemoriesCard(ctx) {
  const mems = ctx.gameState.memories || [];
  if (mems.length === 0) {
    return `
      <div class="card">
        <div class="card-title">Memory Wall</div>
        <div class="dim small">Milestones with your Cannabud will appear here.</div>
      </div>`;
  }
  return `
    <div class="card">
      <div class="card-title">Memory Wall</div>
      <div class="memories-row">
        ${mems.slice(0, 8).map(m => `
          <div class="mem-card">
            <div class="mem-card__sprite" data-sprite="${m.sprite || ''}"></div>
            <div class="mem-card__caption">${m.caption || ''}</div>
            <div class="dim small">${formatDateShort(m.ts)}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

function renderStrainDexCard(ctx) {
  const discovered = new Set(ctx.gameState.lifetime?.strainsDiscovered || []);
  const bossesBeat = new Set(ctx.gameState.battle?.bossesDefeated || []);
  return `
    <div class="card">
      <div class="card-title">Strain Dex <span class="dim small">${discovered.size} strains · ${bossesBeat.size} bosses</span></div>
      <div class="dim small">Discover strains via Pick For Me; defeat bosses in the Battle tab.</div>
      <div class="dex-strip">
        <div class="dex-pill">🎯 ${discovered.size} <span class="dim small">strains found</span></div>
        <div class="dex-pill">⚔️ ${bossesBeat.size} <span class="dim small">bosses defeated</span></div>
        <div class="dex-pill">🏆 ${Object.keys(ctx.gameState.achievements || {}).length} <span class="dim small">trophies</span></div>
      </div>
    </div>`;
}

function claimAndPlantOffspring(ctx) {
  if (!isOffspringReady(ctx.gameState)) return;
  const offspring = claimOffspring(ctx.gameState);
  if (!offspring) return;
  sfx.evolution();

  // Memory wall entry
  if (!ctx.gameState.memories) ctx.gameState.memories = [];
  ctx.gameState.memories.unshift({
    ts: Date.now(),
    kind: 'breed',
    sprite: `${offspring.type}_seed`,
    caption: `${offspring.name} hatched! ${offspring.mythic ? '✨ MYTHIC trait!' : ''}`.trim(),
  });
  ctx.gameState.memories = ctx.gameState.memories.slice(0, 30);

  // Find an empty UNLOCKED plot, or prompt to unlock+plant
  const emptySlot = PLOT_IDS.find(pid => plotIsEmpty(ctx.gameState, pid));
  if (emptySlot) {
    const planted = plantBudInEmptyPlot(ctx.gameState, emptySlot, {
      monsterType:    offspring.type,
      monsterVariant: offspring.variant,
      monsterName:    offspring.name,
    });
    if (planted) {
      // Override the rolled trait with the inherited one
      ctx.gameState.trait = offspring.trait;
      snapshotActiveTo(ctx.gameState, getActivePlotId(ctx.gameState));
    }
    ctx.toast(`🎁 ${offspring.name} planted in ${PLOT_LABELS[emptySlot]}!`, 'gold', 3500);
    ctx.onShell();
    ctx.onSwitchTab('garden');
    import('../companion.js').then(m => m.initCompanion(ctx.uid)).catch(() => {});
    ctx.onSave();
    return;
  }

  // No empty plots — keep the offspring as a "pending" entry for now
  if (!ctx.gameState.pendingOffspring) ctx.gameState.pendingOffspring = [];
  ctx.gameState.pendingOffspring.push(offspring);
  ctx.toast(`🎁 ${offspring.name} ready, but no empty plots! Unlock a plot to plant.`, 'gold', 4000);
  ctx.onRefresh();
  ctx.onSave();
}

export function renderQuestsTab(ctx) {
  ensureDaily(ctx.gameState);
  const dailies = ctx.gameState.quests.daily || [];
  const totalAch = ACHIEVEMENTS.length;
  const haveAch  = Object.keys(ctx.gameState.achievements || {}).length;
  const showPrestige = canPrestige(ctx.gameState);

  return `
    <section class="tab-pane quests-tab">
      <div class="card">
        <div class="card-title">Today's Quests <span class="dim small">streak: ${ctx.gameState.quests.dailyStreak || 0}🔥</span></div>
        ${dailies.map(q => {
          const pct = Math.min(100, (q.progress / q.target) * 100);
          const done = q.progress >= q.target;
          return `
            <div class="quest-row ${done ? 'quest-row--done' : ''}">
              <span class="quest-row__emoji">${q.emoji}</span>
              <div class="quest-row__info">
                <div class="quest-row__name">
                  ${q.name}
                  ${q.howTo ? `<button class="quest-info-btn" data-quest-info="${q.id}" aria-label="How to complete">?</button>` : ''}
                </div>
                <div class="quest-row__bar"><div class="quest-row__fill" style="width:${pct}%"></div></div>
                <div class="dim small">${q.progress}/${q.target} · ${q.howTo || ''}</div>
              </div>
              ${q.claimed ? `<span class="dim small">✅ Claimed</span>`
                : done ? `<button class="btn-juicy compact" data-claim="${q.id}">Claim 🪙30 ⚡30</button>`
                : `<span class="dim small">…</span>`}
            </div>`;
        }).join('')}
        ${dailies.every(q => q.claimed) ? `
          <div class="dim small" style="margin-top:0.5rem">All cleared today! 🌟 Bonus +1 Seed claimed.</div>
        ` : ''}
      </div>

      ${renderLoginStreakCard(ctx)}

      ${renderBreedingCard(ctx)}

      ${renderTitlesCard(ctx)}

      ${renderMemoriesCard(ctx)}

      ${renderStrainDexCard(ctx)}

      <div class="card">
        <div class="card-title">Trophies <span class="dim small">${haveAch}/${totalAch}</span></div>
        <div class="achievement-grid">
          ${ACHIEVEMENTS.map(a => {
            const got = !!ctx.gameState.achievements?.[a.id];
            const prog = !got && a.progress ? a.progress(ctx.gameState) : null;
            const pct  = prog ? Math.min(100, (prog.current / prog.target) * 100) : 0;
            return `
              <div class="ach-card ${got ? 'ach-card--unlocked' : ''}" title="${a.desc}">
                <div class="ach-card__title">${got ? '🏆' : '🔒'} ${a.name}</div>
                <div class="dim small">${a.desc}</div>
                <div class="dim small">${a.budReward ? '+'+a.budReward+'🪙' : ''} ${a.seedReward ? '+'+a.seedReward+'🌱' : ''}</div>
                ${prog ? `
                  <div class="ach-progress">
                    <div class="ach-progress__bar"><div class="ach-progress__fill" style="width:${pct}%"></div></div>
                    <div class="ach-progress__text dim small">${prog.current} / ${prog.target}</div>
                  </div>` : ''}
              </div>`;
          }).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-title">Prestige</div>
        ${showPrestige ? `
          <div class="dim small">Harvest your Cannabud to gain permanent multipliers and ${previewPrestige(ctx.gameState).seedReward} 🌱 Seeds. Resets level/needs/inventory.</div>
          <button class="btn-juicy big" id="btn-prestige">🌟 Harvest & Prestige</button>` : `
          <div class="dim">Reach Lv.${PRESTIGE.UNLOCK_LEVEL} to unlock prestige (Harvest cycle).</div>
          <div class="dim small">Current prestige: Lv.${ctx.gameState.prestige?.count || 0}</div>`}
      </div>
    </section>
  `;
}

export function wireQuestsTab(body, ctx) {
  // Quest help tooltips
  body.querySelectorAll('[data-quest-info]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const qid = btn.dataset.questInfo;
      const q = ctx.gameState.quests?.daily?.find(x => x.id === qid);
      if (q?.howTo) {
        ctx.toast(`${q.emoji} ${q.name} — ${q.howTo}`, 'gold', 4500);
      }
    });
  });

  // Render any sprite placeholders in memories
  body.querySelectorAll('.mem-card__sprite').forEach(el => {
    const name = el.dataset.sprite;
    if (name) {
      const variant = getVariant(ctx.gameState.monsterType, ctx.gameState.monsterVariant || 'classic');
      renderSprite(el, name, 4, { paletteRemap: variant?.paletteRemap });
    }
  });
  // Title picker
  body.querySelectorAll('[data-title]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.title || null;
      equipTitle(ctx.gameState, id);
      sfx.tap();
      ctx.onRefresh(false);
      ctx.onTopbar();
      ctx.onSave();
    });
  });

  // Breeding parent picker — enable Start when exactly 2 are checked
  const breedChecks = body.querySelectorAll('[data-breed-parent]');
  const breedStart = body.querySelector('#breed-start');
  if (breedChecks.length && breedStart) {
    const updateState = () => {
      const checked = [...breedChecks].filter(c => c.checked);
      // Cap to 2: if user picks a third, untick the oldest
      if (checked.length > 2) {
        checked[0].checked = false;
      }
      breedStart.disabled = body.querySelectorAll('[data-breed-parent]:checked').length !== 2;
    };
    breedChecks.forEach(c => c.addEventListener('change', updateState));
    breedStart.addEventListener('click', () => {
      const picks = [...body.querySelectorAll('[data-breed-parent]:checked')];
      if (picks.length !== 2) return;
      const r = startBreeding(ctx.gameState, picks[0].dataset.breedParent, picks[1].dataset.breedParent);
      if (!r.ok) {
        sfx.error();
        ctx.toast(r.reason === 'already' ? 'Already breeding' : r.reason === 'too_young' ? 'Both parents need Lv.15+' : 'Cannot start', 'red');
        return;
      }
      sfx.evolution();
      try { track('breeding_started', { mythic: !!r.offspring.mythic, type: r.offspring.type, variant: r.offspring.variant }); } catch (_) {}
      ctx.toast(`🧬 Breeding started — 24h until ${r.offspring.name}!${r.offspring.mythic ? ' ✨ MYTHIC!' : ''}`, 'gold', 3500);
      ctx.onRefresh();
      ctx.onSave();
    });
  }
  // Skip / Cancel breeding
  body.querySelector('#breed-skip')?.addEventListener('click', () => {
    const r = skipBreedingWithSeeds(ctx.gameState, 5);
    if (!r.ok) { sfx.error(); ctx.toast(r.reason === 'broke' ? 'Need 5 🌱 Seeds' : 'Cannot skip', 'red'); return; }
    sfx.buy();
    ctx.onRefresh();
    ctx.onTopbar();
    ctx.onSave();
  });
  body.querySelector('#breed-cancel')?.addEventListener('click', () => {
    if (!confirm('Cancel breeding? No refund.')) return;
    cancelBreeding(ctx.gameState);
    sfx.click();
    ctx.onRefresh();
    ctx.onSave();
  });
  // Claim offspring
  body.querySelector('#breed-claim')?.addEventListener('click', () => claimAndPlantOffspring(ctx));
  body.querySelectorAll('[data-claim]').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = claimQuest(ctx.gameState, btn.dataset.claim);
      if (!r) { sfx.error(); return; }
      sfx.questDone();
      ctx.toast(`+${r.buds}🪙 +${r.xp}⚡${r.bonusSeed ? ` +${r.bonusSeed}🌱 BONUS!` : ''}`, 'gold');
      checkAchievements(ctx.gameState);
      ctx.onRefresh();
      ctx.onSave();
    });
  });

  body.querySelector('#btn-prestige')?.addEventListener('click', () => {
    if (!canPrestige(ctx.gameState)) return;
    const preview = previewPrestige(ctx.gameState);
    if (!confirm(`Harvest your Cannabud for +${preview.seedReward} 🌱 and permanent boosts? (Resets level, needs, inventory.)`)) return;
    doPrestige(ctx.gameState);
    sfx.prestige();
    ctx.toast(`🌟 Prestige ${ctx.gameState.prestige.count}! Seeds banked.`, 'gold', 3500);
    ctx.onRefresh(true); ctx.onTopbar();
    ctx.onSave();
  });
}
