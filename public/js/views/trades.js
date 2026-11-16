/* Échanges entre joueurs : propositions reçues, envoyées, nouvel échange, historique */
import { S, esc, icon, coin, fmt, api, fail, toast, norm, openModal, confirmBox, busy, since, plural, ensureCards } from '../core.js';
import { cardHTML } from '../cards.js';

let tab = 'in';
const draft = { to: null, their: null, give: {}, get: {}, giveCoins: 0, getCoins: 0, message: '' };

const avatarHTML = (name, card) => {
  const c = card && S.card[card];
  return `<span class="avatar">${c ? `<img src="${esc(c.img)}" alt="" referrerpolicy="no-referrer">` : esc(String(name).slice(0, 1).toUpperCase())}</span>`;
};

function sideHTML(side, opts) {
  opts = opts || {};
  const entries = Object.entries(side.cards || {});
  const cards = entries.map(([id, n]) => `<div class="tc">${cardHTML(id)}${n > 1 ? `<span class="tc-q">×${n}</span>` : ''}${opts.remove ? `<button class="tc-x" type="button" data-rm="${esc(id)}" aria-label="Retirer">${icon('x')}</button>` : ''}</div>`).join('');
  return `<div class="trade-cards">${cards || '<span class="dim">Aucune carte</span>'}</div>${side.coins ? `<div class="trade-coins">${coin()} ${fmt(side.coins)} Coins</div>` : ''}`;
}

