// Se ejecuta DENTRO de una pestaña abierta en https://www.instagram.com/pamrod/
// (sin iniciar sesión). Devuelve un texto JSON con lo que muestra el perfil público.
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
  await new Promise((r) => setTimeout(r, 2500));

  // Seguidores: el texto visible ("16.1K followers"); si hay un title con el número exacto, se usa ese.
  const main = document.querySelector('main') || document.body;
  const txt = main.innerText;
  const fm = txt.match(/([\d.,]+[KM]?)\s+followers/i);
  let exacto = null;
  for (const el of main.querySelectorAll('[title]')) {
    if (/^[\d,.]+$/.test(el.getAttribute('title')) && el.closest('a[href*="followers"], li, section')) { exacto = num(el.getAttribute('title')); break; }
  }
  const meta = dec(document.querySelector('meta[name="description"]')?.content || '');
  const mm = meta.match(/([\d.,]+[KM]?) Followers?, ([\d.,]+[KM]?) Following, ([\d.,]+[KM]?) Posts?/i);

  const links = [...new Set([...document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')].map((a) => a.getAttribute('href')))];
  const posts = [];
  for (const l of links) {
    try {
      const h = await (await fetch(l)).text();
      const d = dec((h.match(/<meta (?:property="og:description"|name="description") content="([^"]+)"/) || [])[1] || '');
      const x = d.match(/^([\d.,]+[KM]?) likes?, ([\d.,]+[KM]?) comments? - \S+ on ([A-Za-z]+ \d+, \d{4}): "?([\s\S]*)/);
      const partes = l.split('/').filter(Boolean);
      const codigo = partes[partes.length - 1];
      const tipo = partes.includes('reel') ? 'Reel' : 'Post';
      if (x) posts.push({ codigo, url: 'https://www.instagram.com' + l, tipo, fecha: iso(x[3]), me_gusta: num(x[1]), comentarios: num(x[2]), texto: x[4].replace(/"\.\s*$/, '').replace(/\s+/g, ' ').trim().slice(0, 90) });
    } catch (e) { /* se omite esa publicación */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  // Las fijadas aparecen primero aunque sean más viejas que la siguiente.
  for (let i = 0; i < Math.min(3, posts.length - 1); i++) {
    const despues = posts.slice(i + 1).map((p) => p.fecha).filter(Boolean).sort().pop();
    posts[i].fijada = !!(posts[i].fecha && despues && posts[i].fecha < despues);
  }
  posts.forEach((p) => { if (p.fijada === undefined) p.fijada = false; });

  return JSON.stringify({
    metodo: 'navegador',
    seguidores_texto: fm ? fm[1] : (mm ? mm[1] : null),
    seguidores: exacto ?? (fm ? num(fm[1]) : null),
    publicaciones: mm ? num(mm[3]) : null,
    posts,
  });
})();
