/* =========================================================================
   AnimeConnection : règles du jeu (raretés, packs, missions, marché)
   Tout ce qui touche à l'équilibrage se règle dans ce fichier.
   ========================================================================= */
'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'cards.json'), 'utf8'));
// Injecte l'édition LOL en mémoire sans modifier les identifiants existants.
require('./lol-data').install(DATA);
// Enrichit l'édition Summer Waifus sans modifier les anciennes cartes.
require('./summer-2026').install(DATA);

/* Taux de base par carte (en %) : Secrète et Primordiale sont intentionnellement
   exceptionnelles. Les packs premium ont leurs propres pondérations ci-dessous.
   La somme des poids de chaque table = 100. */
const RARITIES = [
  { id: 'commune',     label: 'Commune',     weight: 67,       value: 2,    score: 1,   merchant: null },
  { id: 'rare',        label: 'Rare',        weight: 26,       value: 5,    score: 3,   merchant: 60 },
  { id: 'epique',      label: 'Épique',      weight: 6.65,     value: 15,   score: 8,   merchant: 180 },
  { id: 'legendaire',  label: 'Légendaire',  weight: 0.3,      value: 50,   score: 20,  merchant: 600 },
  { id: 'mythique',    label: 'Mythique',    weight: 0.049915,  value: 150,  score: 50,  merchant: 2000 },
  { id: 'secrete',     label: 'Secrète',     weight: 0.00008,   value: 500,  score: 150, merchant: null, fullArt: true },
  { id: 'primordiale', label: 'Primordiale', weight: 0.000005, value: 2000, score: 500, merchant: null, fullArt: true },
  { id: 'astral',      label: 'Astral',      weight: 0.000001, value: 10000, score: 2500, merchant: null, fullArt: true },
];
RARITIES.forEach(r => { r.fullArt = true; });
const RANK = Object.fromEntries(RARITIES.map((r, i) => [r.id, i]));
const RAR = Object.fromEntries(RARITIES.map((r) => [r.id, r]));
const HIDDEN = new Set(RARITIES.filter((r) => r.hidden).map((r) => r.id));

const SETTINGS = {
  freeInterval: 10 * 60 * 1000, // un pack gratuit toutes les 10 minutes
  freeCap: 10,                  // jusqu’à 10 packs gratuits à ouvrir ensemble
  startCoins: 500,
  starterPacks: { standard: 5, celeste: 1, special: 1 },
  pityLimit: 120,               // garantie d'une Légendaire exacte au 120e pack sans Légendaire+
  specialBonus: 0,              // Les éditions collector ne tombent pas en bonus dans les packs normaux
  marketFee: 0.05,              // 5 % de taxe sur les ventes entre joueurs
  marketMaxListings: 30,
  streakBonus: 50,              // Coins x jours de connexion d'affilée (max 7)
  streakMax: 7,
  merchantSlots: 8,
  merchantHours: 1,
  timeZone: 'Europe/Paris',
};

