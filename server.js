const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const rules = require('./reglements.json');

const css = fs.readFileSync(path.join(__dirname, 'style.css'));
const logo = fs.readFileSync(path.join(__dirname, 'dreamlight-logo.png'));
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
const ruleUrl = rule => '/reglements/' + encodeURIComponent(rule.slug);

function layout(title, body) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)} · Dreamlight</title><link rel="stylesheet" href="/style.css"><link rel="icon" type="image/png" href="/dreamlight-logo.png"></head>
  <body><header><div class="shell top"><a class="brand" href="/"><img src="/dreamlight-logo.png" width="42" height="40" alt=""> Dreamlight</a>
  <nav aria-label="Navigation principale"><a href="/#reglements">Tous les règlements</a></nav></div></header>
  <main class="shell">${body}</main>
  <footer class="shell">Dreamlight <span>Centre des règlements</span></footer></body></html>`;
}

function legalIndex(rule) {
  const cards = rule.rubriques.map(item => `<a class="card" href="${ruleUrl(rule)}/${encodeURIComponent(item.slug)}">
    <h2>${escape(item.titre)}</h2><span class="action">Consulter la rubrique</span></a>`).join('');
  return layout(rule.titre, `<a class="back" href="/#reglements">Tous les règlements</a>
    <h1>${escape(rule.titre)}</h1><p>${escape(rule.description)}</p>
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
    toc: '<nav class="side legal-toc" aria-label="Sommaire du règlement"><h2>Sommaire</h2><ul>' + contents.join('') + '</ul></nav>'
  };
}

function legalDetail(rule, item) {
  const document = item.reglement && renderLegalDocument(item.reglement);
  const content = document ? document.html : item.sections.length
    ? renderSections(item.sections)
    : '<p class="notice">Le règlement de cette rubrique sera ajouté prochainement.</p>';
  return layout(item.titre, `<a class="back" href="${ruleUrl(rule)}">Règlement légal</a>
    <div class="reading"><article><h1>${escape(item.titre)}</h1>${content}</article>${document ? document.toc : ''}</div>`);
}

function home() {
  const cards = rules.map(rule => `<a class="card" href="${ruleUrl(rule)}">
    <span class="icon" aria-hidden="true">${escape(rule.icone)}</span><h3>${escape(rule.titre)}</h3>
    <p>${escape(rule.description)}</p><span class="action">${rule.rubriques ? 'Voir les sous-catégories' : 'Lire le règlement'}</span></a>`).join('');
  return layout('Centre des règlements', `<section class="hero"><div class="orb" aria-hidden="true"></div>
    <div class="hero-copy"><h1>Les règlements<br>de <em>Dreamlight</em></h1>
    <p>Choisis la rubrique qui correspond à ce que tu cherches.</p>
    <a class="button" href="#reglements">Voir les rubriques</a></div><img class="hero-logo" src="/dreamlight-logo.png" width="480" height="448" alt=""></section>
    <section id="reglements"><h2>Choisir un règlement</h2>
    <p class="notice">Les textes proposés sont des exemples en attendant les règlements officiels.</p>
    <div class="grid">${cards}</div></section>`);
}

function renderSections(sections) {
  return sections.map(section => `<section><h2>${escape(section.titre)}</h2><p>${escape(section.texte)}</p></section>`).join('');
}

function detail(rule) {
  const links = rules.map(item => `<a href="${ruleUrl(item)}"${item === rule ? ' aria-current="page"' : ''}>${escape(item.titre)}</a>`).join('');
  const sections = renderSections(rule.sections);
  return layout(rule.titre, `<a class="back" href="/#reglements">Tous les règlements</a>
    <div class="reading"><article><span class="icon" aria-hidden="true">${escape(rule.icone)}</span>
    <h1>${escape(rule.titre)}</h1><p>${escape(rule.description)}</p>
    <p class="notice">Texte d’exemple à remplacer par le règlement officiel.</p>${sections}</article>
    <nav class="side" aria-label="Rubriques"><h2>Rubriques</h2>${links}</nav></div>`);
}

http.createServer((req, res) => {
  function send(status, type, body) {
    res.writeHead(status, {'Content-Type': type + '; charset=utf-8'});
    res.end(req.method === 'HEAD' ? undefined : body);
  }

  const route = req.url.split('?')[0].replace(/\/$/, '') || '/';
  if (route === '/sante') return send(200, 'text/plain', 'OK');
  if (route === '/dreamlight-logo.png') {
    res.writeHead(200, {'Content-Type': 'image/png'});
    return res.end(req.method === 'HEAD' ? undefined : logo);
  }
  if (route === '/style.css') return send(200, 'text/css', css);
  if (route === '/') return send(200, 'text/html', home());
  const rule = rules.find(item => ruleUrl(item) === route);
  if (rule) return send(200, 'text/html', rule.rubriques ? legalIndex(rule) : detail(rule));

  const parent = rules.find(item => item.rubriques && route.startsWith(ruleUrl(item) + '/'));
  const rubrique = parent?.rubriques.find(item => route === ruleUrl(parent) + '/' + encodeURIComponent(item.slug));
  if (rubrique) return send(200, 'text/html', legalDetail(parent, rubrique));
  send(404, 'text/html', layout('Page introuvable', '<section class="missing"><h1>Page introuvable</h1><a class="button" href="/">Revenir à l’accueil</a></section>'));
}).listen(Number(process.env.PORT || 3000), '0.0.0.0');
