/**
 * api.js
 * ------------------------------------------------------------------
 * A fake backend. Every "endpoint" returns a Promise and resolves
 * after a randomised delay, so the rest of the app can be written
 * exactly as if it were talking to a real REST API. All data below
 * is treated as a JSON payload (deep-cloned on every call) — the
 * "database" for this demo.
 * ------------------------------------------------------------------
 */
const Api = (() => {

  const NAMES = [
    'Amelia Clarke','Youssef Nabil','Priya Nair','Marcus Chen','Sofia Rossi',
    'Daniel Osei','Layla Haddad','Tom Fischer','Ines Duarte','Kenji Sato',
    'Fatima Zahra','Owen Brooks','Nadia Petrov','Liam O\'Connor','Aya Tanaka',
    'Carlos Mendez','Grace Kim','Omar Farouk','Elena Popescu','Noah Bergström'
  ];
  const STATUSES = ['paid','paid','paid','pending','paid','refunded','failed','paid'];
  const CHANNELS = ['Web','iOS App','Android App','Marketplace'];

  function seededRandom(seed){
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  function pad(n){ return String(n).padStart(4,'0'); }

  function buildOrders(count = 84){
    const rnd = seededRandom(42);
    const orders = [];
    const now = new Date('2026-08-02T09:00:00');
    for(let i=0;i<count;i++){
      const daysAgo = Math.floor(rnd()*45);
      const date = new Date(now); date.setDate(date.getDate()-daysAgo);
      const name = NAMES[Math.floor(rnd()*NAMES.length)];
      orders.push({
        id: `#NB-${pad(3050+i)}`,
        customer: name,
        email: name.toLowerCase().replace(/[^a-z]+/g,'.') + '@mail.com',
        date: date.toISOString().slice(0,10),
        amount: Math.round((rnd()*480+18) * 100) / 100,
        status: STATUSES[Math.floor(rnd()*STATUSES.length)],
        channel: CHANNELS[Math.floor(rnd()*CHANNELS.length)],
        items: Math.ceil(rnd()*5)
      });
    }
    return orders.sort((a,b)=> new Date(b.date)-new Date(a.date));
  }

  const DB = {
    orders: buildOrders(),
    stats: {
      revenue: { value: 128430.52, delta: 12.4, spark: [22,26,24,30,28,34,38,36,42,40,46,52,48,55,60] },
      orders:  { value: 2384, delta: 8.1, spark: [12,14,13,15,17,16,19,18,21,20,23,25,24,27,29] },
      activeUsers: { value: 9532, delta: -3.2, spark: [40,42,39,41,38,36,37,35,33,34,32,31,30,29,28] },
      conversion: { value: 4.62, delta: 1.9, spark: [3.8,3.9,4.0,3.95,4.1,4.2,4.15,4.3,4.35,4.4,4.5,4.45,4.55,4.6,4.62] }
    },
    salesSeries: {
      7:  { labels:['Wed','Thu','Fri','Sat','Sun','Mon','Tue'], revenue:[14,18,16,22,19,26,24], refunds:[1,2,1,3,2,1,2] },
      30: null, // generated below
      90: null
    },
    traffic: [
      { label:'Organic search', value:38, color:'var(--accent)' },
      { label:'Direct', value:24, color:'var(--accent-2)' },
      { label:'Social', value:19, color:'var(--warning)' },
      { label:'Referral', value:12, color:'#8B7CF6' },
      { label:'Email', value:7, color:'var(--danger)' }
    ],
    notifications: [
      { id:1, type:'order', title:'New order received', body:'Amelia Clarke just placed order #NB-3131 ($214.00)', time:'2m ago', unread:true },
      { id:2, type:'warn',  title:'Payment failed', body:'Card declined for order #NB-3098 — customer notified', time:'41m ago', unread:true },
      { id:3, type:'ok',    title:'Payout completed', body:'$18,204.11 was deposited to your connected account', time:'3h ago', unread:true },
      { id:4, type:'order', title:'Refund processed', body:'Order #NB-3070 refunded to Kenji Sato', time:'6h ago', unread:false },
      { id:5, type:'ok',    title:'Weekly report ready', body:'Your analytics summary for last week is available', time:'1d ago', unread:false }
    ]
  };

  // generate longer-range synthetic series from the 7-day one
  function genSeries(days){
    const rnd = seededRandom(days * 7);
    const labels = [], revenue = [], refunds = [];
    const now = new Date('2026-08-02T09:00:00');
    for(let i=days-1;i>=0;i--){
      const d = new Date(now); d.setDate(d.getDate()-i);
      labels.push(d.toLocaleDateString('en-US',{month:'short', day:'numeric'}));
      const base = 14 + Math.sin(i/4) * 6 + rnd()*10;
      revenue.push(Math.round(base*10)/10);
      refunds.push(Math.round((rnd()*3)*10)/10);
    }
    return { labels, revenue, refunds };
  }
  DB.salesSeries[30] = genSeries(30);
  DB.salesSeries[90] = genSeries(90);

  function delay(min=280, max=650){
    return new Promise(res => setTimeout(res, min + Math.random()*(max-min)));
  }
  function clone(x){ return JSON.parse(JSON.stringify(x)); }

  return {
    async getStats(){ await delay(300,500); return clone(DB.stats); },
    async getOrders(){ await delay(400,700); return clone(DB.orders); },
    async getSalesSeries(range){ await delay(250,450); return clone(DB.salesSeries[range] || DB.salesSeries[30]); },
    async getTraffic(){ await delay(250,400); return clone(DB.traffic); },
    async getNotifications(){ await delay(150,300); return clone(DB.notifications); },
    async search(query){
      await delay(120,260);
      const q = query.trim().toLowerCase();
      if(!q) return [];
      return DB.orders
        .filter(o => o.id.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q) || o.email.toLowerCase().includes(q))
        .slice(0,8)
        .map(o => ({ id:o.id, title:o.customer, subtitle:`${o.id} · $${o.amount.toFixed(2)}` }));
    }
  };
})();
