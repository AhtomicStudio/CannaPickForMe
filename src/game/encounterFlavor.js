/**
 * CannaGotchi — Encounter Flavor Lines
 *
 * Tiny copy variety for wild encounters. Random per fight, type-specific.
 * Returned as the *first* line of the battle log (replacing the bland
 * "A wild X appears!" default).
 */

const FLAVOR = {
  indica: [
    'rolls out from behind a kush bush — eyes half-closed.',
    'shows up reeking of grape and pine.',
    'stomps in heavy. The ground actually moves a little.',
    'materializes from a slow-rolling cloud of haze.',
    'unfurls from a couch cushion. Why was there a couch here.',
  ],
  sativa: [
    'streaks in fast — leaves a faint citrus trail.',
    'bounces in vibrating with too much energy.',
    'cartwheels into the arena. Show-off.',
    'shouts "CHALLENGE" before it even arrives.',
    'rises out of a sunbeam looking suspiciously alert.',
  ],
  hybrid: [
    'walks in calmly. Knows exactly what it\'s doing.',
    'splits the difference between scary and friendly.',
    'flickers in like a glitch. Probably crossbred.',
    'arrives carrying tiny binoculars. Has been watching.',
    'phases in. Looks vaguely familiar.',
  ],
};

/** Build a flavorful intro line: "A wild Couch-Locker rolls out from behind..." */
export function flavorLineFor(encounter) {
  if (!encounter) return 'A wild Cannabud appears!';
  if (encounter.isBoss) {
    // Bosses get a dedicated dramatic intro
    return `⚠️ ${encounter.name} blocks your path. ${encounter.flavor || ''}`.trim();
  }
  const pool = FLAVOR[encounter.type] || FLAVOR.hybrid;
  const line = pool[Math.floor(Math.random() * pool.length)];
  return `A wild ${encounter.name} ${line}`;
}
