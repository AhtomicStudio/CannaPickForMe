// scripts/generate-compare.mjs
// Generates static head-to-head comparison pages (/compare/<a>-vs-<b>) for
// pairs of similar, data-rich strains. Same static-output model as
// generate-seo.mjs: flat files in /public/compare, served clean by Vercel.
//
// All copy is composed from real strain data (type, genetics, effects,
// flavors, terpenes, shelf-sourced THC) in hedged experience language.
// No medical claims, no invented facts: fields we lack are simply omitted.
//
// Run via `npm run generate:compare` or automatically in prebuild.

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { comparisonPairs } from './_comparePairs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SITE_URL = 'https://cannapickforme.com';
const OG_IMAGE = `${SITE_URL}/icon-512.png`;
const OUT_DIR = join(ROOT, 'public', 'compare');

const strains = JSON.parse(
  await readFile(join(ROOT, 'public/data/strains.json'), 'utf8')
);

// ---------------------------------------------------------------------------
// Helpers (mirrors generate-seo.mjs conventions)
// ---------------------------------------------------------------------------
const escape = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const typeLabel = (t) => {
  const map = { sativa: 'Sativa', indica: 'Indica', hybrid: 'Hybrid' };
  return map[String(t).toLowerCase()] || String(t);
};

const terpNames = (s) => (s.terpenes || []).map((t) => (t && t.name) || t);

function thcText(s) {
  const t = s.thc;
  if (!t || !Number.isFinite(t.min) || !Number.isFinite(t.max)) return '';
  const min = Math.round(t.min);
  const max = Math.round(t.max);
  return min === max ? `~${min}%` : `${min}-${max}%`;
}

function occasionOf(s) {
  const e = new Set(s.effects || []);
  if (e.has('Sleepy')) return 'night';
  if (e.has('Energetic') || e.has('Focused')) return 'day';
  if (e.has('Giggly') || e.has('Talkative')) return 'social';
  if (e.has('Creative')) return 'creative';
  return 'anytime';
}

const OCCASION_PHRASE = {
  night: 'a wind-down night',
  day: 'a daytime session with things left to do',
  social: 'a kickback with friends',
  creative: 'a creative session',
  anytime: 'whatever the day turns into',
};

// ---------------------------------------------------------------------------
// Copy builders — grounded in field-by-field deltas between the two strains
// ---------------------------------------------------------------------------
function sharedAndDistinct(a, b) {
  const ae = a.effects || [];
  const be = b.effects || [];
  return {
    shared: ae.filter((e) => be.includes(e)),
    onlyA: ae.filter((e) => !be.includes(e)).slice(0, 3),
    onlyB: be.filter((e) => !ae.includes(e)).slice(0, 3),
  };
}

const lower = (arr) => arr.map((e) => e.toLowerCase());
const listOf = (arr) => {
  const l = lower(arr);
  if (l.length <= 1) return l.join('');
  if (l.length === 2) return `${l[0]} and ${l[1]}`;
  return `${l.slice(0, -1).join(', ')}, and ${l[l.length - 1]}`;
};

function verdictProse(a, b) {
  const { shared, onlyA, onlyB } = sharedAndDistinct(a, b);
  const sentences = [];

  const ta = typeLabel(a.type).toLowerCase();
  const tb = typeLabel(b.type).toLowerCase();
  sentences.push(ta === tb
    ? `${a.name} and ${b.name} are both ${ta}s, so this one comes down to the details.`
    : `${a.name} is a ${ta} while ${b.name} is a ${tb}, and that sets the tone for how they differ.`);

  if (shared.length >= 2) {
    sentences.push(`Reported effects overlap on ${listOf(shared.slice(0, 3))}, which is why people cross-shop them.`);
  }
  if (onlyA.length && onlyB.length) {
    sentences.push(`Where they split: ${a.name} is more often described as ${listOf(onlyA)}, while ${b.name} leans ${listOf(onlyB)}.`);
  } else if (onlyA.length) {
    sentences.push(`${a.name} brings ${listOf(onlyA)} that ${b.name} is less known for.`);
  } else if (onlyB.length) {
    sentences.push(`${b.name} brings ${listOf(onlyB)} that ${a.name} is less known for.`);
  }

  const terpA = terpNames(a);
  const terpB = terpNames(b);
  if (terpA.length && terpB.length && terpA[0] !== terpB[0]) {
    sentences.push(`On the nose, ${a.name} leads with ${terpA[0].toLowerCase()} and ${b.name} with ${terpB[0].toLowerCase()}, so they smell and taste like different rooms.`);
  } else if (terpA.length && terpB.length) {
    sentences.push(`Both lead with ${terpA[0].toLowerCase()}, so the aroma family is similar.`);
  }

  const thcA = a.thc && (a.thc.min + a.thc.max) / 2;
  const thcB = b.thc && (b.thc.min + b.thc.max) / 2;
  if (thcA && thcB && Math.abs(thcA - thcB) >= 3) {
    const [hi, lo] = thcA > thcB ? [a, b] : [b, a];
    sentences.push(`Shelf tests put ${hi.name} noticeably stronger (${thcText(hi)} vs ${thcText(lo)}), worth knowing if you like a gentler ceiling.`);
  }

  sentences.push('Neither is objectively better. Match the pick to the night you are planning, and start low if either is new to you.');
  return sentences.join(' ');
}

