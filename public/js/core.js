/* =========================================================================
   AnimeConnection : noyau (état, API, utilitaires, notifications, fenêtres)
   ========================================================================= */

export const S = {
  data: null,     // règles + set complet (envoyés par le serveur)
  me: null,       // état du joueur connecté
  meAt: 0,        // instant de réception de "me" (pour les comptes à rebours)
  card: {}, series: [], serie: {}, rarities: [], rar: {}, rank: {}, totalCards: 0,
};

/* ---------- bus d'événements ---------- */
const bus = new EventTarget();
export function on(name, fn) {
  const h = (e) => fn(e.detail);
  bus.addEventListener(name, h);
  return () => bus.removeEventListener(name, h);
}
export function emit(name, detail) { bus.dispatchEvent(new CustomEvent(name, { detail })); }

/* ---------- utilitaires ---------- */
export const $ = (s, el) => (el || document).querySelector(s);
export const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');
export const pad = (n) => String(n).padStart(2, '0');
export const icon = (id, cls) => `<svg${cls ? ` class="${cls}"` : ''} aria-hidden="true"><use href="#i-${id}"/></svg>`;
export const coin = (cls) => icon('coin', cls || 'coin');
export const plural = (n, one, many) => (Math.abs(n) > 1 ? many : one);
export const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export function clock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}
export function since(ts) {
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return 'à l\'instant';
  if (d < 3600) return `il y a ${Math.floor(d / 60)} min`;
  if (d < 86400) return `il y a ${Math.floor(d / 3600)} h`;
  if (d < 86400 * 30) return `il y a ${Math.floor(d / 86400)} j`;
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}
export const initials = (name) => String(name || '?').trim().slice(0, 1).toUpperCase();
export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/* ---------- données ---------- */
export function setData(d) {
  S.data = d;
  S.series = d.series;
  S.rarities = d.rarities;
  S.totalCards = d.totalCards;
  d.series.forEach((s, i) => { S.serie[s.id] = s; s.order = i; });
  d.rarities.forEach((r, i) => { S.rar[r.id] = r; S.rank[r.id] = i; });
}
/* Cache des cartes : le set complet (50 000 cartes) se charge à la demande. */
export function mergeCards(map) {
  if (!map) return;
  for (const id of Object.keys(map)) { const c = map[id]; if (c) S.card[id] = c; }
}
export async function ensureCards(ids, onProgress) {
  const missing = Array.from(new Set(ids)).filter((id) => id && !S.card[id]);
  for (let i = 0; i < missing.length; i += 500) {
    const d = await api('/api/cards', { ids: missing.slice(i, i + 500) });
    mergeCards(d.cards);
    if (onProgress) onProgress(Math.min(missing.length, i + 500), missing.length);
  }
}
export const cardImg = (c) => c.art || c.img;
export const serieName = (id) => (S.serie[id] ? S.serie[id].name : '');

/* Prix conseillé à la vente sur le Marché. */
export const SUGGEST = { commune: 10, rare: 40, epique: 120, legendaire: 450, mythique: 1500, secrete: 6000, primordiale: 25000, astral: 100000 };
export const RGB = {
  commune: '180,178,207', rare: '96,180,255', epique: '192,132,252', legendaire: '255,201,74',
  mythique: '255,77,141', secrete: '111,247,255', primordiale: '255,233,168', astral: '193,158,255',
};

/* Statistiques de collection (calculées par le serveur). */
export function stats() {
  const st = (S.me && S.me.stats) || { uniq: 0, dupes: 0, dupeValue: 0, score: 0, byR: {}, bySerie: {} };
  return Object.assign({ pct: S.totalCards ? (st.uniq / S.totalCards) * 100 : 0 }, st);
}
export const pctLabel = (p) => (p > 0 && p < 1 ? (Math.round(p * 100) / 100).toLocaleString('fr-FR') : Math.floor(p).toLocaleString('fr-FR'));

