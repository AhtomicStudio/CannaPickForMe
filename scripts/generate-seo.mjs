// scripts/generate-seo.mjs
// Generates static SEO landing pages for every strain in src/data/strains.json,
// plus a sitemap.xml and robots.txt. Output goes into /public so Vite copies
// it into the build untouched. Each strain becomes a flat file at
// /public/strain/<slug>.html — Vercel's `cleanUrls: true` serves it at
// /strain/<slug>. Static files take priority over the SPA catch-all rewrite.
//
// Run via `npm run generate:seo` or automatically before `npm run build`.

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { comparisonPairs, comparisonsByStrain } from './_comparePairs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SITE_URL = 'https://cannapickforme.com';
const OG_IMAGE = `${SITE_URL}/icon-512.png`;
const OUT_DIR = join(ROOT, 'public', 'strain');

// ---------------------------------------------------------------------------
// Load source data
// ---------------------------------------------------------------------------
const strains = JSON.parse(
  await readFile(join(ROOT, 'public/data/strains.json'), 'utf8')
);

// Optional shelf snapshot (scripts/pull-menu-availability.mjs). Baked in when
// present; pages render fine without it.
let availability = null;
try {
  availability = JSON.parse(
    await readFile(join(ROOT, 'public/data/menu-availability.json'), 'utf8')
  );
} catch { /* no snapshot yet */ }

// strainId -> [{ name, url, fetched }]
function availabilityFor(strainId) {
  if (!availability) return [];
  const out = [];
  for (const d of Object.values(availability.dispensaries || {})) {
    if ((d.strains || []).includes(strainId)) {
      out.push({ name: d.name, url: d.url, fetched: availability._fetched });
    }
  }
  return out;
}

// Pull DISPENSARY_NAMES out of src/main.js so we don't duplicate the mapping.
const mainJs = await readFile(join(ROOT, 'src/main.js'), 'utf8');
const dispMatch = mainJs.match(/const DISPENSARY_NAMES = \{([\s\S]*?)\};/);
const DISPENSARIES = {};
if (dispMatch) {
  const re = /'([^']+)':\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(dispMatch[1])) !== null) DISPENSARIES[m[1]] = m[2];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const escape = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const titleCase = (s) =>
  String(s).replace(/\b\w/g, (c) => c.toUpperCase());

const typeLabel = (t) => {
  const map = { sativa: 'Sativa', indica: 'Indica', hybrid: 'Hybrid' };
  return map[String(t).toLowerCase()] || titleCase(t);
};

// Genetics/lineage string (e.g. "Blueberry × Haze") — the canonical field.
const lineageOf = (s) => s.genetics || '';

// "THC 22%" or "THC 18-25%" from a shelf-sourced {min,max} range, else ''.
function thcLabel(s) {
  const t = s.thc;
  if (!t || !Number.isFinite(t.min) || !Number.isFinite(t.max)) return '';
  const min = Math.round(t.min);
  const max = Math.round(t.max);
  return min === max ? `THC ~${min}%` : `THC ${min}-${max}%`;
}

