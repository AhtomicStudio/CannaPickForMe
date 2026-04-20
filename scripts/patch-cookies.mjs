import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dir, '../src/data/strains.json');
const strains = JSON.parse(readFileSync(filePath, 'utf8'));

const DISP = 'cookies-hayward';

// === 1. Badge existing strains ===
const toBadge = new Set([
  'Alien OG','Atomic Apple','Biscotti','Blackberry Caviar','Bubba Kush','Cereal Milk',
  'Cheetah Piss','Cherry Pie','Chrome','Cinnamon Milk','Durban Poison','Gelato 41',
  'Girl Scout Cookies','GMO Cookies','Hollywood','Jack Herer','Jealousy','King Louis XIII',
  'Lemon Cherry Gelato','Lemon Fruz','London Pound Cake #75','Mars OG','OG Kush','Papaya',
  'Peanut Butter Breath','Permanent Fumes','Pink Lemon x Tropaya','Purple Punch',
  "Scottie's Cake",'Sour Diesel','Strawberry Cough','Super Boof','Super Lemon Haze',
  'Tequila Sunrise','Wedding Cake','Wedding Crasher',
]);

let badged = 0;
for (const s of strains) {
  if (toBadge.has(s.name)) {
    if (!s.dispensaries) s.dispensaries = [];
    if (!s.dispensaries.includes(DISP)) { s.dispensaries.push(DISP); badged++; }
  }
}

