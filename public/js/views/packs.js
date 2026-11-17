/* Packs : gratuits, quotidien, réserve, achats en Coins, taux de drop */
import { S, esc, icon, coin, fmt, clock, emit, freeLive, dailyLive, collStats, plural } from '../core.js';
import { packHTML } from '../cards.js';
import { openFree, openDaily, openInventory, buyPack, openSecretGift, openTestUltimate, buyPacksBulk, openInventoryBulk, openFreeBulk } from '../opening.js';

/* Mêmes tables et règles que côté serveur : les pourcentages sont contrôlables. */
const pctTxt = (v) => `${Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 7 })} %`;
function slotRate(min, rid, pack) {
  const rank = S.rank;
  const pool = S.rarities.filter((r) => rank[r.id] >= rank[min || 'commune']);
  const rate = (r) => pack?.rates ? (pack.rates[r.id] || 0) : r.weight;
  const total = pool.reduce((sum, r) => sum + rate(r), 0);
  return rank[rid] >= rank[min || 'commune'] ? rate(S.rar[rid]) / total : 0;
}
const tail = (rid, rates) => S.rarities.filter((r) => S.rank[r.id] >= S.rank[rid])
  .reduce((sum, r) => sum + (rates[r.id] || 0), 0) / 100;
/* Chance d'avoir une rareté indiquée ou mieux sur les 5 slots,
   avec substitution d'une carte collector pour le pack Édition. */
function atLeastOne(pack, rid) {
  const fail = pack.slots.map((min) => 1 - S.rarities.filter((r) => S.rank[r.id] >= S.rank[rid])
    .reduce((sum, r) => sum + slotRate(min, r.id, pack), 0));
  const none = fail.reduce((a, b) => a * b, 1);
  if (!pack.editionChance) return (1 - none) * 100;
  const editionFails = 1 - tail(rid, pack.editionRates);
  const noneWhenEdition = fail.reduce((sum, _, j) =>
    sum + fail.reduce((pr, f, i) => i === j ? pr : pr * f, 1), 0) / fail.length * editionFails;
  return (1 - (1 - pack.editionChance) * none - pack.editionChance * noneWhenEdition) * 100;
}