// Bidirectional internal linking: a strain links UP to the content hubs that
// feature it (keeps the SEO cluster tight). Hub slugs mirror scripts/generate-content.mjs.
const HUB_LINKS = [
  { tag: 'Body High', slug: 'best-body-high-strains', label: 'Best Body High Strains' },
  { tag: 'Head High', slug: 'best-head-high-strains', label: 'Best Head High Strains' },
  { tag: 'Sleepy', slug: 'best-sleepy-strains', label: 'Best Strains for Sleep' },
  { tag: 'Energetic', slug: 'best-energizing-strains', label: 'Best Energizing Strains' },
  { tag: 'Relaxed', slug: 'best-relaxing-strains', label: 'Best Relaxing Strains' },
  { tag: 'Creative', slug: 'best-creative-strains', label: 'Best Strains for Creativity' },
  { tag: 'Focused', slug: 'best-focus-strains', label: 'Best Strains for Focus' },
  { tag: 'Hungry', slug: 'best-strains-for-munchies', label: 'Best Strains for the Munchies' },
  { tag: 'Talkative', slug: 'best-social-strains', label: 'Best Strains for Social Sessions' },
  { tag: 'Giggly', slug: 'best-strains-for-movie-night', label: 'Best Strains for Movie Night' },
];
const TYPE_HUBS = {
  indica: ['best-indica-strains', 'Best Indica Strains'],
  sativa: ['best-sativa-strains', 'Best Sativa Strains'],
  hybrid: ['best-hybrid-strains', 'Best Hybrid Strains'],
};
function guideLinksHtml(strain) {
  const links = HUB_LINKS.filter((h) => (strain.effects || []).includes(h.tag)).slice(0, 3);
  const typeHub = TYPE_HUBS[String(strain.type).toLowerCase()];
  if (!links.length && !typeHub) return '';
  return `<section class="card">
      <h2>Related guides</h2>
      <ul class="disp-list">
        ${links.map((h) => `<li><a href="/lore/${h.slug}">${escape(h.label)} →</a></li>`).join('')}
        ${typeHub ? `<li><a href="/lore/${typeHub[0]}">${escape(typeHub[1])} →</a></li>` : ''}
        <li><a href="/lore">The Lore — guides &amp; collections →</a></li>
      </ul>
    </section>`;
}

// Build a short, search-friendly meta description.
function buildMetaDescription(strain) {
  const type = typeLabel(strain.type);
  const top = (strain.effects || []).slice(0, 4).join(', ').toLowerCase();
  const flavors = (strain.flavors || []).slice(0, 3).join(', ').toLowerCase();
  const terps = (strain.terpenes || []).map((t) => (t && t.name) || t).slice(0, 3).join(', ').toLowerCase();
  const pieces = [
    `${strain.name} is a ${type.toLowerCase()} strain`,
    top ? `known for ${top} effects` : null,
    flavors ? `with ${flavors} flavors` : null,
    terps ? `and ${terps} terpenes` : null,
  ].filter(Boolean);
  let desc = `${pieces.join(', ')}.`;
  const lin = lineageOf(strain);
  if (lin) desc += ` Genetics: ${lin}.`;
  desc += ' Match it to your mood with the free CannaPickForMe strain matcher.';
  if (desc.length > 300) desc = desc.slice(0, 297) + '...';
  return desc;
}

// ---------------------------------------------------------------------------
// Content depth: about prose + per-strain FAQ. Composed ONLY from real data
// (type, genetics, effects, flavors, terpenes) in hedged experience language,
// never medical claims. Sentence variants are picked by a deterministic hash
// of the strain id so the 221 pages don't read like one template.
// ---------------------------------------------------------------------------
function hashPick(id, salt, n) {
  const str = `${id}|${salt}`;
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % n;
}

const TERPENE_AROMA = {
  Myrcene: 'an earthy, musky depth',
  Limonene: 'a bright citrus zest',
  Pinene: 'a fresh pine snap',
  Caryophyllene: 'a peppery spice',
  Terpinolene: 'a fruity, floral lift',
  Linalool: 'soft lavender florals',
  Humulene: 'hoppy, woody undertones',
  Ocimene: 'sweet herbal notes',
};

// Coarse day/night/social lean from the effect tags, used to ground the
// "when do people reach for this" copy in the data we actually have.
function occasionOf(strain) {
  const e = new Set(strain.effects || []);
  if (e.has('Sleepy')) return 'night';
  if (e.has('Energetic') || e.has('Focused')) return 'day';
  if (e.has('Giggly') || e.has('Talkative')) return 'social';
  if (e.has('Creative')) return 'creative';
  return 'anytime';
}

