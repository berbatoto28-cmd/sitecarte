/* =========================================================================
   AnimeConnection : rendu des cartes, dos de carte et packs + effet 3D
   ========================================================================= */
import { S, esc, icon, initials, cardImg, serieName } from './core.js';

const ROLE = { MAIN: 'Personnage principal', SUPPORTING: 'Personnage secondaire', BACKGROUND: 'Figurant' };
export const roleLabel = (r) => ROLE[r] || '';
export const THEMES = {
  summer: { label: 'Summer', icon: 'sun' },
  legends: { label: 'Legends', icon: 'flame' },
  villains: { label: 'Villains', icon: 'skull' },
};

function nameClass(name, full) {
  const n = name.length;
  if (full) return n > 15 ? 'is-xlong' : n > 10 ? 'is-long' : '';
  return n > 19 ? 'is-xlong' : n > 15 ? 'is-long' : '';
}

/**
 * Carte complète.
 * opts.missing  : carte non possédée (niveaux de gris)
 * opts.qty      : badge ×N si > 1
 * opts.isNew    : badge NOUVEAU
 * opts.static   : pas de clic / pas d'effet 3D
 * opts.eager    : chargement immédiat de l'image
 * Toutes les raretés utilisent une illustration pleine carte.
 */
export function cardHTML(id, opts) {
  opts = opts || {};
  const c = S.card[id];
  if (!c) return `<div class="card skeleton" data-card="${esc(id)}" aria-hidden="true"><div class="card-tilt"><div class="card-body"></div></div></div>`;
  if (c.rarity === 'astral') return astralHTML(c, opts);
  const r = S.rar[c.rarity];
  const s = S.serie[c.serie] || { name: '', color: '#8b5cf6' };
  const full = true;
  const cls = ['card', `r-${c.rarity}`];
  if (opts.missing) cls.push('is-unowned');
  if (full) cls.push('full');
  if (c.theme) cls.push(`t-${c.theme}`);

  if (!opts.static) cls.push('is-click');
  if (opts.cls) cls.push(opts.cls);
  const img = `<img src="${esc(cardImg(c))}" alt="" loading="${opts.eager ? 'eager' : 'lazy'}" decoding="async" draggable="false" referrerpolicy="no-referrer">`;
  const art = `<div class="c-art"><span class="c-fallback">${esc(initials(c.name))}</span>${img}</div>`;
  const nc = nameClass(c.name, full);
  const serieLabel = c.from ? `${s.name} · ${serieName(c.from)}` : s.name;
  const theme = c.theme && THEMES[c.theme] ? `<div class="c-theme">${icon(THEMES[c.theme].icon)}<span>${THEMES[c.theme].label}</span></div>` : '';
  let inner;
  if (full) {
    const isP = c.rarity === 'primordiale';
    const isS = c.rarity === 'secrete';
    // Identités graphiques exclusives : aucune couche Astral, Secrète et Primordiale n'est partagée.
    const eliteIdentity = isP
      ? '<div class="elite-primordial-sun" aria-hidden="true"></div><div class="elite-primordial-runes" aria-hidden="true"></div>'
      : isS
        ? '<div class="elite-secret-cipher" aria-hidden="true"></div><div class="elite-secret-sigil" aria-hidden="true"></div>'
        : '';
    inner = art +
      eliteIdentity +
      '<div class="c-holo"></div><div class="c-shade"></div><div class="c-themefx"></div><div class="c-inner"></div>' +
      `<div class="c-emblem">${icon(isP ? 'crown' : 'spark')}${esc(r.label)}</div>` + theme +
      `<div class="c-plate"><span class="c-name ${nc}">${esc(c.name)}</span>` +
        (c.native ? `<span class="c-native">${esc(c.native)}</span>` : '') +
        `<span class="c-line"><span class="c-serie">${esc(serieLabel)}</span><span class="c-num">${esc(c.num)}</span></span></div>` +
      '<div class="c-ring"></div><div class="c-sparkle"></div>' + (isP ? '<div class="c-shine"></div>' : '') + '<div class="c-glare"></div>';
  } else {
    inner = art +
      '<div class="c-holo"></div><div class="c-themefx"></div>' +
      
      '<div class="c-ring"></div>' + theme +
      `<div class="c-top"><span class="c-name ${nc}">${esc(c.name)}</span><span class="c-gem" title="${esc(r.label)}"></span></div>` +
      `<div class="c-ribbon">${esc(r.label)}</div>` +
      `<div class="c-bottom"><span class="c-serie">${esc(serieLabel)}</span><span class="c-num">${esc(c.num)}</span></div>` +
      (S.rank[c.rarity] >= S.rank.legendaire && !opts.missing ? '<div class="c-sparkle"></div>' : '') +
      '<div class="c-glare"></div>';
  }
  const label = `${c.name}, ${r.label}, ${s.name}${opts.missing ? ', non possédée' : ''}`;
  const attrs = opts.static ? 'aria-hidden="true"' : `tabindex="0" role="button" aria-label="${esc(label)}"`;
  return `<div class="${cls.join(' ')}" data-card="${esc(c.id)}" style="--sc:${esc(s.color)}" ${attrs}>` +
    (c.rarity === 'primordiale' && !opts.missing && !opts.noAura ? '<div class="c-aura"></div>' : '') +
    `<div class="card-tilt"><div class="card-body">${inner}</div></div>` +
    (opts.qty > 1 ? `<span class="c-qty">×${opts.qty}</span>` : '') +
    (opts.missing ? '<span class="c-new c-unowned">Non obtenue</span>' : opts.isNew ? '<span class="c-new">NEW</span>' : '') +
    '</div>';
}

