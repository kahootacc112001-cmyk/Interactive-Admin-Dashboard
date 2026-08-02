/**
 * components.js
 * ------------------------------------------------------------------
 * Small, dependency-free UI primitives shared across the app:
 * Toast notifications, a generic Modal, skeleton loaders, a count-up
 * number animator, and a pagination control builder.
 * ------------------------------------------------------------------
 */

/* ---------------------------- Toasts ---------------------------- */
const Toast = (() => {
  const stack = document.getElementById('toastStack');
  const ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    error:   '<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    info:    '<svg viewBox="0 0 24 24" fill="none"><path d="M12 8h.01M11 12h1v5h1" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/></svg>'
  };

  function show({ type = 'info', title, message, duration = 4200 }){
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <span class="toast-icon">${ICONS[type] || ICONS.info}</span>
      <div class="toast-body"><strong>${title}</strong>${message ? `<p>${message}</p>` : ''}</div>
      <button class="toast-close" aria-label="Dismiss">
        <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      </button>`;
    stack.appendChild(el);

    const remove = () => {
      el.classList.add('is-leaving');
      el.addEventListener('animationend', () => el.remove(), { once:true });
    };
    el.querySelector('.toast-close').addEventListener('click', remove);
    const timer = setTimeout(remove, duration);
    el.addEventListener('mouseenter', () => clearTimeout(timer));
    return el;
  }

  return {
    success: (title, message) => show({ type:'success', title, message }),
    error:   (title, message) => show({ type:'error', title, message }),
    info:    (title, message) => show({ type:'info', title, message }),
  };
})();

/* ---------------------------- Modal ------------------------------ */
const Modal = (() => {
  const backdrop = document.getElementById('modalBackdrop');
  const titleEl = document.getElementById('modalTitle');
  const bodyEl = document.getElementById('modalBody');
  const footEl = document.getElementById('modalFoot');
  const closeBtn = document.getElementById('modalClose');

  function open({ title, bodyHtml, footButtons = [] }){
    titleEl.textContent = title;
    bodyEl.innerHTML = bodyHtml;
    footEl.innerHTML = '';
    footButtons.forEach(btn => {
      const b = document.createElement('button');
      b.className = `btn ${btn.className || 'btn-secondary'}`;
      b.textContent = btn.label;
      b.addEventListener('click', () => { btn.onClick?.(); if(btn.closesModal !== false) close(); });
      footEl.appendChild(b);
    });
    backdrop.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
  function close(){
    backdrop.classList.remove('is-open');
    document.body.style.overflow = '';
  }
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', e => { if(e.target === backdrop) close(); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape') close(); });

  return { open, close };
})();

/* ------------------------- Count-up numbers ----------------------- */
function animateCountUp(el, target, { duration = 900, decimals = 0, prefix = '', suffix = '' } = {}){
  const start = performance.now();
  const from = 0;
  function frame(now){
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    const value = from + (target - from) * eased;
    el.textContent = prefix + value.toLocaleString('en-US', { minimumFractionDigits:decimals, maximumFractionDigits:decimals }) + suffix;
    if(t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ---------------------------- Skeletons --------------------------- */
function skeletonRows(count, cols){
  let html = '';
  for(let i=0;i<count;i++){
    html += `<tr class="skeleton-row">${'<td><div class="skel-line" style="width:'+(60+Math.random()*30)+'%"></div></td>'.repeat(cols)}</tr>`;
  }
  return html;
}

/* --------------------------- Pagination ---------------------------- */
function buildPagination(container, { page, totalPages, onChange }){
  container.innerHTML = '';
  const mk = (label, target, opts = {}) => {
    const b = document.createElement('button');
    b.className = 'page-btn' + (opts.active ? ' is-active' : '');
    b.textContent = label;
    b.disabled = !!opts.disabled;
    b.addEventListener('click', () => onChange(target));
    return b;
  };

  container.appendChild(mk('‹', page - 1, { disabled: page <= 1 }));

  const window = 1;
  const pages = new Set([1, totalPages]);
  for(let p = page - window; p <= page + window; p++){ if(p>=1 && p<=totalPages) pages.add(p); }
  const sorted = [...pages].sort((a,b)=>a-b);
  let prev = 0;
  sorted.forEach(p => {
    if(p - prev > 1){
      const span = document.createElement('span');
      span.textContent = '…';
      span.style.cssText = 'padding:0 4px;color:var(--text-faint);align-self:center;font-size:12.5px;';
      container.appendChild(span);
    }
    container.appendChild(mk(String(p), p, { active: p === page }));
    prev = p;
  });

  container.appendChild(mk('›', page + 1, { disabled: page >= totalPages }));
}

/* --------------------------- Utilities ------------------------------ */
function initials(name){
  return name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
}
function avatarColor(seed){
  const hues = [255, 210, 165, 340, 25, 190];
  let h = 0; for(const c of seed) h = (h + c.charCodeAt(0)) % hues.length;
  const hue = hues[h];
  return `hsl(${hue} 70% 52%)`;
}
function debounce(fn, wait = 220){
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}
function formatCurrency(n){
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
}
function formatDate(iso){
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}