function aboutProse(strain) {
  const name = strain.name;
  const type = typeLabel(strain.type).toLowerCase();
  const sentences = [];

  const lin = lineageOf(strain);
  if (lin) {
    sentences.push([
      `${name} comes from ${lin} genetics.`,
      `Its lineage traces back to ${lin}.`,
      `Genetics-wise, ${name} is a cross of ${lin}.`,
    ][hashPick(strain.id, 'lin', 3)]);
  }

  const terps = (strain.terpenes || []).map((t) => (t && t.name) || t);
  if (terps.length) {
    const lead = terps[0];
    const rest = terps.slice(1).map((t) => t.toLowerCase());
    const aroma = TERPENE_AROMA[lead] || 'its signature aroma';
    const restTxt = rest.length ? `, backed by ${rest.join(' and ')}` : '';
    sentences.push([
      `The terpene profile leads with ${lead.toLowerCase()}${restTxt}, which brings ${aroma} to the nose.`,
      `${lead} is the dominant terpene here${restTxt}, lending ${aroma}.`,
    ][hashPick(strain.id, 'terp', 2)]);
  }

  const effects = (strain.effects || []).slice(0, 3).map((e) => e.toLowerCase());
  if (effects.length >= 2) {
    const list = effects.length > 2
      ? `${effects[0]}, ${effects[1]}, and ${effects[2]}`
      : effects.join(' and ');
    sentences.push([
      `People most often describe the experience as ${list}.`,
      `Reported effects lean ${list}.`,
      `The experience is commonly described as ${list}, though everyone reacts a little differently.`,
    ][hashPick(strain.id, 'eff', 3)]);
  }

  sentences.push({
    night: 'That combination makes it a popular pick for winding down in the evening.',
    day: 'That mix earns it a spot in daytime rotations, when there is still stuff to get done.',
    social: 'That mix makes it a natural fit for kickbacks and social sessions.',
    creative: 'That mix suits creative sessions where you want the ideas flowing.',
    anytime: `It reads like a flexible, any-time-of-day kind of ${type}.`,
  }[occasionOf(strain)]);

  return sentences.join(' ');
}

function buildFaq(strain) {
  const name = strain.name;
  const type = typeLabel(strain.type);
  const faqs = [];

  const lin = lineageOf(strain);
  const typeChar = {
    indica: 'Indicas are usually associated with mellow, body-forward evenings.',
    sativa: 'Sativas are usually associated with upbeat, head-forward sessions.',
    hybrid: 'Hybrids sit between indica and sativa, so the character comes down to the specific cut.',
  }[type.toLowerCase()] || '';
  let typeAnswer = `${name} is a ${type.toLowerCase()}.`;
  if (lin) typeAnswer += ` It crosses ${lin}.`;
  if (typeChar) typeAnswer += ` ${typeChar}`;
  faqs.push({ q: `Is ${name} an indica or a sativa?`, a: typeAnswer });

  const effects = (strain.effects || []).slice(0, 4).map((e) => e.toLowerCase());
  if (effects.length) {
    faqs.push({
      q: `What does ${name} feel like?`,
      a: `Users most often describe ${name} as ${effects.join(', ')}. Effects vary person to person, so start low and go slow, especially with a strain you have not tried before.`,
    });
  }

  const flavors = (strain.flavors || []).slice(0, 3).map((f) => f.toLowerCase());
  const terps = (strain.terpenes || []).map((t) => ((t && t.name) || t).toLowerCase());
  if (flavors.length) {
    let a = `Expect ${flavors.join(', ')} notes.`;
    if (terps.length) a += ` The flavor tracks with its terpene profile: ${terps.join(', ')}.`;
    faqs.push({ q: `What does ${name} taste like?`, a });
  }

  const occAnswer = {
    night: `${name} leans nighttime. People most often reach for it to wind down once the day is done.`,
    day: `${name} leans daytime. Its reported effects pair better with getting things done than with melting into the couch.`,
    social: `${name} shines in social settings. It is often described as chatty and giggly, good company for a kickback.`,
    creative: `${name} suits creative time. Its reported effects lean heady and idea-friendly.`,
    anytime: `${name} does not strongly lean either way, so let the dose set the tone. Lighter for daytime, heavier for night.`,
  }[occasionOf(strain)];
  faqs.push({ q: `Is ${name} better for daytime or nighttime?`, a: occAnswer });

  return faqs;
}

// FAQPage structured data — must mirror the visible FAQ content exactly.
function faqLd(faqs) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  });
}

