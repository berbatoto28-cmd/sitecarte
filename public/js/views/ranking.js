/* Classement des collectionneurs + profil public d'un joueur */
import { S, esc, icon, fmt, api, fail, since, collStats, bestCards, plural } from '../core.js';
import { cardHTML } from '../cards.js';

const avatar = (name, card, cls) => {
  const c = card && S.card[card];
  return `<span class="avatar ${cls || ''}">${c ? `<img src="${esc(c.img)}" alt="" referrerpolicy="no-referrer">` : esc(String(name).slice(0, 1).toUpperCase())}</span>`;
};

export async function render(ctx, arg) {
  if (arg) return profile(ctx, arg);
  ctx.el.innerHTML = `
  <header class="view-head"><div><h1>Le <span class="grad">Classement</span></h1>
  <p>Chaque carte différente rapporte des points selon sa rareté : de 1 point pour une Commune à 500 pour une Primordiale.</p></div></header>
  <div class="search"><input class="input" type="search" data-player-search placeholder="Rechercher un joueur…" aria-label="Rechercher un joueur"></div><div data-player-results></div>
  <div data-body><div class="loading"></div></div>`;
  let searchSeq = 0, timer;
  ctx.el.querySelector('[data-player-search]').addEventListener('input', e => {
    clearTimeout(timer); const term = e.target.value; const seq = ++searchSeq;
    timer = setTimeout(async () => {
      try {
        const { players } = await api('/api/players?q=' + encodeURIComponent(term));
        if (ctx.alive && seq === searchSeq) ctx.el.querySelector('[data-player-results]').innerHTML = players.map(p => '<p><a class="btn" href="#/collection?player=' + encodeURIComponent(p.name) + '">' + esc(p.name) + ' · ' + fmt(p.uniq) + ' cartes</a></p>').join('') || '<p>Aucun joueur trouvé</p>';
      } catch(e) { if (ctx.alive && seq === searchSeq) fail(e); }
    }, 200);
  });
  ctx.onLeave(() => { clearTimeout(timer); searchSeq++; });
  let d;
  try { d = await api('/api/leaderboard'); } catch (e) { fail(e); return undefined; }
  if (!ctx.alive) return undefined;
  const body = ctx.el.querySelector('[data-body]');
  const me = S.me.user.name;
  if (!d.board.length) {
    body.innerHTML = `<div class="empty">${icon('trophy')}<b>Pas encore de joueurs classés</b></div>`;
    return undefined;
  }
  const top = d.board.slice(0, 3);
  body.innerHTML = `
    <div class="podium">${top.map((p, i) => `
      <a class="panel podium-spot p${i + 1}" href="#/joueur/${encodeURIComponent(p.name)}">
        <span class="medal">${i + 1}</span>${avatar(p.name, p.avatar)}
        <b>${esc(p.name)}</b><small>${fmt(p.score)} points · ${fmt(p.uniq)} cartes</small></a>`).join('')}
    </div>
    <div class="table-wrap"><table class="board">
      <thead><tr><th>Rang</th><th>Joueur</th><th>Points</th><th class="hide-sm">Cartes</th><th class="hide-sm">Progression</th></tr></thead>
      <tbody>${d.board.map((p) => `<tr class="${p.name === me ? 'is-me' : ''}">
        <td>#${p.rank}</td>
        <td><a class="who" href="#/joueur/${encodeURIComponent(p.name)}">${avatar(p.name, p.avatar)}${esc(p.name)}</a></td>
        <td><b>${fmt(p.score)}</b></td>
        <td class="hide-sm">${fmt(p.uniq)} / ${fmt(d.total)}</td>
        <td class="hide-sm"><div class="bar"><i style="--p:${(p.uniq / d.total) * 100}%"></i></div></td></tr>`).join('')}</tbody>
    </table></div>`;
  return undefined;
}

