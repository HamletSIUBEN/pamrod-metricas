// Carga los datos de la carpeta data/ y ofrece la misma interfaz `dash` que usa el tablero.
(function () {
  const FILES = {
    ig_diario: 'data/ig_diario.json',
    ig_posts: 'data/ig_posts.json',
    seguimiento: 'data/seguimiento.json',
    metas: 'data/metas.json',
    estado: 'data/estado.json',
  };
  const store = {};
  const calcs = {};
  const order = [];
  const subs = [];
  Object.keys(FILES).forEach((k) => (store[k] = { status: 'loading', data: [] }));

  function notify() { subs.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); }
  function runCalcs() {
    order.forEach((id) => {
      const c = calcs[id];
      const ins = c.inputs.map((i) => store[i] || { status: 'missing' });
      if (ins.some((s) => s.status === 'error' || s.status === 'missing')) store[id] = { status: 'error', data: [] };
      else if (ins.every((s) => s.status === 'ok')) {
        try { store[id] = { status: 'ok', data: c.fn(...ins.map((s) => s.data)) }; }
        catch (e) { console.error(id, e); store[id] = { status: 'error', data: [], message: e.message }; }
      }
    });
  }

  window.dash = {
    colors: ['#2f6bff', '#ff3d8b', '#ffb400', '#8b5cf6', '#10b981', '#0ea5e9', '#f97316', '#64748b'],
    data(id) { return store[id] || { status: 'missing', data: [] }; },
    calc(id, def) { calcs[id] = def; order.push(id); store[id] = { status: 'loading', data: [] }; },
    onData(fn) { subs.push(fn); try { fn(); } catch (e) { console.error(e); } },
    setLink(name) { try { history.replaceState(null, '', '#' + name); } catch (e) { /* sin historial */ } },
    params() { return {}; }, setParams() {}, resetParams() {}, refresh() {}, loader() {},
  };

  const bust = '?v=' + Date.now();
  Promise.all(Object.entries(FILES).map(([id, url]) =>
    fetch(url + bust, { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((d) => { store[id] = { status: 'ok', data: d }; })
      .catch(() => { store[id] = { status: 'error', data: [] }; })
  )).then(() => { runCalcs(); notify(); });

  let w = window.innerWidth;
  let t;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(() => { if (Math.abs(window.innerWidth - w) > 16) { w = window.innerWidth; notify(); } }, 150);
  });
})();
