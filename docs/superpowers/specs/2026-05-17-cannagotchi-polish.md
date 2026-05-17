# Cannagotchi Polish Pass — Design Spec
**Date:** 2026-05-17
**Scope:** Three targeted improvements to the Cannagotchi feature: file split, battle AI scaling, prestige badge

---

## Problem Statement

Three quality issues identified after the Cannagotchi feature shipped:

1. `gameScreen.js` has grown to ~2100 lines (91KB) — too large to maintain comfortably as features are added
2. Battle AI uses the same simple heuristic regardless of player level, making encounters feel flat for veteran players
3. The prestige strip in the garden tab only surfaces the XP multiplier; the bud earn and stat buff multipliers are invisible during normal play

---

## Section 1 — `gameScreen.js` File Split

### Goal
Reduce `gameScreen.js` to a thin coordinator (~200 lines). Each tab's render and wire logic moves into its own file.

### New File Structure

```
src/game/
  gameScreen.js          (coordinator — state, topbar, tab switching, idle loop, event bus)
  tabs/
    tabGarden.js         (renderGardenTab, wireGardenTab)
    tabBattle.js         (renderBattleTab, wireBattleTab)
    tabShop.js           (renderShopTab, wireShopTab)
    tabQuests.js         (renderQuestsTab, wireQuestsTab)
    tabVersus.js         (renderVersusTab, wireVersusTab)
```

### Context Object Pattern

Tab files receive shared state via a context object argument — no module-level globals inside tab files. `gameScreen.js` owns all state and passes exactly what each tab needs:

```js
// gameScreen.js calls:
renderGardenTab(container, {
  gameState: _gameState,
  uid: _uid,
  onSave: debouncedSave,
  onStateChange: syncTopbar,
  sfx,
  emit,
});
```

Each tab file exports exactly two functions:

```js
// tabs/tabGarden.js
export function renderGardenTab(container, ctx) { ... }
export function wireGardenTab(container, ctx) { ... }
```

### What Stays in `gameScreen.js`

- All module-level state variables (`_gameState`, `_uid`, `_activeTab`, `_battleSession`, `_versusSession`, etc.)
- `switchTab()` and `refreshActiveTab()`
- `syncTopbar()`
- The idle tick loop
- Event bus listener registration/cleanup
- `initGameScreen()` entry point
- `debouncedSave()`

### What Moves Out

| Function | Destination |
|---|---|
| `renderGardenTab` + `wireGardenTab` | `tabs/tabGarden.js` |
| `renderBattleTab` + `wireBattleTab` | `tabs/tabBattle.js` |
| `renderShopTab` + `wireShopTab` | `tabs/tabShop.js` |
| `renderQuestsTab` + `wireQuestsTab` | `tabs/tabQuests.js` |
| `renderVersusTab` + `wireVersusTab` | `tabs/tabVersus.js` |

### Constraints
- No behavior changes — pure refactor
- No new abstractions beyond the context object pattern
- Import graph must not create circular dependencies (`gameScreen.js` imports tab files; tab files never import `gameScreen.js`)

---

## Section 2 — Battle AI Difficulty Scaling

### Goal
Make encounters feel progressively harder as players level up — both through smarter AI decision-making and slightly stronger enemy stats.

### AI Tier System

**File:** `src/game/battle.js`

New helper added to `battle.js`:

```js
function getAITier(playerLevel) {
  if (playerLevel >= 31) return 'advanced';
  if (playerLevel >= 16) return 'intermediate';
  return 'basic';
}
```

`pickAIAction(state, side)` receives the player's level and selects behavior by tier.

### Tier Behaviors

**Basic (Lv1–15) — unchanged**
- Heal if HP < 35% max (70% chance)
- Buff if no active buffs (35% chance)
- Otherwise pick highest expected-damage move

**Intermediate (Lv16–30)**
- Heal threshold raised to < 50% HP
- Responds to player buffs: if player used `atk_up` last turn, AI uses `def_up` if available
- 20% chance to pick the second-highest damage move (unpredictability)
- Otherwise highest expected-damage move

