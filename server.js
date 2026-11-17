/* =========================================================================
   AnimeConnection : serveur (Node.js 22.13+ sans aucune dépendance)
   - comptes joueurs, sessions
   - tirages côté serveur (impossible de tricher depuis le navigateur)
   - cartes Secrètes et Primordiales masquées tant que le joueur ne les a pas obtenues
   - packs gratuits, pack quotidien, éditions spéciales, missions, marché, échanges, classement
   Lancer :  node server.js   puis ouvrir http://localhost:3000
   ========================================================================= */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { DatabaseSync } = require('node:sqlite');
const G = require('./lib/game');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC = path.join(__dirname, 'public');
// Railway : stockage obligatoire sur un volume persistant. Ne jamais utiliser
// le disque ephemere pour les comptes, les cartes et les achats des joueurs.
if (process.env.RAILWAY_SERVICE_ID && !process.env.RAILWAY_VOLUME_MOUNT_PATH) {
  console.error('[AnimeConnection] Volume Railway manquant. Attachez un volume au service sur /data avant de deployer.');
  process.exit(1);
}
const DB_FILE = process.env.DB_FILE || (process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'animeconnection.db')
  : path.join(__dirname, 'data', 'animeconnection.db'));
if (process.env.RAILWAY_SERVICE_ID && !path.resolve(DB_FILE).startsWith(path.resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH) + path.sep)) {
  console.error('[AnimeConnection] DB_FILE doit se trouver sur le volume Railway persistant.');
  process.exit(1);
}
const SESSION_MS = 30 * 24 * 3600 * 1000;
const scrypt = promisify(crypto.scrypt);

/* =========================================================================
   Illustrations personnalisées : public/art/<NUMÉRO>.jpg (ex. OP-001.jpg)
   remplacent l'image AniList (pratique pour un design « ultime »).
   ========================================================================= */
const ART_DIR = path.join(PUBLIC, 'art');
let artCount = 0;
try {
  const byNum = new Map(G.CARDS.map((c) => [c.num.toUpperCase(), c]));
  for (const f of fs.readdirSync(ART_DIR)) {
    const m = /^(.+)\.(jpe?g|png|webp|gif|avif)$/i.exec(f);
    if (!m) continue;
    const c = byNum.get(m[1].toUpperCase()) || G.CARD[m[1]];
    if (c) { c.art = `/art/${encodeURIComponent(f)}`; artCount++; }
  }
} catch (e) { /* pas de dossier art */ }

/* =========================================================================
   Base de données
   ========================================================================= */
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
const db = new DatabaseSync(DB_FILE);
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 3000;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass TEXT NOT NULL,
  coins INTEGER NOT NULL DEFAULT 0,
  free_anchor INTEGER NOT NULL,
  last_daily TEXT,
  streak INTEGER NOT NULL DEFAULT 0,
  pity INTEGER NOT NULL DEFAULT 0,
  avatar TEXT,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL DEFAULT 0,
  coll_ver INTEGER NOT NULL DEFAULT 0,
  secret_gift_claimed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS inventory (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pack TEXT NOT NULL,
  qty INTEGER NOT NULL,
  PRIMARY KEY (user_id, pack)
);
CREATE TABLE IF NOT EXISTS collection (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card TEXT NOT NULL,
  qty INTEGER NOT NULL,
  is_new INTEGER NOT NULL DEFAULT 1,
  first_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, card)
);
CREATE TABLE IF NOT EXISTS discovered (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card TEXT NOT NULL,
  PRIMARY KEY (user_id, card)
);
CREATE TABLE IF NOT EXISTS counters (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value INTEGER NOT NULL,
  PRIMARY KEY (user_id, key)
);
CREATE TABLE IF NOT EXISTS daily (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  mission TEXT NOT NULL,
  pos INTEGER NOT NULL DEFAULT 0,
  progress INTEGER NOT NULL DEFAULT 0,
  claimed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day, mission)
);
CREATE TABLE IF NOT EXISTS achievements (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  claimed_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY,
  seller INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card TEXT NOT NULL,
  price INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  buyer INTEGER,
  created_at INTEGER NOT NULL,
  closed_at INTEGER,
  notified INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS listings_status ON listings(status, created_at);
CREATE TABLE IF NOT EXISTS merchant_buys (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot TEXT NOT NULL,
  period INTEGER NOT NULL,
  PRIMARY KEY (user_id, slot)
);
CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY,
  from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  give TEXT NOT NULL,
  get TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  closed_at INTEGER,
  notified INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS trades_to ON trades(to_id, status);
CREATE INDEX IF NOT EXISTS trades_from ON trades(from_id, status);
CREATE TABLE IF NOT EXISTS feed (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card TEXT NOT NULL,
  at INTEGER NOT NULL
);
`);
// Mise à niveau des bases créées par une version précédente
if (!db.prepare('PRAGMA table_info(users)').all().some((c) => c.name === 'coll_ver')) {
  db.exec('ALTER TABLE users ADD COLUMN coll_ver INTEGER NOT NULL DEFAULT 0');
}
if (!db.prepare('PRAGMA table_info(users)').all().some((c) => c.name === 'secret_gift_claimed')) {
  db.exec('ALTER TABLE users ADD COLUMN secret_gift_claimed INTEGER NOT NULL DEFAULT 0');
}

const stmts = new Map();
const q = (sql) => {
  let s = stmts.get(sql);
  if (!s) { s = db.prepare(sql); stmts.set(sql, s); }
  return s;
};
function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}

class Oops extends Error { constructor(msg, status) { super(msg); this.status = status || 400; } }
const int = (v) => (Number.isFinite(Number(v)) ? Math.floor(Number(v)) : NaN);
const fmt = (n) => Number(n).toLocaleString('fr-FR');
function fmtDur(ms) {
  const s = Math.ceil(ms / 1000), m = Math.floor(s / 60);
  return m ? `${m} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`;
}
const cardName = (id) => { const c = G.CARD[id]; return c ? (G.isHidden(c) ? `une carte ${G.RAR[c.rarity].label}` : c.name) : 'cette carte'; };

/* =========================================================================
   Briques de jeu
   ========================================================================= */
const getUser = (id) => q('SELECT * FROM users WHERE id = ?').get(id);
const addCoins = (uid, n) => q('UPDATE users SET coins = coins + ? WHERE id = ?').run(n, uid);
const bumpColl = (uid) => q('UPDATE users SET coll_ver = coll_ver + 1 WHERE id = ?').run(uid);
function spend(uid, n) {
  if (n <= 0) return;
  const r = q('UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?').run(n, uid, n);
  if (!r.changes) throw new Oops('Pas assez de Coins.');
}
function addPacks(uid, pack, n) {
  q('INSERT INTO inventory (user_id, pack, qty) VALUES (?, ?, ?) ON CONFLICT(user_id, pack) DO UPDATE SET qty = qty + excluded.qty').run(uid, pack, n);
}
function owned(uid, card) {
  const r = q('SELECT qty FROM collection WHERE user_id = ? AND card = ?').get(uid, card);
  return r ? r.qty : 0;
}
function giveCard(uid, card, n) {
  const had = owned(uid, card);
  if (had) q('UPDATE collection SET qty = qty + ? WHERE user_id = ? AND card = ?').run(n || 1, uid, card);
  else q('INSERT INTO collection (user_id, card, qty, is_new, first_at) VALUES (?, ?, ?, 1, ?)').run(uid, card, n || 1, Date.now());
  const c = G.CARD[card];
  if (c && G.isHidden(c)) q('INSERT OR IGNORE INTO discovered (user_id, card) VALUES (?, ?)').run(uid, card);
  bumpColl(uid);
  return !had;
}
function takeCard(uid, card, n, keep) {
  const had = owned(uid, card);
  if (had - n < (keep || 0)) {
    throw new Oops(keep ? `Il ne vous reste pas assez de doublons de ${cardName(card)}.` : `Vous ne possédez pas assez d'exemplaires de ${cardName(card)}.`);
  }
  if (had === n) q('DELETE FROM collection WHERE user_id = ? AND card = ?').run(uid, card);
  else q('UPDATE collection SET qty = qty - ? WHERE user_id = ? AND card = ?').run(n, uid, card);
  bumpColl(uid);
}
function grantReward(uid, reward) {
  if (reward.coins) addCoins(uid, reward.coins);
  Object.entries(reward.packs || {}).forEach(([p, n]) => addPacks(uid, p, n));
}

