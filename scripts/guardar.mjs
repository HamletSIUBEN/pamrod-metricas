// Uso: node scripts/guardar.mjs perfil.json [reels.json]
//   perfil.json: lo que dejó scripts/leer-perfil.js en window.__lectura
//   reels.json:  lo que dejó scripts/leer-reels.js en window.__lectura (opcional)
// Si el perfil no se pudo leer, usa "-" en su lugar: node scripts/guardar.mjs - reels.json
// Sin ninguna lectura válida: node scripts/guardar.mjs --fallo "motivo"
import { readFile, writeFile } from 'node:fs/promises';

const DIR = new URL('../data/', import.meta.url);
const leer = async (f) => JSON.parse(await readFile(new URL(f, DIR), 'utf8'));
const guardar = (f, d) => writeFile(new URL(f, DIR), JSON.stringify(d, null, 1) + '\n');
const hoy = new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10); // hora de RD
const estado = { ultimo_intento: new Date().toISOString(), ok: false, metodo: 'ninguno', mensaje: '' };

async function fallo(msg) {
  estado.mensaje = msg;
  await guardar('estado.json', estado);
  console.log(JSON.stringify(estado));
  process.exit(0);
}

if (process.argv[2] === '--fallo') await fallo(process.argv.slice(3).join(' ') || 'No se pudo leer el perfil');

const abrir = async (ruta) => (ruta && ruta !== '-' ? JSON.parse(await readFile(ruta, 'utf8')) : null);
const perfil = await abrir(process.argv[2]);
const lecturaReels = await abrir(process.argv[3]);
const diario = await leer('ig_diario.json');
const posts = await leer('ig_posts.json');

// Seguidores. Un "16K" sin decimal redondea demasiado: se ignora si el último conteo está a menos de 1,000.
let seg = perfil && Number.isFinite(perfil.seguidores) ? perfil.seguidores : null;
const previo = diario.filter((d) => d.seguidores !== null && d.fecha !== hoy).pop();
if (seg !== null && perfil.seguidores_texto && /K$/i.test(perfil.seguidores_texto) && !/\./.test(perfil.seguidores_texto) && previo && Math.abs(previo.seguidores - seg) < 1000) seg = null;
const pubs = perfil && Number.isFinite(perfil.publicaciones) ? perfil.publicaciones : null;

const leidas = [...((perfil && perfil.posts) || []), ...((lecturaReels && lecturaReels.reels) || [])];
if (seg === null && pubs === null && !leidas.length) await fallo('La página abrió pero no mostró datos (posible muro de inicio de sesión)');

if (seg !== null || pubs !== null) {
  const fila = { fecha: hoy, seguidores: seg, seguidores_texto: perfil.seguidores_texto ?? null, publicaciones: pubs, fuente: 'Perfil público de Instagram' };
  const i = diario.findIndex((d) => d.fecha === hoy);
  if (i >= 0) diario[i] = fila; else diario.push(fila);
  diario.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

let nuevas = 0;
for (const n of leidas) {
  if (!n.codigo) continue;
  const p = posts.find((x) => x.codigo === n.codigo);
  if (p) {
    for (const k of ['me_gusta', 'comentarios', 'fijada', 'vistas', 'vistas_texto', 'fecha']) if (n[k] !== null && n[k] !== undefined) p[k] = n[k];
    if (n.texto && (!p.texto || n.texto.length > p.texto.length)) p.texto = n.texto;
    if (n.url) p.url = n.url;
    p.revisado = hoy;
  } else if (n.fecha) {
    posts.push({ codigo: n.codigo, url: n.url, tipo: n.tipo, fecha: n.fecha, me_gusta: n.me_gusta ?? null, comentarios: n.comentarios ?? null, vistas: n.vistas ?? null, vistas_texto: n.vistas_texto ?? null, texto: n.texto || '', fijada: !!n.fijada, revisado: hoy });
    nuevas++;
  }
}
posts.sort((a, b) => b.fecha.localeCompare(a.fecha));

const conVistas = ((lecturaReels && lecturaReels.reels) || []).filter((r) => Number.isFinite(r.vistas)).length;
estado.ok = true;
estado.metodo = 'navegador';
estado.mensaje = `Seguidores: ${perfil?.seguidores_texto ?? '—'} · publicaciones leídas: ${leidas.length} · reels con vistas: ${conVistas} · nuevas: ${nuevas}`;
await guardar('ig_diario.json', diario);
await guardar('ig_posts.json', posts);
await guardar('estado.json', estado);
console.log(JSON.stringify(estado));
