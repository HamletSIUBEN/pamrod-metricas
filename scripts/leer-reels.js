// Se ejecuta DENTRO de una pestaña abierta en https://www.instagram.com/pamrod/reels/
// (sin iniciar sesión). Deja en window.__lectura un texto JSON con las vistas públicas de cada reel,
// más me gusta, comentarios, fecha y texto de cada uno.
(async () => {
  const dec = (s) => { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; };
  const num = (txt) => {
    if (!txt) return null;
    const m = String(txt).trim().replace(/,/g, '').match(/^([\d.]+)\s*([KkMm])?$/);
    if (!m) return null;
    return Math.round(parseFloat(m[1]) * (m[2] ? (m[2].toLowerCase() === 'k' ? 1e3 : 1e6) : 1));
  };
  const MESES = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };
  const iso = (s) => { const m = s.match(/([A-Za-z]+) (\d+), (\d{4})/); return m ? `${m[3]}-${String(MESES[m[1]]).padStart(2, '0')}-${m[2].padStart(2, '0')}` : null; };
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  await espera(3000);
  // Desplaza un poco para que cargue una segunda fila de reels, si Instagram lo permite.
  for (let i = 0; i < 2; i++) { window.scrollTo(0, document.body.scrollHeight); await espera(1500); }

  const vistos = new Map();
  for (const a of document.querySelectorAll('a[href*="/reel/"]')) {
    const href = a.getAttribute('href');
    if (vistos.has(href)) continue;
    const t = (a.innerText || '').replace(/\s+/g, ' ').trim().match(/[\d.,]+[KM]?/);
    vistos.set(href, t ? t[0] : null);
  }
  const reels = [];
  for (const [href, vtxt] of vistos) {
    const partes = href.split('/').filter(Boolean);
    const codigo = partes[partes.length - 1];
    const r = { codigo, url: 'https://www.instagram.com' + href, tipo: 'Reel', vistas: num(vtxt), vistas_texto: vtxt };
    try {
      const h = await (await fetch(href)).text();
      const d = dec((h.match(/<meta (?:property="og:description"|name="description") content="([^"]+)"/) || [])[1] || '');
      const x = d.match(/^([\d.,]+[KM]?) likes?, ([\d.,]+[KM]?) comments? - \S+ on ([A-Za-z]+ \d+, \d{4}): "?([\s\S]*)/);
      if (x) Object.assign(r, { fecha: iso(x[3]), me_gusta: num(x[1]), comentarios: num(x[2]), texto: x[4].replace(/"\.\s*$/, '').replace(/\s+/g, ' ').trim().slice(0, 140) });
    } catch (e) { /* queda solo con las vistas */ }
    reels.push(r);
    await espera(400);
  }
  window.__lectura = JSON.stringify({ reels });
  return 'LISTO ' + window.__lectura.length;
})();