// Pick up to N similar strains: same type first, then anything sharing >=2 effects.
function relatedStrains(target, all, n = 6) {
  const targetEffects = new Set((target.effects || []).map((e) => e.toLowerCase()));
  const scored = all
    .filter((s) => s.id !== target.id)
    .map((s) => {
      const sameType = s.type === target.type ? 2 : 0;
      const overlap = (s.effects || []).filter((e) =>
        targetEffects.has(e.toLowerCase())
      ).length;
      return { s, score: sameType + overlap };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name))
    .slice(0, n)
    .map((x) => x.s);
  return scored;
}

// JSON-LD structured data — Product schema is the closest fit for a strain
// listing and is what Leafly/Weedmaps use too.
function jsonLd(strain) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: strain.name,
    description: strain.description || buildMetaDescription(strain),
    category: `Cannabis / ${typeLabel(strain.type)}`,
    image: OG_IMAGE,
    url: `${SITE_URL}/strain/${strain.id}`,
    brand: { '@type': 'Brand', name: lineageOf(strain) || 'Cannabis' },
    additionalProperty: [
      {
        '@type': 'PropertyValue',
        name: 'Type',
        value: typeLabel(strain.type),
      },
      ...(strain.effects || []).map((e) => ({
        '@type': 'PropertyValue',
        name: 'Effect',
        value: e,
      })),
      ...(strain.flavors || []).map((f) => ({
        '@type': 'PropertyValue',
        name: 'Flavor',
        value: f,
      })),
      ...(strain.terpenes || []).map((t) => ({
        '@type': 'PropertyValue',
        name: 'Terpene',
        value: (t && t.name) || t,
      })),
    ],
  };
  return JSON.stringify(data);
}

// Breadcrumbs help Google render the SERP nicely.
function breadcrumbsLd(strain) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: SITE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Strains',
        item: `${SITE_URL}/strains`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: strain.name,
        item: `${SITE_URL}/strain/${strain.id}`,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// HTML template — self-contained, dark theme matching the app's vibe.
// No SPA bundle is loaded; this is a pure SEO landing page that funnels to /.
// ---------------------------------------------------------------------------
function strainPage(strain, related, comparisons = []) {
  const title = `${strain.name} Strain — Effects, Flavors & Match Your Mood | CannaPickForMe`;
  const desc = buildMetaDescription(strain);
  const url = `${SITE_URL}/strain/${strain.id}`;
  const about = aboutProse(strain);
  const faqs = buildFaq(strain);
  const compareHtml = comparisons.length
    ? `<section class="card">
        <h2>Head to Head</h2>
        <p class="muted">Deciding between ${escape(strain.name)} and something similar?</p>
        <ul class="disp-list">
          ${comparisons.map((c) => `<li><a href="/compare/${escape(c.slug)}">${escape(strain.name)} vs ${escape(c.other.name)} →</a></li>`).join('')}
        </ul>
      </section>`
    : '';
  const dispensaries = (strain.dispensaries || [])
    .map((id) => DISPENSARIES[id])
    .filter(Boolean);

  const effectsHtml = (strain.effects || [])
    .map((e) => `<span class="chip">${escape(e)}</span>`)
    .join('');
  const flavorsHtml = (strain.flavors || [])
    .map((f) => `<span class="chip chip--alt">${escape(f)}</span>`)
    .join('');
  const terpenesHtml = (strain.terpenes || [])
    .map((t) => `<span class="chip chip--terp">${escape((t && t.name) || t)}</span>`)
    .join('');
  const onShelf = availabilityFor(strain.id);
  const onShelfHtml = onShelf
    .map((a) => `<p class="on-shelf">✅ On the menu at <a href="${escape(a.url)}" rel="noopener">${escape(a.name)}</a> <span class="muted-inline">(menu checked ${escape(a.fetched)})</span></p>`)
    .join('');
  const dispensariesHtml = (dispensaries.length || onShelf.length)
    ? `<section class="card">
        <h2>Where to find ${escape(strain.name)}</h2>
        ${onShelfHtml}
        ${dispensaries.length ? `<p class="muted">Available at participating Bay Area dispensaries:</p>
        <ul class="disp-list">
          ${dispensaries.map((d) => `<li>${escape(d)}</li>`).join('')}
        </ul>` : ''}
        <p class="muted-inline">Menus rotate. Check the dispensary for today's shelf.</p>
      </section>`
    : '';
  const relatedHtml = related.length
    ? `<section class="card">
        <h2>Strains similar to ${escape(strain.name)}</h2>
        <ul class="related-grid">
          ${related
            .map(
              (r) => `<li>
              <a href="/strain/${escape(r.id)}" class="related-card">
                <span class="related-card__name">${escape(r.name)}</span>
                <span class="related-card__type type-${escape(
                  String(r.type).toLowerCase()
                )}">${escape(typeLabel(r.type))}</span>
                <span class="related-card__effects">${escape(
                  (r.effects || []).slice(0, 3).join(' · ')
                )}</span>
              </a>
            </li>`
            )
            .join('')}
        </ul>
      </section>`
    : '';

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
<link rel="apple-touch-icon" href="/icon-512.png" />