/* Toutes les cartes sont publiques, indépendamment des découvertes passées. */
function cardsFor(uid, ids) {
  return Object.fromEntries([...new Set(ids)].filter(id => G.CARD[id]).map(id => [id, G.CARD[id]]));
}

/* ---------- statistiques d'une collection ---------- */
function collStats(rows) {
  const st = { uniq: 0, copies: 0, dupes: 0, dupeValue: 0, score: 0, complete: 0, byR: {}, bySerie: {}, special: 0 };
  G.RARITIES.forEach((r) => { st.byR[r.id] = 0; });
  for (const r of rows) {
    const c = G.CARD[r.card];
    if (!c) continue;
    st.uniq++; st.copies += r.qty;
    st.byR[c.rarity]++;
    st.bySerie[c.serie] = (st.bySerie[c.serie] || 0) + 1;
    st.score += G.RAR[c.rarity].score;
    if (G.SERIE[c.serie].special) st.special++;
    if (r.qty > 1) { st.dupes += r.qty - 1; st.dupeValue += (r.qty - 1) * G.RAR[c.rarity].value; }
  }
  for (const [sid, n] of Object.entries(st.bySerie)) if (n >= G.SERIE[sid].count) st.complete++;
  st.total = G.CARDS.length;
  st.missing = st.total - st.uniq;
  st.pct = +(100 * st.uniq / st.total).toFixed(2);
  st.series = Object.fromEntries(G.SERIES.map(s => [s.id, { owned: st.bySerie[s.id] || 0, total: s.count, missing: s.count - (st.bySerie[s.id] || 0), pct: +(100 * (st.bySerie[s.id] || 0) / s.count).toFixed(2) }]));
  return st;
}
function bestOf(rows, n) {
  return rows.filter((r) => G.CARD[r.card]).map((r) => G.CARD[r.card])
    .sort((a, b) => G.RANK[b.rarity] - G.RANK[a.rarity] || b.fav - a.fav).slice(0, n).map((c) => c.id);
}

/* ---------- missions ---------- */
function playerCount() { return q('SELECT COUNT(*) AS n FROM users').get().n; }
function ensureDaily(uid, day) {
  if (q('SELECT 1 FROM daily WHERE user_id = ? AND day = ? LIMIT 1').get(uid, day)) return;
  q('DELETE FROM daily WHERE user_id = ? AND day <> ?').run(uid, day);
  const list = G.dailyMissionsFor(uid, day, playerCount());
  list.forEach((m, i) => q('INSERT INTO daily (user_id, day, mission, pos) VALUES (?, ?, ?, ?)').run(uid, day, m.id, i));
  q('INSERT INTO daily (user_id, day, mission, pos) VALUES (?, ?, ?, ?)').run(uid, day, 'bonus', 99);
}
function track(uid, event, n) {
  n = n || 1;
  q('INSERT INTO counters (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = value + excluded.value').run(uid, event, n);
  const day = G.dayString(Date.now());
  ensureDaily(uid, day);
  for (const r of q('SELECT mission, progress FROM daily WHERE user_id = ? AND day = ? AND claimed = 0').all(uid, day)) {
    const def = G.DAILY_DEF[r.mission];
    if (def && def.event === event && r.progress < def.target) {
      q('UPDATE daily SET progress = ? WHERE user_id = ? AND day = ? AND mission = ?').run(Math.min(def.target, r.progress + n), uid, day, r.mission);
    }
  }
}
function missionsState(uid, rows) {
  const now = Date.now();
  const day = G.dayString(now);
  ensureDaily(uid, day);
  const drows = q('SELECT mission, progress, claimed FROM daily WHERE user_id = ? AND day = ? ORDER BY pos').all(uid, day);
  const daily = drows.filter((r) => G.DAILY_DEF[r.mission]).map((r) => {
    const d = G.DAILY_DEF[r.mission];
    return { id: r.mission, label: d.label, target: d.target, progress: Math.min(d.target, r.progress), claimed: !!r.claimed, reward: d.reward };
  });
  const b = drows.find((r) => r.mission === 'bonus');
  const bonus = {
    id: 'bonus', label: 'Terminer toutes les missions du jour', target: daily.length,
    progress: daily.filter((m) => m.progress >= m.target).length, claimed: !!(b && b.claimed), reward: G.DAILY_BONUS_REWARD,
  };
  const st = collStats(rows || q('SELECT card, qty FROM collection WHERE user_id = ?').all(uid));
  const stats = { uniq: st.uniq, complete: st.complete, own_special: st.special };
  G.RARITIES.forEach((r) => { stats['own_' + r.id] = st.byR[r.id]; });
  for (const r of q('SELECT key, value FROM counters WHERE user_id = ?').all(uid)) stats[r.key] = r.value;
  const done = new Set(q('SELECT id FROM achievements WHERE user_id = ?').all(uid).map((r) => r.id));
  const achievements = G.ACHIEVEMENTS.map((a) => ({ id: a.id, progress: Math.min(a.target, stats[a.stat] || 0), claimed: done.has(a.id) }));
  const series = Object.entries(st.bySerie).map(([sid, n]) => ({
    id: sid, owned: n, total: G.SERIE[sid].count,
    claimed: G.SERIE_STEPS.map((x) => x.k).filter((k) => done.has(`s_${sid}_${k}`)),
  })).sort((x, y) => (y.owned / y.total) - (x.owned / x.total) || y.owned - x.owned);
  return { day, resetIn: G.msUntilMidnight(now), daily, bonus, achievements, series };
}
function claimableCount(ms) {
  let n = ms.daily.filter((m) => !m.claimed && m.progress >= m.target).length +
    (!ms.bonus.claimed && ms.bonus.progress >= ms.bonus.target ? 1 : 0) +
    ms.achievements.filter((a) => !a.claimed && a.progress >= G.ACH[a.id].target).length;
  for (const s of ms.series) {
    for (const st of G.SERIE_STEPS) {
      const step = G.serieStep(s.id, st.k);
      if (step && s.owned >= step.target && !s.claimed.includes(st.k)) n++;
    }
  }
  return n;
}

