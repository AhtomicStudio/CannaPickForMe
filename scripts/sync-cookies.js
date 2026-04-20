// Cross-references Cookies Hayward menu against strains.json
// Outputs: existing strains to badge + new strains to add

const strains = require('../src/data/strains.json');

const cookiesRaw = [
  "06 OG","24K","Alien OG","Atomic Apple","Biscotti","Black Orchid","Blackberry Caviar",
  "Blackberry Kush","Blue Cookies","Blueberry Haze","Brain Wash","Bubba Kush","Cereal Milk",
  "Cheetah Piss","Cherry Pie","Chrome","Cinnamon Milk","Cobra Chi","Cream OG","Dark Web",
  "Durban Poison","Frostbite","Fruit Juice","Gelato 33","Gelato 41","Gelatti","Ghost OG",
  "Girl Scout Cookies","GMO Cookies","Guava","Gush Mintz","Headbanger","Hollywood",
  "Horchata","Jack Herer","Jealousy","King Louis XIII","Krypto Chronic","LCG",
  "Lemon Cherry Gelato","Lemon Diesel","Lemon Freeze Pop","Lemon Fruz","London Pound Cake #75",
  "Mars OG","Mule Fuel","Nameless OG","Nightshade","OG Kush","Orange Sunset","Original Glue",
  "Papaya","Peanut Butter Breath","Permanent Fumes","Permanent Marker","Pink Lemon x Tropaya",
  "Pink Lemonade","Purple Chemdawg","Rainbow Runtz","SFV OG","Scotties Cake","Slumberjack",
  "Smacks","Sour Cherry Pie","Sour Diesel","Strawberry Cough","Strawberry Guava","Strawnana",
  "Sugar Cane","Super Boof","Super Lemon Haze","Tequila Sunrise","Thai OG","The Gruntz",
  "Tropical Zkittlez","UFOreoz","Watermelon Z","Wedding Cake","Wedding Crasher","XXX Runtz",
  "Yellow Diamonds","Z-Pie","Zootopia x Thin Mintz","Zowahh","Gaslato","Gascotti",
  "Jack Z","LCG x Biscotti","LCG x Z","Oak-Lato","Pandora's Box","Pebble Beach",
  "Purple Punch","Space Face","Super Runtz x GM","Sweet Retreat #8","Sweetiez",
  "Trop Cherry","Wave Runner","Wavvyland","Z Animal #10","Zelium","Zion OG",
];

const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const existingMap = new Map(strains.map(s => [normalize(s.name), s.name]));

const toBadge = [];
const toAdd = [];

for (const name of cookiesRaw) {
  const key = normalize(name);
  if (existingMap.has(key)) {
    toBadge.push(existingMap.get(key));
  } else {
    // check partial match
    const partial = strains.find(s =>
      normalize(s.name).includes(key) || key.includes(normalize(s.name))
    );
    if (partial) {
      toAdd.push({ name, note: `possible match: ${partial.name}` });
    } else {
      toAdd.push({ name });
    }
  }
}

console.log(`\n=== BADGE EXISTING (${toBadge.length}) ===`);
tobadge: toBadge.forEach(n => console.log(' +', n));

console.log(`\n=== ADD NEW (${toAdd.length}) ===`);
toAdd.forEach(n => console.log(' >', n.name, n.note ? `[${n.note}]` : ''));
