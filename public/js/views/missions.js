/* Missions : quotidiennes, collection par série, succès */
import { S, esc, icon, fmt, clock, api, fail, toast, rewardHTML, rewardText, busy } from '../core.js';

const ICONS = {
  daily: 'sun', open5: 'pack', open15: 'pack', free3: 'gift', destroy10: 'trash', new3: 'cards', epic1: 'spark', legend1: 'crown',
  list1: 'tag', buy1: 'market', trade1: 'swap', bonus: 'gift',
};
const PREFIX_ICON = [['uniq', 'cards'], ['own_', 'crown'], ['packs', 'pack'], ['destroy', 'trash'], ['sold', 'tag'], ['trades', 'swap']];
const iconFor = (id) => ICONS[id] || (PREFIX_ICON.find(([p]) => id.startsWith(p)) || [0, 'target'])[1];

export async function render(ctx) {
  ctx.el.innerHTML = `
  <header class="view-head">
    <div><h1>Les <span class="grad">Missions</span></h1><p>Des récompenses en Coins et en packs pour chaque objectif atteint. Les missions du jour changent chaque nuit à minuit.</p></div>
    <button class="btn btn-primary" type="button" data-claim-all disabled>${icon('gift')} Tout récupérer</button>
  </header>
  <div data-body><div class="loading"></div></div>`;
  const body = ctx.el.querySelector('[data-body]');
  let ms = null;
  let at = 0;
  let claiming = false;
  const allButton = ctx.el.querySelector('[data-claim-all]');
  allButton.addEventListener('click', () => {
    if (claiming || allButton.disabled) return;
    claiming = true;
    busy(allButton, async () => {
      body.querySelectorAll('[data-claim]').forEach(b => { b.disabled = true; });
      try {
        const d = await api('/api/missions/claim-all', {});
        ms = d.missions; at = performance.now();
        toast(d.count ? `${fmt(d.count)} récompenses récupérées !` : 'Aucune récompense disponible', d.count ? rewardText(d.reward) : '', 'gold', 'gift');
      } catch (e) { fail(e); }
      finally { claiming = false; }
    }).finally(() => { if (ctx.alive) paint(); });
  });

  const load = async () => {
    try { ms = (await api('/api/missions')).missions; at = performance.now(); } catch (e) { fail(e); return; }
    if (ctx.alive) paint();
  };

  const missionRow = (m, extraCls) => {
    const done = m.progress >= m.target;
    const state = m.claimed ? 'is-claimed' : done ? 'is-claimable' : '';
    return `<div class="mission ${state} ${extraCls || ''}">
      <div class="mission-ico">${icon(m.claimed ? 'check' : iconFor(m.id))}</div>
      <div><h4>${esc(m.label)}</h4><div class="reward">${rewardHTML(m.reward)}</div>
        <div class="bar ${done ? 'is-done' : ''}"><i style="--p:${Math.min(100, (m.progress / m.target) * 100)}%"></i></div>
        <div class="prog">${fmt(m.progress)} / ${fmt(m.target)}</div></div>
      ${m.claimed ? `<span class="status ok">${icon('check')} Récupéré</span>` : `<button class="btn btn-sm ${done ? 'btn-primary' : 'btn-ghost'}" type="button" data-claim="${esc(m.id)}" ${done ? '' : 'disabled'}>${done ? 'Récupérer' : 'En cours'}</button>`}
    </div>`;
  };

  function paint() {
    let available = [...ms.daily, ms.bonus].filter(m=>!m.claimed && m.progress>=m.target).length;
    available += ms.achievements.filter(m=>!m.claimed && m.progress>=S.data.achievements.find(d=>d.id===m.id).target).length;
    for (const s of ms.series || []) for (const step of S.data.serieSteps) {
      if (!s.claimed.includes(step.k) && s.owned>=Math.ceil(s.total*step.frac)) available++;
    }
    allButton.disabled = claiming || !available;
    allButton.innerHTML = `${icon('gift')} Tout récupérer${available ? ` (${fmt(available)})` : ''}`;
    const ach = Object.fromEntries(ms.achievements.map((a) => [a.id, a]));
    const defs = S.data.achievements;
    const general = defs.filter((d) => d.group !== 'serie');
    // Missions disponibles uniquement pour les séries commencées par le joueur.
    const bySerie = (ms.series || []).slice(0, 36).map((progress) => ({
      s: S.serie[progress.id], progress,
      steps: S.data.serieSteps.map((step) => ({
        id: `s_${progress.id}_${step.k}`, target: Math.ceil(progress.total * step.frac),
        reward: step.reward, progress: progress.owned, claimed: progress.claimed.includes(step.k),
      })),
    })).filter((x) => x.s);
    const groupHTML = (g) => general.filter((d) => d.group === g).map((d) => missionRow(Object.assign({}, d, ach[d.id]))).join('');
    body.innerHTML = `
      <section class="panel panel-glow">
        <h2 class="section-title">${icon('sun')} Missions du jour <small data-reset></small></h2>
        <div class="mission-grid">${ms.daily.map((m) => missionRow(m)).join('')}${missionRow(ms.bonus, 'bonus')}</div>
      </section>
      <section class="section panel">
        <h2 class="section-title">${icon('trophy')} Succès de collection</h2>
        <div class="mission-grid">${groupHTML('collection')}</div>
      </section>
      <section class="section panel">
        <h2 class="section-title">${icon('flame')} Succès d'activité</h2>
        <div class="mission-grid">${groupHTML('activite')}</div>
      </section>
      <section class="section">
        <h2 class="section-title">${icon('cards')} Missions de collection par série <small>Complétez chaque série pour gagner un Pack Céleste</small></h2>
        <div class="serie-missions">${bySerie.map(({ s, steps, progress }) => {
          const prog = progress.owned;
          const total = steps.length ? steps[steps.length - 1].target : 0;
          return `<article class="sm-card" style="--sc:${esc(s.color)}">
            <div class="sm-banner">${s.banner || s.cover ? `<img src="${esc(s.banner || s.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}<b>${esc(s.name)}</b><span>${prog} / ${total}</span></div>
            <div class="sm-body"><div class="bar ${prog >= total ? 'is-done' : ''}"><i style="--p:${(prog / total) * 100}%"></i></div>
            <div class="sm-steps">${steps.map((d) => {
              const a = d;
              const done = a.progress >= d.target;
              const cls = a.claimed ? 'is-claimed' : done ? 'is-claimable' : '';
              return `<div class="sm-step ${cls}"><b>${d.target} cartes</b><span title="${esc(rewardText(d.reward))}">${rewardHTML(d.reward)}</span>
                ${a.claimed ? `<span>${icon('check')} Récupéré</span>` : `<button class="btn ${done ? 'btn-primary' : 'btn-ghost'}" type="button" data-claim="${esc(d.id)}" ${done ? '' : 'disabled'}>${done ? 'Récupérer' : 'Verrouillé'}</button>`}</div>`;
            }).join('') || `<div class="empty">${icon('cards')}<b>Commencez une série</b><span>Ouvrez vos premiers packs pour débloquer ces missions.</span></div>`}</div></div></article>`;
        }).join('') || `<div class="empty">${icon('cards')}<b>Commencez une série</b><span>Ouvrez vos premiers packs pour débloquer ces missions.</span></div>`}</div>
      </section>`;
    body.querySelectorAll('[data-claim]').forEach((b) => b.addEventListener('click', () => {
      if (claiming) return;
      claiming = true; allButton.disabled = true;
      return busy(b, async () => {
      try {
        const d = await api('/api/missions/claim', { id: b.dataset.claim });
        ms = d.missions; at = performance.now();
        toast('Récompense récupérée !', rewardText(d.reward), 'gold', 'gift');
      } catch (e) { fail(e); }
      finally { claiming = false; if (ctx.alive) paint(); }
    });
    }));
    tickReset();
  }
  function tickReset() {
    const el = body.querySelector('[data-reset]');
    if (!el || !ms) return;
    const left = ms.resetIn - (performance.now() - at);
    el.textContent = `Nouvelles missions dans ${clock(left)}`;
    if (left <= 0) load();
  }
  ctx.every(1000, tickReset);
  await load();
}
