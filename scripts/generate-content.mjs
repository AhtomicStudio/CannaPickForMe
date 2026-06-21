// scripts/generate-content.mjs
// SEO content engine. Renders two kinds of static, indexable pages into
// /public/lore/<slug>.html (served at /lore/<slug> via cleanUrls):
//   1. Editorial posts  — markdown files in content/lore/*.md (fact-checked).
//   2. Data-driven hubs  — collection pages auto-built from strains.json.
// Both deep-link into the /strain/<id> pages, and both are added to sitemap.xml.
//
// Runs after generate-seo.mjs in `prebuild` (so the sitemap already exists).
// No npm dependencies.

import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SITE_URL = 'https://cannapickforme.com';
const OG_IMAGE = `${SITE_URL}/icon-512.png`;
const OUT_DIR = join(ROOT, 'public', 'lore');
const CONTENT_DIR = join(ROOT, 'content', 'lore');
const SITEMAP = join(ROOT, 'public', 'sitemap.xml');
const TODAY = new Date().toISOString().slice(0, 10);

const strains = JSON.parse(await readFile(join(ROOT, 'public/data/strains.json'), 'utf8'));
const strainById = new Map(strains.map((s) => [s.id, s]));

// ── helpers ────────────────────────────────────────────────────────────────
const escape = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const typeLabel = (t) => ({ sativa: 'Sativa', indica: 'Indica', hybrid: 'Hybrid' }[String(t).toLowerCase()] || 'Hybrid');

