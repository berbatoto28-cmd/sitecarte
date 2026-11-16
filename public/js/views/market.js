/* Marché : ventes entre joueurs + le Marchand (stock renouvelé chaque heure) */
import { S, esc, icon, coin, fmt, clock, api, fail, toast, norm, confirmBox, busy, since, plural, ensureCards } from '../core.js';
import { cardHTML } from '../cards.js';

let tab = 'buy';
const F = { q: '', serie: '', rarity: '', sort: 'recent' };

export async function render(ctx, arg, query) {
  if (query.get('card') && S.card[query.get('card')]) { tab = 'buy'; F.q = S.card[query.get('card')].name; F.serie = ''; F.rarity = ''; }
  ctx.el.innerHTML = `
  <header class="view-head">
    <div><h1>Le <span class="grad">Marché</span></h1><p>Achetez les cartes qui vous manquent et vendez vos doublons aux autres joueurs, uniquement en Coins. Taxe de ${Math.round(S.data.settings.marketFee * 100)} % sur chaque vente.</p></div>
    <div class="tabs" role="tablist">
      <button type="button" role="tab" data-tab="buy">${icon('market')}Acheter</button>
      <button type="button" role="tab" data-tab="merchant">${icon('store')}Le Marchand</button>
      <button type="button" role="tab" data-tab="mine">${icon('tag')}Mes ventes</button>
      <button type="button" role="tab" data-tab="sell">${icon('plus')}Vendre</button>
    </div>
  </header>
  <div data-body><div class="loading"></div></div>`;
  const body = ctx.el.querySelector('[data-body]');
  let data = null;

  const load = async () => {
    try {
      data = await api('/api/market'); data.loadedAt = performance.now();
      if (tab === 'sell') await ensureCards(Object.keys(S.me.collection).slice(0, 1500));
    } catch (e) { fail(e); return; }
    if (ctx.alive) paint();
  };

  const paintTabs = () => ctx.el.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  ctx.el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', async () => {
    tab = b.dataset.tab; paintTabs();
    if (tab === 'sell') {
      body.innerHTML = '<div class="loading"></div>';
      try { await ensureCards(Object.keys(S.me.collection).slice(0, 1500)); } catch(e) { fail(e); }
      if (!ctx.alive || tab !== 'sell') return;
    }
    paint();
  }));
  paintTabs();

  function paint() {
    if (!data) return;
    if (tab === 'buy') paintBuy();
    else if (tab === 'merchant') paintMerchant();
    else if (tab === 'mine') paintMine();
    else paintSell();
  }

  function filters(extra) {
    return `<div class="toolbar">
      <div class="search">${icon('search')}<input class="input" type="search" placeholder="Rechercher une carte…" value="${esc(F.q)}" data-q aria-label="Rechercher"></div>
      <select class="select" data-serie aria-label="Série"><option value="">Toutes les séries</option>${S.series.map((s) => `<option value="${s.id}" ${F.serie === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
      <select class="select" data-rarity aria-label="Rareté"><option value="">Toutes les raretés</option>${S.rarities.map((r) => `<option value="${r.id}" ${F.rarity === r.id ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}</select>
      ${extra || ''}<span class="count" data-count></span></div>`;
  }
  function bindFilters(repaint) {
    let t = 0;
    body.querySelector('[data-q]').addEventListener('input', (e) => { F.q = e.target.value; clearTimeout(t); t = setTimeout(repaint, 140); });
    body.querySelector('[data-serie]').addEventListener('change', (e) => { F.serie = e.target.value; repaint(); });
    body.querySelector('[data-rarity]').addEventListener('change', (e) => { F.rarity = e.target.value; repaint(); });
    const so = body.querySelector('[data-sort]');
    if (so) so.addEventListener('change', (e) => { F.sort = e.target.value; repaint(); });
  }
  const match = (id) => {
    const c = S.card[id];
    if (!c) return false;
    if (F.serie && c.serie !== F.serie) return false;
    if (F.rarity && c.rarity !== F.rarity) return false;
    const q = norm(F.q.trim());
    return !q || norm(`${c.name} ${S.serie[c.serie].name} ${c.num}`).includes(q);
  };

  /* --- acheter --- */
  function paintBuy() {
    body.innerHTML = filters(`<select class="select" data-sort aria-label="Trier"><option value="recent" ${F.sort === 'recent' ? 'selected' : ''}>Plus récentes</option><option value="asc" ${F.sort === 'asc' ? 'selected' : ''}>Prix croissant</option><option value="desc" ${F.sort === 'desc' ? 'selected' : ''}>Prix décroissant</option><option value="rarity" ${F.sort === 'rarity' ? 'selected' : ''}>Rareté</option></select>`) + '<div data-list></div>';
    const listEl = body.querySelector('[data-list]');
    const repaint = () => {
      let rows = data.listings.filter((l) => match(l.card));
      const sorts = {
        recent: (a, b) => b.id - a.id, asc: (a, b) => a.price - b.price, desc: (a, b) => b.price - a.price,
        rarity: (a, b) => S.rank[S.card[b.card].rarity] - S.rank[S.card[a.card].rarity] || a.price - b.price,
      };
      rows = rows.sort(sorts[F.sort] || sorts.recent);
      body.querySelector('[data-count]').textContent = `${rows.length} ${plural(rows.length, 'offre', 'offres')}`;
      if (!rows.length) {
        listEl.innerHTML = `<div class="empty">${icon('market')}<b>Aucune offre pour le moment</b><span>Revenez plus tard, passez voir le Marchand, ou mettez vos propres doublons en vente.</span></div>`;
        return;
      }
      listEl.innerHTML = `<div class="market-grid">${rows.map((l) => {
        const owned = S.me.collection[l.card] || 0;
        return `<div class="offer">${cardHTML(l.card, { qty: 0 })}
          <div class="offer-meta"><span>par <b>${esc(l.seller)}</b></span><span>${since(l.at)}</span></div>
          <div class="offer-meta"><span class="price">${coin()}${fmt(l.price)}</span>${owned ? `<span class="badge">${owned} possédée${owned > 1 ? 's' : ''}</span>` : '<span class="badge" style="background:rgba(236,72,153,.18);color:#fbcfe8">Nouvelle !</span>'}</div>
          ${l.mine ? `<button class="btn btn-sm btn-ghost" type="button" data-cancel="${l.id}">Retirer ma vente</button>`
            : `<button class="btn btn-sm btn-gold" type="button" data-buy="${l.id}" ${S.me.user.coins < l.price ? 'disabled title="Pas assez de Coins"' : ''}>${icon('market')}Acheter</button>`}
        </div>`;
      }).join('')}</div>`;
      listEl.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => buyListing(+b.dataset.buy, b)));
      listEl.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', () => cancelListing(+b.dataset.cancel, b)));
    };
    bindFilters(repaint);
    repaint();
  }

  async function buyListing(id, btn) {
    const l = data.listings.find((x) => x.id === id);
    if (!l) return;
    const c = S.card[l.card];
    const ok = await confirmBox({ title: `Acheter ${c.name} ?`, text: `${esc(S.rar[c.rarity].label)} · ${esc(S.serie[c.serie].name)}<br>Prix : <b>${fmt(l.price)} Coins</b> (vendue par ${esc(l.seller)}).`, ok: 'Acheter', gold: true });
    if (!ok) return;
    busy(btn, async () => {
      try {
        const d = await api('/api/market/buy', { id });
        toast(d.isNew ? 'Nouvelle carte !' : 'Achat réussi', `${c.name} rejoint votre collection.`, 'ok', 'cards');
        await load();
      } catch (e) { fail(e); await load(); }
    });
  }
  async function cancelListing(id, btn) {
    busy(btn, async () => {
      try { await api('/api/market/cancel', { id }); toast('Vente retirée', 'La carte est revenue dans votre collection.', 'ok', 'tag'); await load(); } catch (e) { fail(e); }
    });
  }

  /* --- le Marchand --- */
  function paintMerchant() {
    const left = () => Math.max(0, data.merchant.refreshIn - (performance.now() - data.loadedAt));
    body.innerHTML = `
      <div class="panel merchant-head">
        <div class="merchant-avatar">${icon('store')}</div>
        <div style="flex:1"><h2 class="section-title" style="margin:0">Le Marchand</h2>
        <p class="muted" style="margin:4px 0 0">Il propose ${data.merchant.slots.length} cartes à prix fixe, les mêmes pour tous les joueurs. Chaque offre ne peut être achetée qu'une fois par joueur.</p></div>
        <div class="timer" style="font-size:26px;text-align:right" data-left></div>
      </div>
      <div class="market-grid section">${data.merchant.slots.map((s) => {
        const owned = S.me.collection[s.card] || 0;
        return `<div class="offer ${s.bought ? 'is-bought' : ''}">${cardHTML(s.card)}
          <div class="offer-meta"><span class="price">${coin()}${fmt(s.price)}</span>${owned ? `<span class="badge">${owned} possédée${owned > 1 ? 's' : ''}</span>` : '<span class="badge" style="background:rgba(236,72,153,.18);color:#fbcfe8">Nouvelle !</span>'}</div>
          <button class="btn btn-sm ${s.bought ? 'btn-ghost' : 'btn-gold'}" type="button" data-slot="${esc(s.slot)}" ${s.bought || S.me.user.coins < s.price ? 'disabled' : ''}>${s.bought ? `${icon('check')}Achetée` : `${icon('store')}Acheter`}</button></div>`;
      }).join('')}</div>`;
    const leftEl = body.querySelector('[data-left]');
    const tickLeft = () => {
      if (!leftEl.isConnected) return;
      const l = left();
      leftEl.innerHTML = `${clock(l)}<small>avant le nouveau stock</small>`;
      if (l <= 0) load();
    };
    tickLeft();
    body.querySelectorAll('[data-slot]').forEach((b) => b.addEventListener('click', async () => {
      const s = data.merchant.slots.find((x) => x.slot === b.dataset.slot);
      const c = S.card[s.card];
      const ok = await confirmBox({ title: `Acheter ${c.name} ?`, text: `${esc(S.rar[c.rarity].label)} · ${esc(S.serie[c.serie].name)} pour <b>${fmt(s.price)} Coins</b>.`, ok: 'Acheter', gold: true });
      if (!ok) return;
      busy(b, async () => {
        try {
          const d = await api('/api/market/merchant', { slot: s.slot });
          toast(d.isNew ? 'Nouvelle carte !' : 'Achat réussi', `${c.name} rejoint votre collection.`, 'ok', 'cards');
          await load();
        } catch (e) { fail(e); await load(); }
      });
    }));
    merchantTick = tickLeft;
  }

  /* --- mes ventes --- */
  function paintMine() {
    const rows = data.mine;
    const label = { open: ['En vente', 'wait'], sold: ['Vendue', 'ok'], cancelled: ['Retirée', ''] };
    body.innerHTML = rows.length ? `<div class="list">${rows.map((l) => {
      const c = S.card[l.card];
      const [txt, cls] = label[l.status] || [l.status, ''];
      const fee = Math.floor(l.price * S.data.settings.marketFee);
      return `<div class="list-row">${cardHTML(l.card)}
        <div><b>${esc(c ? c.name : l.card)}</b><small>${esc(c ? S.serie[c.serie].name : '')} · mise en vente ${since(l.at)}${l.status === 'sold' ? ` · achetée par ${esc(l.buyer || '?')}` : ''}</small></div>
        <div style="display:grid;justify-items:end;gap:4px"><span class="price">${coin()}${fmt(l.price)}</span>${l.status === 'sold' ? `<small class="dim">+${fmt(l.price - fee)} reçus</small>` : ''}</div>
        ${l.status === 'open' ? `<button class="btn btn-sm btn-ghost" type="button" data-cancel="${l.id}">Retirer</button>` : `<span class="status ${cls}">${txt}</span>`}
      </div>`;
    }).join('')}</div>` : `<div class="empty">${icon('tag')}<b>Aucune vente</b><span>Ouvrez l'onglet « Vendre » et choisissez une carte de votre collection.</span></div>`;
    body.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', () => cancelListing(+b.dataset.cancel, b)));
  }

  /* --- vendre --- */
  function paintSell() {
    body.innerHTML = `<p class="muted" style="margin:0 0 6px">Choisissez une carte : sa fiche s'ouvre avec le formulaire de vente. Les doublons apparaissent en premier.</p>` + filters() + '<div data-list></div>';
    const listEl = body.querySelector('[data-list]');
    const repaint = () => {
      const coll = S.me.collection;
      const ids = Object.keys(coll).filter((id) => match(id))
        .sort((a, b) => (coll[b] > 1) - (coll[a] > 1) || S.rank[S.card[b].rarity] - S.rank[S.card[a].rarity] || String(S.card[a].num).localeCompare(String(S.card[b].num)));
      body.querySelector('[data-count]').textContent = `${ids.length} ${plural(ids.length, 'carte', 'cartes')}${ids.length > 60 ? ' · 60 affichées : utilisez la recherche' : ''}`;
      listEl.innerHTML = ids.length ? `<div class="card-grid">${ids.slice(0, 60).map((id) => cardHTML(id, { qty: coll[id] })).join('')}</div>`
        : `<div class="empty">${icon('cards')}<b>Aucune carte</b><span>Ouvrez des packs pour remplir votre collection.</span></div>`;
    };
    bindFilters(repaint);
    repaint();
  }

  let merchantTick = null;
  ctx.every(1000, () => { if (tab === 'merchant' && merchantTick) merchantTick(); });
  let sig = JSON.stringify(S.me.collection);
  ctx.on('me', () => {
    const now = JSON.stringify(S.me.collection);
    if (now !== sig) { sig = now; load(); }
  });
  await load();
}