/* Les slots représentent la rareté minimum, jamais une Légendaire garantie.
   rates sont des poids en %, re-normalisés sur la rareté minimale du slot.
   La sélection d'une édition augmente la chance d'une variante collector sans garantie.
*/
const CELESTE_RATES = { commune: 35, rare: 44, epique: 19.8, legendaire: 1.1, mythique: .099915, secrete: .00008, primordiale: .000005, astral: .000001 };
const ROYAL_RATES = { commune: 25, rare: 40, epique: 31.55, legendaire: 3.2, mythique: .249915, secrete: .00008, primordiale: .000005, astral: .000001 };
const SPECIAL_RATES = { commune: 60, rare: 29, epique: 10.15, legendaire: .75, mythique: .099915, secrete: .00008, primordiale: .000005, astral: .000001 };
const EDITION_RATES = { legendaire: 98.9, mythique: 1.0999, secrete: .00009, primordiale: .00001, astral: .000001 };
// Cadeau de bienvenue spécial : 1 Secrète EXACTE + 4 autres cartes, pas de Primordiale bonus.
const SECRET_GIFT_RATES = { commune: 67, rare: 26, epique: 6.65, legendaire: .3, mythique: .05, secrete: 0, primordiale: 0, astral: 0 };
const PACKS = {
  secretgift: { id: 'secretgift', name: 'Pack Secret gratuit', price: null, gift: true,
    slots: [null, null, null, 'rare', 'secrete'],
    desc: 'Un cadeau unique par compte : 5 cartes dont exactement une Secrète garantie.' },
  standard: { id: 'standard', name: 'Pack Standard', price: 200, slots: [null, null, null, null, 'rare'],
    desc: '5 cartes. Une Rare ou mieux, mais les grandes raretés sont difficiles à obtenir.' },
  quotidien: { id: 'quotidien', name: 'Pack Quotidien', price: null, slots: [null, null, null, null, 'epique'],
    desc: 'Offert chaque jour. 5 cartes dont une Épique ou mieux.' },
  serie: { id: 'serie', name: 'Pack Série', price: 350, slots: [null, null, null, null, 'rare'], perSerie: true,
    desc: '5 cartes de la série choisie. Une Rare ou mieux.' },
  celeste: { id: 'celeste', name: 'Pack Céleste', price: 1600, slots: [null, 'rare', 'rare', 'rare', 'epique'], rates: CELESTE_RATES,
    desc: '5 cartes, plus de chance de Légendaire ou mieux. Aucune Légendaire garantie.' },
  royal: { id: 'royal', name: 'Pack Royal', price: 6000, slots: ['rare', 'rare', 'epique', 'epique', 'epique'], rates: ROYAL_RATES,
    desc: 'Pack très haut de gamme : 3 Épiques ou mieux, chances de Légendaire renforcées, sans garantie.' },
  special: { id: 'special', name: 'Pack Édition spéciale', price: 3500,
    slots: [null, 'rare', 'rare', 'epique', 'epique'], rates: SPECIAL_RATES, perSet: true,
    editionChance: 0.10, editionRates: EDITION_RATES,
    desc: '5 cartes avec taux premium et 10 % de chance d’obtenir une carte collector de l’édition choisie. Aucune Légendaire garantie.' },
};

const SERIES = DATA.series;
const CARDS = DATA.cards;
const CARD = Object.create(null);
CARDS.forEach((c, i) => { c.collectionNo = i + 1; CARD[c.id] = c; });
const SERIE = Object.create(null);
SERIES.forEach((s) => { SERIE[s.id] = s; });
const SPECIALS = SERIES.filter((s) => s.special);
const REGULAR = SERIES.filter((s) => !s.special);

/* ---------- pools de tirage ---------- */
// Pool général : chaque carte pèse selon la popularité de sa série (les grandes séries sortent plus souvent).
const serieWeight = (s) => Math.max(1, Math.sqrt(s.pop || 1));
const GLOBAL = {};
RARITIES.forEach((r) => { GLOBAL[r.id] = { cards: [], cum: [], total: 0 }; });
const BY_SERIE = Object.create(null);
SERIES.forEach((s) => { BY_SERIE[s.id] = {}; RARITIES.forEach((r) => { BY_SERIE[s.id][r.id] = []; }); });
for (const c of CARDS) {
  BY_SERIE[c.serie][c.rarity].push(c);
  const s = SERIE[c.serie];
  if (s.special) continue;
  const g = GLOBAL[c.rarity];
  g.total += serieWeight(s);
  g.cards.push(c);
  g.cum.push(g.total);
}

