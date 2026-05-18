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

// Build a short, search-friendly meta description.
function buildMetaDescription(strain) {
  const type = typeLabel(strain.type);
  const top = (strain.effects || []).slice(0, 4).join(', ').toLowerCase();
  const flavors = (strain.flavors || []).slice(0, 3).join(', ').toLowerCase();
  const pieces = [
    `${strain.name} is a ${type.toLowerCase()} strain`,
    top ? `known for ${top} effects` : null,
    flavors ? `with ${flavors} flavors` : null,
  ].filter(Boolean);
  let desc = `${pieces.join(', ')}.`;
  if (strain.genetics) desc += ` Genetics: ${strain.genetics}.`;
  desc += ' Match it to your mood with the free CannaPickForMe strain matcher.';
  if (desc.length > 300) desc = desc.slice(0, 297) + '...';
  return desc;
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
    brand: { '@type': 'Brand', name: strain.genetics || 'Cannabis' },
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
    ],
  };
  if (typeof strain.rating === 'number') {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: strain.rating,
      bestRating: 5,
      // We don't have real review counts; omit ratingCount to avoid lying to Google.
    };
  }
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
function strainPage(strain, related) {
  const title = `${strain.name} Strain — Effects, Flavors & Match Your Mood | CannaPickForMe`;
  const desc = buildMetaDescription(strain);
  const url = `${SITE_URL}/strain/${strain.id}`;
  const dispensaries = (strain.dispensaries || [])
    .map((id) => DISPENSARIES[id])
    .filter(Boolean);

  const effectsHtml = (strain.effects || [])
    .map((e) => `<span class="chip">${escape(e)}</span>`)
    .join('');
  const flavorsHtml = (strain.flavors || [])
    .map((f) => `<span class="chip chip--alt">${escape(f)}</span>`)
    .join('');
  const dispensariesHtml = dispensaries.length
    ? `<section class="card">
        <h2>Where to find ${escape(strain.name)}</h2>
        <p class="muted">Available at participating Bay Area dispensaries:</p>
        <ul class="disp-list">
          ${dispensaries.map((d) => `<li>${escape(d)}</li>`).join('')}
        </ul>
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
  .muted { color: var(--muted); margin: 0 0 0.5rem; font-size: 0.9rem; }
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
      ${typeof strain.rating === 'number' ? `<span class="rating">★ ${strain.rating.toFixed(1)}</span>` : ''}
      ${strain.genetics ? `<span>· ${escape(strain.genetics)}</span>` : ''}
    </div>

    ${strain.description ? `<p class="lead">${escape(strain.description)}</p>` : ''}

    ${effectsHtml ? `<section class="card">
      <h2>Effects</h2>
      <p class="muted">What ${escape(strain.name)} typically feels like:</p>
      <div>${effectsHtml}</div>
    </section>` : ''}

    ${flavorsHtml ? `<section class="card">
      <h2>Flavors & Aroma</h2>
      <div>${flavorsHtml}</div>
    </section>` : ''}

    <div class="cta">
      <h2>Is ${escape(strain.name)} right for tonight?</h2>
      <p>Answer 4 quick questions and we'll tell you whether it matches your mood.</p>
      <a href="/">🔥 Match My Mood</a>
    </div>

    ${dispensariesHtml}

    ${relatedHtml}

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
function sitemap(strainList) {
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

  let written = 0;
  for (const strain of strains) {
    if (!strain.id || !strain.name) continue;
    const related = relatedStrains(strain, strains, 6);
    const html = strainPage(strain, related);
    await writeFile(join(OUT_DIR, `${strain.id}.html`), html, 'utf8');
    written++;
  }

  await writeFile(join(ROOT, 'public', 'sitemap.xml'), sitemap(strains), 'utf8');
  await writeFile(join(ROOT, 'public', 'robots.txt'), robots, 'utf8');

  console.log(`[generate-seo] wrote ${written} strain pages to /public/strain/`);
  console.log(`[generate-seo] wrote sitemap.xml (${strains.length + 3} URLs) and robots.txt`);
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
