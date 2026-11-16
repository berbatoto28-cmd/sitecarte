/* AnimeConnection V10 — reveal légendaire+ : mise en scène 4K adaptative.
   Le décor, la lumière, les particules et la typographie sont vectoriels/Canvas.
   Les portraits AniList ne deviennent pas magiquement 4K : on limite leur taille
   et on charge, si disponible, une illustration/vidéo spécifique via manifest.json.
*/
import { S, esc, cardImg } from './core.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const TIERS = Object.freeze({
  legendaire:  { name: 'LÉGENDAIRE',  eyebrow: 'UNE LÉGENDE EST APPARUE',  lead: 'Le destin vient de changer.',          tag: '01 / ÉVEIL',       rgb: [255, 194, 73],  duration: 1800, sfx:'SHING' },
  mythique:    { name: 'MYTHIQUE',    eyebrow: 'AU-DELÀ DES LÉGENDES',    lead: 'Une puissance hors du commun.',      tag: '02 / ASCENSION',   rgb: [255, 88, 167], duration: 1950, sfx:'KRAK' },
  secrete:     { name: 'SECRÈTE',     eyebrow: 'SIGNATURE INCONNUE',      lead: 'Tu viens de briser les probabilités.',tag: '03 / ANOMALIE',    rgb: [105, 240, 252],duration: 2100, sfx:'BAM' },
  primordiale: { name: 'PRIMORDIALE', eyebrow: 'LE SOMMET ABSOLU',       lead: 'Un événement qui marque l’histoire.', tag: '04 / GENÈSE',     rgb: [255, 226, 153],duration: 2300, sfx:'DOOM' },
  astral:      { name: 'ASTRAL',      eyebrow: 'AU-DELÀ DU CIEL',         lead: 'La carte ultime de cet univers.',      tag: '05 / COSMOS',     rgb: [193, 158, 255],duration: 3100, sfx:'ASTRAL' },
});

let manifestPromise;
async function revealManifest() {
  if (!manifestPromise) manifestPromise = fetch('/reveals/manifest.json', { cache: 'no-store' })
    .then((r) => r.ok ? r.json() : {})
    .catch(() => ({}));
  return manifestPromise;
}
function localAsset(src, type) {
  if (typeof src !== 'string' || !src.startsWith('/reveals/')) return null;
  if (!/\.(webp|png|jpe?g|avif|gif|mp4|webm)$/i.test(src)) return null;
  return type === 'video' ? (/\.(mp4|webm)$/i.test(src) ? src : null) : (/\.(webp|png|jpe?g|avif|gif)$/i.test(src) ? src : null);
}
function setupPortrait(root, card, assets) {
  const hero = root.querySelector('.rv-art-img');
  const reflection = root.querySelector('.rv-reflection');
  const source = localAsset(assets?.poster, 'image') || cardImg(card) || '';
  hero.src = source;
  reflection.style.backgroundImage = `url(${JSON.stringify(source)})`;
  if (localAsset(assets?.poster, 'image')) root.classList.add('has-hd-poster');
  hero.addEventListener('load', () => {
    const sz = Math.min(hero.naturalWidth, hero.naturalHeight);
    // Les images AniList font souvent seulement 150-400 px : pas de faux "portrait 4K".
    if (sz < 640 && !localAsset(assets?.poster, 'image')) root.classList.add('low-res-source');
  }, { once:true });
  hero.addEventListener('error', () => {
    if (hero.src !== card.img && card.img) { hero.src = card.img; return; }
    root.classList.add('no-portrait');
  });
  const movie = localAsset(assets?.video, 'video');
  if (movie) {
    const v = document.createElement('video');
    v.className = 'rv-character-video';
    v.src = movie;
    v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true;
    v.preload = 'metadata';
    v.setAttribute('aria-hidden', 'true');
    v.addEventListener('playing', () => root.classList.add('is-video'), { once:true });
    v.addEventListener('error', () => { v.remove(); root.classList.remove('is-video'); });
    root.querySelector('.rv-art-window').appendChild(v);
    v.play().catch(() => { v.remove(); root.classList.remove('is-video'); });
  }
}