export async function render(ctx, arg, query) {
  if (query.get('give') && S.card[query.get('give')]) {
    tab = 'new';
    const id = query.get('give');
    if (S.me.collection[id]) draft.give[id] = Math.max(1, draft.give[id] || 0);
  }
  if (query.get('to')) { tab = 'new'; if (draft.to !== query.get('to')) { draft.to = query.get('to'); draft.their = null; draft.get = {}; } }
  ctx.el.innerHTML = `
  <header class="view-head">
    <div><h1>Les <span class="grad">Échanges</span></h1><p>Proposez vos cartes (et des Coins) contre celles d'un autre joueur. L'échange se fait dès qu'il accepte : rien n'est bloqué tant qu'il n'a pas répondu.</p></div>
    <div class="tabs" role="tablist">
      <button type="button" role="tab" data-tab="in">${icon('gift')}Reçues <i class="nav-count" data-n-in hidden></i></button>
      <button type="button" role="tab" data-tab="out">${icon('swap')}Envoyées</button>
      <button type="button" role="tab" data-tab="new">${icon('plus')}Nouvel échange</button>
      <button type="button" role="tab" data-tab="hist">${icon('clock')}Historique</button>
    </div>
  </header>
  <div data-body><div class="loading"></div></div>`;
  const body = ctx.el.querySelector('[data-body]');
  let data = null;

  const load = async () => {
    try { data = await api('/api/trades'); } catch (e) { fail(e); return; }
    if (!ctx.alive) return;
    const n = ctx.el.querySelector('[data-n-in]');
    n.hidden = !data.incoming.length;
    n.textContent = data.incoming.length;
    paint();
  };
  const paintTabs = () => ctx.el.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  ctx.el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; paintTabs(); paint(); }));
  paintTabs();

  function paint() {
    if (tab === 'new') return paintNew();
    if (!data) return undefined;
    if (tab === 'in') return paintList(data.incoming, 'in');
    if (tab === 'out') return paintList(data.outgoing, 'out');
    return paintList(data.history, 'hist');
  }

  function paintList(rows, kind) {
    if (!rows.length) {
      const msg = { in: ['Aucune proposition reçue', 'Quand un joueur vous proposera un échange, il apparaîtra ici.'], out: ['Aucune proposition en attente', 'Lancez un nouvel échange avec un autre joueur.'], hist: ['Aucun échange terminé', 'Vos échanges acceptés, refusés ou annulés apparaîtront ici.'] }[kind];
      body.innerHTML = `<div class="empty">${icon('swap')}<b>${msg[0]}</b><span>${msg[1]}</span>${kind !== 'hist' ? `<button class="btn btn-primary" type="button" data-new style="margin-top:10px">${icon('plus')}Nouvel échange</button>` : ''}</div>`;
      const nb = body.querySelector('[data-new]');
      if (nb) nb.addEventListener('click', () => { tab = 'new'; paintTabs(); paint(); });
      return;
    }
    const me = S.me.user.name;
    const STATUS = { accepted: ['Accepté', 'ok'], declined: ['Refusé', 'bad'], cancelled: ['Annulé', ''], invalid: ['Impossible', 'bad'], pending: ['En attente', 'wait'] };
    body.innerHTML = `<div class="list">${rows.map((t) => {
      const mine = t.from === me;
      const other = mine ? t.to : t.from;
      const youGive = mine ? t.give : t.get;
      const youGet = mine ? t.get : t.give;
      const [stTxt, stCls] = STATUS[t.status] || [t.status, ''];
      return `<article class="panel trade">
        <div class="trade-head">${avatarHTML(other)}<div><b>${mine ? `Vous → <a href="#/joueur/${encodeURIComponent(other)}">${esc(other)}</a>` : `<a href="#/joueur/${encodeURIComponent(other)}">${esc(other)}</a> vous propose`}</b><div class="dim" style="font-size:13.5px">${since(t.closedAt || t.at)}</div></div>
          <span class="spacer"></span><span class="status ${stCls}">${stTxt}</span></div>
        ${t.message ? `<p class="trade-msg">« ${esc(t.message)} »</p>` : ''}
        <div class="trade-sides">
          <div class="trade-side"><h4>Vous donnez</h4>${sideHTML(youGive)}</div>
          <div class="trade-arrow">${icon('swap')}</div>
          <div class="trade-side"><h4>Vous recevez</h4>${sideHTML(youGet)}</div>
        </div>
        ${t.status === 'pending' ? `<div class="row" style="justify-content:flex-end">${kind === 'in'
          ? `<button class="btn btn-ghost" type="button" data-act="decline" data-id="${t.id}">Refuser</button><button class="btn btn-primary" type="button" data-act="accept" data-id="${t.id}">${icon('check')}Accepter l'échange</button>`
          : `<button class="btn btn-ghost" type="button" data-act="cancel" data-id="${t.id}">Annuler la proposition</button>`}</div>` : ''}
      </article>`;
    }).join('')}</div>`;
    body.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
      const act = b.dataset.act;
      if (act === 'accept') {
        const ok = await confirmBox({ title: 'Accepter cet échange ?', text: 'Les cartes et les Coins seront échangés immédiatement.', ok: 'Accepter' });
        if (!ok) return;
      }
      busy(b, async () => {
        try {
          await api(`/api/trades/${b.dataset.id}/${act}`, {});
          toast(act === 'accept' ? 'Échange réussi !' : act === 'decline' ? 'Proposition refusée' : 'Proposition annulée', act === 'accept' ? 'Les cartes sont dans votre collection.' : '', act === 'accept' ? 'ok' : '', 'swap');
        } catch (e) { fail(e); }
        await load();
      });
    }));
  }

  /* --- nouvel échange --- */
  async function paintNew() {
    if (!draft.to) return paintPlayers();
    if (!draft.their) {
      body.innerHTML = '<div class="loading"></div>';
      try { draft.their = (await api(`/api/players/${encodeURIComponent(draft.to)}`)).player; } catch (e) { fail(e); draft.to = null; return paintPlayers(); }
      if (!ctx.alive || tab !== 'new') return undefined;
    }
    // on retire ce qui n'est plus disponible
    Object.keys(draft.give).forEach((id) => { const max = S.me.collection[id] || 0; if (!max) delete draft.give[id]; else draft.give[id] = Math.min(draft.give[id], max); });
    Object.keys(draft.get).forEach((id) => { const max = draft.their.collection[id] || 0; if (!max) delete draft.get[id]; else draft.get[id] = Math.min(draft.get[id], max); });
    const p = draft.their;
    body.innerHTML = `
      <div class="panel trade">
        <div class="trade-head">${avatarHTML(p.name, p.avatar)}<div><b>Échange avec <a href="#/joueur/${encodeURIComponent(p.name)}">${esc(p.name)}</a></b><div class="dim" style="font-size:13.5px">${fmt(Object.keys(p.collection).length)} cartes différentes</div></div>
          <span class="spacer"></span><button class="btn btn-sm btn-ghost" type="button" data-change>Changer de joueur</button></div>
        <div class="trade-sides">
          <div class="trade-side"><h4>Vous donnez</h4>${sideHTML({ cards: draft.give }, { remove: true })}
            <div class="row" style="margin-top:14px"><button class="btn btn-sm" type="button" data-pick="give">${icon('plus')}Ajouter mes cartes</button>
            <div class="input-coin" style="width:170px">${coin()}<input class="input" style="height:36px" type="number" min="0" step="10" value="${draft.giveCoins || ''}" placeholder="Coins" data-coins="give" aria-label="Coins donnés"></div></div></div>
          <div class="trade-arrow">${icon('swap')}</div>
          <div class="trade-side"><h4>Vous recevez</h4>${sideHTML({ cards: draft.get }, { remove: true })}
            <div class="row" style="margin-top:14px"><button class="btn btn-sm" type="button" data-pick="get">${icon('plus')}Choisir ses cartes</button>
            <div class="input-coin" style="width:170px">${coin()}<input class="input" style="height:36px" type="number" min="0" step="10" value="${draft.getCoins || ''}" placeholder="Coins" data-coins="get" aria-label="Coins demandés"></div></div></div>
        </div>
        <div class="field"><label for="t-msg">Message (facultatif)</label><input class="input" id="t-msg" maxlength="160" value="${esc(draft.message)}" placeholder="Ex. Il me manque Gojo pour finir JJK !"></div>
        <div class="row" style="justify-content:flex-end"><button class="btn btn-ghost" type="button" data-reset>Vider</button><button class="btn btn-primary btn-lg" type="button" data-send>${icon('swap')}Envoyer la proposition</button></div>
      </div>`;
    body.querySelector('[data-change]').addEventListener('click', () => { draft.to = null; draft.their = null; draft.get = {}; draft.getCoins = 0; paintNew(); });
    body.querySelectorAll('.trade-side').forEach((sideEl, i) => sideEl.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => {
      delete (i === 0 ? draft.give : draft.get)[b.dataset.rm];
      paintNew();
    })));
    body.querySelectorAll('[data-coins]').forEach((inp) => inp.addEventListener('input', () => {
      const v = Math.max(0, parseInt(inp.value, 10) || 0);
      if (inp.dataset.coins === 'give') draft.giveCoins = v; else draft.getCoins = v;
    }));
    body.querySelector('#t-msg').addEventListener('input', (e) => { draft.message = e.target.value; });
    body.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
      const giving = b.dataset.pick === 'give';
      openPicker(giving ? S.me.collection : draft.their.collection, giving ? draft.give : draft.get,
        giving ? 'Vos cartes à donner' : `Les cartes de ${draft.their.name}`, giving ? null : S.me.collection, () => paintNew());
    }));
    body.querySelector('[data-reset]').addEventListener('click', () => { draft.give = {}; draft.get = {}; draft.giveCoins = 0; draft.getCoins = 0; draft.message = ''; paintNew(); });
    const send = body.querySelector('[data-send]');
    send.addEventListener('click', () => busy(send, async () => {
      if (!Object.keys(draft.give).length && !Object.keys(draft.get).length) { toast('Échange vide', 'Ajoutez au moins une carte.', 'error'); return; }
      try {
        await api('/api/trades', { to: draft.to, give: { cards: draft.give, coins: draft.giveCoins }, get: { cards: draft.get, coins: draft.getCoins }, message: draft.message });
        toast('Proposition envoyée !', `${draft.to} doit maintenant l'accepter.`, 'ok', 'swap');
        draft.give = {}; draft.get = {}; draft.giveCoins = 0; draft.getCoins = 0; draft.message = '';
        tab = 'out'; paintTabs();
        await load();
      } catch (e) { fail(e); }
    }));
    return undefined;
  }

  async function paintPlayers() {
    body.innerHTML = `<div class="panel"><h2 class="section-title">${icon('user')} Avec qui voulez-vous échanger ?</h2>
      <div class="search" style="margin-bottom:18px">${icon('search')}<input class="input" type="search" placeholder="Pseudo du joueur…" data-ps aria-label="Rechercher un joueur"></div>
      <div data-players><div class="loading"></div></div></div>`;
    const box = body.querySelector('[data-players]');
    const search = async (q) => {
      try {
        const { players } = await api(`/api/players?q=${encodeURIComponent(q || '')}`);
        if (!box.isConnected) return;
        box.innerHTML = players.length ? `<div class="player-list">${players.map((p) => `<button class="player" type="button" data-name="${esc(p.name)}">${avatarHTML(p.name, p.avatar)}<div><b>${esc(p.name)}</b><small>${fmt(p.uniq)} cartes · vu ${since(p.seen)}</small></div></button>`).join('')}</div>`
          : `<div class="empty">${icon('user')}<b>Aucun joueur trouvé</b><span>Invitez vos amis : chacun crée son compte sur ce site, puis vous pourrez échanger.</span></div>`;
        box.querySelectorAll('[data-name]').forEach((b) => b.addEventListener('click', () => { draft.to = b.dataset.name; draft.their = null; draft.get = {}; draft.getCoins = 0; paintNew(); }));
      } catch (e) { fail(e); }
    };
    let t = 0;
    body.querySelector('[data-ps]').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => search(e.target.value.trim()), 200); });
    search('');
  }

  ctx.on('me', () => {
    const n = S.me.notif.trades;
    if (data && n !== data.incoming.length) load();
  });
  await load();
}

