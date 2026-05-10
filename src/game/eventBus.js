/**
 * CannaGotchi — Event Bus
 * Tiny pub/sub so engines, UI, quests, achievements, and SFX can talk
 * without circular imports.
 *
 * Standard events:
 *   game:xp-gained         { amount, source }
 *   game:level-up          { from, to }
 *   game:evolved           { evolution }
 *   game:buds-changed      { amount, total, source }
 *   game:seeds-changed     { amount, total, source }
 *   game:trichomes-changed { amount, total, source }
 *   game:need-changed      { key, value }
 *   game:item-used         { itemId }
 *   game:item-bought       { itemId, qty }
 *   game:battle-start      { encounter }
 *   game:battle-end        { won, encounter, rewards }
 *   game:quest-progress    { questId, progress, target }
 *   game:quest-complete    { questId }
 *   game:quest-claimed     { questId }
 *   game:achievement       { id, def }
 *   game:prestige          { count }
 *   game:tick              { now } — once a second while open
 */

const _listeners = new Map();

export function on(event, fn) {
  if (!_listeners.has(event)) _listeners.set(event, new Set());
  _listeners.get(event).add(fn);
  return () => off(event, fn);
}

export function off(event, fn) {
  _listeners.get(event)?.delete(fn);
}

export function emit(event, payload) {
  const set = _listeners.get(event);
  if (!set) return;
  for (const fn of set) {
    try { fn(payload); }
    catch (err) { console.error(`[eventBus] handler for ${event} threw`, err); }
  }
}

export function clearAll() {
  _listeners.clear();
}