/* ---------- packs ---------- */
function freeState(u, now) {
  const I = G.SETTINGS.freeInterval, cap = G.SETTINGS.freeCap;
  const elapsed = Math.max(0, now - u.free_anchor);
  const banked = Math.min(cap, Math.floor(elapsed / I));
  return { banked, cap, nextIn: banked >= cap ? 0 : I - (elapsed % I), interval: I };
}
function consumeFree(u, now) {
  const I = G.SETTINGS.freeInterval, cap = G.SETTINGS.freeCap;
  const f = freeState(u, now);
  if (f.banked < 1) throw new Oops(`Prochain pack gratuit dans ${fmtDur(f.nextIn)}.`);
  const anchor = f.banked >= cap ? now - (cap - 1) * I : u.free_anchor + I;
  q('UPDATE users SET free_anchor = ? WHERE id = ?').run(anchor, u.id);
}
function checkTarget(def, serie) {
  if (def.perSerie) {
    if (!G.SERIE[serie] || G.SERIE[serie].special) throw new Oops('Choisissez une série.');
  } else if (def.perSet) {
    if (!G.SERIE[serie] || !G.SERIE[serie].special) throw new Oops('Choisissez une édition spéciale.');
  }
}
function openPack(uid, type, serie, source) {
  const u = getUser(uid);
  const pityHit = u.pity + 1 >= G.SETTINGS.pityLimit;
  const drawn = G.drawPack(type, serie, pityHit);
  const bonus = type === 'secretgift' || G.PACKS[type].perSet ? null : G.drawSpecialBonus();
  if (bonus) drawn.push(bonus);
  const now = Date.now();
  let fresh = 0, epic = 0, legend = 0, best = 0;
  const cards = drawn.map((c, i) => {
    const isNew = giveCard(uid, c.id, 1);
    const rank = G.RANK[c.rarity];
    if (isNew) fresh++;
    if (rank >= G.RANK.epique) epic++;
    if (rank >= G.RANK.legendaire) { legend++; q('INSERT INTO feed (user_id, card, at) VALUES (?, ?, ?)').run(uid, c.id, now); }
    best = Math.max(best, rank);
    return { id: c.id, isNew, bonus: !!bonus && i === drawn.length - 1 };
  });
  q('UPDATE users SET pity = ? WHERE id = ?').run(best >= G.RANK.legendaire ? 0 : u.pity + 1, uid);
  track(uid, 'pack_open', 1);
  if (source === 'free' || source === 'secretgift') track(uid, 'free_open', 1);
  if (source === 'daily') track(uid, 'daily_open', 1);
  if (fresh) track(uid, 'new_card', fresh);
  if (epic) track(uid, 'pull_epique', epic);
  if (legend) track(uid, 'pull_legendaire', legend);
  return { type, serie: serie || null, cards, pity: pityHit, refs: cardsFor(uid, cards.map((c) => c.id)) };
}

/* ---------- échanges ---------- */
function normSide(s) {
  s = s && typeof s === 'object' ? s : {};
  const src = s.cards && typeof s.cards === 'object' ? s.cards : {};
  const keys = Object.keys(src);
  if (keys.length > 12) throw new Oops('12 cartes différentes maximum de chaque côté.');
  const cards = {};
  for (const k of keys) {
    if (!G.CARD[k]) throw new Oops('Carte inconnue.');
    const n = int(src[k]);
    if (!(n >= 1 && n <= 99)) throw new Oops('Quantité de cartes invalide.');
    cards[k] = n;
  }
  const coins = int(s.coins || 0);
  if (!(coins >= 0 && coins <= 10000000)) throw new Oops('Montant de Coins invalide.');
  return { cards, coins };
}
function sideMissing(uid, side) {
  const u = getUser(uid);
  if (u.coins < side.coins) return `${fmt(side.coins)} Coins`;
  for (const [id, n] of Object.entries(side.cards)) if (owned(uid, id) < n) return `${n}× ${cardName(id)}`;
  return null;
}
function moveSide(from, to, side) {
  for (const [id, n] of Object.entries(side.cards)) { takeCard(from, id, n, 0); giveCard(to, id, n); }
  if (side.coins) { spend(from, side.coins); addCoins(to, side.coins); }
}

/* ---------- état complet du joueur ---------- */
function meState(uid, knownVer) {
  const u = getUser(uid);
  const now = Date.now();
  const day = G.dayString(now);
  const yesterday = G.dayString(now - 86400000);
  const inventory = {};
  for (const r of q('SELECT pack, qty FROM inventory WHERE user_id = ? AND qty > 0').all(uid)) inventory[r.pack] = r.qty;
  const rows = q('SELECT card, qty, is_new FROM collection WHERE user_id = ?').all(uid);
  const ms = missionsState(uid, rows);
  const out = {
    astralUnlocked: rows.some((r) => G.CARD[r.card]?.rarity === 'astral'),
    user: { id: u.id, name: u.name, coins: u.coins, avatar: u.avatar, createdAt: u.created_at, collVer: u.coll_ver },
    free: freeState(u, now),
    gifts: { secretGiftAvailable: !u.secret_gift_claimed },
    inventory,
    pity: u.pity,
    notif: { trades: q("SELECT COUNT(*) AS n FROM trades WHERE to_id = ? AND status = 'pending'").get(uid).n, missions: claimableCount(ms) },
    events: [],
    now,
  };
  // La collection n'est renvoyée que si elle a changé (économise la bande passante)
  if (knownVer === undefined || Number(knownVer) !== u.coll_ver) {
    const collection = {};
    const fresh = [];
    for (const r of rows) { collection[r.card] = r.qty; if (r.is_new) fresh.push(r.card); }
    const st = collStats(rows);
    const best = bestOf(rows, 12);
    Object.assign(out, {
      collection, fresh,
      stats: { uniq: st.uniq, copies: st.copies, dupes: st.dupes, dupeValue: st.dupeValue, score: st.score, complete: st.complete, byR: st.byR, bySerie: st.bySerie },
      best,
      refs: cardsFor(uid, best.concat(fresh.slice(0, 80), u.avatar ? [u.avatar] : [])),
    });
  }
  for (const s of q("SELECT l.id, l.card, l.price, b.name AS buyer FROM listings l LEFT JOIN users b ON b.id = l.buyer WHERE l.seller = ? AND l.status = 'sold' AND l.notified = 0").all(uid)) {
    out.events.push({ type: 'sold', card: s.card, name: cardName(s.card), price: s.price, gain: s.price - Math.floor(s.price * G.SETTINGS.marketFee), buyer: s.buyer });
  }
  q("UPDATE listings SET notified = 1 WHERE seller = ? AND status = 'sold' AND notified = 0").run(uid);
  for (const t of q("SELECT t.id, t.status, u.name FROM trades t JOIN users u ON u.id = t.to_id WHERE t.from_id = ? AND t.status IN ('accepted', 'declined', 'invalid') AND t.notified = 0").all(uid)) {
    out.events.push({ type: 'trade', status: t.status, with: t.name });
  }
  q("UPDATE trades SET notified = 1 WHERE from_id = ? AND status IN ('accepted', 'declined', 'invalid') AND notified = 0").run(uid);
  const nextStreak = u.last_daily === day ? u.streak : (u.last_daily === yesterday ? u.streak + 1 : 1);
  out.daily = {
    available: u.last_daily !== day,
    streak: u.last_daily === day || u.last_daily === yesterday ? u.streak : 0,
    nextBonus: G.SETTINGS.streakBonus * Math.min(nextStreak, G.SETTINGS.streakMax),
    resetIn: G.msUntilMidnight(now),
  };
  return out;
}

/* ---------- classement (mis en cache 20 s) ---------- */
let boardCache = { at: 0, rows: [] };
function leaderboard() {
  const now = Date.now();
  if (now - boardCache.at < 20000) return boardCache.rows;
  const per = new Map();
  for (const r of q('SELECT user_id, card FROM collection').all()) {
    const c = G.CARD[r.card];
    if (!c) continue;
    let p = per.get(r.user_id);
    if (!p) { p = { uniq: 0, score: 0, top: null }; per.set(r.user_id, p); }
    p.uniq++;
    p.score += G.RAR[c.rarity].score;
    if (!p.top || G.RANK[c.rarity] > G.RANK[G.CARD[p.top].rarity] || (c.rarity === G.CARD[p.top].rarity && c.fav > G.CARD[p.top].fav)) p.top = c.id;
  }
  const rows = q('SELECT id, name, avatar, created_at FROM users').all().map((u) => {
    const p = per.get(u.id) || { uniq: 0, score: 0, top: null };
    return { name: u.name, avatar: u.avatar || p.top, uniq: p.uniq, score: p.score, since: u.created_at };
  }).sort((a, b) => b.score - a.score || b.uniq - a.uniq || a.since - b.since).slice(0, 100);
  rows.forEach((r, i) => { r.rank = i + 1; });
  boardCache = { at: now, rows };
  return rows;
}

