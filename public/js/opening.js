/* =========================================================================
   AnimeConnection : ouverture de packs
   1. le pack flotte -> on le touche -> il se déchire
   2. 5 cartes face cachée (leur aura trahit les plus rares)
   3. on retourne chaque carte : effets selon la rareté,
      cinématique plein écran pour Légendaire, Mythique, Secrète et Primordiale
   ========================================================================= */
import { S, $, esc, icon, fmt, api, fail, freeLive, RGB, sleep, emit, toast, plural, openModal } from './core.js';
import { revealCharacter4K } from './reveal4k.js';
import { cardHTML, backHTML, packHTML } from './cards.js';

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let running = false;

/* ---------- les différentes façons d'ouvrir un pack ---------- */
export function openTestUltimate(btn) {
  return run(btn, () => api('/api/packs/test', {}), {
    kind: 'testultimate', title: 'Pack Test Ultime · Mode Démo', demo: true,
    again: () => ({ label: 'Relancer le test', fn: () => openTestUltimate() }),
  });
}

export function openSecretGift(btn) {
  return run(btn, () => api('/api/packs/open', { source: 'secretgift' }), {
    kind: 'secretgift', title: 'Pack Secret · Cadeau unique',
  });
}
export function openFree(btn) {
  return run(btn, () => api('/api/packs/open', { source: 'free' }), {
    kind: 'free', title: 'Pack gratuit',
    again: () => freeLive().banked > 0 && { label: 'Ouvrir le suivant', fn: () => openFree() },
  });
}
export function openDaily(btn) {
  return run(btn, () => api('/api/packs/open', { source: 'daily' }), {
    kind: 'quotidien', title: 'Pack quotidien',
    again: () => freeLive().banked > 0 && { label: 'Ouvrir un pack gratuit', fn: () => openFree() },
  });
}
/* Choix d'une édition spéciale (pour les packs « Édition spéciale ») */
export function chooseSpecial(title) {
  return new Promise((resolve) => {
    const sets = S.series.filter((s) => s.special);
    const m = openModal(`<h3>${esc(title || 'Quelle édition spéciale ?')}</h3><p>Édition collector : toute Légendaire ou supérieure est une carte spéciale exclusive de l’édition choisie, jamais une version normale. Bonus collector de 10 % ; aucune Légendaire garantie hors fidélité.</p>
      <div class="special-grid" style="grid-template-columns:1fr">${sets.map((s) => `<button class="stile special t-${esc(s.theme)}" type="button" data-set="${esc(s.id)}" style="--sc:${esc(s.color)}">
        <div class="pa-theme">${icon(s.theme === 'summer' ? 'sun' : s.theme === 'villains' ? 'skull' : 'flame')}</div>
        <div class="st-info"><b>${esc(s.name)}</b><p>${esc(s.desc || '')}</p></div></button>`).join('')}</div>`, { onClose: (v) => resolve(v || null) });
    m.el.querySelectorAll('[data-set]').forEach((b) => b.addEventListener('click', () => m.close(b.dataset.set)));
  });
}
export async function openInventory(pack, btn, serie) {
  if (S.data.packs[pack].perSet && !serie) { serie = await chooseSpecial(); if (!serie) return undefined; }
  return run(btn, () => api('/api/packs/open', { source: 'inventory', pack, serie }), {
    kind: pack, serie, title: serie ? `${S.data.packs[pack].name} · ${S.serie[serie].name}` : S.data.packs[pack].name,
    again: () => (S.me.inventory[pack] || 0) > 0 && { label: `Ouvrir le suivant (${S.me.inventory[pack]})`, fn: () => openInventory(pack, null, serie) },
  });
}
export async function buyPack(pack, serie, btn) {
  const def = S.data.packs[pack];
  if (def.perSet && !serie) { serie = await chooseSpecial('Choisissez une édition'); if (!serie) return; }
  return run(btn, () => api('/api/packs/buy', { pack, serie }), {
    kind: pack, serie, title: serie ? `${def.name} · ${S.serie[serie].name}` : def.name,
    again: () => S.me.user.coins >= def.price && { label: `Racheter (${fmt(def.price)} Coins)`, fn: () => buyPack(pack, serie), gold: true },
  });
}