/* Sélecteur de cartes (pour composer un échange) */
async function openPicker(coll, selected, title, mine, onDone) {
  try { await ensureCards(Object.keys(coll).slice(0, 1500)); } catch(e) { fail(e); }
  const sel = Object.assign({}, selected);
  const f = { q: '', serie: '' };
  const m = openModal(`<h3>${esc(title)}</h3><p>Cliquez sur une carte pour l'ajouter. Cliquez encore pour en prendre plusieurs exemplaires (puis revenir à zéro).</p>
    <div class="picker-tools"><div class="search">${icon('search')}<input class="input" type="search" placeholder="Rechercher…" data-q></div>
    <select class="select" data-s><option value="">Toutes les séries</option>${S.series.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>
    ${mine ? '<label class="chip" style="cursor:pointer"><input type="checkbox" data-miss style="accent-color:#c084fc"> Seulement celles qui me manquent</label>' : ''}</div>
    <div class="picker-grid" data-pick-grid data-pick></div>
    <div class="modal-actions"><span class="dim" data-sum style="margin-right:auto;align-self:center"></span><button class="btn btn-primary" type="button" data-ok>${icon('check')}Valider</button></div>`, { cls: 'wide' });
  const grid = m.el.querySelector('[data-pick-grid]');
  const sum = m.el.querySelector('[data-sum]');
  let onlyMissing = false;
  const paint = () => {
    const q = norm(f.q);
    const ids = Object.keys(coll).filter((id) => {
      const c = S.card[id];
      if (!c) return false;
      if (f.serie && c.serie !== f.serie) return false;
      if (onlyMissing && mine && mine[id]) return false;
      return !q || norm(`${c.name} ${S.serie[c.serie].name}`).includes(q);
    }).sort((a, b) => S.rank[S.card[b].rarity] - S.rank[S.card[a].rarity] || String(S.card[a].num).localeCompare(String(S.card[b].num)));
    grid.innerHTML = ids.length ? ids.slice(0, 80).map((id) => {
      const n = sel[id] || 0;
      const max = coll[id];
      return `<button class="pick ${n ? 'is-picked' : ''}" type="button" data-id="${esc(id)}">${cardHTML(id, { static: true })}<span class="pick-q">${n ? `${n} / ${max}` : `${max} dispo.`}</span></button>`;
    }).join('') : `<div class="empty" style="grid-column:1/-1">${icon('cards')}<b>Aucune carte</b></div>`;
    const total = Object.values(sel).reduce((a, b) => a + b, 0);
    sum.textContent = `${total} ${plural(total, 'carte sélectionnée', 'cartes sélectionnées')}` + (ids.length > 80 ? ` · ${ids.length} disponibles, affinez votre recherche` : '');
  };
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    const id = b.dataset.id;
    const n = (sel[id] || 0) + 1;
    if (n > coll[id]) delete sel[id]; else sel[id] = n;
    if (Object.keys(sel).length > 12) { delete sel[id]; toast('Maximum atteint', '12 cartes différentes par côté.', 'error'); }
    paint();
  });
  let t = 0;
  m.el.querySelector('[data-q]').addEventListener('input', (e) => { f.q = e.target.value; clearTimeout(t); t = setTimeout(paint, 140); });
  m.el.querySelector('[data-s]').addEventListener('change', (e) => { f.serie = e.target.value; paint(); });
  const miss = m.el.querySelector('[data-miss]');
  if (miss) miss.addEventListener('change', () => { onlyMissing = miss.checked; paint(); });
  m.el.querySelector('[data-ok]').addEventListener('click', () => {
    Object.keys(selected).forEach((k) => delete selected[k]);
    Object.assign(selected, sel);
    m.close();
    onDone();
  });
  paint();
}