/* =========================================================================
   Sessions & sécurité
   ========================================================================= */
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `s1$${salt.toString('hex')}$${key.toString('hex')}`;
}
async function checkPassword(pw, stored) {
  const [v, saltHex, keyHex] = String(stored).split('$');
  if (v !== 's1' || !saltHex || !keyHex) return false;
  const key = await scrypt(pw, Buffer.from(saltHex, 'hex'), 64);
  const ref = Buffer.from(keyHex, 'hex');
  return ref.length === key.length && crypto.timingSafeEqual(ref, key);
}
function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) { try { out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); } catch (e) { /* cookie illisible */ } }
  });
  return out;
}
function isHttps(req) { return req.socket.encrypted || String(req.headers['x-forwarded-proto'] || '').startsWith('https'); }
function startSession(req, res, uid) {
  const token = crypto.randomBytes(32).toString('base64url');
  q('INSERT INTO sessions (token, user_id, expires) VALUES (?, ?, ?)').run(sha(token), uid, Date.now() + SESSION_MS);
  res.setHeader('Set-Cookie', `ac_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MS / 1000}${isHttps(req) ? '; Secure' : ''}`);
}
function sessionUser(req) {
  const tok = parseCookies(req).ac_session;
  if (!tok) return null;
  const row = q('SELECT u.id, u.last_seen FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires > ?').get(sha(tok), Date.now());
  if (!row) return null;
  if (Date.now() - row.last_seen > 60000) q('UPDATE users SET last_seen = ? WHERE id = ?').run(Date.now(), row.id);
  return row.id;
}
const attempts = new Map();
function rateLimit(req, key, max, windowMs) {
  const ip = req.socket.remoteAddress || '?';
  const k = `${key}:${ip}`;
  const now = Date.now();
  let a = attempts.get(k);
  if (!a || a.reset < now) { a = { n: 0, reset: now + windowMs }; attempts.set(k, a); }
  a.n++;
  if (a.n > max) throw new Oops(`Trop de tentatives. Réessayez dans ${fmtDur(a.reset - now)}.`, 429);
}
setInterval(() => {
  const now = Date.now();
  for (const [k, a] of attempts) if (a.reset < now) attempts.delete(k);
  q('DELETE FROM sessions WHERE expires < ?').run(now);
  q('DELETE FROM feed WHERE id < (SELECT COALESCE(MAX(id), 0) - 500 FROM feed)').run();
  q('DELETE FROM merchant_buys WHERE period < ?').run(G.merchantStock(now).key - 1);
}, 10 * 60 * 1000).unref();

/* =========================================================================
   Routes de l'API
   ========================================================================= */
const routes = [];
function route(method, pattern, handler, opts) {
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$');
  routes.push({ method, re, handler, auth: !(opts && opts.public) });
}
const NAME_RE = /^[\p{L}\p{N}_.-]{3,20}$/u;
const safeDecode = (s) => { try { return decodeURIComponent(s); } catch (e) { return null; } };

/* --- données publiques (règles + liste des séries), compressées une fois pour toutes --- */
const staticBody = Buffer.from(JSON.stringify(G.publicData()));
const staticGz = zlib.gzipSync(staticBody, { level: 9 });
const staticETag = '"' + crypto.createHash('sha256').update(staticBody).digest('hex').slice(0, 16) + '"';
route('GET', '/api/static', ({ req, res }) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('ETag', staticETag);
  res.setHeader('Vary', 'Accept-Encoding');
  if (req.headers['if-none-match'] === staticETag) { res.writeHead(304); res.end(); return undefined; }
  const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  res.writeHead(200, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, gz ? { 'Content-Encoding': 'gzip' } : {}));
  res.end(gz ? staticGz : staticBody);
  return undefined;
}, { public: true });

route('GET', '/api/feed', ({ uid }) => {
  const feed = q('SELECT f.card, f.at, u.name FROM feed f JOIN users u ON u.id = f.user_id ORDER BY f.id DESC LIMIT 30').all();
  return { feed, players: playerCount(), cards: cardsFor(uid, feed.map((f) => f.card)) };
}, { public: true });

/* --- catalogue paginé (50 000 cartes, pas de rendu massif côté navigateur) --- */
const catalogNorm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const catalogSearch = G.CARDS.map((c) => catalogNorm(`${c.name} ${c.native || ''} ${c.num} ${c.collectionNo} #${String(c.collectionNo).padStart(5, '0')} ${(G.SERIE[c.serie] || {}).name || ''} ${(G.SERIE[c.serie] || {}).title || ''} ${(G.SERIE[c.serie] || {}).code || ''}`));
const catalogOrder = new Map(G.CARDS.map((c, i) => [c.id, i]));
/* Vue Classeur : un même manga/anime reste ensemble, y compris les anciennes
   cartes réintroduites en fin de catalogue. Ni l'ID ni le numéro global ne
   changent : les collections existantes restent valables. */
const catalogSerieOrder = new Map(G.SERIES.map((s, i) => [s.id, i]));
const catalogGroupedOrder = new Map(G.CARDS.slice().sort((a, b) =>
  (catalogSerieOrder.get(a.serie) ?? 1e9) - (catalogSerieOrder.get(b.serie) ?? 1e9) ||
  (Number(a.num.match(/-(\d+)$/)?.[1]) || 0) - (Number(b.num.match(/-(\d+)$/)?.[1]) || 0) ||
  catalogOrder.get(a.id) - catalogOrder.get(b.id)
).map((c, i) => [c.id, i]));
route('GET', '/api/catalog', ({ uid, query }) => {
  const qtext = catalogNorm(String(query.get('q') || '').trim().slice(0, 100));
  const serie = String(query.get('serie') || '');
  const rarity = new Set(String(query.get('rarity') || '').split(',').filter((r) => G.RAR[r]));
  const show = String(query.get('show') || 'all');
  const sort = String(query.get('sort') || 'num');
  const page = Math.max(1, Math.min(20000, Number.parseInt(query.get('page') || '1', 10) || 1));
  const limit = Math.max(12, Math.min(72, Number.parseInt(query.get('limit') || '48', 10) || 48));
  const playerName = String(query.get('player') || '').trim();
  const target = playerName ? q('SELECT id FROM users WHERE name = ?').get(playerName) : { id: uid };
  if (!target) throw new Oops('Joueur introuvable.', 404);
  const owned = new Map(q('SELECT card, qty, is_new FROM collection WHERE user_id = ?').all(target.id).map((r) => [r.card, r]));

  const filtered = [];
  for (let i = 0; i < G.CARDS.length; i++) {
    const c = G.CARDS[i];
    if (serie && c.serie !== serie) continue;

    if (rarity.size && !rarity.has(c.rarity)) continue;
    const qty = owned.get(c.id)?.qty || 0;
    if (show === 'owned' && !qty) continue;
    if (show === 'missing' && qty) continue;
    if (show === 'dupes' && qty < 2) continue;
    if (show === 'new' && !owned.get(c.id)?.is_new) continue;
    if (qtext && !catalogSearch[i].includes(qtext)) continue;
    filtered.push(c);
  }
  const byNum = (a, b) => catalogOrder.get(a.id) - catalogOrder.get(b.id);
  switch (sort) {
    case 'rarity': filtered.sort((a, b) => G.RANK[b.rarity] - G.RANK[a.rarity] || byNum(a, b)); break;
    case 'fav': filtered.sort((a, b) => b.fav - a.fav || byNum(a, b)); break;
    case 'name': filtered.sort((a, b) => a.name.localeCompare(b.name, 'fr') || byNum(a, b)); break;
    case 'qty': filtered.sort((a, b) => (owned.get(b.id)?.qty || 0) - (owned.get(a.id)?.qty || 0) || byNum(a, b)); break;
    default: filtered.sort((a, b) => catalogGroupedOrder.get(a.id) - catalogGroupedOrder.get(b.id)); break;
  }
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const actualPage = Math.min(page, pages);
  const ids = filtered.slice((actualPage - 1) * limit, actualPage * limit).map((c) => c.id);
  return { total, page: actualPage, pages, limit, ids, cards: cardsFor(uid, ids), quantities: Object.fromEntries(ids.map(id => [id, owned.get(id)?.qty || 0])), stats: collStats([...owned.values()]) };
}, { public: false });