const TERPENE_NOSE = {
  Myrcene: 'that earthy, musky funk',
  Limonene: 'bright citrus',
  Pinene: 'fresh pine',
  Caryophyllene: 'peppery spice',
  Terpinolene: 'fruity florals',
  Linalool: 'lavender florals',
  Humulene: 'hoppy, woody notes',
  Ocimene: 'sweet herbal notes',
};

function pickList(self, other) {
  const { onlyA } = sharedAndDistinct(self, other);
  const items = [];
  for (const e of onlyA.slice(0, 2)) items.push(`you want ${e.toLowerCase()} in the mix`);
  const occSelf = occasionOf(self);
  if (occSelf !== occasionOf(other)) items.push(`the plan is ${OCCASION_PHRASE[occSelf]}`);
  const thcSelf = self.thc && (self.thc.min + self.thc.max) / 2;
  const thcOther = other.thc && (other.thc.min + other.thc.max) / 2;
  if (thcSelf && thcOther && Math.abs(thcSelf - thcOther) >= 3) {
    items.push(thcSelf > thcOther ? 'you want the heavier hitter' : 'you want a mellower ceiling');
  }
  // Similar pairs rarely differ on effects, so aroma and flavor carry the call.
  const tSelf = terpNames(self)[0];
  const tOther = terpNames(other)[0];
  if (items.length < 3 && tSelf && tSelf !== tOther && TERPENE_NOSE[tSelf]) {
    items.push(`you like ${TERPENE_NOSE[tSelf]} on the nose`);
  }
  if (items.length < 3) {
    const distinctFlavors = (self.flavors || [])
      .filter((f) => !(other.flavors || []).includes(f))
      .slice(0, 2);
    if (distinctFlavors.length) items.push(`you are chasing ${listOf(distinctFlavors)} flavors`);
  }
  if (!items.length) items.push(`${self.name}'s flavor profile (${listOf((self.flavors || []).slice(0, 2))}) sounds more like you`);
  return items.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Structured data
// ---------------------------------------------------------------------------
function breadcrumbsLd(pair) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Compare', item: `${SITE_URL}/compare` },
      { '@type': 'ListItem', position: 3, name: `${pair.a.name} vs ${pair.b.name}`, item: `${SITE_URL}/compare/${pair.slug}` },
    ],
  });
}

// ---------------------------------------------------------------------------
// Page template
// ---------------------------------------------------------------------------
function row(label, va, vb) {
  if (!va && !vb) return '';
  return `<tr><th>${escape(label)}</th><td>${va || '<span class="na">·</span>'}</td><td>${vb || '<span class="na">·</span>'}</td></tr>`;
}