/* ---------- hasard ---------- */
const rand = () => crypto.randomInt(0, 0x7fffffff) / 0x7fffffff;
const randInt = (n) => crypto.randomInt(0, n);
function seeded(str) { // mulberry32, pour les tirages reproductibles (marchand, missions du jour)
  let a = crypto.createHash('sha256').update(String(str)).digest().readUInt32LE(0);
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rollRarity(min, rng, weights) {
  const pool = RARITIES.filter((r) => RANK[r.id] >= RANK[min || 'commune']);
  const total = pool.reduce((a, r) => a + (weights ? weights[r.id] || 0 : r.weight), 0);
  if (!(total > 0)) throw Error(`Aucune rareté disponible pour ${min}`);
  let x = (rng || rand)() * total;
  for (const r of pool) { x -= weights ? weights[r.id] || 0 : r.weight; if (x < 0) return r.id; }
  return pool[pool.length - 1].id;
}
function pickWeighted(g, rng) {
  const x = (rng || rand)() * g.total;
  let lo = 0, hi = g.cum.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (g.cum[mid] > x) hi = mid; else lo = mid + 1; }
  return g.cards[lo];
}
function pickFrom(serieId, rid) {
  let r = RANK[rid];
  const pools = BY_SERIE[serieId];
  while (r > 0 && !pools[RARITIES[r].id].length) r--;
  while (r < RARITIES.length - 1 && !pools[RARITIES[r].id].length) r++;
  const list = pools[RARITIES[r].id];
  return list[randInt(list.length)];
}

/* Seul le cadeau exceptionnel, limité à une ouverture par compte côté serveur,
   peut garantir une Secrète. La garantie de fidélité ne donne qu'une Légendaire. */
function drawPack(type, serie, pityHit) {
  if (type === 'secretgift') {
    const cards = Array.from({ length: 4 }, (_, i) => {
      const rid = rollRarity(i === 3 ? 'rare' : null, null, SECRET_GIFT_RATES);
      return pickWeighted(GLOBAL[rid]);
    });
    cards.push(pickWeighted(GLOBAL.secrete));
    return cards.sort((a, b) => RANK[a.rarity] - RANK[b.rarity]);
  }
  const def = PACKS[type];
  // Le booster LOL est une vraie édition dédiée : ses cinq cartes sont
  // exclusivement issues de League of Legends, Astral comprises.
  // La fidélité conserve sa garantie Légendaire exacte.
  if (type === 'special' && serie === 'lol-runeterra') {
    return def.slots.map((min, i) => {
      const rid = pityHit && i === def.slots.length - 1
        ? 'legendaire' : rollRarity(min, null, def.rates);
      return pickFrom(serie, rid);
    }).sort((a, b) => RANK[a.rarity] - RANK[b.rarity]);
  }
  const last = def.slots.length - 1;
  const cards = def.slots.map((min, i) => {
    const rid = pityHit && i === last ? 'legendaire' : rollRarity(min, null, def.rates);
    if (def.perSerie) return pickFrom(serie, rid);
    return pickWeighted(GLOBAL[rid]);
  });
  if (def.perSet && rand() < def.editionChance) {
    // Une seule carte du pack est remplacée par une carte de l'édition.
    // Le rang collector suit une table volontairement plus sévère.
    const rank = rollRarity('legendaire', null, def.editionRates);
    // Ne jamais écraser l'emplacement de la garantie.
    const slot = randInt(pityHit ? last : cards.length);
    cards[slot] = pickFrom(serie, rank);
  }
  return cards.sort((a, b) => RANK[a.rarity] - RANK[b.rarity]);
}
/* Pack TEST, indépendant de l'économie : exactement une carte de chaque rareté
   demandée, puis une Épique. Aucune attribution n'est effectuée ici. */
const TEST_RARITIES = Object.freeze(['epique', 'legendaire', 'mythique', 'secrete', 'primordiale', 'astral']);
function drawTestPack() {
  return TEST_RARITIES.map((rid) => {
    const pool = GLOBAL[rid];
    if (!pool || !pool.cards.length) throw Error(`Aucune carte pour le test ${rid}`);
    return pickWeighted(pool);
  });
}

/* Carte bonus d'édition spéciale : très faible chance, jamais garantie. */
function drawSpecialBonus() {
  if (!SPECIALS.length || rand() >= SETTINGS.specialBonus) return null;
  const set = SPECIALS[randInt(SPECIALS.length)];
  return pickFrom(set.id, rollRarity('legendaire', null, EDITION_RATES));
}

