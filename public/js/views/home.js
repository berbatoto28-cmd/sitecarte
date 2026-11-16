/* Tableau de bord : packs gratuits, missions du jour, meilleures cartes, tirages de la communauté */
import { S, esc, icon, fmt, clock, api, emit, freeLive, dailyLive, collStats, bestCards, since, plural, rewardHTML } from '../core.js';
import { cardHTML, packHTML } from '../cards.js';
import { openFree, openDaily } from '../opening.js';

export async function render(ctx) {
  const me = S.me;
  const st = collStats(me.collection);
  const best = bestCards(me.collection, 10);
  ctx.el.innerHTML = `
  <div class="home-hero">
    <section class="panel panel-glow welcome">
      <div>
        <span class="eyebrow">${icon('spark')} Bon retour parmi nous</span>
        <h1>Salut, <span class="grad">${esc(me.user.name)}</span> !</h1>
      </div>
      <div class="welcome-stats">
        <div class="ring" style="--p:${st.pct};--size:132px"><div><b>${st.pct}%</b><small>du set</small></div></div>
        <div class="stat-list">
          <div><b>${fmt(st.uniq)}</b><span>/ ${fmt(S.totalCards)} cartes différentes</span></div>
          <div><b>${fmt(st.score)}</b><span>points de collection</span></div>
          <div><b>${fmt(st.dupes)}</b><span>${plural(st.dupes, 'doublon', 'doublons')} (${fmt(st.dupeValue)} Coins)</span></div>
        </div>
      </div>
      <div class="row">
        <a class="btn btn-primary" href="#/packs">${icon('pack')}Ouvrir des packs</a>
        <a class="btn" href="#/collection">${icon('cards')}Ma collection</a>
      </div>
    </section>
    <section class="panel packwidget" data-free></section>
    <section class="panel packwidget" data-daily></section>
  </div>

  <div class="grid-2 section">
    <section class="panel">
      <h2 class="section-title">${icon('target')} Missions du jour <small><a href="#/missions">Tout voir ${icon('chevron')}</a></small></h2>
      <div class="mini-missions" data-missions><div class="loading"></div></div>
    </section>
    <section class="panel">
      <h2 class="section-title">${icon('crown')} Mes plus belles cartes</h2>
      ${best.length ? `<div class="best-row">${best.map((id) => cardHTML(id, { qty: me.collection[id] })).join('')}</div>`
        : `<div class="empty">${icon('cards')}<b>Votre classeur est vide</b><span>Ouvrez vos packs de bienvenue !</span></div>`}
    </section>
  </div>

  <section class="section panel">
    <h2 class="section-title">${icon('flame')} Tirages de la communauté <small data-players></small></h2>
    <div class="feed" data-feed><div class="loading" style="width:100%"></div></div>
  </section>

  <section class="section">
    <h2 class="section-title">${icon('cards')} Mes séries <small>${fmt(S.series.length)} séries · <a href="#/collection">Explorer tout le catalogue</a></small></h2>
    <div class="series-scroll">${S.series.filter((s) => !s.special).slice(0, 36).map((s) => {
      const b = st.byS[s.id];
      return `<a class="serie-tile with-bar" href="#/collection?serie=${s.id}" style="--sc:${esc(s.color)}">
        ${s.banner || s.cover ? `<img src="${esc(s.banner || s.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}
        <span class="st-meta">${b.owned}/${b.total}</span><b>${esc(s.name)}</b>
        <div class="bar thin ${b.owned === b.total ? 'is-done' : ''}"><i style="--p:${(b.owned / b.total) * 100}%"></i></div></a>`;
    }).join('')}</div>
  </section>`;

  const freeEl = ctx.el.querySelector('[data-free]');
  const dailyEl = ctx.el.querySelector('[data-daily]');
  let freeState = '';
  const paintFree = () => {
    const f = freeLive();
    const key = `${f.banked}`;
    if (key !== freeState) {
      freeState = key;
      freeEl.classList.toggle('is-ready', f.banked > 0);
      freeEl.innerHTML = `${packHTML('free')}
        <div><h3>Pack gratuit</h3><p>Un nouveau pack toutes les ${Math.round(f.interval / 60000)} min, jusqu'à ${f.cap} en réserve.</p>
        <div class="timer" data-t></div>
        <div class="stack-dots">${Array.from({ length: f.cap }, (_, i) => `<i class="${i < f.banked ? 'on' : ''}"></i>`).join('')}</div>
        <button class="btn ${f.banked ? 'btn-primary' : ''}" type="button" data-open ${f.banked ? '' : 'disabled'}>${icon('gift')}${f.banked ? `Ouvrir (${f.banked})` : 'En préparation'}</button></div>`;
      freeEl.querySelector('[data-open]').addEventListener('click', (e) => openFree(e.currentTarget));
    }
    const t = freeEl.querySelector('[data-t]');
    t.innerHTML = f.banked >= f.cap ? `Réserve pleine<small>Ouvrez-les pour relancer le minuteur</small>` : `${clock(f.next)}<small>avant le prochain pack</small>`;
  };
  let dailyState = '';
  const paintDaily = () => {
    const d = dailyLive();
    const key = `${d.available}`;
    if (key !== dailyState) {
      dailyState = key;
      dailyEl.classList.toggle('is-ready', d.available);
      dailyEl.innerHTML = `${packHTML('quotidien')}
        <div><h3>Pack quotidien</h3><p>${d.available ? `Disponible ! Bonus de connexion : <b>+${fmt(S.me.daily.nextBonus)} Coins</b>.` : `Série en cours : <b>${S.me.daily.streak} ${plural(S.me.daily.streak, 'jour', 'jours')}</b>. Revenez demain !`}</p>
        <div class="timer" data-t></div>
        <button class="btn ${d.available ? 'btn-primary' : ''}" type="button" data-open ${d.available ? '' : 'disabled'}>${icon('sun')}${d.available ? 'Ouvrir' : 'Déjà ouvert'}</button></div>`;
      dailyEl.querySelector('[data-open]').addEventListener('click', (e) => openDaily(e.currentTarget));
    }
    dailyEl.querySelector('[data-t]').innerHTML = d.available ? `Prêt<small>5 cartes dont une Épique ou mieux</small>` : `${clock(d.resetIn)}<small>avant le prochain</small>`;
  };
  paintFree(); paintDaily();
  ctx.on('tick', () => { paintFree(); paintDaily(); });
  ctx.on('me', () => { freeState = ''; dailyState = ''; paintFree(); paintDaily(); });
  ctx.on('opened', () => emit('rerender'));

  // Missions du jour
  api('/api/missions').then(({ missions }) => {
    if (!ctx.alive) return;
    const box = ctx.el.querySelector('[data-missions]');
    box.innerHTML = missions.daily.map((m) => `
      <div class="mm ${m.progress >= m.target ? 'is-done' : ''}">
        <span>${esc(m.label)}</span><em>${m.claimed ? `${icon('check')} Récupéré` : `${m.progress}/${m.target}`}</em>
        <div class="bar ${m.progress >= m.target ? 'is-done' : ''}"><i style="--p:${(m.progress / m.target) * 100}%"></i></div>
      </div>`).join('') +
      `<div class="mm"><span>${icon('gift')} Bonus : ${rewardHTML(missions.bonus.reward)}</span><em>${missions.bonus.progress}/${missions.bonus.target}</em></div>`;
  }).catch(() => {});

  // Fil de la communauté
  api('/api/feed').then(({ feed, players }) => {
    if (!ctx.alive) return;
    ctx.el.querySelector('[data-players]').textContent = `${fmt(players)} ${plural(players, 'joueur', 'joueurs')}`;
    const box = ctx.el.querySelector('[data-feed]');
    box.innerHTML = feed.length ? feed.map((f) => `<div class="feed-item">${cardHTML(f.card)}<p><b>${esc(f.name)}</b> · ${since(f.at)}</p></div>`).join('')
      : `<div class="empty" style="flex:1">${icon('flame')}<b>Aucun tirage Légendaire pour l'instant</b><span>Soyez le premier à en obtenir un !</span></div>`;
  }).catch(() => {});
}
