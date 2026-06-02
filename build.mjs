// Build statique des pages légales Cliché — zéro dépendance npm.
// Lit src/{page}-{lang}.md, convertit en HTML, écrit les routes propres.
//   FR : /{page}/index.html      EN : /en/{page}/index.html
// Relancer après chaque édition des .md : `node build.mjs`.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');

const PAGES = ['privacy', 'terms', 'support'];
const LANGS = ['fr', 'en'];

const NAV = {
  fr: { privacy: 'Confidentialité', terms: 'Conditions', support: 'Aide' },
  en: { privacy: 'Privacy', terms: 'Terms', support: 'Support' },
};
const LANG_LABEL = { fr: 'FR', en: 'EN' };
const TAGLINE = {
  fr: 'Range ta pellicule. Sans abonnement.',
  en: 'Tidy your library. No subscription.',
};

// ── Mini convertisseur Markdown → HTML (sous-ensemble utilisé par nos pages).
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function inline(text) {
  // échappe d'abord, puis ré-injecte le markdown inline.
  let t = escapeHtml(text);
  // liens [label](url)
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
    let href = url.trim();
    // liens internes absolus → relatifs (chaque page est 1 niveau sous sa racine de langue)
    if (href === '/privacy') href = '../privacy/';
    else if (href === '/terms') href = '../terms/';
    else if (href === '/support') href = '../support/';
    const ext = /^https?:/.test(href);
    const attrs = ext ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${href}"${attrs}>${label}</a>`;
  });
  // gras **x**
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // italique _x_
  t = t.replace(/(^|[\s(])_([^_]+)_/g, '$1<em>$2</em>');
  return t;
}

function mdToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let i = 0;
  let para = [];
  let quote = [];
  let list = [];

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(' '))}</p>`);
      para = [];
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      out.push(
        `<blockquote>${quote
          .map((q) => `<p>${inline(q)}</p>`)
          .join('')}</blockquote>`,
      );
      quote = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      out.push(
        `<ul>${list.map((li) => `<li>${inline(li)}</li>`).join('')}</ul>`,
      );
      list = [];
    }
  };
  const flushAll = () => {
    flushPara();
    flushQuote();
    flushList();
  };

  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    if (t === '') {
      flushAll();
    } else if (t.startsWith('## ')) {
      flushAll();
      out.push(`<h2>${inline(t.slice(3))}</h2>`);
    } else if (t.startsWith('# ')) {
      flushAll();
      out.push(`<h1>${inline(t.slice(2))}</h1>`);
    } else if (t.startsWith('> ')) {
      flushPara();
      flushList();
      quote.push(t.slice(2));
    } else if (t.startsWith('- ')) {
      flushPara();
      flushQuote();
      list.push(t.slice(2));
    } else {
      flushQuote();
      flushList();
      para.push(t);
    }
    i++;
  }
  flushAll();
  return out.join('\n      ');
}

// ── Template HTML.
function page({ lang, slug, bodyHtml, depth }) {
  const cssPath = '../'.repeat(depth) + 'assets/style.css';
  const langRoot = lang === 'en' ? '../'.repeat(depth - 1) : '../'.repeat(depth);
  // Lien vers l'autre langue, même page.
  const other = lang === 'fr' ? 'en' : 'fr';
  const otherHref =
    lang === 'fr'
      ? `${'../'.repeat(depth)}en/${slug}/`
      : `${'../'.repeat(depth)}${slug}/`; // depuis /en/{slug}/ → ../../{slug}/ ... ajusté plus bas
  // depth: FR pages = 1 ; EN pages = 2.
  // FR /{slug}/  → EN ../en/{slug}/
  // EN /en/{slug}/ → FR ../../{slug}/
  const toOther =
    lang === 'fr' ? `../en/${slug}/` : `../../${slug}/`;
  const homeHref = lang === 'fr' ? '../' : '../../';
  const nav = NAV[lang];
  const navLinks = PAGES.map((p) => {
    const href =
      lang === 'fr'
        ? p === slug
          ? '#'
          : `../${p}/`
        : p === slug
          ? '#'
          : `../${p}/`;
    const active = p === slug ? ' class="active"' : '';
    return `<a href="${href}"${active}>${nav[p]}</a>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="index, follow" />
  <title>Cliché — ${nav[slug]}</title>
  <link rel="stylesheet" href="${cssPath}" />
</head>
<body>
  <header class="top">
    <a class="brand" href="${homeHref}"><em>Cliché</em></a>
    <nav class="pages">${navLinks}</nav>
    <a class="lang" href="${toOther}">${LANG_LABEL[other]}</a>
  </header>
  <main>
      ${bodyHtml}
  </main>
  <footer>
    <p>${TAGLINE[lang]}</p>
    <p class="muted">© ${new Date().getFullYear()} Cliché · <a href="${
      lang === 'fr' ? '../privacy/' : '../privacy/'
    }">${nav.privacy}</a> · <a href="${
      lang === 'fr' ? '../terms/' : '../terms/'
    }">${nav.terms}</a> · <a href="${
      lang === 'fr' ? '../support/' : '../support/'
    }">${nav.support}</a></p>
  </footer>
</body>
</html>
`;
}

// ── Landing racine (FR, toggle EN).
function landing() {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cliché — Informations légales</title>
  <link rel="stylesheet" href="assets/style.css" />
</head>
<body>
  <header class="top">
    <span class="brand"><em>Cliché</em></span>
    <a class="lang" href="en/privacy/">EN</a>
  </header>
  <main>
    <h1>Cliché</h1>
    <p>${TAGLINE.fr}</p>
    <ul class="landing">
      <li><a href="privacy/">Politique de confidentialité</a></li>
      <li><a href="terms/">Conditions d'utilisation</a></li>
      <li><a href="support/">Aide &amp; support</a></li>
    </ul>
  </main>
  <footer>
    <p class="muted">© ${new Date().getFullYear()} Cliché</p>
  </footer>
</body>
</html>
`;
}

// ── Build.
for (const lang of LANGS) {
  for (const slug of PAGES) {
    const md = readFileSync(join(SRC, `${slug}-${lang}.md`), 'utf8');
    const bodyHtml = mdToHtml(md);
    const depth = lang === 'fr' ? 1 : 2;
    const dir =
      lang === 'fr' ? join(ROOT, slug) : join(ROOT, 'en', slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), page({ lang, slug, bodyHtml, depth }));
    console.log(`✓ ${lang}/${slug}`);
  }
}
writeFileSync(join(ROOT, 'index.html'), landing());
writeFileSync(join(ROOT, '.nojekyll'), '');
console.log('✓ landing + .nojekyll');