/* --- cartes à la demande --- */
route('POST', '/api/cards', ({ uid, body }) => {
  const ids = Array.isArray(body.ids) ? body.ids.slice(0, 600).map(String) : [];
  return { cards: cardsFor(uid, ids) };
}, { public: true });
route('GET', '/api/series/:id', ({ uid, params }) => {
  const s = G.SERIE[safeDecode(params.id)];
  if (!s) throw new Oops('Série introuvable.', 404);
  const ids = G.RARITIES.flatMap((r) => G.BY_SERIE[s.id][r.id].map((c) => c.id));
  const cards = cardsFor(uid, ids);
  const order = ids.map((id) => cards[id]).sort((a, b) => a.num.localeCompare(b.num));
  return { serie: s, cards: order };
}, { public: true });

/* --- comptes --- */
route('POST', '/api/register', async ({ req, res, body }) => {
  rateLimit(req, 'register', 8, 15 * 60 * 1000);
  const name = String(body.name || '').trim();
  const pw = String(body.password || '');
  if (!NAME_RE.test(name)) throw new Oops('Pseudo : 3 à 20 caractères (lettres, chiffres, _ . -).');
  if (pw.length < 6 || pw.length > 100) throw new Oops('Mot de passe : 6 caractères minimum.');
  if (q('SELECT 1 FROM users WHERE name = ?').get(name)) throw new Oops('Ce pseudo est déjà pris.');
  const hash = await hashPassword(pw);
  const now = Date.now();
  const uid = tx(() => {
    if (q('SELECT 1 FROM users WHERE name = ?').get(name)) throw new Oops('Ce pseudo est déjà pris.');
    const r = q('INSERT INTO users (name, pass, coins, free_anchor, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?)')
      .run(name, hash, G.SETTINGS.startCoins, now - G.SETTINGS.freeInterval, now, now);
    const id = Number(r.lastInsertRowid);
    Object.entries(G.SETTINGS.starterPacks).forEach(([p, n]) => addPacks(id, p, n));
    return id;
  });
  startSession(req, res, uid);
  return { me: meState(uid), welcome: true };
}, { public: true });

route('POST', '/api/login', async ({ req, res, body }) => {
  rateLimit(req, 'login', 12, 10 * 60 * 1000);
  const u = q('SELECT id, pass FROM users WHERE name = ?').get(String(body.name || '').trim());
  if (!u || !(await checkPassword(String(body.password || ''), u.pass))) throw new Oops('Pseudo ou mot de passe incorrect.');
  startSession(req, res, u.id);
  return { me: meState(u.id) };
}, { public: true });