/* ---------- cartes cachées ---------- */
const isHidden = () => false;
function maskCard(c) { return c; }

/* ---------- dates (heure de Paris) ---------- */
function dayString(ms) { return new Date(ms).toLocaleDateString('sv-SE', { timeZone: SETTINGS.timeZone }); }
function msUntilMidnight(ms) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: SETTINGS.timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  const elapsed = (+parts.hour * 3600 + +parts.minute * 60 + +parts.second) * 1000 + (ms % 1000);
  return 86400000 - elapsed;
}

/* ---------- missions du jour ---------- */
const DAILY_FIXED = { id: 'daily', label: 'Ouvrir le pack quotidien', event: 'daily_open', target: 1, reward: { coins: 50 } };
const DAILY_POOL = [
  { id: 'open5',    label: 'Ouvrir 5 packs',                          event: 'pack_open',       target: 5,  reward: { coins: 150 } },
  { id: 'open15',   label: 'Ouvrir 15 packs',                         event: 'pack_open',       target: 15, reward: { coins: 200, packs: { standard: 1 } } },
  { id: 'free3',    label: 'Ouvrir 3 packs gratuits',                 event: 'free_open',       target: 3,  reward: { coins: 120 } },
  { id: 'destroy10',label: 'Détruire 10 doublons',                    event: 'destroy',         target: 10, reward: { coins: 120 } },
  { id: 'new3',     label: 'Obtenir 3 nouvelles cartes',              event: 'new_card',        target: 3,  reward: { coins: 150 } },
  { id: 'epic1',    label: 'Obtenir une carte Épique ou mieux',       event: 'pull_epique',     target: 1,  reward: { packs: { standard: 1 } } },
  { id: 'legend1',  label: 'Obtenir une carte Légendaire ou mieux',   event: 'pull_legendaire', target: 1,  reward: { coins: 300 } },
  { id: 'list1',    label: 'Mettre une carte en vente au Marché',     event: 'market_list',     target: 1,  reward: { coins: 80 } },
  { id: 'buy1',     label: 'Acheter une carte au Marché',             event: 'market_buy',      target: 1,  reward: { coins: 100 } },
  { id: 'trade1',   label: 'Proposer un échange à un joueur',         event: 'trade_send',      target: 1,  reward: { coins: 100 }, needsPlayers: true },
];
const DAILY_COUNT = 4;
const DAILY_BONUS_REWARD = { packs: { celeste: 1 } };
const DAILY_DEF = Object.fromEntries([DAILY_FIXED].concat(DAILY_POOL).map((m) => [m.id, m]));
function dailyMissionsFor(userId, day, playerCount) {
  const rng = seeded(`daily:${userId}:${day}`);
  const pool = DAILY_POOL.filter((m) => !m.needsPlayers || playerCount > 1).slice();
  const picked = [];
  while (picked.length < DAILY_COUNT && pool.length) picked.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  const opens = picked.filter((m) => m.event === 'pack_open');
  if (opens.length > 1) {
    const alt = pool.find((m) => m.event !== 'pack_open');
    if (alt) picked[picked.indexOf(opens[1])] = alt;
  }
  return [DAILY_FIXED].concat(picked);
}

