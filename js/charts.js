/**
 * charts.js
 * ------------------------------------------------------------------
 * All charting in this dashboard is hand-rolled on top of the
 * Canvas 2D API — no chart libraries. Three primitives:
 *   - Charts.area()       animated gradient area/line chart
 *   - Charts.donut()      animated donut chart
 *   - Charts.sparkline()  tiny inline trend line for stat cards
 * Each is theme-aware: colors are resolved from CSS custom
 * properties at draw time, so switching theme just needs a redraw.
 * ------------------------------------------------------------------
 */
const Charts = (() => {

  function resolveColor(token){
    if(!token) return '#888';
    const m = token.match(/^var\((--[\w-]+)\)$/);
    if(!m) return token;
    return getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || '#888';
  }

  function setupHiDPI(canvas){
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(rect.width, 40);
    const h = Math.max(rect.height || canvas.height, 40);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }

  /* -------------------------- Area / line chart -------------------------- */
  function area(canvas, { labels, series, duration = 900, padding = { t:14, r:8, b:26, l:8 } }){
    let raf;
    function render(){
      const { ctx, w, h } = setupHiDPI(canvas);
      const plotW = w - padding.l - padding.r;
      const plotH = h - padding.t - padding.b;
      const allVals = series.flatMap(s => s.data);
      const max = Math.max(...allVals) * 1.15;
      const min = Math.min(0, Math.min(...allVals));
      const n = labels.length;
      const xAt = i => padding.l + (plotW * i) / (n - 1);
      const yAt = v => padding.t + plotH - ((v - min) / (max - min || 1)) * plotH;

      const gridColor = resolveColor('var(--border-soft)');
      const textColor = resolveColor('var(--text-faint)');

      const start = performance.now();
      cancelAnimationFrame(raf);

      function frame(now){
        const t = Math.min(1, (now - start) / duration);
        const p = easeOutCubic(t);
        ctx.clearRect(0, 0, w, h);

        // gridlines
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        const rows = 4;
        for(let r=0;r<=rows;r++){
          const y = padding.t + (plotH / rows) * r;
          ctx.beginPath();
          ctx.moveTo(padding.l, y);
          ctx.lineTo(w - padding.r, y);
          ctx.stroke();
        }

        // x labels (sparse to avoid crowding)
        ctx.fillStyle = textColor;
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';
        const step = Math.max(1, Math.ceil(n / 7));
        for(let i=0;i<n;i+=step){
          ctx.fillText(labels[i], xAt(i), h - 8);
        }

        // series (draw fills first, then lines on top)
        series.forEach(s => {
          const visibleCount = Math.max(2, Math.floor(n * p));
          const pts = s.data.slice(0, visibleCount).map((v,i)=>[xAt(i), yAt(v)]);
          if(pts.length < 2) return;

          if(s.fill){
            const grad = ctx.createLinearGradient(0, padding.t, 0, padding.t + plotH);
            const c = resolveColor(s.color);
            grad.addColorStop(0, c + '55');
            grad.addColorStop(1, c + '02');
            ctx.beginPath();
            ctx.moveTo(pts[0][0], yAt(min));
            pts.forEach(([x,y]) => ctx.lineTo(x,y));
            ctx.lineTo(pts[pts.length-1][0], yAt(min));
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();
          }

          ctx.beginPath();
          pts.forEach(([x,y], i) => i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y));
          ctx.strokeStyle = resolveColor(s.color);
          ctx.lineWidth = 2.2;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.stroke();

          // end dot
          if(t >= 0.98){
            const [lx, ly] = pts[pts.length - 1];
            ctx.beginPath();
            ctx.arc(lx, ly, 3.4, 0, Math.PI*2);
            ctx.fillStyle = resolveColor(s.color);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(lx, ly, 6, 0, Math.PI*2);
            ctx.strokeStyle = resolveColor(s.color);
            ctx.globalAlpha = .35;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        });

        if(t < 1) raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
    }

    render();
    const ro = new ResizeObserver(debounce(render, 120));
    ro.observe(canvas);
    return { redraw: render, destroy: () => { cancelAnimationFrame(raf); ro.disconnect(); } };
  }

  /* ------------------------------ Donut chart ------------------------------ */
  function donut(canvas, { segments, duration = 900, thickness = 22 }){
    let raf;
    function render(){
      const { ctx, w, h } = setupHiDPI(canvas);
      const cx = w/2, cy = h/2;
      const radius = Math.min(w, h)/2 - 4;
      const total = segments.reduce((a,s)=>a+s.value, 0);
      const start = performance.now();
      cancelAnimationFrame(raf);

      function frame(now){
        const t = Math.min(1, (now - start) / duration);
        const p = easeOutCubic(t);
        ctx.clearRect(0,0,w,h);

        let angle = -Math.PI/2;
        segments.forEach(seg => {
          const sweep = (seg.value/total) * Math.PI * 2 * p;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, angle, angle + sweep);
          ctx.lineWidth = thickness;
          ctx.lineCap = 'butt';
          ctx.strokeStyle = resolveColor(seg.color);
          ctx.stroke();
          angle += (seg.value/total) * Math.PI * 2;
        });

        ctx.fillStyle = resolveColor('var(--text)');
        ctx.font = '600 20px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.round(total * p) + '%', cx, cy - 4);
        ctx.font = '11px Inter, sans-serif';
        ctx.fillStyle = resolveColor('var(--text-faint)');
        ctx.fillText('of sessions', cx, cy + 15);

        if(t < 1) raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
    }
    render();
    const ro = new ResizeObserver(debounce(render, 120));
    ro.observe(canvas);
    return { redraw: render, destroy: () => { cancelAnimationFrame(raf); ro.disconnect(); } };
  }

  /* ----------------------------- Sparkline ------------------------------- */
  function sparkline(canvas, data, colorToken, duration = 800){
    let raf;
    function render(){
      const { ctx, w, h } = setupHiDPI(canvas);
      const max = Math.max(...data), min = Math.min(...data);
      const xAt = i => (w * i) / (data.length - 1);
      const yAt = v => h - 4 - ((v - min) / (max - min || 1)) * (h - 8);
      const color = resolveColor(colorToken);
      const start = performance.now();
      cancelAnimationFrame(raf);

      function frame(now){
        const t = Math.min(1, (now - start)/duration);
        const p = easeOutCubic(t);
        ctx.clearRect(0,0,w,h);
        const visible = Math.max(2, Math.floor(data.length * p));
        const pts = data.slice(0, visible).map((v,i) => [xAt(i), yAt(v)]);

        const grad = ctx.createLinearGradient(0,0,0,h);
        grad.addColorStop(0, color + '40');
        grad.addColorStop(1, color + '00');
        ctx.beginPath();
        ctx.moveTo(pts[0][0], h);
        pts.forEach(([x,y]) => ctx.lineTo(x,y));
        ctx.lineTo(pts[pts.length-1][0], h);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        pts.forEach(([x,y],i) => i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y));
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.8;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();

        if(t < 1) raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
    }
    render();
    return { redraw: render, destroy: () => cancelAnimationFrame(raf) };
  }

  return { area, donut, sparkline, resolveColor };
})();
