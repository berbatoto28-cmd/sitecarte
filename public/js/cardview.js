/* =========================================================================
   AnimeConnection : fiche détaillée d'une carte (zoom 3D + actions)
   ========================================================================= */
import { S, esc, icon, coin, fmt, api, fail, toast, openModal, confirmBox, busy, SUGGEST, plural, ensureCards, serieName } from './core.js';
import { cardHTML, roleLabel } from './cards.js';

export async function openCardView(id) {
  if (!S.card[id]) { try { await ensureCards([id]); } catch (e) { fail(e); return; } }
  if (!S.card[id]) return;
  const m = openModal('<div class="cardview" data-cv></div>', { raw: true });
  const root = m.el.querySelector('[data-cv]');
  if (S.me && S.me.fresh.includes(id)) {
    api('/api/collection/seen', { cards: [id] }).catch(() => {});
    S.me.fresh = S.me.fresh.filter((x) => x !== id);
  }
  const close = () => m.close();
  const draw = () => {
    const c = S.card[id];
    const r = S.rar[c.rarity];
    const s = S.serie[c.serie] || { name: '', count: 0 };
    const qty = (S.me && S.me.collection[id]) || 0;
    const ownedInSerie = (S.me && S.me.stats && S.me.stats.bySerie[c.serie]) || 0;
    const rate = `${String(r.weight).replace('.', ',')} %`;
    const serieLine = `<div class="cv-serie">${s.cover ? `<img src="${esc(s.cover)}" alt="" referrerpolicy="no-referrer">` : ''}<div><b>${esc(s.name)}</b><small>${s.special ? 'Édition spéciale' : esc(s.title || s.name)}${S.me ? ` · ${ownedInSerie}/${s.count} ${plural(ownedInSerie, 'carte possédée', 'cartes possédées')}` : ''}</small></div></div>`;

    const dupes = Math.max(0, qty - 1);
    let actions;
    if (!S.me) {
      actions = '';
    } else if (!qty) {
      actions = `<p class="cv-note">Vous n'avez pas encore cette carte. Elle peut sortir d'un pack (${esc(r.label)} : ${rate} par carte), s'acheter au Marché ou s'obtenir par échange.</p>
        <div class="row"><a class="btn btn-primary" href="#/packs${s.special ? '' : '?serie=' + encodeURIComponent(c.serie)}" data-go>${icon('pack')}Ouvrir des packs</a><a class="btn" href="#/marche?card=${encodeURIComponent(id)}" data-go>${icon('market')}Chercher au Marché</a></div>`;
    } else {
      actions = `
        ${dupes ? `<div class="row">
          <button class="btn btn-danger" type="button" data-destroy="1">${icon('trash')}Détruire 1 doublon <span class="dim">+${fmt(r.value)}</span></button>
          ${dupes > 1 ? `<button class="btn btn-danger" type="button" data-destroy="${dupes}">Les ${dupes} doublons <span class="dim">+${fmt(r.value * dupes)}</span></button>` : ''}
        </div>` : `<p class="cv-note">${icon('lock')} Vous n'avez qu'un exemplaire : on ne peut détruire que les doublons.</p>`}
        <div class="field"><label for="cv-price">Vendre au Marché (les autres joueurs l'achètent en Coins)</label>
          <div class="cv-sell"><div class="input-coin">${coin()}<input class="input" id="cv-price" type="number" min="1" max="9999999" step="1" value="${SUGGEST[c.rarity]}"></div>
          <button class="btn btn-gold" type="button" data-sell>${icon('tag')}Mettre en vente</button></div></div>
        <p class="cv-note" data-net></p>
        <div class="row">
          <button class="btn" type="button" data-avatar ${S.me.user.avatar === id ? 'disabled' : ''}>${icon('user')}${S.me.user.avatar === id ? 'Votre avatar' : 'Choisir comme avatar'}</button>
          <a class="btn" href="#/echanges?give=${encodeURIComponent(id)}" data-go>${icon('swap')}Proposer en échange</a>
        </div>`;
    }
    root.innerHTML = `
      <button class="modal-close" type="button" aria-label="Fermer">${icon('x')}</button>
      <div class="cv-stage" style="--c:var(--r-${c.rarity})">${cardHTML(id, { missing: !qty && !!S.me, eager: true, cls: 'big', qty })}</div>
      <div class="cv-info">
        <div class="row"><span class="pill-r r-c-${c.rarity}"><i></i>${esc(r.label)}</span><span class="badge">${esc(c.num)}</span>${r.fullArt ? '<span class="badge">Full Art</span>' : ''}${c.theme ? `<span class="badge">${esc(s.name)}</span>` : ''}</div>
        <div><h2>${esc(c.name)}</h2><div class="cv-native">${esc(c.native || '')}${c.role ? `${c.native ? ' · ' : ''}${esc(roleLabel(c.role))}` : ''}${c.from ? ` · ${esc(serieName(c.from))}` : ''}</div></div>
        ${serieLine}
        <div class="cv-facts">
          <div><span>Exemplaires</span><b>${qty}</b></div>
          <div><span>Popularité</span><b>${icon('heart')}${fmt(c.fav)}</b></div>
          <div><span>Destruction</span><b>${coin()}${fmt(r.value)}</b></div>
          <div><span>Taux par carte</span><b>${rate}</b></div>
        </div>
        <div class="cv-actions">${actions}</div>
      </div>`;
    root.querySelector('.modal-close').addEventListener('click', close);
    root.querySelectorAll('[data-go]').forEach((a) => a.addEventListener('click', () => { close(); document.querySelector('#stage [data-close]')?.click(); }));
    const price = root.querySelector('#cv-price');
    const net = root.querySelector('[data-net]');
    if (price) {
      const upd = () => {
        const p = Math.max(0, parseInt(price.value, 10) || 0);
        const fee = Math.floor(p * S.data.settings.marketFee);
        net.textContent = `Vous recevrez ${fmt(p - fee)} Coins à la vente (taxe du Marché : ${Math.round(S.data.settings.marketFee * 100)} %).`;
      };
      price.addEventListener('input', upd);
      upd();
    }
    root.querySelectorAll('[data-destroy]').forEach((b) => b.addEventListener('click', async () => {
      const n = +b.dataset.destroy;
      const ok = await confirmBox({ title: `Détruire ${n} ${plural(n, 'doublon', 'doublons')} ?`, text: `${esc(c.name)} ×${n} contre <b>${fmt(n * r.value)} Coins</b>. Un exemplaire reste dans votre collection.`, ok: 'Détruire', danger: true });
      if (!ok) return;
      busy(b, async () => {
        try { const d = await api('/api/cards/destroy', { card: id, qty: n }); toast('Doublons détruits', `+${fmt(d.gain)} Coins`, 'gold', 'coin'); draw(); } catch (e) { fail(e); }
      });
    }));
    const sell = root.querySelector('[data-sell]');
    if (sell) sell.addEventListener('click', async () => {
      const p = parseInt(price.value, 10);
      if (!(p >= 1)) { toast('Prix invalide', 'Indiquez un prix en Coins.', 'error'); return; }
      if (qty === 1) {
        const ok = await confirmBox({ title: 'Vendre votre seul exemplaire ?', text: `${esc(c.name)} quittera votre collection pendant la vente. Vous pourrez annuler tant que personne ne l'a achetée.`, ok: 'Mettre en vente', gold: true });
        if (!ok) return;
      }
      busy(sell, async () => {
        try { await api('/api/market/list', { card: id, price: p }); toast('En vente !', `${c.name} est au Marché pour ${fmt(p)} Coins.`, 'gold', 'tag'); draw(); } catch (e) { fail(e); }
      });
    });
    const av = root.querySelector('[data-avatar]');
    if (av) av.addEventListener('click', () => busy(av, async () => {
      try { await api('/api/avatar', { card: id }); toast('Avatar mis à jour', c.name, 'ok', 'user'); draw(); } catch (e) { fail(e); }
    }));
  };
  draw();
}