route('POST', '/api/logout', ({ req, res }) => {
  const tok = parseCookies(req).ac_session;
  if (tok) q('DELETE FROM sessions WHERE token = ?').run(sha(tok));
  res.setHeader('Set-Cookie', 'ac_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  return { ok: true };
}, { public: true });

route('GET', '/api/me', ({ uid, query }) => ({ me: meState(uid, query.has('cv') ? query.get('cv') : undefined) }));

/* Démo d'animation : tirage contrôlé, strictement sans récompense en base.
   N'affecte ni collection, ni Coins, ni quêtes, ni compteur de fidélité. */
route('POST', '/api/packs/test', ({ req }) => {
  rateLimit(req, 'testpack', 80, 5 * 60 * 1000);
  const drawn = G.drawTestPack();
  const cards = drawn.map((c) => ({ id: c.id, isNew: false, bonus: false }));
  // Les fiches complètes sont disponibles uniquement pendant la démo.
  // Le navigateur les enlève de son cache dès la fermeture.
  const refs = Object.fromEntries(drawn.map((c) => [c.id, c]));
  return { result: { type: 'testultimate', serie: null, demo: true, cards, pity: false, refs } };
});

/* --- packs --- */
route('POST', '/api/packs/open' , ({ uid, body }) => {
  const source = body.source;
  const result = tx(() => {
    const u = getUser(uid);
    const now = Date.now();
    if (source === 'free') {
      consumeFree(u, now);
      return openPack(uid, 'standard', null, 'free');
    }
    if (source === 'secretgift') {
      // Le changement d'état + attribution des cinq cartes sont dans la même transaction.
      // Le UPDATE conditionnel évite aussi un deuxième tirage lors de clics répétés.
      const used = q('UPDATE users SET secret_gift_claimed = 1 WHERE id = ? AND secret_gift_claimed = 0').run(uid);
      if (!used.changes) throw new Oops('Pack Secret déjà récupéré sur ce compte.');
      return openPack(uid, 'secretgift', null, 'secretgift');
    }
    if (source === 'daily') {
      const day = G.dayString(now);
      if (u.last_daily === day) throw new Oops(`Pack quotidien déjà ouvert. Prochain dans ${fmtDur(G.msUntilMidnight(now))}.`);
      const streak = u.last_daily === G.dayString(now - 86400000) ? u.streak + 1 : 1;
      const bonus = G.SETTINGS.streakBonus * Math.min(streak, G.SETTINGS.streakMax);
      q('UPDATE users SET last_daily = ?, streak = ?, coins = coins + ? WHERE id = ?').run(day, streak, bonus, uid);
      return Object.assign(openPack(uid, 'quotidien', null, 'daily'), { streak, bonus });
    }
    if (source === 'inventory') {
      const def = G.PACKS[body.pack];
      if (!def || def.perSerie || def.gift) throw new Oops('Pack inconnu.');
      let serie = null;
      if (def.perSet) {
        serie = G.SERIE[body.serie] && G.SERIE[body.serie].special ? body.serie : G.SPECIALS[crypto.randomInt(G.SPECIALS.length)].id;
      }
      const r = q('UPDATE inventory SET qty = qty - 1 WHERE user_id = ? AND pack = ? AND qty > 0').run(uid, def.id);
      if (!r.changes) throw new Oops(`Vous n'avez plus de ${def.name}.`);
      return openPack(uid, def.id, serie, 'inventory');
    }
    throw new Oops('Source de pack inconnue.');
  });
  return { result, me: meState(uid) };
});

route('POST', '/api/packs/buy', ({ uid, body }) => {
  const def = G.PACKS[body.pack];
  if (!def || !def.price) throw new Oops('Ce pack ne peut pas être acheté.');
  const serie = def.perSerie || def.perSet ? String(body.serie || '') : null;
  checkTarget(def, serie);
  const result = tx(() => { spend(uid, def.price); return openPack(uid, def.id, serie, 'buy'); });
  return { result, me: meState(uid) };
});

/* Ouverture groupée de 2 à 10 boosters. Une seule transaction :
   les 10 packs sont validés ensemble et le compte ne paie jamais partiellement.
   Chaque pack applique sa propre fidélité et ses taux réels. */
route('POST', '/api/packs/bulk', ({ uid, body }) => {
  const count = int(body.count);
  if (!(count >= 2 && count <= 10)) throw new Oops('Choisissez entre 2 et 10 packs.');
  const source = String(body.source || '');
  const pack = String(body.pack || '');
  const def = G.PACKS[pack];
  let serie = null;
  if (source === 'buy') {
    if (!def || !def.price || def.gift) throw new Oops('Pack indisponible à l’achat.');
    serie = def.perSerie || def.perSet ? String(body.serie || '') : null;
    checkTarget(def, serie);
  } else if (source === 'inventory') {
    if (!def || def.gift || def.perSerie || !['standard', 'celeste', 'royal', 'special'].includes(pack))
      throw new Oops('Pack indisponible dans votre réserve.');
    serie = def.perSet && G.SERIE[body.serie]?.special ? String(body.serie) : null;
    if (def.perSet && !serie) throw new Oops('Choisissez une édition spéciale.');
  } else if (source !== 'free') throw new Oops('Source groupée inconnue.');
  const results = tx(() => {
    if (source === 'buy') spend(uid, def.price * count);
    if (source === 'inventory') {
      const paid = q('UPDATE inventory SET qty = qty - ? WHERE user_id = ? AND pack = ? AND qty >= ?')
        .run(count, uid, pack, count);
      if (!paid.changes) throw new Oops(`Il vous faut ${count} packs en réserve.`);
    }
    const out = [];
    for (let i = 0; i < count; i++) {
      if (source === 'free') consumeFree(getUser(uid), Date.now());
      out.push(openPack(uid, source === 'free' ? 'standard' : pack, serie, source));
    }
    return out;
  });
  return { results, count, source, me: meState(uid) };
});

/* --- collection --- */
route('POST', '/api/collection/seen', ({ uid, body }) => {
  if (Array.isArray(body.cards)) {
    tx(() => body.cards.slice(0, 400).forEach((id) => q('UPDATE collection SET is_new = 0 WHERE user_id = ? AND card = ?').run(uid, String(id))));
  } else {
    q('UPDATE collection SET is_new = 0 WHERE user_id = ? AND is_new = 1').run(uid);
  }
  bumpColl(uid);
  return { ok: true };
});

route('POST', '/api/cards/destroy', ({ uid, body }) => {
  const c = G.CARD[body.card];
  if (!c) throw new Oops('Carte inconnue.');
  const n = int(body.qty || 1);
  if (!(n >= 1 && n <= 9999)) throw new Oops('Quantité invalide.');
  const gain = n * G.RAR[c.rarity].value;
  tx(() => { takeCard(uid, c.id, n, 1); addCoins(uid, gain); track(uid, 'destroy', n); });
  return { gain, destroyed: n, me: meState(uid) };
});

route('POST', '/api/cards/destroy-dupes', ({ uid, body }) => {
  const max = G.RAR[body.max] ? body.max : 'epique';
  const out = tx(() => {
    let gain = 0, count = 0;
    for (const r of q('SELECT card, qty FROM collection WHERE user_id = ? AND qty > 1').all(uid)) {
      const c = G.CARD[r.card];
      if (!c || G.RANK[c.rarity] > G.RANK[max]) continue;
      count += r.qty - 1;
      gain += (r.qty - 1) * G.RAR[c.rarity].value;
      q('UPDATE collection SET qty = 1 WHERE user_id = ? AND card = ?').run(uid, r.card);
    }
    if (!count) throw new Oops('Aucun doublon à détruire avec ce filtre.');
    addCoins(uid, gain);
    bumpColl(uid);
    track(uid, 'destroy', count);
    return { gain, destroyed: count };
  });
  return Object.assign(out, { me: meState(uid) });
});

route('POST', '/api/avatar', ({ uid, body }) => {
  if (!G.CARD[body.card] || !owned(uid, body.card)) throw new Oops('Vous devez posséder cette carte.');
  q('UPDATE users SET avatar = ? WHERE id = ?').run(body.card, uid);
  bumpColl(uid);
  boardCache.at = 0;
  return { me: meState(uid) };
});

/* --- missions --- */
route('GET', '/api/missions', ({ uid }) => ({ missions: missionsState(uid) }));

route('POST', '/api/missions/claim-all', ({ uid }) => {
  const result = tx(() => {
    const ms = missionsState(uid);
    const day = ms.day;
    const ready = [];
    for (const m of [...ms.daily, ms.bonus]) {
      if (!m.claimed && m.progress >= m.target) ready.push({id:m.id, reward:m.reward, daily:true});
    }
    for (const state of ms.achievements) {
      const def = G.ACH[state.id];
      if (!state.claimed && state.progress >= def.target) ready.push({id:state.id,reward:def.reward});
    }
    // Include every started series, even those beyond the first 36 UI panels.
    for (const s of ms.series) for (const st of G.SERIE_STEPS) {
      const step = G.serieStep(s.id, st.k);
      if (step && s.owned >= step.target && !s.claimed.includes(step.k)) ready.push({id:`s_${s.id}_${step.k}`,reward:step.reward});
    }
    const reward = {coins:0,packs:{}};
    for (const m of ready) {
      if (m.daily) q('UPDATE daily SET claimed = 1 WHERE user_id = ? AND day = ? AND mission = ? AND claimed = 0').run(uid,day,m.id);
      else q('INSERT INTO achievements (user_id, id, claimed_at) VALUES (?, ?, ?)').run(uid,m.id,Date.now());
      grantReward(uid,m.reward);
      reward.coins += m.reward.coins || 0;
      for (const [pack,n] of Object.entries(m.reward.packs || {})) reward.packs[pack]=(reward.packs[pack] || 0)+n;
    }
    return {reward,claimed:ready.map(m=>m.id),count:ready.length};
  });
  return {...result, missions:missionsState(uid),me:meState(uid)};
});

route('POST', '/api/missions/claim', ({ uid, body }) => {
  const id = String(body.id || '');
  const reward = tx(() => {
    const day = G.dayString(Date.now());
    const ms = missionsState(uid);
    if (id === 'bonus') {
      if (ms.bonus.claimed) throw new Oops('Récompense déjà récupérée.');
      if (ms.bonus.progress < ms.bonus.target) throw new Oops('Terminez d\'abord toutes les missions du jour.');
      q("UPDATE daily SET claimed = 1 WHERE user_id = ? AND day = ? AND mission = 'bonus'").run(uid, day);
      grantReward(uid, ms.bonus.reward);
      return ms.bonus.reward;
    }
    const d = ms.daily.find((m) => m.id === id);
    if (d) {
      if (d.claimed) throw new Oops('Récompense déjà récupérée.');
      if (d.progress < d.target) throw new Oops('Mission pas encore terminée.');
      q('UPDATE daily SET claimed = 1 WHERE user_id = ? AND day = ? AND mission = ?').run(uid, day, id);
      grantReward(uid, d.reward);
      return d.reward;
    }
    const sm = /^s_(.+)_([123])$/.exec(id);
    if (sm) {
      const step = G.serieStep(sm[1], +sm[2]);
      if (!step) throw new Oops('Mission inconnue.');
      const s = ms.series.find((x) => x.id === sm[1]);
      if (s && s.claimed.includes(step.k)) throw new Oops('Récompense déjà récupérée.');
      if (!s || s.owned < step.target) throw new Oops('Mission pas encore terminée.');
      q('INSERT INTO achievements (user_id, id, claimed_at) VALUES (?, ?, ?)').run(uid, id, Date.now());
      grantReward(uid, step.reward);
      return step.reward;
    }
    const a = G.ACH[id];
    const st = ms.achievements.find((x) => x.id === id);
    if (!a || !st) throw new Oops('Mission inconnue.');
    if (st.claimed) throw new Oops('Récompense déjà récupérée.');
    if (st.progress < a.target) throw new Oops('Mission pas encore terminée.');
    q('INSERT INTO achievements (user_id, id, claimed_at) VALUES (?, ?, ?)').run(uid, id, Date.now());
    grantReward(uid, a.reward);
    return a.reward;
  });
  return { reward, missions: missionsState(uid), me: meState(uid) };
});

/* --- marché --- */
route('GET', '/api/market', ({ uid }) => {
  const now = Date.now();
  const stock = G.merchantStock(now);
  const bought = new Set(q('SELECT slot FROM merchant_buys WHERE user_id = ? AND period = ?').all(uid, stock.key).map((r) => r.slot));
  const listings = q("SELECT l.id, l.card, l.price, l.created_at AS at, u.name AS seller, l.seller = ? AS mine FROM listings l JOIN users u ON u.id = l.seller WHERE l.status = 'open' ORDER BY l.id DESC LIMIT 600").all(uid)
    .map((l) => Object.assign(l, { mine: !!l.mine }));
  const mine = q("SELECT l.id, l.card, l.price, l.status, l.created_at AS at, l.closed_at AS closedAt, b.name AS buyer FROM listings l LEFT JOIN users b ON b.id = l.buyer WHERE l.seller = ? AND (l.status = 'open' OR l.closed_at > ?) ORDER BY l.id DESC LIMIT 80").all(uid, now - 7 * 86400000);
  const merchant = { refreshIn: stock.refreshIn, slots: stock.slots.map((s) => Object.assign({ bought: bought.has(s.slot) }, s)) };
  return {
    listings, merchant, mine, fee: G.SETTINGS.marketFee,
    cards: cardsFor(uid, listings.map((l) => l.card).concat(mine.map((l) => l.card), merchant.slots.map((s) => s.card))),
  };
});

route('POST', '/api/market/list', ({ uid, body }) => {
  const c = G.CARD[body.card];
  if (!c) throw new Oops('Carte inconnue.');
  const price = int(body.price);
  if (!(price >= 1 && price <= 9999999)) throw new Oops('Prix : entre 1 et 9 999 999 Coins.');
  tx(() => {
    const open = q("SELECT COUNT(*) AS n FROM listings WHERE seller = ? AND status = 'open'").get(uid).n;
    if (open >= G.SETTINGS.marketMaxListings) throw new Oops(`${G.SETTINGS.marketMaxListings} ventes en cours maximum.`);
    takeCard(uid, c.id, 1, 0);
    q('INSERT INTO listings (seller, card, price, created_at) VALUES (?, ?, ?, ?)').run(uid, c.id, price, Date.now());
    track(uid, 'market_list', 1);
  });
  return { me: meState(uid) };
});

route('POST', '/api/market/buy', ({ uid, body }) => {
  const out = tx(() => {
    const l = q('SELECT * FROM listings WHERE id = ?').get(int(body.id));
    if (!l || l.status !== 'open') throw new Oops('Cette offre n\'est plus disponible.');
    if (l.seller === uid) throw new Oops('C\'est votre propre vente.');
    spend(uid, l.price);
    addCoins(l.seller, l.price - Math.floor(l.price * G.SETTINGS.marketFee));
    const isNew = giveCard(uid, l.card, 1);
    q("UPDATE listings SET status = 'sold', buyer = ?, closed_at = ? WHERE id = ?").run(uid, Date.now(), l.id);
    track(uid, 'market_buy', 1);
    track(l.seller, 'market_sold', 1);
    return { card: l.card, isNew };
  });
  boardCache.at = 0;
  return Object.assign(out, { refs: cardsFor(uid, [out.card]), me: meState(uid) });
});

route('POST', '/api/market/merchant', ({ uid, body }) => {
  const out = tx(() => {
    const stock = G.merchantStock(Date.now());
    const s = stock.slots.find((x) => x.slot === String(body.slot));
    if (!s) throw new Oops('Cette offre du Marchand a expiré.');
    if (q('SELECT 1 FROM merchant_buys WHERE user_id = ? AND slot = ?').get(uid, s.slot)) throw new Oops('Vous avez déjà acheté cette offre.');
    spend(uid, s.price);
    q('INSERT INTO merchant_buys (user_id, slot, period) VALUES (?, ?, ?)').run(uid, s.slot, stock.key);
    const isNew = giveCard(uid, s.card, 1);
    track(uid, 'market_buy', 1);
    return { card: s.card, isNew };
  });
  return Object.assign(out, { refs: cardsFor(uid, [out.card]), me: meState(uid) });
});

route('POST', '/api/market/cancel', ({ uid, body }) => {
  tx(() => {
    const l = q('SELECT * FROM listings WHERE id = ?').get(int(body.id));
    if (!l || l.seller !== uid || l.status !== 'open') throw new Oops('Vente introuvable.');
    q("UPDATE listings SET status = 'cancelled', closed_at = ? WHERE id = ?").run(Date.now(), l.id);
    giveCard(uid, l.card, 1);
  });
  return { me: meState(uid) };
});

/* --- joueurs --- */
route('GET', '/api/players', ({ uid, query }) => {
  const term = String(query.get('q') || '').replace(/[\\%_]/g, (m) => '\\' + m).slice(0, 20);
  const players = q("SELECT u.id, u.name, u.avatar, u.last_seen AS seen, (SELECT COUNT(*) FROM collection c WHERE c.user_id = u.id) AS uniq FROM users u WHERE u.id <> ? AND u.name LIKE ? ESCAPE '\\' ORDER BY u.last_seen DESC LIMIT 40")
    .all(uid, term + '%');
  return { players, cards: cardsFor(uid, players.map((p) => p.avatar)) };
});

route('GET', '/api/players/:name', ({ uid, params }) => {
  const wanted = safeDecode(params.name);
  const u = wanted && q('SELECT id, name, avatar, created_at, last_seen FROM users WHERE name = ?').get(wanted);
  if (!u) throw new Oops('Joueur introuvable.', 404);
  const rows = q('SELECT card, qty FROM collection WHERE user_id = ?').all(u.id);
  const collection = {};
  rows.forEach((r) => { collection[r.card] = r.qty; });
  const counters = {};
  for (const r of q('SELECT key, value FROM counters WHERE user_id = ?').all(u.id)) counters[r.key] = r.value;
  const board = leaderboard().find((r) => r.name === u.name);
  const st = collStats(rows);
  const best = bestOf(rows, 12);
  return {
    player: {
      name: u.name, avatar: u.avatar || best[0] || null, since: u.created_at, seen: u.last_seen,
      score: st.score, uniq: st.uniq, rank: board ? board.rank : null, bySerie: st.bySerie, best,
      packs: counters.pack_open || 0, trades: counters.trade_done || 0, sold: counters.market_sold || 0,
      collection, stats: st,
    },
    cards: cardsFor(uid, best.concat(u.avatar ? [u.avatar] : [])),
  };
});

route('GET', '/api/leaderboard', ({ uid }) => {
  const board = leaderboard();
  return { board, total: G.CARDS.length, cards: cardsFor(uid, board.map((b) => b.avatar)) };
});

/* --- échanges --- */
function tradeRow(t) {
  return { id: t.id, from: t.from_name, to: t.to_name, give: JSON.parse(t.give), get: JSON.parse(t.get), message: t.message, status: t.status, at: t.created_at, closedAt: t.closed_at };
}
const TRADE_SELECT = 'SELECT t.*, f.name AS from_name, d.name AS to_name FROM trades t JOIN users f ON f.id = t.from_id JOIN users d ON d.id = t.to_id';

route('GET', '/api/trades', ({ uid }) => {
  const incoming = q(`${TRADE_SELECT} WHERE t.to_id = ? AND t.status = 'pending' ORDER BY t.id DESC`).all(uid).map(tradeRow);
  const outgoing = q(`${TRADE_SELECT} WHERE t.from_id = ? AND t.status = 'pending' ORDER BY t.id DESC`).all(uid).map(tradeRow);
  const history = q(`${TRADE_SELECT} WHERE (t.from_id = ? OR t.to_id = ?) AND t.status <> 'pending' ORDER BY t.closed_at DESC LIMIT 40`).all(uid, uid).map(tradeRow);
  const ids = [];
  incoming.concat(outgoing, history).forEach((t) => { ids.push(...Object.keys(t.give.cards), ...Object.keys(t.get.cards)); });
  return { incoming, outgoing, history, cards: cardsFor(uid, ids) };
});

route('POST', '/api/trades', ({ uid, body }) => {
  const to = q('SELECT id, name FROM users WHERE name = ?').get(String(body.to || '').trim());
  if (!to) throw new Oops('Joueur introuvable.');
  if (to.id === uid) throw new Oops('Vous ne pouvez pas échanger avec vous-même.');
  const give = normSide(body.give);
  const get = normSide(body.get);
  if (!Object.keys(give.cards).length && !Object.keys(get.cards).length) throw new Oops('Ajoutez au moins une carte à l\'échange.');
  const message = String(body.message || '').trim().slice(0, 160);
  const miss = sideMissing(uid, give);
  if (miss) throw new Oops(`Vous ne possédez pas : ${miss}.`);
  const missTo = sideMissing(to.id, get);
  if (missTo) throw new Oops(`${to.name} ne possède pas : ${missTo}.`);
  tx(() => {
    const pending = q("SELECT COUNT(*) AS n FROM trades WHERE from_id = ? AND status = 'pending'").get(uid).n;
    if (pending >= 20) throw new Oops('20 propositions en attente maximum.');
    q('INSERT INTO trades (from_id, to_id, give, get, message, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uid, to.id, JSON.stringify(give), JSON.stringify(get), message, Date.now());
    track(uid, 'trade_send', 1);
  });
  return { me: meState(uid) };
});

route('POST', '/api/trades/:id/:action', ({ uid, params }) => {
  const t = q('SELECT * FROM trades WHERE id = ?').get(int(params.id));
  if (!t || t.status !== 'pending') throw new Oops('Cet échange n\'est plus en attente.');
  const now = Date.now();
  const close = (status) => q('UPDATE trades SET status = ?, closed_at = ? WHERE id = ?').run(status, now, t.id);
  if (params.action === 'cancel') {
    if (t.from_id !== uid) throw new Oops('Échange introuvable.');
    close('cancelled');
    q('UPDATE trades SET notified = 1 WHERE id = ?').run(t.id);
  } else if (params.action === 'decline') {
    if (t.to_id !== uid) throw new Oops('Échange introuvable.');
    close('declined');
  } else if (params.action === 'accept') {
    if (t.to_id !== uid) throw new Oops('Échange introuvable.');
    const give = JSON.parse(t.give), get = JSON.parse(t.get);
    const fromName = getUser(t.from_id).name;
    const a = sideMissing(t.from_id, give);
    if (a) { close('invalid'); throw new Oops(`Échange impossible : ${fromName} ne possède plus ${a}.`); }
    const b = sideMissing(uid, get);
    if (b) throw new Oops(`Il vous manque : ${b}.`);
    tx(() => {
      moveSide(t.from_id, uid, give);
      moveSide(uid, t.from_id, get);
      close('accepted');
      track(uid, 'trade_done', 1);
      track(t.from_id, 'trade_done', 1);
    });
    boardCache.at = 0;
    return { me: meState(uid), refs: cardsFor(uid, Object.keys(give.cards)) };
  } else {
    throw new Oops('Action inconnue.', 404);
  }
  return { me: meState(uid) };
});

/* =========================================================================
   Serveur HTTP
   ========================================================================= */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.webm': 'video/webm', '.mp4': 'video/mp4', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.svg', '.txt']);
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: https://s4.anilist.co https://ddragon.leagueoflegends.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
};
const acceptsGzip = (req) => /\bgzip\b/.test(req.headers['accept-encoding'] || '');