/* ---------- succès ---------- */
const ACHIEVEMENTS = [
  { id: 'uniq10',   group: 'collection', label: 'Collectionner 10 cartes différentes',   stat: 'uniq', target: 10,   reward: { coins: 150 } },
  { id: 'uniq50',   group: 'collection', label: 'Collectionner 50 cartes différentes',   stat: 'uniq', target: 50,   reward: { packs: { standard: 3 } } },
  { id: 'uniq100',  group: 'collection', label: 'Collectionner 100 cartes différentes',  stat: 'uniq', target: 100,  reward: { packs: { celeste: 1 }, coins: 500 } },
  { id: 'uniq500',  group: 'collection', label: 'Collectionner 500 cartes différentes',  stat: 'uniq', target: 500,  reward: { packs: { celeste: 2 }, coins: 2000 } },
  { id: 'uniq1000', group: 'collection', label: 'Collectionner 1 000 cartes différentes', stat: 'uniq', target: 1000, reward: { packs: { celeste: 3, special: 1 }, coins: 5000 } },
  { id: 'uniq5000', group: 'collection', label: 'Collectionner 5 000 cartes différentes', stat: 'uniq', target: 5000, reward: { packs: { celeste: 10, special: 3 }, coins: 25000 } },
  { id: 'series1',  group: 'collection', label: 'Compléter une série entière',            stat: 'complete', target: 1,  reward: { packs: { special: 1 } } },
  { id: 'series10', group: 'collection', label: 'Compléter 10 séries entières',           stat: 'complete', target: 10, reward: { packs: { special: 3 }, coins: 5000 } },
  { id: 'own_legendaire',  group: 'collection', label: 'Obtenir une carte Légendaire',  stat: 'own_legendaire',  target: 1, reward: { coins: 200 } },
  { id: 'own_mythique',    group: 'collection', label: 'Obtenir une carte Mythique',    stat: 'own_mythique',    target: 1, reward: { packs: { celeste: 1 } } },
  { id: 'own_secrete',     group: 'collection', label: 'Obtenir une carte Secrète',     stat: 'own_secrete',     target: 1, reward: { coins: 2500 } },
  { id: 'own_primordiale', group: 'collection', label: 'Obtenir une carte Primordiale', stat: 'own_primordiale', target: 1, reward: { packs: { celeste: 3 }, coins: 5000 } },
  { id: 'own_special',     group: 'collection', label: 'Obtenir une carte d\'édition spéciale', stat: 'own_special', target: 1, reward: { coins: 500 } },
  { id: 'packs10',   group: 'activite', label: 'Ouvrir 10 packs',        stat: 'pack_open',   target: 10,   reward: { coins: 200 } },
  { id: 'packs100',  group: 'activite', label: 'Ouvrir 100 packs',       stat: 'pack_open',   target: 100,  reward: { packs: { celeste: 1 } } },
  { id: 'packs500',  group: 'activite', label: 'Ouvrir 500 packs',       stat: 'pack_open',   target: 500,  reward: { packs: { celeste: 3 } } },
  { id: 'packs1000', group: 'activite', label: 'Ouvrir 1 000 packs',     stat: 'pack_open',   target: 1000, reward: { packs: { celeste: 5, special: 2 }, coins: 5000 } },
  { id: 'destroy50', group: 'activite', label: 'Détruire 50 doublons',   stat: 'destroy',     target: 50,   reward: { coins: 300 } },
  { id: 'destroy500',group: 'activite', label: 'Détruire 500 doublons',  stat: 'destroy',     target: 500,  reward: { packs: { celeste: 1 } } },
  { id: 'sold1',     group: 'activite', label: 'Vendre une carte au Marché',   stat: 'market_sold', target: 1,  reward: { coins: 200 } },
  { id: 'sold10',    group: 'activite', label: 'Vendre 10 cartes au Marché',   stat: 'market_sold', target: 10, reward: { packs: { celeste: 1 } } },
  { id: 'trades1',   group: 'activite', label: 'Réussir un échange',           stat: 'trade_done',  target: 1,  reward: { coins: 300 } },
  { id: 'trades10',  group: 'activite', label: 'Réussir 10 échanges',          stat: 'trade_done',  target: 10, reward: { packs: { celeste: 2 } } },
];
const ACH = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
/* Missions de collection par série : 25 %, 50 %, 100 %. Identifiant : s_<serie>_<1|2|3> */
const SERIE_STEPS = [
  { k: 1, frac: 0.25, reward: { coins: 150 } },
  { k: 2, frac: 0.5, reward: { packs: { standard: 2 } } },
  { k: 3, frac: 1, reward: { packs: { celeste: 1 }, coins: 1000 } },
];
function serieStep(serieId, k) {
  const s = SERIE[serieId];
  const st = SERIE_STEPS.find((x) => x.k === k);
  if (!s || !st) return null;
  return { id: `s_${serieId}_${k}`, serie: serieId, k, target: Math.ceil(s.count * st.frac), reward: st.reward };
}