// Minimal, safe markdown: ## / ### headings, - lists, **bold**, [text](url), paragraphs, ---.
function inline(s) {
  return s
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img class="lore-post-img" src="$2" alt="$1" loading="lazy" />')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
}
function mdToHtml(md) {
  const lines = md.split('\n');
  let html = '', inList = false, para = [];
  const flushPara = () => { if (para.length) { html += `<p>${inline(escape(para.join(' ')))}</p>\n`; para = []; } };
  const closeList = () => { if (inList) { html += '</ul>\n'; inList = false; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { flushPara(); closeList(); }
    else if ((m = line.match(/^###\s+(.+)/))) { flushPara(); closeList(); html += `<h3>${inline(escape(m[1]))}</h3>\n`; }
    else if ((m = line.match(/^##\s+(.+)/))) { flushPara(); closeList(); html += `<h2>${inline(escape(m[1]))}</h2>\n`; }
    else if ((m = line.match(/^#\s+(.+)/))) { flushPara(); closeList(); html += `<h2>${inline(escape(m[1]))}</h2>\n`; }
    else if (/^---+$/.test(line)) { flushPara(); closeList(); html += '<hr/>\n'; }
    else if ((m = line.match(/^[-*]\s+(.+)/))) { flushPara(); if (!inList) { html += '<ul>\n'; inList = true; } html += `<li>${inline(escape(m[1]))}</li>\n`; }
    else { para.push(line); }
  }
  flushPara(); closeList();
  return html;
}
function parseFrontMatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    data[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { data, body: m[2] };
}

// ── data-driven hubs ─────────────────────────────────────────────────────────
const HUBS = [
  {
    slug: 'best-body-high-strains', title: 'Best Body High Strains', overline: 'Strain Collection',
    intro: 'Heavy, physical, melt-into-the-couch flower. These are the body-dominant strains in our library.',
    match: (s) => (s.effects || []).includes('Body High'),
  },
  {
    slug: 'best-head-high-strains', title: 'Best Head High Strains', overline: 'Strain Collection',
    intro: 'Cerebral, uplifting, creative flower — the strains that live in your head, not your couch.',
    match: (s) => (s.effects || []).includes('Head High'),
  },
  {
    slug: 'best-sleepy-strains', title: 'Best Strains for Sleep', overline: 'Strain Collection',
    intro: 'Sedating indicas and heavy hybrids for winding down — and actually staying down.',
    match: (s) => (s.effects || []).includes('Sleepy'),
  },
  {
    slug: 'best-energizing-strains', title: 'Best Energizing Strains', overline: 'Strain Collection',
    intro: 'Daytime flower with a get-up-and-go lift — for chores, hikes, or just not melting into the couch.',
    match: (s) => (s.effects || []).includes('Energetic'),
  },
  {
    slug: 'best-relaxing-strains', title: 'Best Relaxing Strains', overline: 'Strain Collection',
    intro: 'Mellow, easygoing flower for decompressing after a long one.',
    match: (s) => (s.effects || []).includes('Relaxed'),
  },
  {
    slug: 'best-creative-strains', title: 'Best Strains for Creativity', overline: 'Strain Collection',
    intro: 'Cerebral, free-associating flower for making music, art, or just thinking sideways.',
    match: (s) => (s.effects || []).includes('Creative'),
  },
  {
    slug: 'best-focus-strains', title: 'Best Strains for Focus', overline: 'Strain Collection',
    intro: 'Clear-headed flower that helps you lock in instead of spacing out.',
    match: (s) => (s.effects || []).includes('Focused'),
  },
  {
    slug: 'best-indica-strains', title: 'Best Indica Strains', overline: 'Strain Collection',
    intro: 'The heavy, relaxing, body-forward side of the menu.',
    match: (s) => String(s.type).toLowerCase() === 'indica',
  },
  {
    slug: 'best-sativa-strains', title: 'Best Sativa Strains', overline: 'Strain Collection',
    intro: 'The bright, energizing, head-forward side of the menu.',
    match: (s) => String(s.type).toLowerCase() === 'sativa',
  },
  {
    slug: 'best-hybrid-strains', title: 'Best Hybrid Strains', overline: 'Strain Collection',
    intro: 'The best-of-both-worlds middle of the menu — balanced head and body.',
    match: (s) => String(s.type).toLowerCase() === 'hybrid',
  },
];

// ── shared page shell ────────────────────────────────────────────────────────
const CSS = `
  :root{--bg:#0a0e17;--card:rgba(255,255,255,0.04);--border:rgba(255,255,255,0.08);--text:#e5e7eb;--muted:#9ca3af;--accent:#4ade80;--accent-2:#fbbf24;--cyan:#67e8f9;--indica:#a78bfa;--sativa:#fb923c;--hybrid:#4ade80;}
  *{box-sizing:border-box}html,body{margin:0;padding:0}
  body{background:radial-gradient(1200px 600px at 50% -10%,#1a2032 0%,var(--bg) 60%);color:var(--text);font-family:'Space Grotesk',system-ui,-apple-system,sans-serif;line-height:1.6;min-height:100vh}
  a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
  .wrap{max-width:760px;margin:0 auto;padding:1.5rem 1.25rem 4rem}
  .topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem}
  .topbar a.brand{font-family:'Outfit',sans-serif;font-weight:800;color:var(--text);font-size:1.1rem}
  .brand .glow{color:var(--accent)}
  .crumbs{font-size:.85rem;color:var(--muted);margin-bottom:1rem}
  .overline{font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin:0 0 .4rem}
  h1{font-family:'Outfit',sans-serif;font-size:clamp(2rem,6vw,2.6rem);margin:0 0 .5rem;line-height:1.1}
  h2{font-family:'Outfit',sans-serif;font-size:1.4rem;margin:2rem 0 .6rem}
  h3{font-family:'Outfit',sans-serif;font-size:1.1rem;margin:1.4rem 0 .4rem}
  p{margin:0 0 1rem}.lead{font-size:1.1rem;color:#d1d5db}
  ul{margin:0 0 1rem;padding-left:1.2rem}li{margin:.3rem 0}
  hr{border:none;border-top:1px solid var(--border);margin:2rem 0}
  .meta{color:var(--muted);font-size:.85rem;margin-bottom:1.5rem}
  .grid{list-style:none;padding:0;margin:1rem 0;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:.6rem}
  .scard{display:block;padding:.8rem .9rem;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid var(--border);color:var(--text)}
  .scard:hover{background:rgba(255,255,255,0.06);border-color:rgba(74,222,128,.4);text-decoration:none}
  .scard__name{display:block;font-weight:600;font-family:'Outfit',sans-serif;margin-bottom:.25rem}
  .pill{display:inline-block;font-size:.7rem;padding:.1rem .5rem;border-radius:999px;border:1px solid currentColor;margin-bottom:.35rem}
  .type-sativa{color:var(--sativa)}.type-indica{color:var(--indica)}.type-hybrid{color:var(--hybrid)}
  .scard__eff{display:block;font-size:.8rem;color:var(--muted)}
  .cta{background:linear-gradient(135deg,#4ade80,#22d3ee);color:#06200d;padding:1.25rem;border-radius:16px;text-align:center;margin:2.5rem 0}
  .cta h2{color:#06200d;margin:.2rem 0 .4rem}.cta p{margin:0 0 1rem;color:#06200d;opacity:.85}
  .cta a{display:inline-block;padding:.8rem 1.7rem;border-radius:999px;background:#0a0e17;color:var(--accent);font-weight:700;font-family:'Outfit',sans-serif}
  .cta a:hover{text-decoration:none}
  .morelore{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:1rem 1.25rem;margin:1.5rem 0}
  .morelore a{display:inline-block;margin:.2rem .6rem .2rem 0}
  footer{color:var(--muted);font-size:.78rem;margin-top:3rem;line-height:1.5}footer p{margin:.4rem 0}footer a{color:var(--muted);text-decoration:underline}
`;

function shell({ title, desc, url, jsonLd, body }) {
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
<meta property="og:title" content="${escape(title)}" />
<meta property="og:description" content="${escape(desc)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${OG_IMAGE}" />
<meta property="og:site_name" content="CannaPickForMe" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escape(title)}" />
<meta name="twitter:description" content="${escape(desc)}" />
<meta name="twitter:image" content="${OG_IMAGE}" />
${jsonLd.map((j) => `<script type="application/ld+json">${j}</script>`).join('\n')}
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=Space+Grotesk:wght@400;500;600&display=swap" rel="stylesheet" />
<style>${CSS}</style>
</head>
<body>
  <div class="wrap">
    <header class="topbar">
      <a href="/" class="brand">Canna<span class="glow">Pick</span>ForMe 🌿</a>
      <a href="/" style="color:var(--muted);font-size:.9rem;">Try the matcher →</a>
    </header>
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> <a href="/lore">The Lore</a> <span>/</span> <span>${escape(title)}</span></nav>
    ${body}
    <div class="cta">
      <h2>Not sure what to grab tonight?</h2>
      <p>Answer 4 quick questions and we'll match a strain to your mood.</p>
      <a href="/">🔥 Match My Mood</a>
    </div>
    <footer>
      <p><strong>For adults 21+ only.</strong> Educational content, not medical advice. Cannabis affects everyone differently.</p>
      <p>Cannabis remains a Schedule I Controlled Substance under federal law. These statements have not been evaluated by the FDA. Effect and terpene descriptions are based on community-reported data and emerging research; individual experiences vary.</p>
      <p><a href="/">CannaPickForMe</a> · Made with 💨 in California</p>
    </footer>
  </div>
</body>
</html>
`;
}

const breadcrumbLd = (title, url) => JSON.stringify({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'The Lore', item: `${SITE_URL}/lore` },
    { '@type': 'ListItem', position: 3, name: title, item: url },
  ],
});

function strainGrid(list) {
  return `<ul class="grid">${list.map((s) => `<li><a class="scard" href="/strain/${escape(s.id)}">
    <span class="scard__name">${escape(s.name)}</span>
    <span class="pill type-${escape(String(s.type).toLowerCase())}">${escape(typeLabel(s.type))}</span>
    <span class="scard__eff">${escape((s.effects || []).filter((e) => e !== 'Head High' && e !== 'Body High').slice(0, 3).join(' · '))}</span>
  </a></li>`).join('')}</ul>`;
}

// ── renderers ────────────────────────────────────────────────────────────────
function renderHub(hub) {
  const matched = strains.filter(hub.match)
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 60);
  if (matched.length < 5) return null; // skip thin hubs — no low-value pages
  const url = `${SITE_URL}/lore/${hub.slug}`;
  const desc = `${hub.intro} ${matched.length} strains.`.slice(0, 300);
  const others = HUBS.filter((h) => h.slug !== hub.slug).slice(0, 5);
  const body = `
    <p class="overline">${escape(hub.overline)}</p>
    <h1>${escape(hub.title)}</h1>
    <p class="lead">${escape(hub.intro)}</p>
    <p class="meta">${matched.length} strains in this collection.</p>
    ${strainGrid(matched)}
    ${others.length ? `<div class="morelore"><strong>More from The Lore:</strong><br/>${others.map((h) => `<a href="/lore/${h.slug}">${escape(h.title)} →</a>`).join('')}</div>` : ''}`;
  const itemList = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: hub.title, description: desc, url,
    mainEntity: { '@type': 'ItemList', numberOfItems: matched.length,
      itemListElement: matched.map((s, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/strain/${s.id}`, name: s.name })) },
  });
  return { html: shell({ title: `${hub.title} | CannaPickForMe`, desc, url, jsonLd: [itemList, breadcrumbLd(hub.title, url)], body }), url, slug: hub.slug,
    meta: { slug: hub.slug, title: hub.title, description: hub.intro, overline: hub.overline, type: 'hub' } };
}

function renderPost(data, bodyMd) {
  const url = `${SITE_URL}/lore/${data.slug}`;
  const hubLinks = (data.relatedHubs || '').split(',').map((s) => s.trim()).filter(Boolean)
    .map((slug) => HUBS.find((h) => h.slug === slug)).filter(Boolean);
  const body = `
    ${data.overline ? `<p class="overline">${escape(data.overline)}</p>` : ''}
    <h1>${escape(data.title)}</h1>
    ${data.date ? `<p class="meta">Updated ${escape(data.date)}</p>` : ''}
    ${mdToHtml(bodyMd)}
    ${hubLinks.length ? `<div class="morelore"><strong>Explore the collections:</strong><br/>${hubLinks.map((h) => `<a href="/lore/${h.slug}">${escape(h.title)} →</a>`).join('')}</div>` : ''}`;
  const article = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Article', headline: data.title,
    description: data.description || '', datePublished: data.date || TODAY, dateModified: data.date || TODAY,
    image: OG_IMAGE, mainEntityOfPage: url,
    author: { '@type': 'Organization', name: 'CannaPickForMe' },
    publisher: { '@type': 'Organization', name: 'CannaPickForMe', logo: { '@type': 'ImageObject', url: OG_IMAGE } },
  });
  return { html: shell({ title: `${data.title} | CannaPickForMe`, desc: data.description || data.title, url, jsonLd: [article, breadcrumbLd(data.title, url)], body }), url, slug: data.slug,
    meta: { slug: data.slug, title: data.title, description: data.description || '', overline: data.overline || '', type: 'post' } };
}

// ── run ──────────────────────────────────────────────────────────────────────
async function loadPosts() {
  if (!existsSync(CONTENT_DIR)) return [];
  const files = (await readdir(CONTENT_DIR)).filter((f) => f.endsWith('.md'));
  const out = [];
  for (const f of files) {
    const { data, body } = parseFrontMatter(await readFile(join(CONTENT_DIR, f), 'utf8'));
    if (!data.slug || !data.title) { console.warn(`[content] skipping ${f}: needs title + slug front-matter`); continue; }
    out.push(renderPost(data, body));
  }
  return out;
}

async function updateSitemap(pages) {
  if (!existsSync(SITEMAP)) { console.warn('[content] sitemap.xml not found — run generate-seo first'); return; }
  let xml = await readFile(SITEMAP, 'utf8');
  const block = pages.map((p) => `  <url>\n    <loc>${p.url}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`).join('\n');
  // De-dupe: strip any prior /lore/ entries we added, then insert fresh before </urlset>.
  xml = xml.replace(/\s*<url>\s*<loc>[^<]*\/lore\/[^<]*<\/loc>[\s\S]*?<\/url>/g, '');
  xml = xml.replace('</urlset>', `${block}\n</urlset>`);
  await writeFile(SITEMAP, xml, 'utf8');
}

async function main() {
  if (existsSync(OUT_DIR)) await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const pages = [...HUBS.map(renderHub).filter(Boolean), ...(await loadPosts())];
  for (const page of pages) await writeFile(join(OUT_DIR, `${page.slug}.html`), page.html, 'utf8');
  await updateSitemap(pages);

  // Manifest so the SPA /lore screen can list these static pages as cards.
  await writeFile(join(ROOT, 'public', 'lore-index.json'), JSON.stringify(pages.map((p) => p.meta), null, 2) + '\n', 'utf8');

  console.log(`[content] wrote ${pages.length} page(s) to /public/lore/ (${HUBS.length} hubs + ${pages.length - HUBS.length} posts) + lore-index.json`);
}

main().then(() => process.exit(0), (err) => { console.error('[content] failed:', err); process.exit(1); });
