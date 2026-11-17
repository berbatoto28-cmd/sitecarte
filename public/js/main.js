/* =========================================================================
   AnimeConnection : démarrage, navigation, en-tête, minuteurs
   ========================================================================= */
import { S, $, $$, api, setData, on, emit, fmt, clock, freeLive, esc, icon, toast, fail, plural } from './core.js';
import { initTilt } from './cards.js';
import { initStars } from './fx.js';
import { openCardView } from './cardview.js';
import * as landing from './views/landing.js';
import * as home from './views/home.js';
import * as packs from './views/packs.js';
import * as collection from './views/collection.js';
import * as market from './views/market.js';
import * as trades from './views/trades.js';
import * as missions from './views/missions.js';
import * as ranking from './views/ranking.js';

const VIEWS = {
  accueil: home, packs, collection, marche: market, echanges: trades,
  missions, classement: ranking, joueur: ranking,
};

/* ---------- navigation ---------- */
let current = null;
function makeCtx(el) {
  const offs = [];
  return {
    el, alive: true,
    on(name, fn) { offs.push(on(name, fn)); },
    every(ms, fn) { const t = setInterval(fn, ms); offs.push(() => clearInterval(t)); },
    onLeave(fn) { offs.push(fn); },
    destroy() { this.alive = false; offs.forEach((f) => f()); },
  };
}
export function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch (e) { return p; } });
  return { name: parts[0] || 'accueil', arg: parts[1] || '', query: new URLSearchParams(qs || '') };
}
async function route(keepScroll) {
  const { name, arg, query } = parseHash();
  const scrollY = window.scrollY;
  if (current) current.destroy();
  const el = $('#view');
  el.innerHTML = '';
  const guest = !S.me;
  document.body.classList.toggle('is-guest', guest);
  const key = guest ? 'landing' : (VIEWS[name] ? name : 'accueil');
  const mod = guest ? landing : VIEWS[key];
  $$('#mainnav a').forEach((a) => {
    const active = a.dataset.nav === (key === 'joueur' ? 'classement' : key);
    a.classList.toggle('is-active', active);
    if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const ctx = makeCtx(el);
  current = ctx;
  if (!keepScroll) window.scrollTo({ top: 0, behavior: 'instant' });
  try {
    await mod.render(ctx, arg, query);
    if (keepScroll && ctx.alive) window.scrollTo({ top: scrollY, behavior: 'instant' });
  } catch (e) {
    console.error(e);
    if (ctx.alive) el.innerHTML = `<div class="empty">${icon('x')}<b>Impossible d'afficher cette page</b><span>${esc(e.message)}</span></div>`;
  }
}
export function rerender() { route(); }

/* ---------- en-tête ---------- */
let shownCoins = null;
function animateCoins(to) {
  const el = $('#coins-amount');
  if (shownCoins === null || shownCoins === to) { shownCoins = to; el.textContent = fmt(to); return; }
  const from = shownCoins;
  shownCoins = to;
  if (to > from) { const w = $('#coins'); w.classList.remove('bump'); void w.offsetWidth; w.classList.add('bump'); }
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / 700);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(Math.round(from + (to - from) * e));
    if (k < 1 && shownCoins === to) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function setBadge(name, n, dotOnly) {
  $$(`[data-badge="${name}"]`).forEach((b) => {
    b.hidden = !n;
    if (!dotOnly) b.textContent = n > 99 ? '99+' : String(n);
  });
}
function paintHeader() {
  const me = S.me;
  if (!me) return;
  animateCoins(me.user.coins);
  const av = $('#avatar-btn');
  const c = me.user.avatar && S.card[me.user.avatar];
  av.innerHTML = c ? `<img src="${esc(c.img)}" alt="" referrerpolicy="no-referrer">` : `<span>${esc(me.user.name.slice(0, 1).toUpperCase())}</span>`;
  $('#menu-profile').href = `#/joueur/${encodeURIComponent(me.user.name)}`;
  const adminLink = $('#menu-admin');
  if (adminLink) {
    adminLink.hidden = !me.user.isAdmin;
    adminLink.style.display = me.user.isAdmin ? 'flex' : 'none';
  }
  setBadge('trades', me.notif.trades);
  setBadge('missions', me.notif.missions);
  setBadge('fresh', me.fresh.length, true);
  tickHeader();
}
let lastBanked = null;
function tickHeader() {
  if (!S.me) return;
  const f = freeLive();
  const chip = $('#chip-free');
  const txt = $('#chip-free-text');
  if (f.banked > 0) {
    chip.classList.add('is-ready');
    txt.textContent = `${f.banked} ${plural(f.banked, 'pack prêt', 'packs prêts')}`;
  } else {
    chip.classList.remove('is-ready');
    txt.textContent = clock(f.next);
  }
  chip.title = f.banked > 0 ? 'Packs gratuits disponibles' : `Prochain pack gratuit dans ${clock(f.next)}`;
  const inv = Object.values(S.me.inventory).reduce((a, b) => a + b, 0);
  setBadge('packs', f.banked + inv + (S.me.daily.available ? 1 : 0), true);
  if (lastBanked !== null && f.banked > lastBanked && !document.querySelector('.stage:not([hidden])')) {
    toast('Pack gratuit prêt !', 'Un nouveau pack vous attend.', 'ok', 'gift');
  }
  lastBanked = f.banked;
}

/* ---------- démarrage ---------- */
async function poll() {
  if (!S.me || document.hidden) return;
  try { await api(`/api/me?cv=${S.me.user.collVer}`); } catch (e) {
    if (e.status === 401) { S.me = null; toast('Session expirée', 'Reconnectez-vous pour continuer.', 'error'); route(); }
  }
}

function bindGlobal() {
  // Ouvrir la fiche d'une carte au clic (sauf dans les sélecteurs et l'ouverture de pack)
  const openFrom = (target) => {
    const card = target.closest('.card.is-click[data-card]');
    if (!card || card.closest('[data-pick], .flip, .cine, .cv-stage, [data-noview]')) return false;
    openCardView(card.dataset.card);
    return true;
  };
  document.addEventListener('click', (e) => { if (!e.defaultPrevented) openFrom(e.target); });
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.card.is-click[data-card]')) {
      if (openFrom(e.target)) e.preventDefault();
    }
  });
  const btn = $('#avatar-btn');
  const menu = $('#usermenu');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    btn.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('.usermenu')) { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
  menu.addEventListener('click', async (e) => {
    const out = e.target.closest('[data-action="logout"]');
    menu.hidden = true;
    if (!out) return;
    try { await api('/api/logout', {}); } catch (err) { /* déjà déconnecté */ }
    S.me = null;
    shownCoins = null; lastBanked = null;
    location.hash = '#/';
    route();
  });
}

async function boot() {
  initStars($('#stars'));
  initTilt();
  bindGlobal();
  try {
    setData(await api('/api/static'));
  } catch (e) {
    $('#view').innerHTML = `<div class="empty" style="margin-top:12vh">${icon('x')}<b>Le serveur AnimeConnection ne répond pas</b>
      <span>Lancez le serveur (double-clic sur « Lancer AnimeConnection.bat » ou <code>npm start</code>), puis ouvrez <b>http://localhost:3000</b>.</span></div>`;
    document.body.classList.remove('is-booting');
    document.body.classList.add('is-guest');
    return;
  }
  try { await api('/api/me'); } catch (e) { if (e.status !== 401) fail(e); }
  on('me', paintHeader);
  on('login', () => { shownCoins = null; lastBanked = null; paintHeader(); route(); });
  on('rerender', () => { if (!document.querySelector('.stage:not([hidden])')) route(true); });
  paintHeader();
  window.addEventListener('hashchange', () => route());
  await route();
  requestAnimationFrame(() => document.body.classList.remove('is-booting'));
  setInterval(() => { if (S.me) { tickHeader(); emit('tick'); } }, 1000);
  setInterval(poll, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
}

boot();