<!-- Open Graph -->
<meta property="og:type" content="article" />
<meta property="og:title" content="${escape(strain.name)} — ${escape(typeLabel(strain.type))} Strain Effects & Match" />
<meta property="og:description" content="${escape(desc)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${OG_IMAGE}" />
<meta property="og:site_name" content="CannaPickForMe" />

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escape(strain.name)} — ${escape(typeLabel(strain.type))} Strain" />
<meta name="twitter:description" content="${escape(desc)}" />
<meta name="twitter:image" content="${OG_IMAGE}" />

<!-- Structured Data -->
<script type="application/ld+json">${jsonLd(strain)}</script>
<script type="application/ld+json">${breadcrumbsLd(strain)}</script>
<script type="application/ld+json">${faqLd(faqs)}</script>

<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=Space+Grotesk:wght@400;500;600&display=swap" rel="stylesheet" />

<style>
  :root {
    --bg: #0a0e17;
    --bg-2: #111827;
    --card: rgba(255,255,255,0.04);
    --border: rgba(255,255,255,0.08);
    --text: #e5e7eb;
    --muted: #9ca3af;
    --accent: #4ade80;
    --accent-2: #fbbf24;
    --indica: #a78bfa;
    --sativa: #fb923c;
    --hybrid: #4ade80;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: radial-gradient(1200px 600px at 50% -10%, #1a2032 0%, var(--bg) 60%);
    color: var(--text);
    font-family: 'Space Grotesk', system-ui, -apple-system, sans-serif;
    line-height: 1.55;
    min-height: 100vh;
  }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .wrap { max-width: 760px; margin: 0 auto; padding: 1.5rem 1.25rem 4rem; }
  .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
  .topbar a.brand { font-family: 'Outfit', sans-serif; font-weight: 800; color: var(--text); font-size: 1.1rem; }
  .brand .glow { color: var(--accent); }
  .crumbs { font-size: 0.85rem; color: var(--muted); margin-bottom: 1rem; }
  h1 { font-family: 'Outfit', sans-serif; font-size: clamp(2rem, 6vw, 2.75rem); margin: 0 0 0.4rem; }
  h2 { font-family: 'Outfit', sans-serif; font-size: 1.25rem; margin: 0 0 0.75rem; }
  .type-pill {
    display: inline-block; padding: 0.2rem 0.7rem; border-radius: 999px;
    font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
    border: 1px solid currentColor;
  }
  .type-sativa { color: var(--sativa); }
  .type-indica { color: var(--indica); }
  .type-hybrid { color: var(--hybrid); }
  .meta-row { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; margin-bottom: 1.5rem; color: var(--muted); }
  .rating { color: var(--accent-2); }
  .lead { font-size: 1.05rem; color: #d1d5db; margin: 0 0 2rem; }
  .card {
    background: var(--card); border: 1px solid var(--border); border-radius: 14px;
    padding: 1.25rem; margin-bottom: 1.25rem;
  }
  .chip {
    display: inline-block; margin: 0.2rem 0.3rem 0.2rem 0;
    padding: 0.35rem 0.75rem; border-radius: 999px;
    background: rgba(74,222,128,0.08); color: var(--accent);
    border: 1px solid rgba(74,222,128,0.2); font-size: 0.85rem;
  }
  .chip--alt { background: rgba(251,191,36,0.08); color: var(--accent-2); border-color: rgba(251,191,36,0.2); }
  .chip--terp { background: rgba(34,211,238,0.08); color: #67e8f9; border-color: rgba(34,211,238,0.25); }
  .muted { color: var(--muted); margin: 0 0 0.5rem; font-size: 0.9rem; }
  .prose { margin: 0; color: #d1d5db; }
  .on-shelf { margin: 0 0 0.75rem; color: #d1d5db; }
  .muted-inline { color: var(--muted); font-size: 0.82rem; }
  .faq-q { font-family: 'Outfit', sans-serif; font-size: 1rem; margin: 1rem 0 0.35rem; color: var(--text); }
  .faq-q:first-of-type { margin-top: 0.25rem; }
  .faq-a { margin: 0 0 0.5rem; color: #d1d5db; font-size: 0.95rem; }
  .disp-list { padding-left: 1.1rem; margin: 0.25rem 0 0; }
  .disp-list li { margin: 0.25rem 0; }
  .related-grid {
    list-style: none; padding: 0; margin: 0.25rem 0 0;
    display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.6rem;
  }
  .related-card {
    display: block; padding: 0.75rem 0.85rem; border-radius: 10px;
    background: rgba(255,255,255,0.03); border: 1px solid var(--border);
    color: var(--text); transition: border-color 0.15s, background 0.15s;
  }
  .related-card:hover { background: rgba(255,255,255,0.06); border-color: rgba(74,222,128,0.4); text-decoration: none; }
  .related-card__name { display: block; font-weight: 600; font-family: 'Outfit', sans-serif; margin-bottom: 0.2rem; }
  .related-card__type { display: inline-block; font-size: 0.7rem; padding: 0.1rem 0.5rem; border-radius: 999px; border: 1px solid currentColor; margin-bottom: 0.4rem; }
  .related-card__effects { display: block; font-size: 0.8rem; color: var(--muted); }
  .cta {
    background: linear-gradient(135deg, #4ade80 0%, #22d3ee 100%);
    color: #06200d; padding: 1.25rem; border-radius: 16px; text-align: center;
    margin: 2rem 0; box-shadow: 0 0 0 1px rgba(74,222,128,0.3), 0 10px 40px -10px rgba(74,222,128,0.4);
  }
  .cta h2 { color: #06200d; margin-bottom: 0.4rem; }
  .cta p { margin: 0 0 1rem; color: #06200d; opacity: 0.85; }
  .cta a {
    display: inline-block; padding: 0.85rem 1.75rem; border-radius: 999px;
    background: #0a0e17; color: var(--accent); font-weight: 700; font-family: 'Outfit', sans-serif;
    font-size: 1rem; text-decoration: none;
  }
  .cta a:hover { text-decoration: none; transform: translateY(-1px); }
  footer { color: var(--muted); font-size: 0.78rem; margin-top: 3rem; line-height: 1.5; }
  footer p { margin: 0.4rem 0; }
  footer a { color: var(--muted); text-decoration: underline; }
</style>
</head>
<body>
  <div class="wrap">
    <header class="topbar">
      <a href="/" class="brand">Canna<span class="glow">Pick</span>ForMe 🌿</a>
      <a href="/" style="color: var(--muted); font-size: 0.9rem;">Try the matcher →</a>
    </header>

    <nav class="crumbs" aria-label="Breadcrumb">
      <a href="/">Home</a> <span>/</span> <span>Strains</span> <span>/</span> <span>${escape(strain.name)}</span>
    </nav>

    <h1>${escape(strain.name)}</h1>

    <div class="meta-row">
      <span class="type-pill type-${escape(String(strain.type).toLowerCase())}">${escape(typeLabel(strain.type))}</span>
      ${lineageOf(strain) ? `<span>· ${escape(lineageOf(strain))}</span>` : ''}
      ${thcLabel(strain) ? `<span>· ${escape(thcLabel(strain))}</span>` : ''}
    </div>

    ${strain.description ? `<p class="lead">${escape(strain.description)}</p>` : ''}

    ${about ? `<section class="card">
      <h2>About ${escape(strain.name)}</h2>
      <p class="prose">${escape(about)}</p>
    </section>` : ''}

    ${effectsHtml ? `<section class="card">
      <h2>Effects</h2>
      <p class="muted">What ${escape(strain.name)} typically feels like:</p>
      <div>${effectsHtml}</div>
    </section>` : ''}

    ${flavorsHtml ? `<section class="card">
      <h2>Flavors & Aroma</h2>
      <div>${flavorsHtml}</div>
    </section>` : ''}

    ${terpenesHtml ? `<section class="card">
      <h2>Terpenes</h2>
      <p class="muted">Aromatic compounds that shape ${escape(strain.name)}'s effects:</p>
      <div>${terpenesHtml}</div>
    </section>` : ''}

    <div class="cta">
      <h2>Is ${escape(strain.name)} right for tonight?</h2>
      <p>Answer 4 quick questions and we'll tell you whether it matches your mood.</p>
      <a href="/?strain=${escape(strain.id)}">🔥 Match My Mood</a>
    </div>

    ${dispensariesHtml}

    ${faqs.length ? `<section class="card">
      <h2>${escape(strain.name)} FAQ</h2>
      ${faqs.map((f) => `<h3 class="faq-q">${escape(f.q)}</h3>
      <p class="faq-a">${escape(f.a)}</p>`).join('\n      ')}
    </section>` : ''}

    ${compareHtml}

    ${relatedHtml}

    ${guideLinksHtml(strain)}

    <footer>
      <p><strong>For adults 21+ only.</strong> Cannabis must be consumed in a legal space.</p>
      <p>Cannabis remains a Schedule I Controlled Substance under federal law. These statements have not been evaluated by the FDA. Effect descriptions are based on community-reported data and individual experiences vary.</p>
      <p><a href="/">CannaPickForMe</a> · Made with 💨 in California</p>
    </footer>
  </div>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Sitemap & robots
// ---------------------------------------------------------------------------
function sitemap(strainList, pairs = []) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: SITE_URL + '/', priority: '1.0', changefreq: 'weekly' },
    { loc: SITE_URL + '/about', priority: '0.5', changefreq: 'monthly' },
    { loc: SITE_URL + '/lore', priority: '0.5', changefreq: 'monthly' },
    ...strainList.map((s) => ({
      loc: `${SITE_URL}/strain/${s.id}`,
      priority: '0.8',
      changefreq: 'monthly',
    })),
    ...pairs.map((p) => ({
      loc: `${SITE_URL}/compare/${p.slug}`,
      priority: '0.7',
      changefreq: 'monthly',
    })),
  ];
  const body = urls
    .map(
      (u) =>
        `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

const robots = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin.html

Sitemap: ${SITE_URL}/sitemap.xml
`;

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
async function main() {
  // Clean previous output so renamed/removed strains don't leave orphans.
  if (existsSync(OUT_DIR)) await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const pairs = comparisonPairs(strains);
  const compareMap = comparisonsByStrain(pairs);

  let written = 0;
  for (const strain of strains) {
    if (!strain.id || !strain.name) continue;
    const related = relatedStrains(strain, strains, 6);
    const html = strainPage(strain, related, compareMap.get(strain.id) || []);
    await writeFile(join(OUT_DIR, `${strain.id}.html`), html, 'utf8');
    written++;
  }

  await writeFile(join(ROOT, 'public', 'sitemap.xml'), sitemap(strains, pairs), 'utf8');
  await writeFile(join(ROOT, 'public', 'robots.txt'), robots, 'utf8');

  console.log(`[generate-seo] wrote ${written} strain pages to /public/strain/`);
  console.log(`[generate-seo] wrote sitemap.xml (${strains.length + pairs.length + 3} URLs) and robots.txt`);
}

main().then(
  () => {
    // Belt-and-suspenders: explicitly exit so this script never holds the
    // CI build hanging on a lingering handle (Vercel was hanging here).
    process.exit(0);
  },
  (err) => {
    console.error('[generate-seo] failed:', err);
    process.exit(1);
  }
);