function astralHTML(c, opts = {}) {
  const serie = S.serie[c.serie] || {name:'Univers',color:'#b7a0ff'};
  const classes = ['card','r-astral','t-astral','full'];
  if (opts.missing) classes.push('is-unowned');

  if (!opts.static) classes.push('is-click');
  if (opts.cls) classes.push(opts.cls);
  const img = esc(cardImg(c));
  // Le titre reste intégral, même pour les personnages aux noms très longs.
  const labelSize = c.name.length > 34 ? 3.45 : c.name.length > 27 ? 4.05 : c.name.length > 21 ? 4.75 : c.name.length > 15 ? 5.45 : 6.15;
  const label = `${c.name}, Astral, ${serie.name}`;
  const attrs = opts.static ? 'aria-hidden="true"' : `tabindex="0" role="button" aria-label="${esc(label)}"`;
  return `<div class="${classes.join(' ')}" data-card="${esc(c.id)}" style="--sc:${esc(serie.color)}" ${attrs}>
    ${!opts.noAura ? '<div class="c-aura astral-aura"></div>' : ''}
    <div class="card-tilt"><div class="card-body">
      <div class="astral-cosmos"></div>
      <div class="astral-backdrop"><img src="${img}" alt="" loading="${opts.eager?'eager':'lazy'}" decoding="async" referrerpolicy="no-referrer" draggable="false"></div>
      <div class="astral-sideband">
        <div class="astral-side-mark">ASTRAL</div>
        <div class="astral-vert-name" style="--astral-label:${labelSize}cqw"><span>${esc(c.name)}</span></div>
      </div>
      <div class="astral-orbit"></div>
      <div class="astral-figure"><img src="${img}" alt="" loading="${opts.eager?'eager':'lazy'}" decoding="async" referrerpolicy="no-referrer" draggable="false"></div>
      <div class="astral-ether"></div><div class="astral-stars"></div><div class="astral-flare"></div>
      <div class="astral-frame" aria-hidden="true"></div>
      <div class="astral-crown"><span>✦</span> ASTRAL <span>✦</span></div>
      <div class="astral-footer"><span>${esc(serie.name)}</span><b>${esc(c.num)}</b></div>
      <div class="astral-hologram"></div><div class="astral-border"></div><div class="c-glare"></div>
    </div></div>
    ${opts.qty > 1 ? `<span class="c-qty">×${opts.qty}</span>` : ''}${opts.missing ? '<span class="c-new c-unowned">Non obtenue</span>' : opts.isNew ? '<span class="c-new">NEW</span>' : ''}
  </div>`;
}

export function backHTML() {
  return '<div class="card-back"><div class="cb-frame"></div><div class="cb-circle"></div>' +
    '<svg class="cb-logo" aria-hidden="true"><use href="#i-logo"/></svg>' +
    '<div class="cb-word">ANIME<br>CONNECTION<b>TCG</b></div></div>';
}

