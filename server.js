const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const rules = require('./reglements.json');
const products = require('./boutique.json');

const css = fs.readFileSync(path.join(__dirname, 'style.css'));
const backgroundPath = path.join(__dirname, 'dreamlight-background.webp');
const background = fs.existsSync(backgroundPath) ? fs.readFileSync(backgroundPath) : null;
const logo = fs.readFileSync(path.join(__dirname, 'dreamlight-logo.png'));
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
const ruleUrl = rule => '/reglements/' + encodeURIComponent(rule.slug);


const ruleIcons = {
  "general": "<path d=\"M12 6.5C9 4.5 6 4.5 3 5.5V19c3-1 6-1 9 1 3-2 6-2 9-1V5.5c-3-1-6-1-9 1Zm0 0V20\"/><path d=\"M6.5 9h2m-2 3h2m7-3h2m-2 3h2\"/>",
  "jeu": "<path d=\"M8 7h8c2.4 0 3.6 1.4 4.3 3.6l1.2 4.5c.6 2.4-1.8 4-3.5 2.3l-2-2.1H8l-2 2.1c-1.7 1.7-4.1.1-3.5-2.3l1.2-4.5C4.4 8.4 5.6 7 8 7Z\"/><path d=\"M6.5 11.5h4m-2-2v4m6.7-2.5h.01m2.5 2h.01\"/>",
  "illegal": "<path d=\"M12 3 3 8l9 5 9-5-9-5ZM3 12l9 5 9-5M3 16l9 5 9-5\"/>",
  "legal": "<path d=\"M12 4v15m-4 1h8M4.5 7h15M6 7l-3 6h6L6 7Zm12 0-3 6h6l-3-6ZM3 13a3 3 0 0 0 6 0m6 0a3 3 0 0 0 6 0\"/>"
};

function ruleIcon(rule) {
  if (!Object.hasOwn(ruleIcons, rule.slug)) {
    return `<span class="icon" aria-hidden="true">${escape(rule.icone ?? '')}</span>`;
  }
  return `<span class="icon icon--${escape(rule.slug)}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" focusable="false">${ruleIcons[rule.slug]}</svg></span>`;
}

function httpsLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function layout(title, body, current = '') {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)} · Dreamlight</title><link rel="stylesheet" href="/style.css"><link rel="icon" type="image/png" href="/dreamlight-logo.png"></head>
  <body${background ? ' class="custom-background"' : ''}><header><div class="shell top"><a class="brand" href="/"><img src="/dreamlight-logo.png" width="42" height="40" alt=""> Dreamlight RP</a>
  <nav class="main-nav" aria-label="Navigation principale">${[
    ['/', 'Accueil'], ['/reglements', 'Règlements'], ['/boutique', 'Boutique']
  ].map(([url, label]) => `<a href="${url}"${current === url ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav></div></header>
  <main class="shell">${body}</main>
  <footer class="shell">Dreamlight <span>Centre des règlements</span></footer></body></html>`;
}

function legalIndex(rule) {
  const cards = rule.rubriques.map(item => `<a class="card legal-card" href="${ruleUrl(rule)}/${encodeURIComponent(item.slug)}">
    <h2>${escape(item.titre)}</h2><span class="action">${item.reglement || item.sections?.length ? 'Lire le règlement' : 'Texte à venir'}</span></a>`).join('');
  return layout(rule.titre, `<a class="back" href="/reglements">Tous les règlements</a>
    <div class="page-heading">${ruleIcon(rule)}<div><h1>${escape(rule.titre)}</h1><p>${escape(rule.description)}</p></div></div>
    <div class="grid legal-grid">${cards}</div>`);
}

function renderLegalDocument(markdown) {
  const contents = [];
  const inline = text => escape(text).replace(/\*\*([^*]+)\*\*|\*([^*]+)\*/g,
    (_, bold, italic) => bold ? '<strong>' + bold + '</strong>' : '<em>' + italic + '</em>');
  const html = markdown.split(/\n[ \t]*\n/).map(block => {
    const lines = block.split('\n');
    if (lines.every(line => line.startsWith('- '))) {
      return '<ul>' + lines.map(line => '<li>' + inline(line.slice(2)) + '</li>').join('') + '</ul>';
    }
    return lines.map(line => {
      if (/^━+$/.test(line)) return '<hr>';
      if (line.startsWith('## ')) {
        const title = line.slice(3);
        const id = 'article-' + title.slice(0, 2);
        contents.push('<li><a href="#' + id + '">' + escape(title) + '</a></li>');
        return '<h3 id="' + id + '">' + escape(title) + '</h3>';
      }
      if (line.startsWith('### ')) return '<h2>' + escape(line.slice(4)) + '</h2>';
      if (line.startsWith('# ')) return '<p class="document-brand">' + escape(line.slice(2)) + '</p>';
      return '<p>' + inline(line.trimEnd()) + '</p>';
    }).join('');
  }).join('');

  return {
    html,
    toc: '<nav class="side legal-toc" aria-label="Sommaire du règlement"><details open><summary>Sommaire</summary><ul>' + contents.join('') + '</ul></details></nav>'
  };
}

function legalDetail(rule, item) {
  const document = item.reglement && renderLegalDocument(item.reglement);
  const content = document ? document.html : item.sections.length
    ? renderSections(item.sections)
    : '<p class="notice">Le règlement de cette rubrique sera ajouté prochainement.</p>';
  return layout(item.titre, `<a class="back" href="${ruleUrl(rule)}">Règlement légal</a>
    <div class="reading${document ? ' reading--document' : ''}">${document ? document.toc : ''}<article><h1>${escape(item.titre)}</h1>${content}</article></div>`);
}

function ruleCards() {
  return rules.map(rule => `<a class="card home-card home-card--${escape(rule.slug)}" href="${ruleUrl(rule)}">
    ${ruleIcon(rule)}<h3>${escape(rule.titre)}</h3>
    <p>${escape(rule.description)}</p><span class="action">${rule.rubriques ? 'Voir les sous-catégories' : rule.sections.length ? 'Lire le règlement' : 'Texte à venir'}</span></a>`).join('');
}

function home() {
  const discord = httpsLink(process.env.DREAMLIGHT_DISCORD_URL);
  return layout('Accueil', `<section class="hero"><div class="orb" aria-hidden="true"></div>
    <div class="hero-copy"><h1>Dreamlight <em>RP</em></h1>
    <p>Crée ton personnage, trouve ta place en ville et écris ton histoire avec les autres joueurs.</p>
    <div class="hero-actions"><a class="button" href="/reglements">Lire les règlements</a>
    <a class="button button--outline" href="/boutique">Voir la boutique</a></div></div>
    <img class="hero-logo" src="/dreamlight-logo.png" width="480" height="448" alt=""></section>
    <section id="reglements"><h2>Règlements</h2><div class="grid home-grid">${ruleCards()}</div></section>
    ${discord ? `<div class="hero-actions" style="margin-bottom: 2rem"><a class="button" href="${escape(discord)}">Rejoindre le Discord</a></div>` : ''}`, '/');
}

function rulesIndex() {
  return layout('Règlements', `<section class="portal-heading"><h1>Règlements</h1>
    <p>Choisis le règlement qui correspond à ton activité sur Dreamlight RP.</p></section>
    <div class="grid home-grid">${ruleCards()}</div>`, '/reglements');
}

function shop() {
  const cards = products.map(product => {
    const checkout = httpsLink(product.lien);
    return `<article class="product"><h2>${escape(product.nom)}</h2><p>${escape(product.description)}</p>
      <div class="product-footer"><strong>${escape(product.prix)}</strong>
      ${checkout ? `<a class="button" href="${escape(checkout)}" aria-label="Acheter ${escape(product.nom)}">Acheter</a>` : '<span class="notice">Indisponible</span>'}</div></article>`;
  }).join('');
  return layout('Boutique', `<section class="portal-heading"><h1>Boutique</h1>
    <p>Les offres du serveur Dreamlight RP.</p></section>
    ${cards ? `<div class="grid portal-grid">${cards}</div>` :
      '<section class="shop-empty"><h2>Aucune offre disponible</h2><p>Les offres apparaîtront ici à l’ouverture de la boutique.</p></section>'}`, '/boutique');
}

function renderSections(sections) {
  return sections.map(section => `<section><h2>${escape(section.titre)}</h2><p>${escape(section.texte)}</p></section>`).join('');
}

function detail(rule) {
  const links = rules.map(item => `<a href="${ruleUrl(item)}"${item === rule ? ' aria-current="page"' : ''}>${escape(item.titre)}</a>`).join('');
  const sections = renderSections(rule.sections);
  return layout(rule.titre, `<a class="back" href="/reglements">Tous les règlements</a>
    <div class="reading"><article>${ruleIcon(rule)}
    <h1>${escape(rule.titre)}</h1><p>${escape(rule.description)}</p>
    <p class="notice">${rule.sections.length ? 'Texte d’exemple à remplacer par le règlement officiel.' : 'Le règlement de cette rubrique sera ajouté prochainement.'}</p>${sections}</article>
    <nav class="side" aria-label="Rubriques"><h2>Rubriques</h2>${links}</nav></div>`);
}

http.createServer((req, res) => {
  function send(status, type, body) {
    res.writeHead(status, {'Content-Type': type + '; charset=utf-8'});
    res.end(req.method === 'HEAD' ? undefined : body);
  }

  const route = req.url.split('?')[0].replace(/\/$/, '') || '/';
  if (route === '/sante') return send(200, 'text/plain', 'OK');
  if (route === '/dreamlight-background.webp' && background) {
    res.writeHead(200, {'Content-Type': 'image/webp'});
    return res.end(req.method === 'HEAD' ? undefined : background);
  }
  if (route === '/dreamlight-logo.png') {
    res.writeHead(200, {'Content-Type': 'image/png'});
    return res.end(req.method === 'HEAD' ? undefined : logo);
  }
  if (route === '/style.css') return send(200, 'text/css', css);
  if (route === '/') return send(200, 'text/html', home());
  if (route === '/reglements') return send(200, 'text/html', rulesIndex());
  if (route === '/serveur' || route === '/communaute') {
    res.writeHead(302, {Location: '/reglements'});
    return res.end();
  }
  if (route === '/boutique') return send(200, 'text/html', shop());
  const rule = rules.find(item => ruleUrl(item) === route);
  if (rule) return send(200, 'text/html', rule.rubriques ? legalIndex(rule) : detail(rule));

  const parent = rules.find(item => item.rubriques && route.startsWith(ruleUrl(item) + '/'));
  const rubrique = parent?.rubriques.find(item => route === ruleUrl(parent) + '/' + encodeURIComponent(item.slug));
  if (rubrique) return send(200, 'text/html', legalDetail(parent, rubrique));
  send(404, 'text/html', layout('Page introuvable', '<section class="missing"><h1>Page introuvable</h1><a class="button" href="/">Revenir à l’accueil</a></section>'));
}).listen(Number(process.env.PORT || 3000), '0.0.0.0');