/* Statistiques déjà calculées par le serveur : compatible avec les vues. */
export function collStats(collection = {}, suppliedStats = null) {
  const fromMe = S.me && collection === S.me.collection && S.me.stats;
  const raw = suppliedStats || (fromMe ? S.me.stats : null);
  const byS = Object.create(null);
  const byR = Object.create(null);
  S.series.forEach((s) => { byS[s.id] = { owned: raw ? (raw.bySerie[s.id] || 0) : 0, total: s.count }; });
  S.rarities.forEach((r) => { byR[r.id] = { owned: raw ? (raw.byR[r.id] || 0) : 0, total: S.data.totalByRarity[r.id] || 0 }; });
  if (!raw) {
    for (const id of Object.keys(collection)) {
      const c = S.card[id]; if (!c) continue;
      if (byS[c.serie]) byS[c.serie].owned++;
      if (byR[c.rarity]) byR[c.rarity].owned++;
    }
  }
  const uniq = raw ? raw.uniq : Object.keys(collection).length;
  return { uniq, copies: raw ? raw.copies : 0, dupes: raw ? raw.dupes : 0,
    dupeValue: raw ? raw.dupeValue : 0, score: raw ? raw.score : 0,
    pct: S.totalCards ? +(100 * uniq / S.totalCards).toFixed(2) : 0,
    byR, byS };
}
export function bestCards(collection = {}, n = 10) {
  const ids = S.me && collection === S.me.collection && S.me.best ? S.me.best : Object.keys(collection);
  return ids.filter((id) => S.card[id] && !S.card[id].hidden)
    .sort((a, b) => S.rank[S.card[b].rarity] - S.rank[S.card[a].rarity] || (S.card[b].fav || 0) - (S.card[a].fav || 0)).slice(0, n);
}