/* ---------- packs (illustrés avec les affiches des séries) ---------- */
const PACK_LOOK = {
  testultimate: { p1: '#ffcd62', p2: '#7927d3', title: 'ULTIME', fan: [], badge: 'DÉMO' },
  secretgift: { p1: '#67e8f9', p2: '#5b21b6', title: 'SECRET', fan: [], badge: 'CADEAU' },
  standard:  { p1: '#6d28d9', p2: '#db2777', title: 'Standard',  fan: ['onepiece', 'naruto', 'dbz'] },
  free:      { p1: '#7c3aed', p2: '#c026d3', title: 'Gratuit',   fan: ['demonslayer', 'jjk', 'aot'], badge: 'FREE' },
  quotidien: { p1: '#0e7490', p2: '#7c3aed', title: 'Quotidien', fan: ['spyfamily', 'csm', 'frieren'] },
  royal:     { p1: '#7c3aed', p2: '#fbbf24', title: 'Royal', fan: ['dbz', 'onepiece', 'jjk'], badge: 'VIP' },
  celeste:   { p1: '#b45309', p2: '#6d28d9', title: 'Céleste',   fan: ['sololeveling', 'hxh', 'bleach'] },
};
export function packHTML(kind, opts) {
  opts = opts || {};
  let p1, p2, art, label, badge = '', extra = '';
  if (kind === 'serie') {
    const s = S.serie[opts.serie];
    p1 = s.color; p2 = s.color;
    art = s.cover ? `<img class="pa-bg" src="${esc(s.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '';
    const size = s.name.length <= 8 ? 13 : s.name.length <= 12 ? 10 : s.name.length <= 20 ? 7.6 : 6;
    label = `<b style="font-size:${size}cqw">${esc(s.name)}</b><span>Pack série</span>`;
  } else if (kind === 'special') {
    const s = S.serie[opts.serie] || { name: 'Édition spéciale', theme: 'legends', color: '#e11d48' };
    p1 = s.color; p2 = '#1e0a3c';
    extra = ` pack--theme t-${esc(s.theme || 'legends')}`;
    art = `<div class="pa-theme">${icon((THEMES[s.theme] || THEMES.legends).icon)}</div>`;
    const size = s.name.length <= 12 ? 10 : 7.8;
    label = `<b style="font-size:${size}cqw">${esc(s.name)}</b><span>Édition spéciale</span>`;
    badge = '<span class="pack-badge">COLLECTOR</span>';
  } else {
    const look = PACK_LOOK[kind] || PACK_LOOK.standard;
    p1 = look.p1; p2 = look.p2;
    art = kind === 'testultimate'
      ? `<div class="pa-test-sigil"><span class="test-gem gem-prime">${icon('crown')}</span><span class="test-gem gem-secret">${icon('spark')}</span><span class="test-gem gem-myth">${icon('spark')}</span><span class="test-gem gem-legend">${icon('spark')}</span><span class="test-gem gem-astral">✦</span></div>`
      : kind === 'secretgift' ? `<div class="pa-secret-sigil">${icon('spark')}<strong>100%</strong><span>SECRÈTE</span></div>` : look.fan.map((sid) => {
      const s = S.serie[sid];
      return s && s.cover ? `<div class="pa-fan"><img src="${esc(s.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer" draggable="false"></div>` : '';
    }).join('');
    label = kind === 'testultimate' ? '<b>ULTIME</b><span>PACK TEST</span>' : kind === 'secretgift' ? '<b>SECRET</b><span>PACK CADEAU</span>' : `<b>PACK</b><span>${esc(look.title)}</span>`;
    if (look.badge) badge = `<span class="pack-badge">${esc(look.badge)}</span>`;
  }
  return `<div class="pack pack--${kind === 'free' ? 'standard' : kind}${extra}" style="--p1:${esc(p1)};--p2:${esc(p2)}" aria-hidden="true"><div class="pack-inner">` +
    `<div class="pack-art">${art}</div><div class="pack-shade"></div>` +
    `<div class="pack-top">${icon('logo')}AnimeConnection</div>` +
    `<div class="pack-label">${label}</div><div class="pack-foot">${kind === 'testultimate' ? '6' : '5'} CARTES</div>` +
    '<div class="pack-crimp t"></div><div class="pack-crimp b"></div><div class="pack-foil"></div>' +
    `</div>${badge}</div>`;
}

/* ---------- effet 3D au survol (délégué, une seule écoute) ---------- */
export function initTilt() {
  let active = null, pending = null, raf = 0;
  const reset = (card) => {
    card.classList.remove('is-tilting');
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
    card.style.setProperty('--gl', '0');
  };
  const apply = () => {
    raf = 0;
    if (!pending) return;
    const { card, x, y } = pending;
    pending = null;
    const r = card.getBoundingClientRect();
    if (!r.width) return;
    const px = Math.min(1, Math.max(0, (x - r.left) / r.width));
    const py = Math.min(1, Math.max(0, (y - r.top) / r.height));
    const k = card.classList.contains('big') ? 18 : 12;
    card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
    card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
    card.style.setProperty('--rx', `${((0.5 - py) * k).toFixed(2)}deg`);
    card.style.setProperty('--ry', `${((px - 0.5) * k).toFixed(2)}deg`);
    card.style.setProperty('--gl', '1');
    card.classList.add('is-tilting');
  };
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest ? e.target.closest('.card.is-click, .card.big') : null;
    if (active && active !== card) reset(active);
    active = card;
    if (!card) return;
    pending = { card, x: e.clientX, y: e.clientY };
    if (!raf) raf = requestAnimationFrame(apply);
  }, { passive: true });
  document.addEventListener('pointerleave', () => { if (active) reset(active); active = null; });
  window.addEventListener('blur', () => { if (active) reset(active); active = null; });
  // Image indisponible : on affiche l'initiale du personnage
  document.addEventListener('error', (e) => {
    const t = e.target;
    if (t && t.tagName === 'IMG') {
      const card = t.closest('[data-card]');
      const c = card && S.card[card.dataset.card];
      // Une illustration locale indisponible revient au portrait du même personnage.
      if (c?.art && c.img && !t.dataset.fallbackTried && t.getAttribute('src') !== c.img) {
        t.dataset.fallbackTried = '1';
        t.src = c.img;
        return;
      }
      t.style.visibility = 'hidden';
    }
  }, true);
}