export function render(ctx) {
  const me = S.me;
  const P = S.data.packs;
  const st = collStats(me.collection);
  ctx.el.innerHTML = `
  <header class="view-head">
    <div><h1>Les <span class="grad">Packs</span></h1>
    <p>5 cartes par pack, ou jusqu’à 10 packs ouverts d’un coup. Tout est gratuit : un pack toutes les ${Math.round(S.data.settings.freeInterval / 60000)} minutes, un pack chaque jour, et des packs supplémentaires avec les Coins gagnés en jouant.</p></div>
  </header>

  <h2 class="section-title">${icon('gift')} Packs offerts <small>Le Pack Test Ultime est une démo sans récompense</small></h2>
  <div class="pack-grid" data-free-grid></div>

  <div class="panel pity section" data-pity></div>

  <section class="section">
    <h2 class="section-title">${icon('coin')} Packs à acheter avec vos Coins <small>Les Coins se gagnent en jouant : missions, doublons détruits, ventes au Marché</small></h2>
    <div class="pack-grid">
      ${['standard', 'celeste', 'royal', 'special'].map((k) => `
        <div class="panel pack-tile">${packHTML(k)}<h3>${esc(P[k].name)}</h3><p>${esc(P[k].desc)}</p>
        <div class="pack-odds"><b>${pctTxt(atLeastOne(P[k], 'legendaire'))}</b><span>de Légendaire ou mieux par pack</span>
          ${P[k].editionChance ? `<em>${pctTxt(P[k].editionChance * 100)} de collector de l’édition</em>` : ''}</div>
        <div class="pack-actions-stack"><button class="btn btn-gold" type="button" data-buy="${k}">Ouvrir ×1 · ${coin()} ${fmt(P[k].price)}</button>
        <button class="btn btn-ghost btn-bulk" type="button" data-buy-ten="${k}" ${S.me.user.coins < P[k].price * 10 ? 'disabled' : ''}>${icon('layers')} Ouvrir ×10 · ${coin()} ${fmt(P[k].price * 10)}</button></div></div>`).join('')}
    </div>
  </section>

  <section class="section">
    <h2 class="section-title">${icon('sun')} Éditions spéciales en vedette <small>League of Legends à la une · Même prix que Summer Waifus</small></h2>
    <div class="special-editions">
      ${S.series.filter((s) => s.special).map((s) => {
        const b = st.byS[s.id];
        return `<div class="panel pack-tile pack-tile-special t-${esc(s.theme || 'legends')}" style="--sc:${esc(s.color)};${s.id==='lol-runeterra'?'border:2px solid #ddbaff;box-shadow:0 0 35px #995af966;background:linear-gradient(150deg,#29154a,#120c21);':''}">
          ${s.id==='lol-runeterra'?'<div style="padding:7px 11px;margin:0 auto 12px;width:max-content;border-radius:99px;background:linear-gradient(95deg,#f1cf85,#a875ef);color:#170a29;font-weight:900;letter-spacing:.13em;font-size:11px">✦ NOUVEAUTÉ · EN VEDETTE ✦</div>':''}
          ${packHTML('special', { serie: s.id })}
          <h3>${esc(s.name)}</h3>
          <p>${esc(s.desc || 'Édition collector à drop rare.')}</p>
          <div class="pack-odds"><b>${pctTxt(atLeastOne(P.special, 'legendaire'))}</b><span>de Légendaire ou mieux par pack</span><em>${b.owned}/${b.total} cartes collectionnées</em></div>
          <div class="pack-actions-stack">
            <button class="btn btn-gold" type="button" data-buy-special="${esc(s.id)}">Ouvrir ×1 · ${coin()} ${fmt(P.special.price)}</button>
            <button class="btn btn-ghost btn-bulk" type="button" data-buy-special-ten="${esc(s.id)}" ${S.me.user.coins < P.special.price * 10 ? 'disabled' : ''}>${icon('layers')} Ouvrir ×10 · ${coin()} ${fmt(P.special.price*10)}</button>
            <a class="btn btn-ghost" href="#/collection?serie=${esc(s.id)}">${icon('cards')}Voir les cartes</a>
          </div>
        </div>`;
      }).join('')}
    </div>
  </section>

  <section class="section">
    <h2 class="section-title">${icon('cards')} Packs série <small>${coin()} ${fmt(P.serie.price)} · ${esc(P.serie.desc)}</small></h2>
    <div class="search" style="margin:15px 0 20px">${icon('search')}<input class="input" type="search" data-series-search placeholder="Rechercher parmi ${fmt(S.series.length)} séries…" aria-label="Chercher une série"></div>
    <div class="serie-packs" data-series-packs></div>
    <p class="dim" data-series-more style="margin:12px 0 0;font-size:13px"></p>
  </section>

  <section class="section panel">
    <h2 class="section-title">${icon('spark')} Probabilités de tirage <small>Taux réels hors garantie de fidélité</small></h2>
    <div class="table-wrap"><table class="rates">
      <thead><tr><th>Rareté</th><th class="num">Par carte Standard</th><th class="num">Standard (5 cartes)</th><th class="num">Céleste (5 cartes)</th><th class="num">Royal (5 cartes)</th><th class="num">Édition (5 cartes)</th></tr></thead>
      <tbody>${S.rarities.map((r) => `<tr class="r-c-${r.id}"><td><span class="pill-r r-c-${r.id}"><i></i>${esc(r.label)}</span></td>
        <td class="num">${pctTxt(100 * slotRate(null, r.id))}</td>
        ${['standard','celeste','royal','special'].map((k) => `<td class="num">${pctTxt(atLeastOne(P[k], r.id))}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>
    <p class="dim" style="margin:14px 0 0;font-size:14px">Les taux « par pack » représentent la probabilité d’obtenir <b>au moins une carte du niveau indiqué ou supérieur</b>. Le Pack Édition remplace parfois une carte par une collector et la table en tient compte. Les cartes Secrètes et Primordiales restent exceptionnellement rares, même dans les packs Royal et Édition. Les probabilités sont calculées hors garantie de fidélité.</p>
    <p class="dim" style="margin:10px 0 0;font-size:14px">Fidélité : au ${S.data.settings.pityLimit}<sup>e</sup> pack consécutif sans Légendaire ou mieux, la 5<sup>e</sup> carte devient une <b>Légendaire</b> (jamais Secrète, Primordiale ni Astral). Aucun pack payant en Coins ne garantit de Légendaire.</p>
  </section>`;

  const freeGrid = ctx.el.querySelector('[data-free-grid]');
  let lastKey = '';
  const paint = () => {
    const f = freeLive();
    const d = dailyLive();
    const inv = S.me.inventory;
    const giftAvailable = !!S.me.gifts?.secretGiftAvailable;
    const key = [giftAvailable, f.banked, d.available, inv.standard || 0, inv.celeste || 0, inv.royal || 0, inv.special || 0].join('|');
    if (key !== lastKey) {
      lastKey = key;
      freeGrid.innerHTML = `
        <div class="panel pack-tile pack-test-tile is-ready">
          <span class="test-pack-label">PACK D'ESSAI · GRATUIT</span>
          ${packHTML('testultimate')}
          <h3>Pack Test Ultime</h3>
          <p>Exactement <b>1 Primordiale, 1 Secrète, 1 Mythique, 1 Légendaire, 1 Épique</b> et <b>1 Astral</b> pour tester les animations.</p>
          <div class="test-pack-demo-note">MODE DÉMO · Réouvrable à volonté · Aucune carte conservée</div>
          <button class="btn btn-gold" type="button" data-act="testultimate">${icon('spark')}Tester les 6 animations</button>
        </div>
        <div class="panel pack-tile secret-gift-tile ${giftAvailable ? 'is-ready' : 'is-claimed'}">
          <span class="secret-gift-label">ÉDITION CADEAU</span>
          ${packHTML('secretgift')}
          <h3>Pack Secret gratuit</h3>
          <p>5 cartes · <b>1 Secrète garantie à 100 %</b> · une seule fois par compte.</p>
          <button class="btn ${giftAvailable ? 'btn-primary' : 'btn-ghost'}" type="button" data-act="secretgift" ${giftAvailable ? '' : 'disabled'}>${icon('spark')}${giftAvailable ? 'Ouvrir gratuitement' : 'Déjà récupéré'}</button>
        </div>
        <div class="panel pack-tile ${f.banked ? 'is-ready' : ''}">
          <span class="qty ${f.banked ? '' : 'zero'}">×${f.banked}</span>${packHTML('free')}
          <h3>Pack gratuit</h3><p data-free-t></p>
          <button class="btn ${f.banked ? 'btn-primary' : ''}" type="button" data-act="free" ${f.banked ? '' : 'disabled'}>${icon('gift')}${f.banked ? 'Ouvrir ×1' : 'En préparation'}</button>
          ${f.banked >= 2 ? `<button class="btn btn-ghost btn-bulk" type="button" data-act="freeall">${icon('layers')} Ouvrir tout ×${f.banked}</button>` : ''}
        </div>
        <div class="panel pack-tile ${d.available ? 'is-ready' : ''}">
          <span class="qty ${d.available ? '' : 'zero'}">×${d.available ? 1 : 0}</span>${packHTML('quotidien')}
          <h3>Pack quotidien</h3><p data-daily-t></p>
          <button class="btn ${d.available ? 'btn-primary' : ''}" type="button" data-act="daily" ${d.available ? '' : 'disabled'}>${icon('sun')}${d.available ? 'Ouvrir' : 'Déjà ouvert'}</button>
        </div>
        ${['standard', 'celeste', 'royal', 'special'].map((k) => `
        <div class="panel pack-tile ${inv[k] ? 'is-ready' : ''}">
          <span class="qty ${inv[k] ? '' : 'zero'}">×${inv[k] || 0}</span>${packHTML(k)}
          <h3>${esc(P[k].name)}</h3><p>${inv[k] ? `Dans votre réserve (missions, cadeaux).` : 'Gagnez-en avec les missions.'}</p>
          <button class="btn ${inv[k] ? 'btn-primary' : ''}" type="button" data-act="inv" data-pack="${k}" ${inv[k] ? '' : 'disabled'}>${icon('pack')}${inv[k] ? 'Ouvrir ×1' : 'Aucun en réserve'}</button>
          ${inv[k] >= 2 ? `<button class="btn btn-ghost btn-bulk" type="button" data-act="invall" data-pack="${k}">${icon('layers')} ${inv[k] <= 10 ? `Ouvrir tout ×${inv[k]}` : `Ouvrir 10 d'un coup`}</button>` : ''}
        </div>`).join('')}`;
      freeGrid.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
        if (b.dataset.act === 'testultimate') openTestUltimate(b);
        else if (b.dataset.act === 'secretgift') openSecretGift(b);
        else if (b.dataset.act === 'free') openFree(b);
        else if (b.dataset.act === 'freeall') openFreeBulk(b, freeLive().banked);
        else if (b.dataset.act === 'daily') openDaily(b);
        else if (b.dataset.act === 'invall') openInventoryBulk(b.dataset.pack, b, null, Math.min(10, S.me.inventory[b.dataset.pack] || 0));
        else openInventory(b.dataset.pack, b);
      }));
    }
    const ft = freeGrid.querySelector('[data-free-t]');
    ft.textContent = f.banked >= f.cap ? `Réserve pleine (${f.cap}). Ouvrez-les pour relancer le minuteur !`
      : `${f.banked ? `${f.banked} ${plural(f.banked, 'prêt', 'prêts')}. ` : ''}Prochain dans ${clock(f.next)}.`;
    const dt = freeGrid.querySelector('[data-daily-t]');
    dt.textContent = d.available ? `Une Épique ou mieux garantie, + ${fmt(S.me.daily.nextBonus)} Coins de bonus.` : `Prochain dans ${clock(d.resetIn)}. Série : ${S.me.daily.streak} ${plural(S.me.daily.streak, 'jour', 'jours')}.`;

    const pity = ctx.el.querySelector('[data-pity]');
    const lim = S.data.settings.pityLimit;
    const left = Math.max(1, lim - S.me.pity);
    pity.innerHTML = `${icon('flame')}<div><b>Garantie Légendaire</b><div class="dim" style="font-size:14px;margin:2px 0 10px">${S.me.pity} ${plural(S.me.pity, 'pack ouvert', 'packs ouverts')} sans Légendaire ou mieux. Garantie dans ${left} ${plural(left, 'pack', 'packs')}.</div>
      <div class="bar"><i style="--p:${(S.me.pity / lim) * 100}%"></i></div></div><span class="pill-r r-c-legendaire"><i></i>${S.me.pity}/${lim}</span>`;
  };
  paint();
  ctx.on('tick', paint);
  ctx.on('me', () => { lastKey = ''; paint(); });
  ctx.on('opened', () => emit('rerender'));

  ctx.el.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => buyPack(b.dataset.buy, null, b)));
  ctx.el.querySelectorAll('[data-buy-ten]').forEach((b) => b.addEventListener('click', () => buyPacksBulk(b.dataset.buyTen, null, b)));
  ctx.el.querySelectorAll('[data-buy-special]').forEach((b) => b.addEventListener('click', () => buyPack('special', b.dataset.buySpecial, b)));
  ctx.el.querySelectorAll('[data-buy-special-ten]').forEach((b) => b.addEventListener('click', () => buyPacksBulk('special', b.dataset.buySpecialTen, b)));
  // Pas de 2 500 packs 3D dans le DOM : 30 affichés, recherche instantanée.
  const seriesInput = ctx.el.querySelector('[data-series-search]');
  const seriesBox = ctx.el.querySelector('[data-series-packs]');
  const more = ctx.el.querySelector('[data-series-more]');
  const regular = S.series.filter((s) => !s.special);
  let debounce = 0;
  function showSeries() {
    const q = seriesInput.value.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const filtered = regular.filter((s) => s.name.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q));
    seriesBox.innerHTML = filtered.slice(0, 30).map((s) => {
      const b = st.byS[s.id];
      return `<div class="serie-pack-wrap" style="--sc:${esc(s.color)}"><button class="serie-pack" type="button" data-serie="${esc(s.id)}">${packHTML('serie', { serie: s.id })}
        <b>${esc(s.name)}</b><small>${b.owned}/${b.total} cartes · ${coin()} ${fmt(P.serie.price)} · ×1</small></button>
        <button class="btn btn-ghost btn-bulk" type="button" data-serie-ten="${esc(s.id)}" ${S.me.user.coins < P.serie.price * 10 ? 'disabled' : ''}>${icon('layers')} ×10 · ${coin()} ${fmt(P.serie.price*10)}</button></div>`;
    }).join('');
    more.textContent = filtered.length > 30 ? `${fmt(filtered.length - 30)} autres séries : précisez votre recherche pour les trouver.` : `${fmt(filtered.length)} séries trouvées.`;
    seriesBox.querySelectorAll('[data-serie]').forEach((b) => b.addEventListener('click', () => buyPack('serie', b.dataset.serie, b)));
    seriesBox.querySelectorAll('[data-serie-ten]').forEach((b) => b.addEventListener('click', () => buyPacksBulk('serie', b.dataset.serieTen, b)));
  }
  seriesInput.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(showSeries, 120); });
  showSeries();
}
