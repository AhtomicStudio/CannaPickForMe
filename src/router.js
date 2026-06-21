import { showScreen } from './main.js';

export function initRouter() {
  window.addEventListener('popstate', handleRoute);

  document.body.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link && link.host === window.location.host && !link.hasAttribute('target')) {
      // Don't intercept auth links or anchor links
      if (link.getAttribute('href').startsWith('#')) return;
      if (link.id === 'auth-links' || link.id === 'result-signup-btn') return;

      const path = link.pathname;
      if (path === '/' || path === '/about' || path === '/lore' || path === '/legal') {
        e.preventDefault();
        window.history.pushState({}, '', path);
        handleRoute();
      }
    }
  });

  // Handle initial deep link
  handleRoute();
}

async function handleRoute() {
  const path = window.location.pathname;

  if (path === '/about') {
    showScreen('screen-about');
    await loadAboutContent();
  } else if (path === '/lore') {
    showScreen('screen-lore');
    await loadLoreContent();
  } else if (path === '/legal') {
    showScreen('screen-legal');
  } else if (path.startsWith('/r/')) {
    // Phase 2 feature: resultId deep linking
    // For now, handled by index.html hash/URL query if any, or just show home
    const ageGateHidden = document.getElementById('age-gate')?.classList.contains('hidden') ?? true;
    const disclaimerHidden = document.getElementById('disclaimer-screen')?.classList.contains('hidden') ?? true;
    if (ageGateHidden && disclaimerHidden) {
      showScreen('home');
    }
  } else {
    // Default to home if past the age gate
    const ageGateHidden = document.getElementById('age-gate')?.classList.contains('hidden') ?? true;
    const disclaimerHidden = document.getElementById('disclaimer-screen')?.classList.contains('hidden') ?? true;
    if (ageGateHidden && disclaimerHidden) {
      showScreen('home');
    }
  }
}

async function loadAboutContent() {
  const { getPageContent } = await import('./services/pagesService.js');
  const data = await getPageContent('about');
  if (!data?.content?.trim()) return;

  const sign = document.querySelector('#screen-about .sign');
  if (sign) {
    sign.innerHTML = `
      <div class="sign__leaf-row">🌿 🍃 🌿</div>
      <h2 class="sign__title">About Me</h2>
      <div class="sign__divider"></div>
      <p class="sign__body sign__body--content" id="about-text"></p>
    `;
    document.getElementById('about-text').textContent = data.content;
  }
}

async function loadLoreContent() {
  const { getInfoTopics } = await import('./services/infoService.js');
  const { getPageContent } = await import('./services/pagesService.js');

  const [topics, loreData, pages] = await Promise.all([
    getInfoTopics(),
    getPageContent('lore'),
    loadLorePages(),
  ]);

  const introEl = document.getElementById('lore-intro');
  if (introEl && loreData?.content?.trim()) {
    introEl.textContent = loreData.content.trim();
  }

  renderTopics(topics, pages);
}