async function profile(ctx, name) {
  ctx.el.innerHTML = '<div class="loading"></div>';
  let p;
  try { p = (await api(`/api/players/${encodeURIComponent(name)}`)).player; } catch (e) {
    if (ctx.alive) ctx.el.innerHTML = `<div class="empty">${icon('user')}<b>${esc(e.message)}</b><a class="btn" href="#/classement">Retour au classement</a></div>`;
    return;
  }
  if (!ctx.alive) return;
  const isMe = p.name === S.me.user.name;
  const coll = isMe ? S.me.collection : p.collection;
  const st = collStats(coll, p.stats);
  const best = (p.best || []).filter((id) => S.card[id]).slice(0, 6);
  const bgCard = (p.avatar && S.card[p.avatar]) || (best[0] && S.card[best[0]]);
  ctx.el.innerHTML = `
    <section class="panel panel-glow profile-hero">
      ${bgCard ? `<div class="ph-bg"><img src="${esc(bgCard.img)}" alt="" referrerpolicy="no-referrer"></div>` : ''}
      ${avatar(p.name, p.avatar || best[0], 'lg')}
      <div>
        <span class="eyebrow">${icon('user')} Collectionneur${p.rank ? ` · #${p.rank} au classement` : ''}</span>
        <h1>${esc(p.name)}</h1>
        <div class="dim">Membre depuis ${new Date(p.since).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} · vu ${since(p.seen)}</div>
        <div class="profile-stats">
          <div><b>${fmt(st.uniq)}</b><span>cartes / ${fmt(S.totalCards)}</span></div>
          <div><b>${fmt(p.score)}</b><span>points</span></div>
          <div><b>${fmt(p.packs)}</b><span>packs ouverts</span></div>
          <div><b>${fmt(p.trades)}</b><span>${plural(p.trades, 'échange', 'échanges')}</span></div>
        </div>
      </div>
      ${isMe ? '<a class="btn" href="#/collection">Ma collection</a>' : `<a class="btn btn-primary" href="#/echanges?to=${encodeURIComponent(p.name)}">${icon('swap')}Proposer un échange</a>`}
    </section>
    <p><a class="btn btn-primary" href="#/collection?player=${encodeURIComponent(p.name)}">Voir toute la collection publique · ${p.stats.pct} % · ${fmt(p.stats.missing)} manquantes · ${fmt(p.stats.dupes)} doublons</a></p>
    <section class="section">
      <h2 class="section-title">${icon('crown')} Vitrine</h2>
      ${best.length ? `<div class="showcase">${best.map((id) => cardHTML(id, { qty: coll[id] })).join('')}</div>` : `<div class="empty">${icon('cards')}<b>Aucune carte pour l'instant</b></div>`}
    </section>
    <section class="section">
      <h2 class="section-title">${icon('cards')} Séries</h2>
      <div class="pack-grid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">${S.series.filter((s) => (p.bySerie[s.id] || 0) > 0).slice(0, 36).map((s) => {
        const b = { owned: p.bySerie[s.id] || 0, total: s.count };
        return `<div class="serie-tile with-bar" style="--sc:${esc(s.color)};width:auto">${s.banner || s.cover ? `<img src="${esc(s.banner || s.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}
          <span class="st-meta">${b.owned}/${b.total}</span><b>${esc(s.name)}</b><div class="bar thin ${b.owned === b.total ? 'is-done' : ''}"><i style="--p:${(b.owned / b.total) * 100}%"></i></div></div>`;
      }).join('')}</div>
    </section>
    ${!isMe ? `<section class="section"><h2 class="section-title">${icon('swap')} Ses doublons <small>Idéal pour un échange</small></h2>
      ${(() => { const d = Object.keys(coll).filter((id) => coll[id] > 1 && S.card[id]).sort((a, b) => S.rank[S.card[b].rarity] - S.rank[S.card[a].rarity]);
        return d.length ? `<div class="card-grid">${d.slice(0, 48).map((id) => cardHTML(id, { qty: coll[id], missing: false })).join('')}</div>` : `<div class="empty">${icon('cards')}<b>Aucun doublon</b></div>`; })()}
    </section>` : ''}`;
}
