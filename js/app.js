/**
 * app.js
 * ------------------------------------------------------------------
 * Application entry point. Wires the DOM to Api/Store/Charts and
 * owns UI state that doesn't need to persist (current page, table
 * sort/filter/pagination, chart instances). Loaded last, after all
 * other modules are defined.
 * ------------------------------------------------------------------
 */
(() => {
  'use strict';

  /* ============================ Theme & shell ============================ */
  const html = document.documentElement;
  const body = document.body;
  const ChartInstances = []; // holds every live chart so theme switches can redraw them

  function applyTheme(theme){
    html.setAttribute('data-theme', theme);
    document.querySelectorAll('.theme-opt').forEach(b =>
      b.classList.toggle('is-active', b.dataset.themePick === theme));
    // redraw any live canvases so colors match the new theme
    ChartInstances.forEach(c => c.redraw());
  }

  function applySidebar(collapsed){
    body.classList.toggle('is-collapsed', collapsed);
  }

  const initState = Store.get();
  applyTheme(initState.theme);
  applySidebar(initState.sidebarCollapsed);
  document.getElementById('settingsName').value = initState.profile.name;
  document.getElementById('settingsRole').value = initState.profile.role;
  updateProfileUI(initState.profile);
  document.getElementById('compactSidebarToggle').checked = initState.sidebarCollapsed;

  document.getElementById('themeToggle').addEventListener('click', () => {
    const next = Store.get().theme === 'dark' ? 'light' : 'dark';
    Store.set({ theme: next });
    applyTheme(next);
  });

  document.getElementById('collapseBtn').addEventListener('click', () => {
    const next = !Store.get().sidebarCollapsed;
    Store.set({ sidebarCollapsed: next });
    applySidebar(next);
    document.getElementById('compactSidebarToggle').checked = next;
  });

  document.querySelectorAll('.theme-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      Store.set({ theme: btn.dataset.themePick });
      applyTheme(btn.dataset.themePick);
    });
  });

  document.getElementById('compactSidebarToggle').addEventListener('change', e => {
    Store.set({ sidebarCollapsed: e.target.checked });
    applySidebar(e.target.checked);
  });

  // mobile nav
  const menuBtn = document.getElementById('menuBtn');
  const scrim = document.getElementById('sidebarScrim');
  menuBtn?.addEventListener('click', () => body.classList.add('is-nav-open'));
  scrim.addEventListener('click', () => body.classList.remove('is-nav-open'));

  function updateProfileUI(profile){
    document.querySelector('.profile-meta strong').textContent = profile.name;
    document.querySelector('.profile-meta small').textContent = profile.role;
    document.querySelector('.avatar').textContent = initials(profile.name);
  }

  /* ============================== View routing ============================ */
  const views = {
    dashboard: document.getElementById('view-dashboard'),
    settings: document.getElementById('view-settings'),
    orders: document.getElementById('view-placeholder'),
    customers: document.getElementById('view-placeholder'),
    products: document.getElementById('view-placeholder'),
  };
  const PLACEHOLDER_TITLES = { orders:'Orders', customers:'Customers', products:'Products' };

  function goTo(viewKey){
    if(!views[viewKey]) return;
    Object.values(views).forEach(v => v.classList.remove('is-active'));
    if(viewKey === 'orders' || viewKey === 'customers' || viewKey === 'products'){
      document.getElementById('placeholderTitle').textContent = PLACEHOLDER_TITLES[viewKey];
    }
    views[viewKey].classList.add('is-active');
    document.querySelectorAll('.nav-item[data-view]').forEach(b =>
      b.classList.toggle('is-active', b.dataset.view === viewKey));
    body.classList.remove('is-nav-open');
    window.scrollTo({ top:0, behavior:'smooth' });
  }

  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', () => { goTo(el.dataset.view); closeAllPopovers(); });
  });

  /* ============================== Popovers ============================== */
  const popoverPairs = [
    ['notifBtn', 'notifPanel'],
    ['profileBtn', 'profilePanel'],
  ];
  function closeAllPopovers(){
    popoverPairs.forEach(([, panelId]) => document.getElementById(panelId).classList.remove('is-open'));
    searchResults.classList.remove('is-open');
  }
  popoverPairs.forEach(([btnId, panelId]) => {
    const btn = document.getElementById(btnId);
    const panel = document.getElementById(panelId);
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const willOpen = !panel.classList.contains('is-open');
      closeAllPopovers();
      panel.classList.toggle('is-open', willOpen);
    });
  });
  document.addEventListener('click', closeAllPopovers);
  document.querySelectorAll('.popover').forEach(p => p.addEventListener('click', e => e.stopPropagation()));

  /* ============================ Notifications ============================ */
  let notifications = [];
  async function loadNotifications(){
    notifications = await Api.getNotifications();
    const read = new Set(Store.get().readNotifications);
    notifications.forEach(n => { if(read.has(n.id)) n.unread = false; });
    renderNotifications();
  }
  const NOTIF_ICONS = {
    order: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    warn:  '<svg viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/></svg>',
    ok:    '<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  function renderNotifications(){
    const list = document.getElementById('notifList');
    list.innerHTML = notifications.map(n => `
      <div class="notif-item ${n.unread ? 'is-unread' : ''}">
        <span class="notif-icon type-${n.type}">${NOTIF_ICONS[n.type]}</span>
        <div class="notif-body">
          <p><strong>${n.title}</strong></p>
          <p>${n.body}</p>
          <time>${n.time}</time>
        </div>
      </div>`).join('');
    const unread = notifications.filter(n => n.unread).length;
    const badge = document.getElementById('notifBadge');
    badge.textContent = unread;
    badge.classList.toggle('is-hidden', unread === 0);
  }
  document.getElementById('markAllRead').addEventListener('click', () => {
    notifications.forEach(n => n.unread = false);
    Store.set({ readNotifications: notifications.map(n => n.id) });
    renderNotifications();
    Toast.success('All caught up', 'Notifications marked as read.');
  });

  /* =============================== Search ================================ */
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');

  const runSearch = debounce(async (q) => {
    if(!q){ searchResults.classList.remove('is-open'); return; }
    const results = await Api.search(q);
    searchResults.innerHTML = results.length
      ? results.map(r => `<div class="search-result-item" data-id="${r.id}"><span>${r.title}</span><span class="muted mono">${r.subtitle}</span></div>`).join('')
      : `<div class="search-empty">No results for "${q}"</div>`;
    searchResults.classList.add('is-open');
  }, 260);

  searchInput.addEventListener('input', e => runSearch(e.target.value.trim()));
  searchInput.addEventListener('focus', () => { if(searchInput.value) searchResults.classList.add('is-open'); });
  searchInput.addEventListener('click', e => e.stopPropagation());
  searchResults.addEventListener('click', e => {
    e.stopPropagation();
    const item = e.target.closest('.search-result-item');
    if(!item) return;
    searchResults.classList.remove('is-open');
    goTo('dashboard');
    setTimeout(() => document.querySelector(`#ordersTable tr[data-id="${item.dataset.id}"]`)?.click(), 50);
  });

  document.addEventListener('keydown', e => {
    if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'){
      e.preventDefault();
      searchInput.focus();
    }
  });

  /* ========================= Profile popover actions ====================== */
  document.getElementById('triggerToastDemo').addEventListener('click', () => {
    Toast.info('This is a test toast', 'Everything is wired up correctly.');
  });
  document.getElementById('signOutBtn').addEventListener('click', () => {
    Modal.open({
      title: 'Sign out of Northbeam?',
      bodyHtml: `<p>You'll need to sign back in to access your dashboard. This is a demo — no session will actually end.</p>`,
      footButtons: [
        { label:'Cancel', className:'btn-secondary' },
        { label:'Sign out', className:'btn-danger', onClick: () => Toast.info('Signed out', 'This is a UI demo, so nothing actually happened.') },
      ]
    });
  });

  /* ============================== Stat cards =============================== */
  const STAT_META = {
    revenue:     { label:'Total revenue',   icon:'💠', prefix:'$', decimals:2, color:'var(--accent)',
      svg:'<svg viewBox="0 0 24 24" fill="none"><path d="M12 2v20M17 6.5C17 4.6 14.8 3 12 3S7 4.6 7 6.5s2.2 3 5 3 5 1.5 5 3.5-2.2 3.5-5 3.5-5-1.4-5-3.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' },
    orders:      { label:'Orders',          decimals:0, color:'var(--accent-2)',
      svg:'<svg viewBox="0 0 24 24" fill="none"><path d="M6 7h15l-1.5 9h-12z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M6 7L4.5 3H2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="20" r="1.4" fill="currentColor"/><circle cx="17" cy="20" r="1.4" fill="currentColor"/></svg>' },
    activeUsers: { label:'Active users',    decimals:0, color:'var(--warning)',
      svg:'<svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3.2" stroke="currentColor" stroke-width="1.8"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16 8.2a3.2 3.2 0 010 6.4M21 20c0-2.6-1.9-4.8-4.4-5.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' },
    conversion:  { label:'Conversion rate', suffix:'%', decimals:2, color:'#8B7CF6',
      svg:'<svg viewBox="0 0 24 24" fill="none"><path d="M3 17l6-6 4 4 8-8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 7h6v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  };

  function statCardSkeleton(){
    const grid = document.getElementById('statGrid');
    grid.innerHTML = Object.keys(STAT_META).map(() => `
      <div class="stat-card">
        <div class="stat-card-top">
          <div class="skel-line" style="width:34px;height:34px;border-radius:10px;"></div>
          <div class="skel-line" style="width:44px;"></div>
        </div>
        <div class="skel-line" style="width:70px;margin-top:16px;"></div>
        <div class="skel-line" style="width:110px;height:22px;margin-top:8px;"></div>
        <div class="skel-line" style="width:100%;height:34px;margin-top:10px;"></div>
      </div>`).join('');
  }

  async function loadStats(){
    statCardSkeleton();
    const stats = await Api.getStats();
    const grid = document.getElementById('statGrid');
    grid.innerHTML = Object.entries(STAT_META).map(([key, meta]) => {
      const s = stats[key];
      const up = s.delta >= 0;
      return `
      <div class="stat-card">
        <div class="stat-card-top">
          <span class="stat-icon" style="background:color-mix(in srgb, ${meta.color} 16%, transparent); color:${meta.color}">${meta.svg}</span>
          <span class="stat-delta ${up ? 'up':'down'}">
            <svg viewBox="0 0 24 24" fill="none"><path d="${up ? 'M12 19V5M6 11l6-6 6 6' : 'M12 5v14M6 13l6 6 6-6'}" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
            ${Math.abs(s.delta)}%
          </span>
        </div>
        <p class="stat-label">${meta.label}</p>
        <p class="stat-value mono" data-count="${key}">0</p>
        <canvas class="stat-spark" data-spark="${key}"></canvas>
      </div>`;
    }).join('');

    Object.entries(STAT_META).forEach(([key, meta]) => {
      const s = stats[key];
      const el = grid.querySelector(`[data-count="${key}"]`);
      animateCountUp(el, s.value, { decimals: meta.decimals, prefix: meta.prefix || '', suffix: meta.suffix || '' });
      const canvas = grid.querySelector(`[data-spark="${key}"]`);
      ChartInstances.push(Charts.sparkline(canvas, s.spark, meta.color));
    });
  }

  /* ============================== Sales chart ============================== */
  let salesChartInstance = null;
  async function loadSalesChart(range){
    const data = await Api.getSalesSeries(range);
    if(salesChartInstance) salesChartInstance.destroy();
    const idx = ChartInstances.indexOf(salesChartInstance);
    if(idx > -1) ChartInstances.splice(idx, 1);
    salesChartInstance = Charts.area(document.getElementById('salesChart'), {
      labels: data.labels,
      series: [
        { data: data.revenue, color: 'var(--accent)', fill: true },
        { data: data.refunds, color: 'var(--danger)', fill: false },
      ]
    });
    ChartInstances.push(salesChartInstance);
  }
  document.getElementById('rangeSwitch').addEventListener('click', e => {
    const btn = e.target.closest('.range-btn');
    if(!btn) return;
    document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    loadSalesChart(btn.dataset.range);
  });

  /* ============================== Donut chart ================================ */
  async function loadDonut(){
    const traffic = await Api.getTraffic();
    const donutInstance = Charts.donut(document.getElementById('donutChart'), { segments: traffic });
    ChartInstances.push(donutInstance);
    document.getElementById('donutLegend').innerHTML = traffic.map(t => `
      <li>
        <span class="k"><i style="background:${Charts.resolveColor(t.color)}"></i>${t.label}</span>
        <span class="v">${t.value}%</span>
      </li>`).join('');
  }

  /* ================================ Orders table ============================== */
  let allOrders = [];
  const tableState = { sortKey:'date', sortDir:'desc', status:'all', query:'', page:1 };

  const STATUS_LABEL = { paid:'Paid', pending:'Pending', refunded:'Refunded', failed:'Failed' };

  function ordersTableSkeleton(){
    document.getElementById('ordersBody').innerHTML = skeletonRows(6, 6);
  }

  async function loadOrders(){
    ordersTableSkeleton();
    allOrders = await Api.getOrders();
    renderOrdersTable();
  }

  function getFilteredSortedOrders(){
    let rows = allOrders.filter(o => {
      if(tableState.status !== 'all' && o.status !== tableState.status) return false;
      if(tableState.query){
        const q = tableState.query.toLowerCase();
        if(!o.customer.toLowerCase().includes(q) && !o.id.toLowerCase().includes(q) && !o.email.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    rows.sort((a,b) => {
      let av = a[tableState.sortKey], bv = b[tableState.sortKey];
      if(tableState.sortKey === 'date'){ av = new Date(av); bv = new Date(bv); }
      if(typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      if(av < bv) return tableState.sortDir === 'asc' ? -1 : 1;
      if(av > bv) return tableState.sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }

  function renderOrdersTable(){
    const pageSize = Store.get().tablePageSize;
    const rows = getFilteredSortedOrders();
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    tableState.page = Math.min(tableState.page, totalPages);
    const startIdx = (tableState.page - 1) * pageSize;
    const pageRows = rows.slice(startIdx, startIdx + pageSize);

    document.getElementById('ordersBody').innerHTML = pageRows.length ? pageRows.map(o => `
      <tr data-id="${o.id}">
        <td class="cell-order">${o.id}</td>
        <td>
          <div class="cell-customer">
            <span class="cell-avatar" style="background:${avatarColor(o.customer)}">${initials(o.customer)}</span>
            ${o.customer}
          </div>
        </td>
        <td class="muted">${formatDate(o.date)}</td>
        <td class="cell-amount">${formatCurrency(o.amount)}</td>
        <td><span class="badge ${o.status}">${STATUS_LABEL[o.status]}</span></td>
        <td>
          <button class="row-menu-btn" aria-label="View order">
            <svg viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </td>
      </tr>`).join('') : `<tr><td colspan="6" style="text-align:center;padding:34px;color:var(--text-faint);">No orders match your filters.</td></tr>`;

    document.getElementById('paginationInfo').textContent = rows.length
      ? `Showing ${startIdx+1}–${Math.min(startIdx+pageSize, rows.length)} of ${rows.length} orders`
      : 'No results';

    buildPagination(document.getElementById('pagination'), {
      page: tableState.page, totalPages,
      onChange: (p) => { tableState.page = p; renderOrdersTable(); }
    });

    document.querySelectorAll('#ordersTable thead th[data-sort]').forEach(th => {
      th.classList.toggle('sorted', th.dataset.sort === tableState.sortKey);
      th.innerHTML = th.textContent.replace(/\s*[▲▼]?$/,'') +
        (th.dataset.sort === tableState.sortKey ? `<span class="sort-arrow">${tableState.sortDir === 'asc' ? '▲':'▼'}</span>` : '');
    });
  }

  document.querySelectorAll('#ordersTable thead th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if(tableState.sortKey === key){
        tableState.sortDir = tableState.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        tableState.sortKey = key;
        tableState.sortDir = 'asc';
      }
      renderOrdersTable();
    });
  });

  document.getElementById('statusFilter').addEventListener('change', e => {
    tableState.status = e.target.value; tableState.page = 1; renderOrdersTable();
  });
  document.getElementById('tableSearch').addEventListener('input', debounce(e => {
    tableState.query = e.target.value.trim(); tableState.page = 1; renderOrdersTable();
  }, 200));

  document.getElementById('ordersBody').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-id]');
    if(!tr) return;
    const order = allOrders.find(o => o.id === tr.dataset.id);
    if(!order) return;
    Modal.open({
      title: order.id,
      bodyHtml: `
        <dl>
          <dt>Customer</dt><dd>${order.customer}</dd>
          <dt>Email</dt><dd>${order.email}</dd>
          <dt>Date</dt><dd>${formatDate(order.date)}</dd>
          <dt>Channel</dt><dd>${order.channel}</dd>
          <dt>Items</dt><dd>${order.items}</dd>
          <dt>Amount</dt><dd>${formatCurrency(order.amount)}</dd>
          <dt>Status</dt><dd><span class="badge ${order.status}">${STATUS_LABEL[order.status]}</span></dd>
        </dl>`,
      footButtons: [
        { label:'Close', className:'btn-secondary' },
        { label:'Resend receipt', className:'btn-primary', onClick: () => Toast.success('Receipt sent', `Emailed to ${order.email}`) },
      ]
    });
  });

  /* ============================== Settings page actions ========================= */
  document.getElementById('saveProfileBtn').addEventListener('click', () => {
    const name = document.getElementById('settingsName').value.trim() || 'Hedra';
    const role = document.getElementById('settingsRole').value.trim() || 'Product Admin';
    const profile = { name, role };
    Store.set({ profile });
    updateProfileUI(profile);
    Toast.success('Profile updated', 'Your changes have been saved.');
  });

  document.getElementById('resetDataBtn').addEventListener('click', () => {
    Modal.open({
      title: 'Reset dashboard data?',
      bodyHtml: `<p>This clears saved preferences from this browser (theme, sidebar state, profile edits) and reloads the demo with fresh fake data. This can't be undone.</p>`,
      footButtons: [
        { label:'Cancel', className:'btn-secondary' },
        { label:'Reset data', className:'btn-danger', onClick: () => {
            Store.reset();
            Toast.info('Data reset', 'Reloading dashboard…');
            setTimeout(() => location.reload(), 700);
          } },
      ]
    });
  });

  /* ==================================== Boot ==================================== */
  async function boot(){
    await Promise.all([ loadStats(), loadSalesChart(30), loadDonut(), loadOrders(), loadNotifications() ]);
    setTimeout(() => Toast.info('Welcome back, ' + Store.get().profile.name.split(' ')[0], 'Your dashboard data has finished loading.'), 500);
  }
  boot();

})();
