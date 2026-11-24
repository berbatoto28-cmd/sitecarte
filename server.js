const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const rules = require('./reglements.json');

const css = fs.readFileSync(path.join(__dirname, 'style.css'));
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
const ruleUrl = rule => '/reglements/' + encodeURIComponent(rule.slug);

function layout(title, body) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)} · Dreamlight</title><link rel="stylesheet" href="/style.css"></head>
  <body><header><div class="shell top"><a class="brand" href="/"><span aria-hidden="true">✦</span> Dreamlight</a>
  <nav aria-label="Navigation principale"><a href="/#reglements">Tous les règlements</a></nav></div></header>
  <main class="shell">${body}</main>
  <footer class="shell">Dreamlight <span>Centre des règlements</span></footer></body></html>`;
}

function home() {
  const cards = rules.map(rule => `<a class="card" href="${ruleUrl(rule)}">
    <span class="icon" aria-hidden="true">${escape(rule.icone)}</span><h3>${escape(rule.titre)}</h3>
    <p>${escape(rule.description)}</p><span class="action">Lire le règlement</span></a>`).join('');
  return layout('Centre des règlements', `<section class="hero"><div class="orb" aria-hidden="true"></div>
    <div class="hero-copy"><h1>Les règlements<br>de <em>Dreamlight</em></h1>
    <p>Choisis la rubrique qui correspond à ce que tu cherches.</p>
    <a class="button" href="#reglements">Voir les rubriques</a></div></section>
    <section id="reglements"><h2>Choisir un règlement</h2>
    <p class="notice">Les textes proposés sont des exemples en attendant les règlements officiels.</p>
    <div class="grid">${cards}</div></section>`);
}

function detail(rule) {
  const links = rules.map(item => `<a href="${ruleUrl(item)}"${item === rule ? ' aria-current="page"' : ''}>${escape(item.titre)}</a>`).join('');
  const sections = rule.sections.map(section => `<section><h2>${escape(section.titre)}</h2><p>${escape(section.texte)}</p></section>`).join('');
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
  if (route === '/style.css') return send(200, 'text/css', css);
  if (route === '/') return send(200, 'text/html', home());
  const rule = rules.find(item => ruleUrl(item) === route);
  if (rule) return send(200, 'text/html', detail(rule));
  send(404, 'text/html', layout('Page introuvable', '<section class="missing"><h1>Page introuvable</h1><a class="button" href="/">Revenir à l’accueil</a></section>'));
}).listen(Number(process.env.PORT || 3000), '0.0.0.0');
