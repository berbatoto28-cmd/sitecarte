/* =========================================================================
   AnimeConnection : ciel étoilé animé (poussière violette + étoiles filantes)
   ========================================================================= */
export function initStars(canvas) {
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLORS = ['255,255,255', '216,180,254', '240,171,252', '165,180,252', '196,181,253'];
  let w = 0, h = 0, dpr = 1, stars = [], shooting = null, last = 0, raf = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(220, (w * h) / 9000));
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() < 0.08 ? 1.4 + Math.random() * 1.2 : 0.4 + Math.random() * 0.9,
      c: COLORS[(Math.random() * COLORS.length) | 0],
      t: Math.random() * Math.PI * 2, s: 0.4 + Math.random() * 1.4,
      vy: -(0.02 + Math.random() * 0.08), vx: (Math.random() - 0.5) * 0.03,
    }));
    if (reduce) draw(0);
  }

  function draw(dt) {
    ctx.clearRect(0, 0, w, h);
    for (const st of stars) {
      st.t += dt * 0.001 * st.s;
      st.x += st.vx * dt * 0.06; st.y += st.vy * dt * 0.06;
      if (st.y < -4) { st.y = h + 4; st.x = Math.random() * w; }
      if (st.x < -4) st.x = w + 4; else if (st.x > w + 4) st.x = -4;
      const a = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(st.t));
      ctx.beginPath();
      ctx.fillStyle = `rgba(${st.c},${(a * 0.9).toFixed(3)})`;
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
      if (st.r > 1.3) {
        const g = ctx.createRadialGradient(st.x, st.y, 0, st.x, st.y, st.r * 6);
        g.addColorStop(0, `rgba(${st.c},${(a * 0.35).toFixed(3)})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(st.x - st.r * 6, st.y - st.r * 6, st.r * 12, st.r * 12);
      }
    }
    if (!shooting && Math.random() < dt * 0.00012) {
      shooting = { x: Math.random() * w * 0.8 + w * 0.1, y: Math.random() * h * 0.35, vx: 0.9 + Math.random() * 0.6, vy: 0.35 + Math.random() * 0.25, life: 0 };
    }
    if (shooting) {
      const sh = shooting;
      sh.life += dt;
      sh.x += sh.vx * dt; sh.y += sh.vy * dt;
      const tail = 140;
      const g = ctx.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * tail, sh.y - sh.vy * tail);
      const fade = Math.max(0, 1 - sh.life / 1100);
      g.addColorStop(0, `rgba(255,255,255,${0.9 * fade})`);
      g.addColorStop(0.3, `rgba(232,121,249,${0.5 * fade})`);
      g.addColorStop(1, 'rgba(232,121,249,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(sh.x - sh.vx * tail, sh.y - sh.vy * tail); ctx.stroke();
      if (sh.life > 1100 || sh.x > w + 200 || sh.y > h + 200) shooting = null;
    }
  }

  function loop(t) {
    const dt = Math.min(64, last ? t - last : 16);
    last = t;
    draw(dt);
    raf = requestAnimationFrame(loop);
  }

  resize();
  window.addEventListener('resize', () => { cancelAnimationFrame(raf); resize(); if (!reduce) { last = 0; raf = requestAnimationFrame(loop); } });
  document.addEventListener('visibilitychange', () => {
    if (reduce) return;
    if (document.hidden) cancelAnimationFrame(raf);
    else { last = 0; raf = requestAnimationFrame(loop); }
  });
  if (!reduce) raf = requestAnimationFrame(loop);
}