// === 2. New strains to add ===
const newStrains = [
  { id:'06-og',           name:'06 OG',              type:'indica',  effects:['Relaxed','Sleepy','Happy','Hungry','Euphoric'],          flavors:['Earthy','Pine','OG'],          description:'A potent OG Kush phenotype with deep earthy tones and heavy sedating effects.',rating:4.3},
  { id:'24k',             name:'24K',                type:'hybrid',  effects:['Happy','Euphoric','Relaxed','Uplifted','Creative'],       flavors:['Sweet','Citrus','Earthy'],      description:'24K Gold — a smooth hybrid known for its gilded, uplifting buzz and sweet finish.',rating:4.4},
  { id:'black-orchid',    name:'Black Orchid',        type:'indica',  effects:['Relaxed','Sleepy','Euphoric','Happy','Body High'],        flavors:['Floral','Sweet','Earthy'],      description:'A dark, floral indica with a heavy body effect and luxurious berry notes.',rating:4.3},
  { id:'blackberry-kush', name:'Blackberry Kush',     type:'indica',  effects:['Relaxed','Sleepy','Happy','Euphoric','Pain Relief'],     flavors:['Berry','Sweet','Earthy'],       description:'A potent indica cross of Blackberry and OG Kush delivering rich berry flavor and full-body relief.',rating:4.5},
  { id:'blue-cookies',    name:'Blue Cookies',        type:'hybrid',  effects:['Euphoric','Relaxed','Happy','Creative','Uplifted'],       flavors:['Sweet','Berry','Vanilla'],      description:'A cross of Girl Scout Cookies and Blueberry bringing a sweet, cerebral hybrid experience.',rating:4.5},
  { id:'blueberry-haze',  name:'Blueberry Haze',      type:'sativa',  effects:['Uplifted','Happy','Creative','Energetic','Euphoric'],    flavors:['Blueberry','Sweet','Haze'],     description:'A vibrant sativa combining Blueberry sweetness with the clear-headed Haze energy.',rating:4.4},
  { id:'brain-wash',      name:'Brain Wash',          type:'hybrid',  effects:['Relaxed','Euphoric','Happy','Focused','Creative'],        flavors:['Earthy','Pine','Citrus'],       description:'A potent hybrid that clears the mental slate with a deeply calming euphoria.',rating:4.4},
  { id:'cobra-chi',       name:'Cobra Chi',           type:'hybrid',  effects:['Happy','Relaxed','Euphoric','Creative','Uplifted'],       flavors:['Tropical','Sweet','Citrus'],    description:'An exotic hybrid cultivar with tropical sweetness and well-balanced effects.',rating:4.3},
  { id:'cream-og',        name:'Cream OG',            type:'indica',  effects:['Relaxed','Sleepy','Happy','Euphoric','Body High'],        flavors:['Creamy','Sweet','OG'],          description:'A creamy indica-leaning OG with rich vanilla tones and heavy relaxing effects.',rating:4.4},
  { id:'dark-web',        name:'Dark Web',            type:'hybrid',  effects:['Relaxed','Euphoric','Focused','Happy','Uplifted'],        flavors:['Diesel','Earthy','Chemical'],   description:'A mysterious hybrid known for its complex fuel-forward profile and intense cerebral buzz.',rating:4.3},
  { id:'frostbite',       name:'Frostbite',           type:'hybrid',  effects:['Relaxed','Euphoric','Happy','Sleepy','Calm'],             flavors:['Cool','Minty','Sweet'],         description:'A frosty hybrid with minty cool notes and a deeply relaxing full-body effect.',rating:4.3},
  { id:'fruit-juice',     name:'Fruit Juice',         type:'sativa',  effects:['Energetic','Happy','Uplifted','Creative','Euphoric'],     flavors:['Tropical','Fruity','Sweet'],    description:'A burst of tropical sativa energy with vibrant fruit notes and an uplifting mood.',rating:4.3},
  { id:'gelatti',         name:'Gelatti',             type:'hybrid',  effects:['Euphoric','Relaxed','Happy','Creative','Uplifted'],       flavors:['Sweet','Creamy','Citrus'],      description:'Gelato × Biscotti — a creamy, dessert hybrid with smooth euphoric effects.',rating:4.6},
  { id:'ghost-og',        name:'Ghost OG',            type:'indica',  effects:['Relaxed','Euphoric','Happy','Sleepy','Pain Relief'],      flavors:['Citrus','OG','Earthy'],         description:'A legendary OG cut with intense citrus and pine aromas and a powerfully sedating body effect.',rating:4.6},
  { id:'horchata',        name:'Horchata',            type:'hybrid',  effects:['Relaxed','Happy','Euphoric','Creative','Focused'],        flavors:['Creamy','Spice','Sweet'],       description:'Mochi Gelato × Jet Fuel Gelato — a smooth, creamy hybrid inspired by the classic drink.',rating:4.7},
  { id:'gush-mintz',      name:'Gush Mintz',          type:'hybrid',  effects:['Euphoric','Relaxed','Happy','Uplifted','Creative'],       flavors:['Mint','Sweet','Fruity'],        description:'Gushers × Kush Mints — a candy-sweet hybrid with a cool minty finish.',rating:4.5},
  { id:'headbanger',      name:'Headbanger',          type:'sativa',  effects:['Energetic','Euphoric','Focused','Happy','Creative'],      flavors:['Diesel','Sour','Earthy'],       description:'Sour Diesel × Biker Kush — a fuel-forward sativa for those who want to turn it up.',rating:4.4},
  { id:'mule-fuel',       name:'Mule Fuel',           type:'indica',  effects:['Relaxed','Sleepy','Euphoric','Happy','Body High'],        flavors:['Diesel','Earthy','Pungent'],    description:'Do-Si-Dos × GMO — a heavy-hitting indica with fuel and earth notes and knockout body effects.',rating:4.6},
  { id:'nightshade',      name:'Nightshade',          type:'indica',  effects:['Sleepy','Relaxed','Euphoric','Happy','Calm'],             flavors:['Earthy','Floral','Berry'],      description:'A deeply sedating indica for end-of-day use, named for its evening blooming characteristics.',rating:4.3},
  { id:'original-glue',   name:'Original Glue',       type:'hybrid',  effects:['Relaxed','Euphoric','Happy','Sleepy','Hungry'],          flavors:['Diesel','Earthy','Pungent'],    description:'The original GG4 formula — a heavy hybrid that glues you to the couch with pungent diesel.',rating:4.7},
  { id:'permanent-marker',name:'Permanent Marker',    type:'hybrid',  effects:['Euphoric','Relaxed','Happy','Creative','Focused'],        flavors:['Sweet','Floral','Citrus'],      description:'Biscotti × Jealousy × Sherbert — a top-shelf hybrid with complex sweet florals.',rating:4.8},
  { id:'sfv-og',          name:'SFV OG',              type:'indica',  effects:['Relaxed','Euphoric','Happy','Sleepy','Body High'],        flavors:['Pine','Earthy','OG'],           description:'San Fernando Valley OG — a classic West Coast indica with pine and lemon OG character.',rating:4.5},
  { id:'strawnana',       name:'Strawnana',            type:'hybrid',  effects:['Happy','Relaxed','Euphoric','Creative','Uplifted'],       flavors:['Strawberry','Banana','Sweet'],  description:'Strawberry Banana — a potent, fruity hybrid with a sweet dessert profile and relaxing effects.',rating:4.6},
  { id:'sugar-cane',      name:'Sugar Cane',          type:'sativa',  effects:['Energetic','Happy','Uplifted','Euphoric','Creative'],     flavors:['Sweet','Tropical','Sugary'],    description:'A sweet tropical sativa with an uplifting, motivating high and candy-like flavor.',rating:4.4},
  { id:'gaslato',         name:'Gaslato',             type:'hybrid',  effects:['Euphoric','Relaxed','Happy','Creative','Uplifted'],       flavors:['Gas','Sweet','Creamy'],         description:'A gassy Gelato cross that balances fuel-forward diesel with sweet creamy notes.',rating:4.5},
  { id:'gascotti',        name:'Gascotti',            type:'hybrid',  effects:['Euphoric','Relaxed','Happy','Focused','Creative'],        flavors:['Gas','Sweet','Earthy'],         description:'Gas × Biscotti — a fuel and dessert hybrid with potent balanced effects.',rating:4.4},
  { id:'jack-z',          name:'Jack Z',              type:'sativa',  effects:['Energetic','Euphoric','Happy','Creative','Focused'],      flavors:['Citrus','Earthy','Spice'],      description:'A Jack Herer lineage cross with Zkittlez adding candy sweetness to a classic sativa buzz.',rating:4.4},
  { id:'pebble-beach',    name:'Pebble Beach',        type:'hybrid',  effects:['Relaxed','Euphoric','Happy','Creative','Calm'],           flavors:['Sweet','Creamy','Berry'],       description:'A smooth, beach-vibes hybrid with creamy dessert flavors and an easygoing high.',rating:4.4},
  { id:'wave-runner',     name:'Wave Runner',         type:'hybrid',  effects:['Euphoric','Happy','Relaxed','Uplifted','Creative'],       flavors:['Tropical','Fruity','Sweet'],    description:'Ride the wave — a tropical hybrid with smooth effects and a fruity, refreshing profile.',rating:4.3},
  { id:'wavvyland',       name:'Wavvyland',           type:'hybrid',  effects:['Happy','Relaxed','Euphoric','Creative','Uplifted'],       flavors:['Sweet','Tropical','Citrus'],    description:'A Cookies cultivar with wavy tropical sweetness and a laid-back hybrid high.',rating:4.4},
  { id:'zelium',          name:'Zelium',              type:'hybrid',  effects:['Euphoric','Relaxed','Happy','Creative','Focused'],        flavors:['Earthy','Sweet','Gas'],         description:'A heavy-hitting hybrid with complex earthy and gassy notes.',rating:4.3},
  { id:'lemon-diesel',    name:'Lemon Diesel',        type:'sativa',  effects:['Energetic','Uplifted','Happy','Focused','Creative'],      flavors:['Lemon','Diesel','Citrus'],      description:'A bright, fuel-forward sativa with sharp lemon and diesel notes and a clear-headed buzz.',rating:4.4},
  { id:'lemon-freeze-pop',name:'Lemon Freeze Pop',    type:'hybrid',  effects:['Happy','Euphoric','Relaxed','Uplifted','Creative'],       flavors:['Lemon','Cool','Sweet'],         description:'A frozen treat hybrid — bright lemon candy with a cool, refreshing finish.',rating:4.5},
  { id:'pink-lemonade',   name:'Pink Lemonade',       type:'hybrid',  effects:['Uplifted','Happy','Euphoric','Creative','Relaxed'],       flavors:['Lemon','Berry','Sweet'],        description:'A berry-lemonade hybrid with a refreshing, mood-lifting effect.',rating:4.4},
  { id:'thai-og',         name:'Thai OG',             type:'sativa',  effects:['Energetic','Euphoric','Creative','Happy','Focused'],      flavors:['Spice','Citrus','Earthy'],      description:'Old-school Thai genetics blended with OG for a cultural sativa with cerebral energy.',rating:4.3},
  { id:'zowahh',          name:'Zowahh',              type:'hybrid',  effects:['Euphoric','Relaxed','Happy','Creative','Uplifted'],       flavors:['Sweet','Fruity','Gas'],         description:'A potent Cookies-family hybrid with sweet fruity gas and balanced euphoric effects.',rating:4.4},
  { id:'smacks',          name:'Smacks',              type:'hybrid',  effects:['Euphoric','Happy','Relaxed','Uplifted','Creative'],       flavors:['Sweet','Fruity','Candy'],       description:'A candy-sweet hybrid that smacks with a burst of flavor and uplifting effects.',rating:4.3},
  { id:'uforeoz',         name:'UFOreoz',             type:'hybrid',  effects:['Euphoric','Relaxed','Happy','Creative','Focused'],        flavors:['Cookie','Sweet','Earthy'],      description:'An out-of-this-world Oreo-family hybrid with sweet creamy notes and balanced effects.',rating:4.4},
  { id:'yellow-diamonds', name:'Yellow Diamonds',     type:'hybrid',  effects:['Euphoric','Happy','Uplifted','Creative','Relaxed'],       flavors:['Lemon','Sweet','Citrus'],       description:'A sparkling, gem-quality hybrid with bright citrus notes and an uplifting high.',rating:4.5},
  { id:'sweetiez',        name:'Sweetiez',            type:'hybrid',  effects:['Happy','Relaxed','Euphoric','Creative','Uplifted'],       flavors:['Sweet','Candy','Fruity'],       description:'A sugary-sweet hybrid built for good vibes and mellow euphoria.',rating:4.3},
  { id:'space-face',      name:'Space Face',          type:'hybrid',  effects:['Euphoric','Relaxed','Happy','Creative','Uplifted'],       flavors:['Sweet','Gas','Earthy'],         description:'A heady hybrid that rockets you into orbit with a gassy sweet profile.',rating:4.4},
  { id:'trop-cherry',     name:'Trop Cherry',         type:'hybrid',  effects:['Happy','Euphoric','Uplifted','Relaxed','Creative'],       flavors:['Cherry','Tropical','Sweet'],    description:'Tropical Cherry — a bright, fruit-forward hybrid with cherry candy sweetness.',rating:4.4},
  { id:'z-animal',        name:'Z Animal #10',        type:'hybrid',  effects:['Relaxed','Euphoric','Happy','Sleepy','Body High'],        flavors:['Earthy','Sweet','Gas'],         description:'Zkittlez × Animal Cookies — a heavy hybrid with sweet candy and earthy body effects.',rating:4.5},
  { id:'zion-og',         name:'Zion OG',             type:'indica',  effects:['Relaxed','Sleepy','Euphoric','Happy','Body High'],        flavors:['OG','Earthy','Pine'],           description:'A classic West Coast OG indica with deep pine and earth notes and heavy sedation.',rating:4.4},
  { id:'watermelon-z',    name:'Watermelon Z',        type:'hybrid',  effects:['Happy','Relaxed','Euphoric','Uplifted','Creative'],       flavors:['Watermelon','Sweet','Fruity'],  description:'Watermelon Zkittlez — a juicy, fruity hybrid with summer vibes and a smooth high.',rating:4.5},
  { id:'lcg',             name:'LCG',                 type:'hybrid',  effects:['Euphoric','Relaxed','Happy','Creative','Uplifted'],       flavors:['Lemon','Cherry','Sweet'],       description:'Lemon Cherry Gelato in its purest expression — bright citrus meets creamy berry.',rating:4.6},
  { id:'lcg-x-z',         name:'LCG x Z',             type:'hybrid',  effects:['Euphoric','Happy','Relaxed','Uplifted','Creative'],       flavors:['Lemon','Cherry','Candy'],       description:'Lemon Cherry Gelato × Zkittlez — a candy-bright hybrid stacked with fruity complexity.',rating:4.6},
  { id:'pandoras-box',    name:"Pandora's Box",        type:'sativa',  effects:['Energetic','Euphoric','Creative','Focused','Uplifted'],   flavors:['Sweet','Citrus','Pine'],        description:'Jack the Ripper × Space Queen — a potent sativa that opens up creative euphoria.',rating:4.5},
  { id:'gelato-33',       name:'Gelato 33',            type:'hybrid',  effects:['Euphoric','Relaxed','Happy','Creative','Uplifted'],       flavors:['Sweet','Citrus','Creamy'],      description:'Larry Bird — the most celebrated Gelato cut, known for its smooth, euphoric balanced high.',rating:4.8},
  { id:'strawberry-guava',name:'Strawberry Guava',    type:'hybrid',  effects:['Happy','Relaxed','Euphoric','Creative','Uplifted'],       flavors:['Strawberry','Guava','Tropical'],description:'A tropical hybrid combining strawberry sweetness with exotic guava for a fruit punch effect.',rating:4.5},
  { id:'xxx-runtz',       name:'XXX Runtz',            type:'hybrid',  effects:['Euphoric','Relaxed','Happy','Creative','Uplifted'],       flavors:['Candy','Sweet','Fruity'],       description:'An extreme Runtz variation with amplified candy sweetness and potent balanced effects.',rating:4.6},
  { id:'lcg-biscotti',    name:'LCG x Biscotti',      type:'hybrid',  effects:['Euphoric','Relaxed','Happy','Focused','Creative'],        flavors:['Lemon','Cherry','Cookie'],      description:'Lemon Cherry Gelato × Biscotti — a dessert hybrid stacking citrus and cookie notes.',rating:4.6},
  { id:'rainbow-runtz',   name:'Rainbow Runtz',        type:'hybrid',  effects:['Euphoric','Happy','Relaxed','Uplifted','Creative'],       flavors:['Candy','Rainbow','Sweet'],      description:'A colorful Runtz phenotype bursting with candy flavor and a euphoric, social high.',rating:4.5},
  { id:'tropical-zkittlez',name:'Tropical Zkittlez',  type:'hybrid',  effects:['Happy','Relaxed','Euphoric','Uplifted','Creative'],       flavors:['Tropical','Candy','Citrus'],    description:'A tropical take on Zkittlez with a fruit punch flavor and laid-back hybrid effects.',rating:4.5},
  { id:'super-runtz-gm',  name:'Super Runtz x GM',    type:'hybrid',  effects:['Euphoric','Relaxed','Happy','Uplifted','Body High'],      flavors:['Gas','Candy','Sweet'],          description:'Super Runtz × GMO — candy sweetness collides with gassy pungency for a potent ride.',rating:4.5},
];

// Tag all new strains with cookies-hayward dispensary
for (const s of newStrains) {
  s.dispensaries = [DISP];
  if (!s.genetics) delete s.genetics;
}

// Avoid duplicates by id
const existingIds = new Set(strains.map(s => s.id));
const toAdd = newStrains.filter(s => !existingIds.has(s.id));

const updated = [...strains, ...toAdd];
writeFileSync(filePath, JSON.stringify(updated, null, 2));
console.log(`Badged: ${badged} existing strains`);
console.log(`Added: ${toAdd.length} new strains`);
console.log(`Total: ${updated.length} strains`);