function sendJSON(req, res, status, obj) {
  const body = Buffer.from(JSON.stringify(obj));
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (body.length > 1400 && acceptsGzip(req)) {
    headers['Content-Encoding'] = 'gzip';
    headers.Vary = 'Accept-Encoding';
    res.writeHead(status, headers);
    res.end(zlib.gzipSync(body, { level: 5 }));
  } else {
    res.writeHead(status, headers);
    res.end(body);
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.method !== 'POST') return resolve({});
    if (!String(req.headers['content-type'] || '').includes('application/json')) return reject(new Oops('JSON attendu.', 415));
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 64 * 1024) { reject(new Oops('Requête trop volumineuse.', 413)); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(v && typeof v === 'object' ? v : {});
      } catch (e) { reject(new Oops('JSON invalide.')); }
    });
    req.on('error', reject);
  });
}

const gzCache = new Map();
function serveStatic(req, res, pathname) {
  const rel0 = safeDecode(pathname);
  if (rel0 === null) { res.writeHead(400); return res.end(); }
  const rel = rel0 === '/' || rel0 === '' ? '/index.html' : rel0;
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Page introuvable');
    }
    const ext = path.extname(file).toLowerCase();
    const etag = `"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', rel.startsWith('/art/') ? 'public, max-age=86400' : 'no-cache');
    if (req.headers['if-none-match'] === etag) { res.writeHead(304); return res.end(); }
    const type = MIME[ext] || 'application/octet-stream';
    if (COMPRESSIBLE.has(ext) && acceptsGzip(req)) {
      let entry = gzCache.get(file);
      if (!entry || entry.etag !== etag) {
        entry = { etag, buf: zlib.gzipSync(fs.readFileSync(file), { level: 9 }) };
        gzCache.set(file, entry);
      }
      res.writeHead(200, { 'Content-Type': type, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding', 'Content-Length': entry.buf.length });
      return res.end(req.method === 'HEAD' ? undefined : entry.buf);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
    return undefined;
  });
  return undefined;
}

const server = http.createServer(async (req, res) => {
  Object.entries(SECURITY_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  const url = new URL(req.url, 'http://localhost');
  // Railway healthcheck : confirme que la base SQLite repond.
  if (url.pathname === '/health') {
    if (req.method !== 'GET') { res.writeHead(405); return res.end(); }
    try {
      db.prepare('SELECT 1 AS ready').get();
      return sendJSON(req, res, 200, { ok: true, app: 'AnimeConnection', version: '20-elite-unique-missions-bulk' });
    } catch (e) {
      console.error('[health] SQLite indisponible', e);
      return sendJSON(req, res, 503, { ok: false });
    }
  }
  if (!url.pathname.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    return serveStatic(req, res, url.pathname);
  }
  let match = null;
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = r.re.exec(url.pathname);
    if (m) { match = { r, params: m.groups || {} }; break; }
  }
  if (!match) return sendJSON(req, res, 404, { error: 'Route inconnue.' });
  try {
    const uid = sessionUser(req);
    if (match.r.auth && !uid) throw new Oops('Connexion requise.', 401);
    const body = await readBody(req);
    const out = await match.r.handler({ req, res, uid, body, params: match.params, query: url.searchParams });
    if (out !== undefined && !res.headersSent) sendJSON(req, res, 200, out);
  } catch (e) {
    if (res.headersSent) return undefined;
    if (e instanceof Oops) return sendJSON(req, res, e.status, { error: e.message });
    console.error(e);
    sendJSON(req, res, 500, { error: 'Erreur du serveur.' });
  }
  return undefined;
});

server.listen(PORT, HOST, () => {
  const regular = G.SERIES.filter((s) => !s.special).length;
  console.log('');
  console.log('  AnimeConnection est en ligne');
  console.log(`  -> http://localhost:${PORT}`);
  console.log(`  ${regular} séries, ${G.SPECIALS.length} éditions spéciales, ${G.CARDS.length.toLocaleString('fr-FR')} cartes${artCount ? `, ${artCount} illustrations perso` : ''}.`);
  console.log('');
});