async function run(btn, request, meta) {
  if (running) return;
  running = true;
  if (btn) { btn.classList.add('is-loading'); btn.disabled = true; }
  let data;
  try {
    data = await request();
  } catch (e) {
    running = false;
    if (btn) { btn.classList.remove('is-loading'); btn.disabled = false; }
    fail(e);
    return;
  }
  if (btn) { btn.classList.remove('is-loading'); btn.disabled = false; }
  try { await stage(data.result, meta); } finally { running = false; }
}

/* ---------- Ouverture simultanée : jusqu'à 10 boosters ---------- */
export async function buyPacksBulk(pack, serie, btn, count = 10) {
  const def = S.data.packs[pack];
  if (!def || !def.price) return;
  if (def.perSet && !serie) { serie = await chooseSpecial('Édition des 10 packs'); if (!serie) return; }
  return runMultiple(btn, () => api('/api/packs/bulk', { source: 'buy', pack, serie, count }), {
    kind: pack, serie, count, title: `${count} × ${def.name}`,
  });
}
export async function openInventoryBulk(pack, btn, serie, count = 10) {
  if (S.data.packs[pack].perSet && !serie) { serie = await chooseSpecial('Édition des packs en réserve'); if (!serie) return; }
  return runMultiple(btn, () => api('/api/packs/bulk', { source: 'inventory', pack, serie, count }), {
    kind: pack, serie, count, title: `${count} × ${S.data.packs[pack].name}`,
  });
}
export async function openFreeBulk(btn, count = 10) {
  const n = Math.min(count, freeLive().banked);
  if (n < 2) return openFree(btn);
  return runMultiple(btn, () => api('/api/packs/bulk', { source: 'free', count: n }), {
    kind: 'free', count: n, title: `${n} packs gratuits`,
  });
}
async function runMultiple(btn, request, meta) {
  if (running) return;
  running = true;
  if (btn) { btn.classList.add('is-loading'); btn.disabled = true; }
  try {
    const data = await request();
    if (btn) { btn.classList.remove('is-loading'); btn.disabled = false; }
    await bulkStage(data.results, meta);
  } catch (e) {
    if (btn) { btn.classList.remove('is-loading'); btn.disabled = false; }
    fail(e);
  } finally { running = false; }
}
function bulkStage(results, meta) {
  return new Promise((resolve) => {
    const stageEl = $('#stage');
    const all = results.flatMap((r) => r.cards);
    const best = all.reduce((v, c) => Math.max(v, S.rank[S.card[c.id].rarity]), 0);
    const bestCard = all.find((c) => S.rank[S.card[c.id].rarity] === best);
    stageEl.hidden = false;
    stageEl.className = 'stage stage-bulk';
    stageEl.style.setProperty('--glow', RGB[S.rarities[best].id]);
    document.body.style.overflow = 'hidden';
    let closed = false;
    let burst = false;
    let finished = false;
    let timer = null;
    const packArt = packHTML(meta.kind, {serie:meta.serie});
    stageEl.innerHTML = `<div class="stage-rays"></div>
      <div class="bulk-top"><div><h2>${esc(meta.title)}</h2><p>${results.length} boosters prêts · ${all.length} cartes à découvrir</p></div>
        <button class="btn btn-ghost" type="button" data-bulk-close>${icon('x')} Fermer</button></div>
      <div class="bulk-area" data-bulk-area>
        <div class="bulk-booster-wall" style="--bulk-cols:${Math.min(5,results.length)};--bulk-mobile-cols:${Math.min(3,results.length)};--bulk-max:${Math.min(1200,results.length <= 5 ? results.length * 278 : 1200)}px">${results.map((result, i) => `
          <div class="bulk-sealed" style="--i:${i};--pack-glow:${RGB[S.card[result.cards.reduce((a,b)=>S.rank[S.card[a.id].rarity]>S.rank[S.card[b.id].rarity]?a:b).id].rarity]}" aria-label="Booster numéro ${i+1}">
            <div class="bulk-pack-shell">
              <div class="bulk-pack-shock"></div>
              <div class="bulk-foil-top">${packArt}</div>
              <div class="bulk-foil-bottom">${packArt}</div>
              <div class="bulk-fan" data-fan="${i}"></div>
            </div><b>PACK ${String(i+1).padStart(2,'0')}</b>
          </div>`).join('')}</div>
      </div>
      <div class="bulk-bottom" data-bulk-bottom>
        <button class="btn btn-gold btn-lg" type="button" data-bulk-reveal>${icon('burst')} Ouvrir les ${results.length} boosters</button>
      </div>`;
    const area = stageEl.querySelector('[data-bulk-area]');
    const bottom = stageEl.querySelector('[data-bulk-bottom]');
    const clean = () => {
      if (closed) return;
      closed = true;
      if (timer) clearTimeout(timer);
      stageEl.dispatchEvent(new Event('stage:close'));
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      stageEl.classList.add('is-out');
      setTimeout(() => {
        stageEl.hidden = true; stageEl.innerHTML = ''; stageEl.className = 'stage';
        emit('opened', {bulk:true, results}); resolve();
      }, reduce ? 0 : 290);
    };
    const onKey = (e) => { if (e.key === 'Escape' && !stageEl.querySelector('.rv4k, .cine')) clean(); };
    const showResults = () => {
      if (closed || finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      stageEl.classList.remove('bulk-opening');
      stageEl.classList.add('bulk-opened');
      area.innerHTML = `<div class="bulk-result-grid">${results.map((result, i) => `
        <section class="bulk-result-pack"><h3>PACK ${String(i+1).padStart(2,'0')}<span>${result.cards.length} cartes</span></h3>
          <div class="bulk-mini-cards">${result.cards.map((entry) => {
            const c = S.card[entry.id];
            const rare = S.rank[c.rarity] >= S.rank.legendaire;
            return `<div class="bulk-mini-item">${cardHTML(entry.id, {static:true, eager:true, isNew:entry.isNew})}
              ${rare ? `<button class="bulk-watch" type="button" data-watch="${esc(c.id)}">${icon('spark')} Revoir le reveal ${esc(S.rar[c.rarity].label)}</button>` : ''}
            </div>`;
          }).join('')}</div></section>`).join('')}</div>`;
      bottom.innerHTML = `<div class="bulk-summary"><b>${all.length} cartes obtenues</b>
        <span>Meilleur tirage : <strong style="color:var(--r-${S.rarities[best].id})">${esc(S.rarities[best].label)}</strong></span></div>
        <button class="btn btn-gold" type="button" data-bulk-close2>${icon('check')} Terminer</button>`;
      bottom.querySelector('[data-bulk-close2]').addEventListener('click', clean);
      area.querySelectorAll('[data-watch]').forEach((b) => b.addEventListener('click', async () => {
        if (closed || stageEl.querySelector('.rv4k,.cine')) return;
        await characterReveal(b.dataset.watch);
        if (!closed) await cinematic(b.dataset.watch);
      }));
      if (bestCard && best >= S.rank.astral && !reduce) {
        timer = setTimeout(async () => {
          if (closed) return;
          await characterReveal(bestCard.id);
          if (!closed) await cinematic(bestCard.id);
        }, 500);
      }
    };
    const showAll = () => {
      if (closed || burst) return;
      burst = true;
      // Chaque vrai booster s'ouvre : les deux parties se séparent,
      // les cinq cartes sortent face cachée, puis se retournent.
      results.forEach((result, i) => {
        const fan = stageEl.querySelector(`[data-fan="${i}"]`);
        if (!fan) return;
        fan.innerHTML = result.cards.map((entry, n) => `<div class="bulk-fan-card${S.rank[S.card[entry.id].rarity] >= S.rank.legendaire ? ' is-holo' : ''}" style="--slot:${n-2};--n:${n};--i:${i}">
          <div class="bulk-fan-inner">
            <div class="bulk-fan-face bulk-fan-back">${backHTML()}</div>
            <div class="bulk-fan-face bulk-fan-front">${cardHTML(entry.id, {static:true,eager:true})}</div>
          </div></div>`).join('');
      });
      stageEl.classList.add('bulk-opening');
      bottom.innerHTML = `<span class="bulk-opening-label">${icon('spark')} Les boosters s'ouvrent…</span>
        <button class="btn btn-ghost btn-sm" type="button" data-bulk-skip>Voir directement les ${all.length} cartes</button>`;
      bottom.querySelector('[data-bulk-skip]').addEventListener('click', showResults);
      timer = setTimeout(showResults, reduce ? 450 : 3350 + Math.min(10,results.length)*100);
    };
    document.addEventListener('keydown', onKey);
    stageEl.querySelector('[data-bulk-close]').addEventListener('click', clean);
    stageEl.querySelector('[data-bulk-reveal]').addEventListener('click', showAll);
  });
}

/* ---------- la scène ---------- */
function stage(result, meta) {
  return new Promise((done) => {
    const el = $('#stage');
    const best = result.cards.reduce((m, c) => Math.max(m, S.rank[S.card[c.id].rarity]), 0);
    const stageSerie = meta.serie && S.serie[meta.serie] ? S.serie[meta.serie] : null;
    const stageTheme = stageSerie?.theme || '';
    el.hidden = false;
    el.className = `stage${stageTheme ? ' theme-' + stageTheme : ''}`;
    el.dataset.best = S.rarities[best].id;
    el.dataset.demo = meta.demo ? 'true' : 'false';
    el.style.setProperty('--glow', stageTheme === 'summer' ? '56, 189, 248' : '168, 85, 247');
    el.innerHTML = `
      <div class="stage-rays"></div>
      <div class="stage-energy"></div>
      <div class="stage-vibe"></div>
      <button class="btn btn-ghost btn-icon stage-close" type="button" data-close aria-label="Fermer">${icon('x')}</button>
      <div class="stage-hud"><h2>${esc(meta.title)}</h2>${meta.demo ? '<div class="demo-warning">MODE DÉMO · Cartes non conservées · Aucun Coin dépensé</div>' : ''}<p data-hint>Touchez le pack pour l'ouvrir</p></div>
      <div class="stage-center" data-center>
        <div class="tear" role="button" tabindex="0" aria-label="Ouvrir le pack">
          <div class="tear-float">
            <div class="tear-part top">${packHTML(meta.kind, { serie: meta.serie })}</div>
            <div class="tear-part bottom">${packHTML(meta.kind, { serie: meta.serie })}</div>
          </div>
          <span class="tear-hint">${icon('spark')} Ouvrir</span>
        </div>
      </div>
      <div class="stage-foot" data-foot></div>`;
    document.body.style.overflow = 'hidden';
    const center = el.querySelector('[data-center]');
    const foot = el.querySelector('[data-foot]');
    const hint = el.querySelector('[data-hint]');
    const tear = el.querySelector('.tear');
    let revealed = 0;
    let closed = false;
    let cine = Promise.resolve();

    const close = () => {
      if (closed) return;
      closed = true;
      el.dispatchEvent(new Event('stage:close'));
      document.removeEventListener('keydown', onKey);
      if (meta.demo) for (const entry of result.cards) {
        if (!S.me?.collection?.[entry.id]) delete S.card[entry.id];
      }
      el.classList.add('is-out');
      document.body.style.overflow = '';
      setTimeout(() => { el.hidden = true; el.innerHTML = ''; el.className = 'stage'; emit('opened', result); done(); }, 340);
    };
    const onKey = (e) => {
      if (document.querySelector('.modal')) return;
      if (e.key === 'Escape') close();
      if ((e.key === 'Enter' || e.key === ' ') && tear.isConnected) { e.preventDefault(); openIt(); }
    };
    document.addEventListener('keydown', onKey);
    el.querySelector('[data-close]').addEventListener('click', close);

    let opening = false;
    const openIt = async () => {
      if (opening) return;
      opening = true;
      hint.textContent = '';
      if (best >= S.rank.legendaire) await hypeIntro(el, best, hint);
      tear.classList.add('is-shaking');
      if (best >= S.rank.legendaire) el.style.setProperty('--glow', RGB[S.rarities[best].id]);
      await sleep(reduce ? 0 : (best >= S.rank.mythique ? 620 : 520));
      tear.classList.remove('is-shaking');
      tear.classList.add('is-torn');
      flash(window.innerWidth / 2, window.innerHeight / 2, best >= S.rank.legendaire ? RGB[S.rarities[best].id] : '255,255,255');
      if (best >= S.rank.legendaire && !reduce) {
        pulseImpact(el, best >= S.rank.secrete ? 3 : best >= S.rank.mythique ? 2 : 1);
        sparks(window.innerWidth / 2, window.innerHeight / 2, RGB[S.rarities[best].id], 28 + best * 8, Math.max(innerWidth, innerHeight) * .38);
      }
      await sleep(reduce ? 0 : (best >= S.rank.secrete ? 900 : 650));
      deal();
    };
    tear.addEventListener('click', openIt);

    const deal = () => {
      center.innerHTML = `<div class="deal">${result.cards.map((c, i) => {
        const rid = S.card[c.id].rarity;
        const hintCls = S.rank[rid] >= S.rank.epique ? ` hint-${rid}` : '';
        return `<div class="flip${hintCls}${c.isNew ? ' is-new' : ''}" style="--i:${i}" data-i="${i}" role="button" tabindex="0" aria-label="Retourner la carte ${i + 1}">${c.bonus ? '<span class="bonus-tag">Bonus édition spéciale</span>' : ''}
          <div class="flip-inner"><div class="flip-face flip-back">${backHTML()}</div>
          <div class="flip-face flip-front">${cardHTML(c.id, { eager: true, static: true, noAura: true })}</div></div></div>`;
      }).join('')}</div>`;
      hint.textContent = meta.demo ? 'Démo : révélez les 6 raretés, dont Astral · Aucun gain en collection' : 'Retournez vos cartes';
      renderFoot();
      center.querySelectorAll('.flip').forEach((f) => {
        const go = () => (f.classList.contains('is-flipped') ? zoom(f) : flipCard(f));
        f.addEventListener('click', go);
        f.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      });
    };

    const flipCard = (f) => {
      if (f.classList.contains('is-flipped')) return Promise.resolve();
      const c = result.cards[+f.dataset.i];
      const rid = S.card[c.id].rarity;
      f.classList.add('is-flipped', 'just-flipped');
      revealed++;
      const p = (async () => {
        await sleep(reduce ? 0 : 380);
        revealFX(el, f, rid);
        // Dès Légendaire : reveal personnage plein écran puis cinématique de rareté.
        if (S.rank[rid] >= S.rank.legendaire && !closed) {
          cine = cine.then(async () => {
            await characterReveal(c.id);
            if (!closed) await cinematic(c.id);
          });
          await cine;
        }
        if (revealed === result.cards.length) finish();
        else renderFoot();
      })();
      return p;
    };

    const zoom = (f) => {
      const c = result.cards[+f.dataset.i];
      import('./cardview.js').then((m) => m.openCardView(c.id));
    };

    const revealAll = async () => {
      const flips = Array.from(center.querySelectorAll('.flip:not(.is-flipped)'));
      for (const f of flips) {
        if (closed) return;
        await flipCard(f);
      }
    };

    function renderFoot() {
      if (revealed < result.cards.length) {
        foot.innerHTML = `<button class="btn btn-primary btn-lg" type="button" data-all>${icon('spark')}Tout révéler</button>`;
        foot.querySelector('[data-all]').addEventListener('click', revealAll);
      }
    }

    function finish() {
      const news = result.cards.filter((c) => c.isNew).length;
      const top = S.rarities[best];
      hint.innerHTML = `${news ? `<b class="grad">${news} ${plural(news, 'nouvelle carte', 'nouvelles cartes')}</b> · ` : ''}Meilleure carte : <b style="color:var(--r-${top.id})">${esc(top.label)}</b>` +
        (result.bonus ? ` · Série de ${result.streak} ${plural(result.streak, 'jour', 'jours')} : <b>+${fmt(result.bonus)} Coins</b>` : '') +
        (result.pity ? ' · <b>Garantie Légendaire activée</b>' : '');
      if (meta.demo) hint.innerHTML += ' · <b>MODE DÉMO — aucune carte ajoutée</b>';
      const again = meta.again && meta.again();
      foot.innerHTML =
        (again ? `<button class="btn ${again.gold ? 'btn-gold' : 'btn-primary'} btn-lg" type="button" data-again>${icon('pack')}${esc(again.label)}</button>` : '') +
        `<a class="btn btn-lg" href="#/collection" data-coll>${icon('cards')}Voir ma collection</a>` +
        `<button class="btn btn-ghost btn-lg" type="button" data-close2>Fermer</button>`;
      if (again) foot.querySelector('[data-again]').addEventListener('click', () => { close(); setTimeout(() => again.fn(), 380); });
      foot.querySelector('[data-coll]').addEventListener('click', close);
      foot.querySelector('[data-close2]').addEventListener('click', close);
    }
  });
}

/* ---------- effets ---------- */
function revealFX(stageEl, f, rid) {
  const rank = S.rank[rid];
  const color = RGB[rid];
  const r = f.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  if (rank >= S.rank.epique) sparks(x, y, color, 10 + rank * 8, 120 + rank * 40);
  if (rank >= S.rank.legendaire) {
    flash(x, y, color);
    stageEl.style.setProperty('--glow', color);
    pulseImpact(stageEl, rank >= S.rank.secrete ? 3 : rank >= S.rank.mythique ? 2 : 1);
    if (!reduce) {
      const bursts = rank >= S.rank.primordiale ? [0, 120, 260, 420] : rank >= S.rank.secrete ? [0, 180, 360] : rank >= S.rank.mythique ? [0, 220] : [0];
      bursts.forEach((d, i) => setTimeout(() => sparks(x, y, color, 18 + rank * 10 + i * 4, 170 + rank * 55), d));
    }
  }
  if (rank >= S.rank.mythique && !reduce) {
    stageEl.classList.remove('shake');
    void stageEl.offsetWidth;
    stageEl.classList.add('shake');
  }
  setTimeout(() => f.classList.remove('just-flipped'), 900);
}


function pulseImpact(host, level = 1) {
  host.classList.remove('impact-1', 'impact-2', 'impact-3');
  void host.offsetWidth;
  host.classList.add(`impact-${level}`);
}

async function hypeIntro(stageEl, best, hintEl) {
  if (reduce) return;
  const rid = S.rarities[best].id;
  const color = RGB[rid];
  stageEl.style.setProperty('--glow', color);
  stageEl.classList.add('is-hype');
  hintEl.innerHTML = best >= S.rank.secrete
    ? '<b class="grad">Anomalie détectée…</b>'
    : best >= S.rank.mythique
      ? '<b class="grad">Puissance exceptionnelle…</b>'
      : '<b class="grad">Énergie légendaire…</b>';
  flash(innerWidth / 2, innerHeight / 2, color);
  sparks(innerWidth / 2, innerHeight / 2, color, 16 + best * 6, Math.max(innerWidth, innerHeight) * .2);
  await sleep(best >= S.rank.secrete ? 520 : 340);
  pulseImpact(stageEl, best >= S.rank.secrete ? 3 : best >= S.rank.mythique ? 2 : 1);
  if (best >= S.rank.mythique) {
    await sleep(160);
    flash(innerWidth / 2, innerHeight / 2, color);
  }
}

function flash(x, y, rgb) {
  if (reduce) return;
  const d = document.createElement('div');
  d.className = 'flash';
  d.style.setProperty('--fx', `${x}px`);
  d.style.setProperty('--fy', `${y}px`);
  d.style.setProperty('--fc', rgb);
  ($('#stage').hidden ? document.body : $('#stage')).appendChild(d);
  setTimeout(() => d.remove(), 950);
}

export function sparks(x, y, rgb, n, spread) {
  if (reduce) return;
  const host = $('#stage').hidden ? document.body : $('#stage');
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    const a = Math.random() * Math.PI * 2;
    const dist = (0.35 + Math.random() * 0.65) * (spread || 200);
    s.className = 'spark';
    s.style.setProperty('--x', `${x}px`);
    s.style.setProperty('--y', `${y}px`);
    s.style.setProperty('--dx', `${Math.cos(a) * dist}px`);
    s.style.setProperty('--dy', `${Math.sin(a) * dist}px`);
    s.style.setProperty('--s', `${3 + Math.random() * 5}px`);
    s.style.setProperty('--d', `${700 + Math.random() * 700}ms`);
    s.style.setProperty('--c', Math.random() < 0.3 ? '255,255,255' : rgb);
    host.appendChild(s);
    setTimeout(() => s.remove(), 1500);
  }
}