/* Particules géométriques nettes à la résolution de l'écran, plafonnées à 4K
   pour éviter des allocations massives sur écrans très grands / fort DPR. */
function animateCanvas(canvas, tier, key, isAlive) {
  if (reduceMotion) return () => {};
  const ctx = canvas.getContext('2d', { alpha:true });
  if (!ctx) return () => {};
  let width = 0, height = 0, dpr = 1, raf = 0, last = 0;
  const v = (tier.rgb).join(',');
  let seed = [...String(key)].reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 5381);
  const random = () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
  const dots = Array.from({length:160}, () => ({
    x:random(), y:random(), radius: .35 + random()*1.45,
    velocity: .12 + random()*.45, drift:(random()-.5)*.2,
    a:random()*Math.PI*2, depth:.3+random()*.9
  }));
  const streaks = Array.from({length:14}, (_,i) => ({ a:i*Math.PI*2/14+random()*.17, spread:.42+random()*.6 }));
  function resize() {
    width = canvas.clientWidth || innerWidth;
    height = canvas.clientHeight || innerHeight;
    const maxRatio = Math.min(2, window.devicePixelRatio || 1, 3840/width, 2160/height);
    dpr = Math.max(.5, maxRatio);
    canvas.width = Math.max(1, Math.floor(width*dpr));
    canvas.height = Math.max(1, Math.floor(height*dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const start = performance.now();
  function draw(now) {
    if (!isAlive()) return;
    // 40 fps max, 30 fps sur surfaces >3 millions de pixels.
    if (now-last < (canvas.width * canvas.height > 3e6 ? 32 : 24)) { raf = requestAnimationFrame(draw); return; }
    last = now;
    const t = (now - start) / 1000;
    const pow = Math.min(1, t / .9);
    ctx.clearRect(0, 0, width, height);
    const cx = width * (width < 800 ? .5 : .675), cy = height*.47;
    const base = Math.min(width,height) * .32;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    // Arc / cercle géométrique, sans image raster étirée.
    for (let k=0;k<3;k++) {
      const rad=base*(1+k*.29) * (1+Math.sin(t*(.5+k*.17))*.014);
      ctx.beginPath();
      ctx.arc(cx,cy,rad,(t*.23)*(k%2?1:-1)+k*1.6,(t*.23)*(k%2?1:-1)+k*1.6+Math.PI*(1.2+k*.11));
      ctx.lineWidth= k===0 ? 1.7 : .7;
      ctx.strokeStyle=`rgba(${v},${(.05+(.18-k*.04)*pow).toFixed(3)})`;
      ctx.stroke();
    }
    for (let k=0;k<streaks.length;k++) {
      const ray=streaks[k];
      const a=ray.a + t * (k%2 ? .009 : -.008);
      const r=base*(1.13+ray.spread*.23);
      const x=cx+Math.cos(a)*r, y=cy+Math.sin(a)*r;
      const x2=cx+Math.cos(a)*r*(1.1+ray.spread), y2=cy+Math.sin(a)*r*(1.1+ray.spread);
      const g=ctx.createLinearGradient(x,y,x2,y2);
      g.addColorStop(0,`rgba(${v},${.13*pow})`);
      g.addColorStop(1,`rgba(${v},0)`);
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x2,y2);ctx.strokeStyle=g; ctx.lineWidth=1;ctx.stroke();
    }
    for (const d of dots) {
      const x=((d.x + (t*d.drift/500))%1+1)%1*width;
      const y=((d.y - t*d.velocity/180)%1+1)%1*height;
      const alpha =(.2+.4*(.5+.5*Math.sin(t*1.6+d.a)))*pow;
      ctx.beginPath(); ctx.arc(x,y,d.radius*d.depth,0,Math.PI*2);
      ctx.fillStyle=`rgba(${v},${alpha.toFixed(3)})`; ctx.fill();
    }
    // Impact radial au début et pour les raretés les plus hautes.
    const impacts = tier.name === 'PRIMORDIALE' ? [0.55,1.62,2.8] : tier.name === 'SECRÈTE' ? [.55,2.2] : [.55];
    for (const when of impacts) {
      const e=(t-when)/.9;
      if(e>=0 && e<=1) {
        ctx.beginPath();ctx.arc(cx,cy,base*(.36+e*2),0,Math.PI*2);
        ctx.lineWidth=3*(1-e);
        ctx.strokeStyle=`rgba(${v},${(.6*(1-e)).toFixed(3)})`;
        ctx.stroke();
      }
    }
    ctx.restore();
    raf=requestAnimationFrame(draw);
  }
  resize();
  window.addEventListener('resize', resize, { passive:true });
  raf=requestAnimationFrame(draw);
  return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
}

/** Lance une séquence animée avant l'animation de la carte. Fermeture au clic ou
 * après la durée, Échap/Entrée/Espace pour passer. Les cartes communes à épiques
 * ne passent jamais ici. */
export async function revealCharacter4K(id) {
  const c = S.card[id];
  const tier = c && TIERS[c.rarity];
  const host = document.querySelector('#stage');
  if (!tier || !host || host.hidden) return;
  const serie = S.serie[c.serie] || { name:'Anime / manga' };
  const assets = (await revealManifest())?.cards?.[c.id] || {};
  if (host.hidden) return;
  return new Promise((resolve) => {
    const root = document.createElement('section');
    root.className=`rv4k rv-simple tier-${c.rarity}${c.theme ? ` theme-${c.theme}` : ''}`;
    root.style.setProperty('--rv-color', tier.rgb.join(','));
    root.setAttribute('role','dialog');
    root.setAttribute('aria-label',`Découverte ${tier.name} : ${c.name}`);
    const coverSrc = serie.banner || serie.cover || localAsset(assets?.poster, 'image') || cardImg(c) || '';
    root.innerHTML=`
      <canvas class="rv-canvas" aria-hidden="true"></canvas>
      <div class="rv-bg">${coverSrc ? `<img class="rv-cover" src="${esc(coverSrc)}" alt="" loading="eager" decoding="async" referrerpolicy="no-referrer">` : ''}</div>
      <div class="rv-shade" aria-hidden="true"></div>
      <div class="rv-glow" aria-hidden="true"></div>
      <div class="rv-simple-copy">
        <div class="rv-kicker">${esc(tier.name)}</div>
        <h2 class="rv-anime-title">${esc(serie.name)}${c.theme==='summer' ? ' · Summer Waifu' : ''}</h2>
        <p class="rv-character-name">${esc(c.name || 'Carte mystère')}</p>
      </div>
      <div class="rv-tap-hint">Cliquer pour continuer</div>`;
    host.appendChild(root);
    const duration = reduceMotion ? 500 : tier.duration;
    root.style.setProperty('--rv-duration',`${duration}ms`);
    let stopped=false, timeout, stopCanvas=()=>{};
    const play = () => {
      clearTimeout(timeout);
      stopCanvas();
      root.classList.remove('rv-playing');
      void root.offsetWidth;
      root.classList.add('rv-playing');
      stopCanvas = animateCanvas(root.querySelector('.rv-canvas'), tier, c.id, ()=>!stopped && !host.hidden);
      timeout = setTimeout(close, duration);
    };
    const onKey = (e) => {
      if (e.key==='Escape'||e.key==='Enter'||e.key===' ') { e.preventDefault(); e.stopImmediatePropagation(); close(); }
    };
    const close = () => {
      if (stopped) return;
      stopped = true;
      clearTimeout(timeout); stopCanvas();
      document.removeEventListener('keydown', onKey, true);
      host.removeEventListener('stage:close', close);
      root.classList.remove('rv-playing');
      root.classList.add('rv-closing');
      setTimeout(()=>{ root.remove(); resolve(); }, reduceMotion ? 0 : 220);
    };
    document.addEventListener('keydown', onKey, true);
    host.addEventListener('stage:close', close, { once:true });
    root.addEventListener('click', close);
    play();
  });
}
