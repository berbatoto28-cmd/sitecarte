/* Accueil des visiteurs : présentation + connexion / inscription */
import { S, $, esc, icon, api, mergeCards, emit, toast, fmt } from '../core.js';
import { cardHTML } from '../cards.js';

const pick = (serie, rarity, name) => {
  const cards = Object.values(S.card).filter((c) => c.serie === serie && c.rarity === rarity);
  return (name && cards.find((c) => c.name === name)) || cards[0];
};

export async function render(ctx) {
  // Seul un aperçu de 7 séries est téléchargé pour la vitrine (jamais 50 000 cartes).
  try {
    const samples = await Promise.all(['onepiece', 'jjk', 'naruto', 'aot', 'demonslayer', 'csm', 'frieren'].map((sid) => api(`/api/series/${sid}`)));
    samples.forEach(({ cards }) => mergeCards(Object.fromEntries(cards.map((c) => [c.id, c]))));
  } catch (e) { /* le formulaire doit fonctionner même si l'aperçu échoue */ }
  if (!ctx.alive) return;

  const hero = [pick('onepiece', 'mythique'), pick('jjk', 'mythique'), pick('naruto', 'mythique')].filter(Boolean);
  const ladder = [
    pick('aot', 'commune'), pick('onepiece', 'rare', 'Shanks'), pick('naruto', 'epique', 'Jiraiya'),
    pick('demonslayer', 'legendaire', 'Kyojuro Rengoku'), pick('csm', 'mythique', 'Power'),
    pick('jjk', 'secrete'), pick('frieren', 'primordiale'),
  ];
  const tiles = S.series.filter((s) => !s.special).slice(0, 28).map((s) => `<a class="serie-tile" style="--sc:${esc(s.color)}">${s.banner || s.cover ? `<img src="${esc(s.banner || s.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}<b>${esc(s.name)}</b></a>`).join('');
  const st = S.data.settings;

  ctx.el.innerHTML = `
  <div class="landing">
    <section class="hero">
      <div class="hero-copy">
        <span class="eyebrow">${icon('spark')} Cartes anime & manga · 100 % gratuit</span>
        <h1 class="hero-title">Anime<span>Connection</span></h1>
        <p class="hero-sub">Les plus grands héros de l'anime et du manga, en cartes à collectionner. Ouvrez des packs, complétez vos séries, échangez et vendez vos doublons avec les autres joueurs.</p>
        <ul class="hero-points">
          <li>${icon('gift')} Un pack offert toutes les ${Math.round(st.freeInterval / 60000)} minutes</li>
          <li>${icon('sun')} Un pack quotidien en plus</li>
          <li>${icon('cards')} ${fmt(S.totalCards)} cartes, ${S.series.length} séries cultes</li>
          <li>${icon('swap')} Échanges & Marché entre joueurs</li>
        </ul>
        <div class="auth panel panel-glow">
          <div class="tabs" role="tablist">
            <button type="button" role="tab" aria-selected="true" data-tab="register">Créer un compte</button>
            <button type="button" role="tab" aria-selected="false" data-tab="login">Se connecter</button>
          </div>
          <form novalidate>
            <div class="field"><label for="a-name">Pseudo</label><input class="input" id="a-name" name="name" autocomplete="username" maxlength="20" required placeholder="Votre pseudo de dresseur"></div>
            <div class="field"><label for="a-pass">Mot de passe</label><input class="input" id="a-pass" name="password" type="password" autocomplete="new-password" minlength="6" maxlength="100" required placeholder="6 caractères minimum"></div>
            <p class="form-error" role="alert"></p>
            <button class="btn btn-primary btn-lg btn-block" type="submit" data-submit>${icon('spark')}Commencer à collectionner</button>
            <p class="dim" style="margin:0;font-size:13.5px" data-perk>Cadeau de bienvenue : 5 Packs Standard, 1 Pack Céleste, 1 Pack Édition spéciale et 500 Coins.</p>
          </form>
        </div>
      </div>
      <div class="hero-stage" aria-hidden="true">${hero.map((c) => cardHTML(c.id, { eager: true, static: true })).join('')}</div>
    </section>

    <section>
      <h2 class="section-title">${icon('spark')} Sept raretés, de Commune à Primordiale <small>Plus c'est rare, plus c'est beau</small></h2>
      <div class="ladder">${ladder.filter(Boolean).map((c) => {
        const r = S.rar[c.rarity];
        return `<figure class="r-c-${r.id}">${cardHTML(c.id, { static: true })}<figcaption><b>${esc(r.label)}</b><span>${Number(r.weight).toLocaleString('fr-FR', {maximumFractionDigits:7})} % par carte${r.fullArt ? ' · Full Art' : ''}</span></figcaption></figure>`;
      }).join('')}</div>
    </section>

    <section>
      <h2 class="section-title">${icon('cards')} ${S.series.length} séries à compléter</h2>
      <div class="marquee"><div class="marquee-track">${tiles}${tiles}</div></div>
    </section>
  </div>`;

  // les cartes du héros réagissent quand même au survol
  ctx.el.querySelectorAll('.hero-stage .card').forEach((c) => c.classList.add('big'));

  let mode = 'register';
  const form = ctx.el.querySelector('form');
  const err = ctx.el.querySelector('.form-error');
  const submit = ctx.el.querySelector('[data-submit]');
  const pass = ctx.el.querySelector('#a-pass');
  const perk = ctx.el.querySelector('[data-perk]');
  ctx.el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.tab;
    ctx.el.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    submit.innerHTML = mode === 'register' ? `${icon('spark')}Commencer à collectionner` : `${icon('out')}Se connecter`;
    pass.autocomplete = mode === 'register' ? 'new-password' : 'current-password';
    perk.hidden = mode !== 'register';
    err.textContent = '';
  }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    const name = form.elements.namedItem('name').value.trim();
    const password = form.elements.namedItem('password').value;
    if (name.length < 3) { err.textContent = 'Pseudo : 3 caractères minimum.'; return; }
    if (password.length < 6) { err.textContent = 'Mot de passe : 6 caractères minimum.'; return; }
    submit.classList.add('is-loading');
    submit.disabled = true;
    try {
      const d = await api(mode === 'register' ? '/api/register' : '/api/login', { name, password });
      if (d.welcome) toast(`Bienvenue, ${S.me.user.name} !`, 'Vos packs de bienvenue vous attendent dans l\'onglet Packs.', 'ok', 'gift');
      history.replaceState(null, '', '#/accueil');
      emit('login');
    } catch (ex) {
      err.textContent = ex.message;
    } finally {
      submit.classList.remove('is-loading');
      submit.disabled = false;
    }
  });
  setTimeout(() => { if (ctx.alive) $('#a-name')?.focus({ preventScroll: true }); }, 300);
}