// Static guides + collections generated at build time by
// scripts/generate-content.mjs. Fetched as a manifest so the SPA can list them.
async function loadLorePages() {
  try {
    const res = await fetch('/lore-index.json', { cache: 'no-cache' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data.pages || []);
  } catch { return []; }
}

// Lightweight markdown for admin-authored posts: **bold**, [text](url),
// ![alt](img), - lists, paragraphs. Lets admin posts include photos and links
// to strains (e.g. [Blue Dream](/strain/blue-dream)). Mirrors generate-content.mjs.
function mdLite(md) {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inl = (s) => s
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img class="lore-post-img" src="$2" alt="$1" loading="lazy" />')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  const lines = String(md || '').split('\n');
  let html = '', inList = false, para = [];
  const fp = () => { if (para.length) { html += `<p>${inl(esc(para.join(' ')))}</p>`; para = []; } };
  const cl = () => { if (inList) { html += '</ul>'; inList = false; } };
  for (const raw of lines) {
    const line = raw.trim();
    let m;
    if (!line) { fp(); cl(); }
    else if ((m = line.match(/^[-*]\s+(.+)/))) { fp(); if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inl(esc(m[1]))}</li>`; }
    else para.push(line);
  }
  fp(); cl();
  return html;
}

function renderTopics(topics, pages = []) {
  const body   = document.getElementById('lore-body');
  const tape   = document.getElementById('lore-tape');
  const header = document.querySelector('.lore-header');

  if (!body) return;

  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const hasContent = topics && topics.some(t => t.content?.trim());
  const hasPages = Array.isArray(pages) && pages.length > 0;

  if (!hasContent && !hasPages) {
    if (header) header.style.display = 'none';
    body.innerHTML = `
      <div class="sign">
        <div class="sign__leaf-row">🍃 🌿 🍃</div>
        <span class="sign__cone">🚧</span>
        <p class="sign__overline">Under Construction</p>
        <h2 class="sign__title">The Lore</h2>
        <div class="sign__divider"></div>
        <p class="sign__body">Ancient strain secrets are being decoded.<br>The universe is still speaking. 🔮</p>
        <p class="sign__tagline">— the lore goes deep, be patient</p>
        <div class="sign__tape">🌿 &nbsp; decoding the cosmos &nbsp; 🌿</div>
      </div>`;
    return;
  }

  if (header) header.style.display = '';
  if (tape) tape.style.display = '';

  const pagesHTML = hasPages
    ? `<div class="lore-pages">${pages.map(p => `
        <a class="lore-page-card" href="/lore/${esc(p.slug)}">
          <span class="lore-page-card__kind">${esc(p.overline || (p.type === 'hub' ? 'Collection' : 'Guide'))}</span>
          <span class="lore-page-card__title">${esc(p.title)}</span>
          ${p.description ? `<span class="lore-page-card__desc">${esc(p.description)}</span>` : ''}
        </a>`).join('')}</div>`
    : '';

  body.innerHTML = pagesHTML + '<div class="topics-grid" id="topics-grid"></div>';
  const grid = document.getElementById('topics-grid');

  if (!hasContent) { if (grid) grid.remove(); return; }

  if (!topics || topics.length === 0) {
    grid.innerHTML = `
      <div style="text-align:center;padding:3rem 1rem;color:var(--text-dim);">
        <div style="font-size:2rem;margin-bottom:0.75rem;">🔮</div>
        <p style="font-size:0.9rem;">The lore is being decoded…<br>Check back soon.</p>
      </div>`;
    return;
  }

  topics.forEach((topic, i) => {
    const icon    = topic.icon    || '🌿';
    const teaser  = topic.teaser  || '';
    const content = topic.content || '';
    const titleText = topic.title || '';

    const card = document.createElement('div');
    card.className = 'topic-card';
    card.style.animationDelay = `${i * 0.06}s`;
    card.innerHTML = `
      <button class="topic-card__trigger" aria-expanded="false" aria-controls="topic-body-${i}">
        <span class="topic-card__icon" aria-hidden="true">${icon}</span>
        <span class="topic-card__text">
          <span class="topic-card__title">${titleText}</span>
          ${teaser ? `<span class="topic-card__teaser">${teaser}</span>` : ''}
        </span>
        <span class="topic-card__chevron" aria-hidden="true">▾</span>
      </button>
      <div class="topic-card__body" id="topic-body-${i}" role="region">
        <div class="topic-card__body-inner">
          <div class="topic-card__content">
            ${topic.image ? `<img class="topic-card__hero" src="${topic.image}" alt="${titleText}" loading="lazy" />` : ''}
            ${content ? mdLite(content) : '<p class="topic-coming-soon">✦ Content coming soon…</p>'}
          </div>
        </div>
      </div>
    `;

    const trigger = card.querySelector('.topic-card__trigger');
    trigger.addEventListener('click', () => {
      const isOpen = card.classList.contains('topic-card--open');
      document.querySelectorAll('.topic-card--open').forEach(c => {
        c.classList.remove('topic-card--open');
        c.querySelector('.topic-card__trigger').setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        card.classList.add('topic-card--open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });

    grid.appendChild(card);
  });
}