function comparePage(pair) {
  const { a, b, slug } = pair;
  const title = `${a.name} vs ${b.name}: Which Strain Fits Your Mood? | CannaPickForMe`;
  const url = `${SITE_URL}/compare/${slug}`;
  const verdict = verdictProse(a, b);
  const desc = `${a.name} vs ${b.name}, compared on effects, flavors, terpenes, and potency. See which one fits your mood, then match it with the free CannaPickForMe quiz.`;
  const chipList = (arr, cls = '') => lower(arr).map((x) => `<span class="chip ${cls}">${escape(x)}</span>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escape(title)}</title>
<meta name="description" content="${escape(desc)}" />
<meta name="theme-color" content="#0a0e17" />
<link rel="canonical" href="${url}" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${escape(`${a.name} vs ${b.name}`)}" />
<meta property="og:description" content="${escape(desc)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${OG_IMAGE}" />
<meta property="og:site_name" content="CannaPickForMe" />
<script type="application/ld+json">${breadcrumbsLd(pair)}</script>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=Space+Grotesk:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
  :root { --bg:#0a0e17; --card:rgba(255,255,255,0.04); --border:rgba(255,255,255,0.08);
    --text:#e5e7eb; --muted:#9ca3af; --accent:#4ade80; --accent-2:#fbbf24;
    --indica:#a78bfa; --sativa:#fb923c; --hybrid:#4ade80; }
  * { box-sizing:border-box; } html,body { margin:0; padding:0; }
  body { background:radial-gradient(1200px 600px at 50% -10%, #1a2032 0%, var(--bg) 60%);
    color:var(--text); font-family:'Space Grotesk',system-ui,sans-serif; line-height:1.55; min-height:100vh; }
  a { color:var(--accent); text-decoration:none; } a:hover { text-decoration:underline; }
  .wrap { max-width:820px; margin:0 auto; padding:1.5rem 1.25rem 4rem; }
  .topbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; }
  .topbar a.brand { font-family:'Outfit',sans-serif; font-weight:800; color:var(--text); font-size:1.1rem; }
  .brand .glow { color:var(--accent); }
  .crumbs { font-size:0.85rem; color:var(--muted); margin-bottom:1rem; }
  h1 { font-family:'Outfit',sans-serif; font-size:clamp(1.6rem,5vw,2.4rem); margin:0 0 1rem; }
  h2 { font-family:'Outfit',sans-serif; font-size:1.25rem; margin:0 0 0.75rem; }
  .type-pill { display:inline-block; padding:0.15rem 0.6rem; border-radius:999px; font-size:0.75rem;
    font-weight:600; text-transform:uppercase; letter-spacing:0.05em; border:1px solid currentColor; }
  .type-sativa { color:var(--sativa); } .type-indica { color:var(--indica); } .type-hybrid { color:var(--hybrid); }
  .card { background:var(--card); border:1px solid var(--border); border-radius:14px; padding:1.25rem; margin-bottom:1.25rem; }
  .prose { margin:0; color:#d1d5db; }
  table { width:100%; border-collapse:collapse; font-size:0.92rem; }
  th, td { text-align:left; padding:0.55rem 0.6rem; border-bottom:1px solid var(--border); vertical-align:top; }
  th { color:var(--muted); font-weight:500; width:22%; }
  thead td { font-family:'Outfit',sans-serif; font-weight:700; font-size:1rem; }
  tr:last-child th, tr:last-child td { border-bottom:none; }
  .na { color:var(--muted); }
  .chip { display:inline-block; margin:0.15rem 0.25rem 0.15rem 0; padding:0.2rem 0.55rem; border-radius:999px;
    background:rgba(74,222,128,0.08); color:var(--accent); border:1px solid rgba(74,222,128,0.2); font-size:0.78rem; }
  .chip--alt { background:rgba(251,191,36,0.08); color:var(--accent-2); border-color:rgba(251,191,36,0.2); }
  .pick-cols { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
  @media (max-width:560px) { .pick-cols { grid-template-columns:1fr; } }
  .pick-cols h3 { font-family:'Outfit',sans-serif; font-size:1rem; margin:0 0 0.5rem; }
  .pick-cols ul { margin:0; padding-left:1.1rem; color:#d1d5db; font-size:0.92rem; }
  .pick-cols li { margin:0.3rem 0; }
  .cta { background:linear-gradient(135deg,#4ade80 0%,#22d3ee 100%); color:#06200d; padding:1.25rem;
    border-radius:16px; text-align:center; margin:2rem 0; }
  .cta h2 { color:#06200d; margin-bottom:0.4rem; } .cta p { margin:0 0 1rem; color:#06200d; opacity:0.85; }
  .cta a { display:inline-block; padding:0.85rem 1.75rem; border-radius:999px; background:#0a0e17;
    color:var(--accent); font-weight:700; font-family:'Outfit',sans-serif; text-decoration:none; }
  footer { color:var(--muted); font-size:0.78rem; margin-top:3rem; line-height:1.5; }
  footer a { color:var(--muted); text-decoration:underline; }
</style>
</head>
<body>
  <div class="wrap">
    <header class="topbar">
      <a href="/" class="brand">Canna<span class="glow">Pick</span>ForMe 🌿</a>
      <a href="/" style="color:var(--muted);font-size:0.9rem;">Try the matcher →</a>
    </header>

    <nav class="crumbs" aria-label="Breadcrumb">
      <a href="/">Home</a> <span>/</span> <span>Compare</span> <span>/</span> <span>${escape(a.name)} vs ${escape(b.name)}</span>
    </nav>

    <h1>${escape(a.name)} vs ${escape(b.name)}</h1>

    <section class="card">
      <h2>The Short Answer</h2>
      <p class="prose">${escape(verdict)}</p>
    </section>

    <section class="card">
      <h2>Side by Side</h2>
      <table>
        <thead>
          <tr><th></th>
            <td><a href="/strain/${escape(a.id)}">${escape(a.name)}</a></td>
            <td><a href="/strain/${escape(b.id)}">${escape(b.name)}</a></td>
          </tr>
        </thead>
        <tbody>
          ${row('Type',
            `<span class="type-pill type-${escape(String(a.type).toLowerCase())}">${escape(typeLabel(a.type))}</span>`,
            `<span class="type-pill type-${escape(String(b.type).toLowerCase())}">${escape(typeLabel(b.type))}</span>`)}
          ${row('Genetics', a.genetics ? escape(a.genetics) : '', b.genetics ? escape(b.genetics) : '')}
          ${row('THC (shelf tested)', escape(thcText(a)), escape(thcText(b)))}
          ${row('Dominant terpenes', escape(lower(terpNames(a)).join(', ')), escape(lower(terpNames(b)).join(', ')))}
          ${row('Reported effects', chipList((a.effects || []).slice(0, 5)), chipList((b.effects || []).slice(0, 5)))}
          ${row('Flavors', chipList((a.flavors || []).slice(0, 4), 'chip--alt'), chipList((b.flavors || []).slice(0, 4), 'chip--alt'))}
        </tbody>
      </table>
    </section>

    <section class="card">
      <h2>Which One Should You Pick?</h2>
      <div class="pick-cols">
        <div>
          <h3>Go with ${escape(a.name)} if…</h3>
          <ul>${pickList(a, b).map((i) => `<li>${escape(i)}</li>`).join('')}</ul>
        </div>
        <div>
          <h3>Go with ${escape(b.name)} if…</h3>
          <ul>${pickList(b, a).map((i) => `<li>${escape(i)}</li>`).join('')}</ul>
        </div>
      </div>
    </section>

    <div class="cta">
      <h2>Still Torn?</h2>
      <p>Answer 4 quick questions and the matcher will call it for you, based on your mood tonight.</p>
      <a href="/">🔥 Match My Mood</a>
    </div>

    <section class="card">
      <h2>Keep Exploring</h2>
      <ul style="padding-left:1.1rem;margin:0.25rem 0 0;">
        <li><a href="/strain/${escape(a.id)}">${escape(a.name)}: full profile →</a></li>
        <li><a href="/strain/${escape(b.id)}">${escape(b.name)}: full profile →</a></li>
        <li><a href="/lore">The Lore: guides &amp; collections →</a></li>
      </ul>
    </section>

    <footer>
      <p><strong>For adults 21+ only.</strong> Cannabis must be consumed in a legal space.</p>
      <p>Cannabis remains a Schedule I Controlled Substance under federal law. These statements have not been evaluated by the FDA. Effect descriptions are based on community-reported data and individual experiences vary. Potency figures come from shelf listings and vary batch to batch.</p>
      <p><a href="/">CannaPickForMe</a> · Made with 💨 in California</p>
    </footer>
  </div>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
async function main() {
  if (existsSync(OUT_DIR)) await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const pairs = comparisonPairs(strains);
  for (const pair of pairs) {
    await writeFile(join(OUT_DIR, `${pair.slug}.html`), comparePage(pair), 'utf8');
  }
  console.log(`[generate-compare] wrote ${pairs.length} comparison pages to /public/compare/`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error('[generate-compare] failed:', err);
    process.exit(1);
  }
);
