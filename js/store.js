/**
 * store.js
 * ------------------------------------------------------------------
 * Minimal reactive-ish store. Holds UI preferences that should
 * survive a page reload (theme, sidebar state, profile edits, read
 * notifications) inside localStorage, plus a tiny pub/sub so other
 * modules can react to changes without tight coupling.
 * ------------------------------------------------------------------
 */
const Store = (() => {
  const KEY = 'northbeam.dashboard.v1';

  const defaults = {
    theme: 'dark',
    sidebarCollapsed: false,
    profile: { name: 'Hedra', role: 'Product Admin' },
    readNotifications: [],
    tablePageSize: 8
  };

  function load(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return { ...defaults };
      return { ...defaults, ...JSON.parse(raw) };
    }catch(e){
      console.warn('Store: failed to read localStorage, falling back to defaults', e);
      return { ...defaults };
    }
  }

  let state = load();
  const listeners = new Set();

  function persist(){
    try{
      localStorage.setItem(KEY, JSON.stringify(state));
    }catch(e){
      console.warn('Store: failed to write localStorage', e);
    }
  }

  function notify(patch){
    listeners.forEach(fn => fn(state, patch));
  }

  return {
    get(){ return state; },
    set(patch){
      state = { ...state, ...patch };
      persist();
      notify(patch);
    },
    subscribe(fn){
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    reset(){
      state = { ...defaults };
      persist();
      notify(state);
    }
  };
})();