/* ---------- marchand (stock commun à tous, renouvelé toutes les heures) ---------- */
const MERCHANT_WEIGHTS = { rare: 34, epique: 36, legendaire: 22, mythique: 8 };
function merchantStock(now) {
  const period = SETTINGS.merchantHours * 3600000;
  const key = Math.floor(now / period);
  const rng = seeded(`merchant:${key}`);
  const ids = Object.keys(MERCHANT_WEIGHTS);
  const total = ids.reduce((a, k) => a + MERCHANT_WEIGHTS[k], 0);
  const used = new Set();
  const slots = [];
  for (let i = 0; i < SETTINGS.merchantSlots; i++) {
    let x = rng() * total, rid = ids[0];
    for (const k of ids) { x -= MERCHANT_WEIGHTS[k]; if (x < 0) { rid = k; break; } }
    let card = pickWeighted(GLOBAL[rid], rng);
    for (let t = 0; t < 5 && used.has(card.id); t++) card = pickWeighted(GLOBAL[rid], rng);
    used.add(card.id);
    slots.push({ slot: `${key}:${i}`, card: card.id, price: RAR[rid].merchant });
  }
  return { key, slots: slots.sort((a, b) => RANK[CARD[b.card].rarity] - RANK[CARD[a.card].rarity]), refreshIn: period - (now % period) };
}

function scoreOf(cardIds) {
  let score = 0;
  for (const id of cardIds) { const c = CARD[id]; if (c) score += RAR[c.rarity].score; }
  return score;
}
const TOTAL_BY_RARITY = {};
RARITIES.forEach((r) => { TOTAL_BY_RARITY[r.id] = 0; });
CARDS.forEach((c) => { TOTAL_BY_RARITY[c.rarity]++; });

/* Données envoyées au navigateur : règles + liste des séries (les cartes se chargent à la demande). */
function publicData() {
  return {
    settings: {
      freeInterval: SETTINGS.freeInterval, freeCap: SETTINGS.freeCap, pityLimit: SETTINGS.pityLimit,
      marketFee: SETTINGS.marketFee, streakBonus: SETTINGS.streakBonus, streakMax: SETTINGS.streakMax,
      merchantHours: SETTINGS.merchantHours, specialBonus: SETTINGS.specialBonus, starterPacks: SETTINGS.starterPacks,
      startCoins: SETTINGS.startCoins,
    },
    rarities: RARITIES,
    packs: PACKS,
    series: SERIES.map((s) => {
      const o = { id: s.id, code: s.code, name: s.name, kind: s.kind, color: s.color, cover: s.cover, banner: s.banner, pop: s.pop, count: s.count };
      if (s.title && s.title !== s.name) o.title = s.title;
      if (s.special) { o.special = true; o.theme = s.theme; o.desc = s.desc; }
      return o;
    }),
    totalCards: CARDS.length,
    totalByRarity: TOTAL_BY_RARITY,
    dailyBonus: DAILY_BONUS_REWARD,
    achievements: ACHIEVEMENTS,
    serieSteps: SERIE_STEPS,
    source: DATA.source,
  };
}

module.exports = {
  RARITIES, RANK, RAR, HIDDEN, SETTINGS, PACKS, EDITION_RATES, SERIES, SERIE, SPECIALS, REGULAR, CARDS, CARD, BY_SERIE,
  DAILY_DEF, DAILY_BONUS_REWARD, ACHIEVEMENTS, ACH, SERIE_STEPS, serieStep,
  drawPack, drawTestPack, drawSpecialBonus, isHidden, maskCard, dailyMissionsFor, merchantStock, scoreOf, dayString, msUntilMidnight, publicData,
};