export const characterReveal = revealCharacter4K;

export function cinematic(id) {
  return new Promise((resolve) => {
    const c = S.card[id];
    if (!c) { resolve(); return; }
    const r = S.rar[c.rarity];
    const s = S.serie[c.serie];
    const host = $('#stage');
    if (host.hidden) { resolve(); return; }
    const el = document.createElement('div');
    const isLegend = c.rarity === 'legendaire';
    const isMyth = c.rarity === 'mythique';
    const isSecret = c.rarity === 'secrete';
    const isPrime = c.rarity === 'primordiale';
    const isAstral = c.rarity === 'astral';
    el.className = `cine c-${c.rarity}${c.theme ? ' theme-' + c.theme : ''}`;
    el.style.setProperty('--cc', c.theme === 'summer' ? '56, 189, 248' : RGB[c.rarity]);
    const heading = isAstral ? 'UNE ÉTOILE EST NÉE' : c.theme === 'summer'
      ? (isPrime ? 'Summer Waifu ultime' : isSecret ? 'Summer Waifu secrète' : isMyth ? 'Summer Waifu mythique' : 'Summer Waifu légendaire')
      : (isPrime ? 'DROP ABSOLU' : isSecret ? 'DROP SECRET' : isMyth ? 'DROP MYTHIQUE' : 'DROP LÉGENDAIRE');
    const subline = isAstral ? 'Le personnage le plus apprécié de son univers — Astral' : isPrime ? "Le plus haut palier vient d'apparaître" : isSecret ? 'Une carte extrêmement rare vient de tomber' : isMyth ? 'Prépare-toi, ce tirage est exceptionnel' : 'Une grosse carte vient de tomber';
    el.innerHTML = `<div class="cine-vignette"></div><div class="cine-rays"></div><div class="cine-portal"></div><div class="cine-shock"></div>
      <div class="cine-orbit o1"></div><div class="cine-orbit o2"></div>
      <div class="cine-badge">${esc(r.label)}</div>
      <h3 class="cine-title"><small>${heading}</small><span>${esc(r.label)}</span></h3>
      <p class="cine-sub">${subline}</p>
      <div class="cine-card">${cardHTML(id, { eager: true, cls: 'big' })}</div>
      <div class="cine-name">${esc(c.name || 'Carte mystère')}<small>${esc(s.name)}${c.theme === 'summer' ? ' · Summer Waifu' : ''}</small></div>
      <div class="cine-tap">Cliquer pour continuer · Échap pour passer</div>`;
    host.appendChild(el);
    const w = innerWidth, h = innerHeight;
    const cineColor = c.theme === 'summer' ? '56, 189, 248' : RGB[c.rarity];
    const power = isAstral ? 145 : isPrime ? 120 : isSecret ? 84 : isMyth ? 56 : 34;
    const bursts = reduce ? [] : isAstral ? [0, 180, 420, 760, 1100, 1560, 1940, 2300] : isLegend ? [120, 520, 980] : isMyth ? [80, 360, 780, 1320] : isSecret ? [40, 260, 520, 900, 1380, 1780] : [0, 240, 480, 760, 1120, 1580, 1980];
    const timers = bursts.map((delay, idx) => setTimeout(() => sparks(w / 2, h / 2, cineColor, power + idx * 4, Math.max(w,h) * (isPrime ? .72 : isSecret ? .58 : .46)), delay));
    if (!reduce) {
      flash(w / 2, h / 2, cineColor);
      if (isMyth || isSecret || isPrime) timers.push(setTimeout(() => flash(w / 2, h / 2, cineColor), 240));
      if (isSecret || isPrime) timers.push(setTimeout(() => flash(w / 2, h / 2, cineColor), 760));
    }
    if ((isMyth || isSecret || isPrime || isAstral) && !reduce) {
      const shakes = isAstral ? [180, 760, 1520] : isPrime ? [240, 780, 1400] : isSecret ? [300, 920] : [460];
      shakes.forEach((delay) => timers.push(setTimeout(() => { host.classList.remove('shake'); void host.offsetWidth; host.classList.add('shake'); }, delay)));
    }
    let finished = false;
    const clear = () => {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      host.removeEventListener('stage:close', clear);
      document.removeEventListener('keydown', onKey);
      if (reduce) { el.remove(); resolve(); return; }
      el.classList.add('is-out');
      setTimeout(() => { el.remove(); resolve(); }, 330);
    };
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); clear(); }
    };
    host.addEventListener('stage:close', clear, { once: true });
    document.addEventListener('keydown', onKey, true);
    el.addEventListener('click', clear);
    if (isAstral) toast('CARTE ASTRAL !', `${c.name} — une découverte cosmique.`, 'gold', 'spark');
    else if (isPrime) toast('Carte Primordiale !', `${c.name} rejoint votre collection.`, 'gold', 'crown');
    else if (isSecret) toast('Carte Secrète !', `${c.name} rejoint votre collection.`, 'primary', 'spark');
    else if (isMyth) toast('Carte Mythique !', `${c.name} rejoint votre collection.`, 'primary', 'spark');
    else if (isLegend) toast('Carte Légendaire !', `${c.name} rejoint votre collection.`, 'primary', 'spark');
  });
}