/* ---------- API ---------- */
export async function api(url, body) {
  const opts = { credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (body !== undefined) {
    opts.method = 'POST';
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res;
  try { res = await fetch(url, opts); } catch (e) { throw Object.assign(new Error('Serveur injoignable. Vérifiez votre connexion.'), { status: 0 }); }
  let data = null;
  try { data = await res.json(); } catch (e) { /* réponse vide */ }
  if (!res.ok) throw Object.assign(new Error((data && data.error) || `Erreur ${res.status}`), { status: res.status });
  if (data) {
    mergeCards(data.cards && !Array.isArray(data.cards) ? data.cards : null);
    mergeCards(data.refs);
    if (data.result) mergeCards(data.result.refs);
    if (Array.isArray(data.results)) data.results.forEach((r) => mergeCards(r.refs));
    if (data.me) setMe(data.me);
  }
  return data;
}

export function setMe(me) {
  const before = S.me;
  if (me) {
    mergeCards(me.refs);
    // la collection n'est renvoyée que si elle a changé
    if (!me.collection && before && before.collection) {
      me.collection = before.collection; me.fresh = before.fresh; me.stats = before.stats; me.best = before.best;
    }
    me.fresh = me.fresh || [];
    me.collection = me.collection || {};
  }
  S.me = me;
  S.meAt = performance.now();
  if (me && Array.isArray(me.events)) me.events.forEach(showEvent);
  emit('me', { before, me });
}

function showEvent(ev) {
  if (ev.type === 'sold') {
    toast('Vente réussie !', `${ev.name || 'Votre carte'} achetée par ${ev.buyer || 'un joueur'} : +${fmt(ev.gain)} Coins.`, 'gold', 'coin');
  } else if (ev.type === 'trade') {
    if (ev.status === 'accepted') toast('Échange accepté', `${ev.with} a accepté votre proposition.`, 'ok', 'swap');
    else if (ev.status === 'declined') toast('Échange refusé', `${ev.with} a refusé votre proposition.`, 'error', 'swap');
    else toast('Échange annulé', `L'échange avec ${ev.with} n'était plus possible.`, 'error', 'swap');
  }
}

/* Pack gratuit en temps réel (sans attendre le serveur). */
export function freeLive() {
  const f = S.me.free;
  const el = performance.now() - S.meAt;
  let banked = f.banked;
  let next = f.nextIn - el;
  if (banked < f.cap) {
    while (next <= 0 && banked < f.cap) { banked++; next += f.interval; }
  }
  if (banked >= f.cap) next = 0;
  return { banked, next, cap: f.cap, interval: f.interval };
}
export function dailyLive() {
  const d = S.me.daily;
  return { available: d.available, resetIn: Math.max(0, d.resetIn - (performance.now() - S.meAt)) };
}

export function rewardHTML(reward) {
  const parts = [];
  if (reward.coins) parts.push(`${coin()} ${fmt(reward.coins)}`);
  Object.entries(reward.packs || {}).forEach(([p, n]) => {
    const def = S.data.packs[p];
    parts.push(`${icon('pack')} ${n} ${def ? def.name : p}`);
  });
  return parts.join(' <span class="dim">+</span> ');
}
export function rewardText(reward) {
  const parts = [];
  if (reward.coins) parts.push(`${fmt(reward.coins)} Coins`);
  Object.entries(reward.packs || {}).forEach(([p, n]) => parts.push(`${n} ${S.data.packs[p] ? S.data.packs[p].name : p}`));
  return parts.join(' + ');
}

/* ---------- notifications ---------- */
export function toast(title, text, type, ico) {
  const root = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast ${type || ''}`;
  el.innerHTML = `${icon(ico || (type === 'error' ? 'x' : type === 'ok' ? 'check' : 'spark'))}<div><b>${esc(title)}</b>${text ? `<span>${esc(text)}</span>` : ''}</div>`;
  root.appendChild(el);
  while (root.children.length > 4) root.firstChild.remove();
  const kill = () => { el.classList.add('is-out'); setTimeout(() => el.remove(), 350); };
  const t = setTimeout(kill, type === 'error' ? 5200 : 4200);
  el.addEventListener('click', () => { clearTimeout(t); kill(); });
}
export const fail = (e) => toast('Oups', e && e.message ? e.message : String(e), 'error');

/* ---------- fenêtres ---------- */
export function openModal(html, opts) {
  opts = opts || {};
  const root = $('#modal-root');
  const el = document.createElement('div');
  el.className = 'modal';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = opts.raw ? html : `<div class="modal-box ${opts.cls || ''}"><button class="modal-close" type="button" aria-label="Fermer">${icon('x')}</button>${html}</div>`;
  root.appendChild(el);
  const prevFocus = document.activeElement;
  let closed = false;
  const close = (value) => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 250);
    if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
    if (opts.onClose) opts.onClose(value);
  };
  const onKey = (e) => { if (e.key === 'Escape' && root.lastElementChild === el) close(); };
  document.addEventListener('keydown', onKey);
  el.addEventListener('click', (e) => {
    if (e.target === el || e.target.closest('.modal-close')) close();
  });
  const focusable = el.querySelector('input, select, textarea, button:not(.modal-close)');
  setTimeout(() => (focusable || el.querySelector('.modal-close') || el).focus({ preventScroll: true }), 60);
  return { el, close };
}

export function confirmBox({ title, text, ok, danger, gold }) {
  return new Promise((resolve) => {
    const m = openModal(`<h3>${esc(title)}</h3><p>${text || ''}</p>
      <div class="modal-actions"><button class="btn btn-ghost" type="button" data-no>Annuler</button>
      <button class="btn ${danger ? 'btn-danger' : gold ? 'btn-gold' : 'btn-primary'}" type="button" data-yes>${ok || 'Confirmer'}</button></div>`,
    { onClose: (v) => resolve(!!v) });
    m.el.querySelector('[data-no]').addEventListener('click', () => m.close(false));
    m.el.querySelector('[data-yes]').addEventListener('click', () => m.close(true));
  });
}

/* Bouton avec état de chargement le temps d'une requête. */
export async function busy(btn, fn) {
  if (!btn) return fn();
  if (btn.classList.contains('is-loading')) return undefined;
  btn.classList.add('is-loading');
  btn.disabled = true;
  try { return await fn(); } finally { btn.classList.remove('is-loading'); btn.disabled = false; }
}
