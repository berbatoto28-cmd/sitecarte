/* Collection : classeur paginé, recherche dans le catalogue sans charger leurs images */
import { S, esc, icon, coin, fmt, api, fail, toast, openModal, collStats, busy, plural } from '../core.js';
import { cardHTML } from '../cards.js';

const F = { q: '', serie: '', rar: new Set(), show: 'all', sort: 'num', page: 1 };
const SHOWS = [['all', 'Afficher : toutes'], ['owned', 'Possédées'], ['missing', 'Manquantes'], ['dupes', 'Doublons'], ['new', 'Nouvelles']];
const SORTS = [['num', 'Série puis numéro'], ['rarity', 'Rareté'], ['fav', 'Popularité'], ['name', 'Nom'], ['qty', 'Exemplaires']];
const PAGE_SIZE = 48;
const labelSerie = (s) => s.id === 'dbz' ? 'Dragon Ball Z (DBZ)' : s.name;
const norm = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export async function render(ctx, arg, query) {
  const playerName = query.get('player') || '';
  const other = playerName && playerName !== S.me.user.name;
  let owner = S.me;
  if (other) {
    const { player } = await api('/api/players/' + encodeURIComponent(playerName));
    if (!ctx.alive) return;
    owner = { collection: player.collection, fresh: [], stats: player.stats };
  }
  const ownerStats = () => { if (!other) owner = S.me; return collStats(owner.collection, owner.stats); };
  if (query.get('serie') && S.serie[query.get('serie')]) {
    F.serie = query.get('serie'); F.show = 'all'; F.page = 1;
  }
  ctx.el.innerHTML = `
    <header class="view-head"><div><h1>${other ? `Collection de ${esc(playerName)}` : 'Ma <span class="grad">Collection</span>'}</h1>
      <p>Classeur de <b>${fmt(S.totalCards)} cartes numérotées</b> : toutes les cartes, même manquantes. Filtrez par anime/manga, rareté ou possession. Les éditions spéciales comme <b>Summer Waifu</b> sont aussi consultables directement.</p></div></header>
    <section class="panel coll-head" data-head></section>
    <div class="toolbar" role="search">
      <div class="search">${icon('search')}<input class="input" type="search" placeholder="Personnage, série, numéro…" value="${esc(F.q)}" data-q aria-label="Rechercher une carte"></div>
      <div class="serie-filter">
        <input class="input" data-serie-find type="search" placeholder="Trouver une série (DBZ, Naruto…)" aria-label="Rechercher une série" autocomplete="off">
        <select class="select" data-serie aria-label="Choisir la série"><option value="">Toutes les séries (${fmt(S.series.length)})</option></select>
      </div>
      <select class="select" data-show aria-label="Afficher">${SHOWS.map(([k, l]) => `<option value="${k}" ${F.show === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <select class="select" data-sort aria-label="Trier">${SORTS.map(([k, l]) => `<option value="${k}" ${F.sort === k ? 'selected' : ''}>Tri : ${l}</option>`).join('')}</select>
      <div class="chips" role="group" aria-label="Raretés">${S.rarities.map((r) => `<button type="button" class="chip" data-rar="${r.id}" aria-pressed="${F.rar.has(r.id)}" style="--c:var(--r-${r.id})"><i></i>${esc(r.label)}</button>`).join('')}</div>
      <div class="quick-series" role="group" aria-label="Séries populaires"><button type="button" data-shortcut="dbz">Dragon Ball Z</button><button type="button" data-shortcut="naruto">Naruto</button><button type="button" data-shortcut="onepiece">One Piece</button><button type="button" data-shortcut="summer">Summer Waifu</button><button type="button" data-shortcut="">Toutes</button></div>
      <span class="count" data-count aria-live="polite">Recherche…</span>
    </div>
    <div data-grid><div class="loading"></div></div>
    <nav class="catalog-pagination" data-pages aria-label="Pages de cartes"></nav>`;
  const head = ctx.el.querySelector('[data-head]');
  const grid = ctx.el.querySelector('[data-grid]');
  const count = ctx.el.querySelector('[data-count]');
  const pages = ctx.el.querySelector('[data-pages]');
  let requestSeq = 0;

  const paintHead = () => {
    const st = ownerStats();
    head.innerHTML = `
      <div class="ring" style="--p:${st.pct};--size:120px"><div><b>${st.pct}%</b><small>${fmt(st.uniq)} / ${fmt(S.totalCards)}</small></div></div>
      <div class="rar-counts">${S.rarities.map((r) => `<div class="rar-count r-c-${r.id}"><b>${fmt(st.byR[r.id].owned)}<span class="dim" style="font-size:13px"> / ${fmt(st.byR[r.id].total)}</span></b><span>${esc(r.label)}</span></div>`).join('')}</div>
      <div style="display:grid;gap:10px;justify-items:stretch">
        <button class="btn btn-danger" type="button" data-bulk ${st.dupes ? '' : 'disabled'}>${icon('trash')}Détruire les doublons</button>
        <span class="dim" style="font-size:13.5px;text-align:center">${fmt(st.dupes)} ${plural(st.dupes, 'doublon', 'doublons')} · ${coin()} ${fmt(st.dupeValue)}</span>
      </div>`;
    const bulk = head.querySelector('[data-bulk]');
    if (other) bulk.remove(); else bulk.addEventListener('click', bulkDestroy);
  };
  const tile = (c) => {
    const n = owner.collection[c.id] || 0;
    const no = String(c.collectionNo || 0).padStart(5, '0');
    return `<div class="catalog-card-entry"><div class="catalog-card-no">N° ${no}<span>${esc(c.num)}</span></div>${cardHTML(c.id, { missing: !n, qty: n, isNew: owner.fresh.includes(c.id) })}</div>`;
  };
  async function paintGrid() {
    const seq = ++requestSeq;
    const qs = new URLSearchParams({ q: F.q.trim(), serie: F.serie, rarity: [...F.rar].join(','), show: F.show,
      player: playerName, sort: F.sort, page: String(F.page), limit: String(PAGE_SIZE) });
    count.textContent = 'Recherche en cours…';
    grid.classList.add('catalog-loading');
    try {
      const data = await api(`/api/catalog?${qs}`);
      if (!ctx.alive || seq !== requestSeq) return;
      F.page = data.page;
      const progress = data.stats.series[F.serie];
      head.querySelector('[data-progress]')?.remove();
      head.insertAdjacentHTML('beforeend', '<p data-progress>' + fmt(data.stats.uniq) + ' possédées · ' + fmt(data.stats.missing) + ' manquantes · ' + fmt(data.stats.dupes) + ' doublons' + (progress ? ' · Anime : ' + progress.owned + '/' + progress.total + ' (' + progress.pct + ' %)' : '') + '</p>');
      const cards = data.ids.map((id) => S.card[id]).filter(Boolean);
      count.textContent = `${F.serie ? `${esc(labelSerie(S.serie[F.serie]))} · ` : ''}${fmt(data.total)} ${plural(data.total, 'carte', 'cartes')} · ${fmt(cards.length)} affichées sur cette page`;
      if (!cards.length) {
        grid.innerHTML = `<div class="empty">${icon('search')}<b>Aucune carte trouvée</b><span>Essayez d'autres filtres ou une autre série.</span></div>`;
      } else if (F.sort === 'num' && !F.serie && !F.q) {
        const groups = [];
        for (const c of cards) {
          if (groups.at(-1)?.id !== c.serie) groups.push({ id: c.serie, cards: [] });
          groups.at(-1).cards.push(c);
        }
        const st = ownerStats();
        grid.innerHTML = groups.map((g) => {
          const s = S.serie[g.id], b = st.byS[g.id];
          return `<section class="serie-block">
            <header class="serie-head" style="--sc:${esc(s.color)}">${s.banner || s.cover ? `<img src="${esc(s.banner || s.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}
              <div><h2>${esc(labelSerie(s))}</h2><div class="jp">${esc(s.title || s.name)}</div></div>
              <div class="sh-prog"><span>${b.owned} / ${b.total} cartes · ${(100*b.owned/Math.max(1,b.total)).toFixed(2)} %</span><div class="bar ${b.owned === b.total ? 'is-done' : ''}"><i style="--p:${100 * b.owned / Math.max(1, b.total)}%"></i></div></div></header>
            <div class="card-grid">${g.cards.map(tile).join('')}</div></section>`;
        }).join('');
      } else {
        grid.innerHTML = `<div class="card-grid">${cards.map(tile).join('')}</div>`;
      }
      if (data.pages > 1) {
        const a = Math.max(1, data.page - 2), b = Math.min(data.pages, a + 4);
        pages.innerHTML = `<button class="btn btn-ghost" data-p="${data.page - 1}" ${data.page === 1 ? 'disabled' : ''}>${icon('chevron')}Précédent</button>
          <span class="catalog-page-info">Page <b>${fmt(data.page)}</b> / ${fmt(data.pages)}</span>
          ${Array.from({length:b-a+1}, (_,i)=>i+a).map((n)=>`<button class="catalog-page-num ${data.page === n ? 'active' : ''}" data-p="${n}" aria-label="Page ${n}" ${data.page === n ? 'aria-current="page"' : ''}>${n}</button>`).join('')}
          <button class="btn btn-primary" data-p="${data.page + 1}" ${data.page === data.pages ? 'disabled' : ''}>Suivant ${icon('chevron')}</button>`;
        pages.querySelectorAll('[data-p]').forEach((btn) => btn.addEventListener('click', () => {
          F.page = Number(btn.dataset.p); paintGrid();
          count.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }));
      } else pages.innerHTML = '';
    } catch (e) {
      if (ctx.alive && seq === requestSeq) { count.textContent = 'Erreur'; grid.innerHTML = `<div class="empty">${icon('x')}<b>${esc(e.message)}</b><button class="btn btn-primary" data-retry>Réessayer</button></div>`; grid.querySelector('[data-retry]').addEventListener('click', paintGrid); }
    } finally { if (seq === requestSeq) grid.classList.remove('catalog-loading'); }
  }
  const select = ctx.el.querySelector('[data-serie]');
  const inputSerie = ctx.el.querySelector('[data-serie-find]');
  const showSerieOptions = () => {
    const term = norm(inputSerie.value).trim();
    const options = S.series.filter((s) => !term || norm(`${s.name} ${s.title || ''} ${s.code || ''} ${s.id} ${labelSerie(s)}`).includes(term));
    // Ne construit pas 2572 options à chaque saisie. La saisie permet de trouver une série même profonde dans la liste.
    const shortlist = term ? options.slice(0, 80) : S.series.slice(0, 80);
    const selected = S.serie[F.serie];
    if (selected && !shortlist.some((s) => s.id === selected.id)) shortlist.unshift(selected);
    select.innerHTML = `<option value="">Toutes les séries (${fmt(S.series.length)})</option>` + shortlist.map((s) =>
      `<option value="${esc(s.id)}" ${F.serie === s.id ? 'selected' : ''}>${esc(labelSerie(s))} (${s.count})</option>`).join('');
  };
  const filterChange = () => { F.page = 1; paintGrid(); };
  showSerieOptions();
  paintHead(); paintGrid();
  let t = 0;
  ctx.el.querySelector('[data-q]').addEventListener('input', (e) => { F.q = e.target.value; clearTimeout(t); t = setTimeout(filterChange, 200); });
  select.addEventListener('change', (e) => { F.serie = e.target.value; filterChange(); });
  inputSerie.addEventListener('input', showSerieOptions);
  ctx.el.querySelectorAll('[data-shortcut]').forEach((b) => b.addEventListener('click', () => { F.serie = b.dataset.shortcut; inputSerie.value = ''; showSerieOptions(); filterChange(); }));
  ctx.el.querySelector('[data-show]').addEventListener('change', (e) => { F.show = e.target.value; filterChange(); });
  ctx.el.querySelector('[data-sort]').addEventListener('change', (e) => { F.sort = e.target.value; filterChange(); });
  ctx.el.querySelectorAll('[data-rar]').forEach((b) => b.addEventListener('click', () => {
    if (F.rar.has(b.dataset.rar)) F.rar.delete(b.dataset.rar); else F.rar.add(b.dataset.rar);
    b.setAttribute('aria-pressed', String(F.rar.has(b.dataset.rar)));
    filterChange();
  }));
  let sig = S.me.user.collVer;
  ctx.on('me', () => {
    if (!other && S.me.user.collVer !== sig) { sig = S.me.user.collVer; paintHead(); paintGrid(); }
  });
  ctx.onLeave(() => {
    if (!other && S.me && S.me.fresh.length) { S.me.fresh = []; api('/api/collection/seen', {}).catch(() => {}); }
  });
}

function bulkDestroy() {
  const st = collStats(S.me.collection);
  if (!st.dupes) return;
  let max = 'epique';
  const m = openModal(`<h3>Détruire les doublons</h3><p>Un exemplaire de chaque carte est toujours conservé.</p>
    <div class="field"><label>Raretés concernées (jusqu'à…)</label><div class="chips" data-max>${S.rarities.map((r) => `<button type="button" class="chip" data-r="${r.id}" style="--c:var(--r-${r.id})"><i></i>${esc(r.label)}</button>`).join('')}</div></div>
    <div class="panel" style="margin-top:18px" data-sum></div>
    <div class="modal-actions"><button class="btn btn-ghost" type="button" data-no>Annuler</button><button class="btn btn-danger" type="button" data-go>${icon('trash')}Détruire</button></div>`);
  const go = m.el.querySelector('[data-go]');
  const calc = () => Object.entries(S.me.collection).reduce((a,[id,n]) => {
    const c = S.card[id];
    if (c && n > 1 && S.rank[c.rarity] <= S.rank[max]) {a.n += n-1; a.gain += (n-1)*S.rar[c.rarity].value;}
    return a;
  }, {n:0,gain:0});
  const upd = () => {
    const {n,gain} = calc();
    m.el.querySelector('[data-sum]').innerHTML = `<b>${fmt(n)} doublons connus</b> · ${coin()} ${fmt(gain)} Coins estimés`;
    go.disabled = !st.dupes;
  };
  m.el.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => { max = b.dataset.r; upd(); }));
  upd();
  m.el.querySelector('[data-no]').addEventListener('click', () => m.close());
  go.addEventListener('click', () => busy(go, async () => {
    try {
      const d = await api('/api/cards/destroy-dupes', { max });
      m.close(); toast(`${fmt(d.destroyed)} doublons détruits`, `+${fmt(d.gain)} Coins`, 'gold', 'coin');
    } catch (e) { fail(e); }
  }));
}
