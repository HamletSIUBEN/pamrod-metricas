// Lee el perfil público de Instagram de @pamrod y actualiza data/ig_diario.json,
// data/ig_posts.json y data/estado.json. Sin dependencias: Node 20+.
import { readFile, writeFile } from 'node:fs/promises';

const USUARIO = 'pamrod';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const DIR = new URL('../data/', import.meta.url);
// Fecha de hoy en República Dominicana (UTC-4, sin horario de verano)
const hoy = new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10);

const leer = async (f) => JSON.parse(await readFile(new URL(f, DIR), 'utf8'));
const guardar = (f, d) => writeFile(new URL(f, DIR), JSON.stringify(d, null, 1) + '\n');

function numero(txt) {
  if (txt === null || txt === undefined) return null;
  const s = String(txt).trim().replace(/,/g, '');
  const m = s.match(/^([\d.]+)\s*([KkMm])?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const mult = m[2] ? (m[2].toLowerCase() === 'k' ? 1e3 : 1e6) : 1;
  return Math.round(n * mult);
}
const fechaRD = (ts) => new Date((ts - 4 * 3600) * 1000).toISOString().slice(0, 10);
const recorte = (t, n = 90) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const decodificar = (s) => s
  .replace(/&quot;/g, '"').replace(/&#039;|&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));

async function get(url, extra = {}) {
  const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9', ...extra }, redirect: 'follow' });
  if (!r.ok) throw new Error(`${url} respondió ${r.status}`);
  return r;
}

// Método 1: la API web pública (números exactos y las últimas 12 publicaciones)
async function porApi() {
  const r = await get(`https://i.instagram.com/api/v1/users/web_profile_info/?username=${USUARIO}`, { 'x-ig-app-id': '936619743392459', accept: '*/*' });
  const j = await r.json();
  const u = j?.data?.user;
  if (!u) throw new Error('La API no devolvió el usuario');
  const posts = u.edge_owner_to_timeline_media.edges.map(({ node: n }) => ({
    codigo: n.shortcode,
    url: `https://www.instagram.com/${USUARIO}/${n.is_video ? 'reel' : 'p'}/${n.shortcode}/`,
    tipo: n.is_video ? 'Reel' : 'Post',
    fecha: fechaRD(n.taken_at_timestamp),
    me_gusta: n.edge_liked_by?.count ?? n.edge_media_preview_like?.count ?? null,
    comentarios: n.edge_media_to_comment?.count ?? null,
    reproducciones: n.video_view_count ?? null,
    texto: recorte(n.edge_media_to_caption?.edges?.[0]?.node?.text),
    fijada: Array.isArray(n.pinned_for_users) && n.pinned_for_users.length > 0,
  }));
  return { metodo: 'api', seguidores: u.edge_followed_by.count, seguidores_texto: null, publicaciones: u.edge_owner_to_timeline_media.count, posts };
}

// Método 2: las etiquetas <meta> de las páginas públicas (si la API está bloqueada)
async function porHtml(conocidos) {
  const html = await (await get(`https://www.instagram.com/${USUARIO}/`)).text();
  const meta = decodificar((html.match(/<meta (?:property="og:description"|name="description") content="([^"]+)"/) || [])[1] || '');
  const m = meta.match(/([\d.,]+[KM]?) Followers?, ([\d.,]+[KM]?) Following, ([\d.,]+[KM]?) Posts?/i);
  if (!m) throw new Error('No se encontró el conteo en la página del perfil');
  // "16K" redondea demasiado: solo se acepta si trae decimal (16.1K) o es un número exacto.
  const preciso = !/K|M/i.test(m[1]) || /\./.test(m[1]);
  const posts = [];
  for (const p of conocidos.slice(0, 24)) {
    try {
      const h = await (await get(`https://www.instagram.com/p/${p.codigo}/`)).text();
      const d = decodificar((h.match(/<meta (?:property="og:description"|name="description") content="([^"]+)"/) || [])[1] || '');
      const x = d.match(/^([\d.,]+[KM]?) likes?, ([\d.,]+[KM]?) comments?/i);
      if (x) posts.push({ codigo: p.codigo, me_gusta: numero(x[1]), comentarios: numero(x[2]) });
    } catch { /* se deja como estaba */ }
    await new Promise((r) => setTimeout(r, 800));
  }
  return { metodo: 'paginas', seguidores: preciso ? numero(m[1]) : null, seguidores_texto: m[1], publicaciones: numero(m[3]), posts };
}

const diario = await leer('ig_diario.json');
const posts = await leer('ig_posts.json');
let res = null;
const errores = [];
for (const intento of [() => porApi(), () => porHtml(posts.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)))]) {
  try { res = await intento(); break; } catch (e) { errores.push(e.message); }
}

const estado = { ultimo_intento: new Date().toISOString(), ok: false, metodo: 'ninguno', mensaje: errores.join(' | ') };
if (res && (res.seguidores !== null || res.publicaciones !== null || res.posts.length)) {
  if (res.seguidores !== null || res.publicaciones !== null) {
    const fila = { fecha: hoy, seguidores: res.seguidores, seguidores_texto: res.seguidores_texto, publicaciones: res.publicaciones, fuente: res.metodo === 'api' ? 'Perfil público de Instagram (exacto)' : 'Perfil público de Instagram' };
    const i = diario.findIndex((d) => d.fecha === hoy);
    if (i >= 0) diario[i] = fila; else diario.push(fila);
    diario.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }
  for (const n of res.posts) {
    const p = posts.find((x) => x.codigo === n.codigo);
    if (p) {
      for (const k of ['me_gusta', 'comentarios', 'reproducciones', 'fijada']) if (n[k] !== null && n[k] !== undefined) p[k] = n[k];
      if (n.texto && !p.texto) p.texto = n.texto;
      p.revisado = hoy;
    } else if (n.fecha) {
      posts.push({ ...n, revisado: hoy });
    }
  }
  posts.sort((a, b) => b.fecha.localeCompare(a.fecha));
  estado.ok = true;
  estado.metodo = res.metodo;
  estado.mensaje = `Seguidores: ${res.seguidores ?? res.seguidores_texto ?? '—'} · publicaciones revisadas: ${res.posts.length}`;
  await guardar('ig_diario.json', diario);
  await guardar('ig_posts.json', posts);
}
await guardar('estado.json', estado);
console.log(JSON.stringify(estado));