**Advanced (Lv31+)**
- Heal threshold raised to < 60% HP
- Counters player's last move: if player buffed → AI attacks; if player healed → AI uses highest-damage move
- Applies available debuff moves when player HP > 70%
- Picks moves weighted by opponent's stat weaknesses (ATK vs DEF ratio)

### Enemy Stat Scaling (Wild Encounters Only)

A flat stat multiplier applied to wild encounter base stats, scaling with player level. Bosses are unaffected (they already have fixed bonuses).

```js
// In makeWildEncounter() — encounters.js
const statBonus = 1 + Math.min(Math.floor(playerLevel / 10), 5) * 0.05;
// Lv.1–9:  ×1.00  (no bonus)
// Lv.10–19: ×1.05  (+5%)
// Lv.20–29: ×1.10  (+10%)
// Lv.30–39: ×1.15  (+15%)
// Lv.40–49: ×1.20  (+20%)
// Lv.50+:   ×1.25  (+25%, capped)
```

Applied to HP, ATK, DEF, SPD after base stat derivation.

### Files Changed
- `src/game/battle.js` — `getAITier()` helper, updated `pickAIAction()`
- `src/game/encounters.js` — `statBonus` multiplier in `makeWildEncounter()`

---

## Section 3 — Prestige Multiplier Display

### Goal
Surface all three prestige multipliers in the garden tab so players understand the full value of their prestige investment.

### Current State
The prestige strip shows one line: `"Prestige Lv.2 · 20% XP boost"`

### New State
Two-line display:

```
✦ Prestige Lv.2
+20% XP  ·  +24% Buds  ·  +10% Stats
```

- Strip is **hidden** when `prestige.count === 0` (no prestige achieved yet — no clutter for new players)
- Strip **appears** once player reaches Prestige 1 and persists
- Values calculated dynamically from `getPrestigeMultipliers(gameState)` — already returns all three

### Multiplier Display Format

| Multiplier | Formula | Example at Prestige 2 |
|---|---|---|
| XP | `+{(xpMult*100-100).toFixed(0)}% XP` | `+20% XP` |
| Buds | `+{(budMult*100-100).toFixed(0)}% Buds` | `+24% Buds` |
| Stats | `+{(statMult*100-100).toFixed(0)}% Stats` | `+10% Stats` |

### Files Changed
- `src/game/tabs/tabGarden.js` — prestige strip render block (after the Section 1 split)

---

## Files Changed Summary

| File | Change |
|---|---|
| `src/game/gameScreen.js` | Gutted to coordinator; all tab render/wire removed |
| `src/game/tabs/tabGarden.js` | New — garden render + wire + updated prestige strip |
| `src/game/tabs/tabBattle.js` | New — battle render + wire |
| `src/game/tabs/tabShop.js` | New — shop render + wire |
| `src/game/tabs/tabQuests.js` | New — quests render + wire |
| `src/game/tabs/tabVersus.js` | New — versus render + wire |
| `src/game/battle.js` | `getAITier()` + updated `pickAIAction()` |
| `src/game/encounters.js` | `statBonus` multiplier in `makeWildEncounter()` |

---

## Risk Mitigations

| Risk | Mitigation |
|---|---|
| Refactor breaks tab render/wire wiring | No behavior change — pure code move. Test each tab renders and wires correctly after split |
| Context object missing a field a tab needs | Extract context shape from existing implicit dependencies before moving code |
| AI tier breaks existing save states | `getAITier` reads player level at battle time — no save schema change |
| Stat bonus makes early-game enemies too hard | Bonus is 0 until Lv.10; early-game is untouched |
| Prestige strip layout breaks on small screens | Single-line fallback: strip wraps naturally; test at 320px width |

---

## Success Criteria

- `gameScreen.js` is under 250 lines after the split
- Each tab file is independently readable with no implicit dependencies on `gameScreen.js` internals
- A Lv.20 player noticeably encounters smarter AI than a Lv.5 player
- A Lv.35+ player feels AI opponents read their moves, not just react to HP
- Players with prestige ≥ 1 can see all three active multipliers in the garden tab at a glance
- No regressions in any tab, battle flow, or prestige state
