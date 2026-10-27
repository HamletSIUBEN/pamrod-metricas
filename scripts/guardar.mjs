// Uso: node scripts/guardar.mjs lectura.json
// Toma el JSON que devolvió scripts/leer-perfil.js y lo agrega a data/.
// Sin lectura válida: node scripts/guardar.mjs --fallo "motivo"
import { readFile, writeFile } from 'node:fs/promises';

const DIR = new URL('../data/', import.meta.url);
const leer = async (f) => JSON.parse(await readFile(new URL(f, DIR), 'utf8'));
const guardar = (f, d) => writeFile(new URL(f, DIR), JSON.stringify(d, null, 1) + '\n');
const hoy = new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10); // hora de RD

const estado = { ultimo_intento: new Date().toISOString(), ok: false, metodo: 'ninguno', mensaje: '' };

if (process.argv[2] === '--fallo') {
  estado.mensaje = process.argv.slice(3).join(' ') || 'No se pudo leer el perfil';
  await guardar('estado.json', estado);
  console.log(JSON.stringify(estado));
  process.exit(0);
}

const res = JSON.parse(await readFile(process.argv[2], 'utf8'));
const diario = await leer('ig_diario.json');
const posts = await leer('ig_posts.json');

// Un "16K" sin decimal redondea demasiado: se ignora si el último conteo está a menos de 1,000.
let seg = Number.isFinite(res.seguidores) ? res.seguidores : null;
const previo = diario.filter((d) => d.seguidores !== null && d.fecha !== hoy).pop();
if (seg !== null && res.seguidores_texto && /K$/i.test(res.seguidores_texto) && !/\./.test(res.seguidores_texto) && previo && Math.abs(previo.seguidores - seg) < 1000) seg = null;

if (seg === null && !Number.isFinite(res.publicaciones) && !(res.posts || []).length) {
  estado.mensaje = 'La página abrió pero no mostró datos (posible muro de inicio de sesión)';
  await guardar('estado.json', estado);
  console.log(JSON.stringify(estado));
  process.exit(0);
}

if (seg !== null || Number.isFinite(res.publicaciones)) {
  const fila = { fecha: hoy, seguidores: seg, seguidores_texto: res.seguidores_texto ?? null, publicaciones: Number.isFinite(res.publicaciones) ? res.publicaciones : null, fuente: 'Perfil público de Instagram' };
  const i = diario.findIndex((d) => d.fecha === hoy);
  if (i >= 0) diario[i] = fila; else diario.push(fila);
  diario.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

let nuevas = 0;
for (const n of res.posts || []) {
  if (!n.codigo) continue;
  const p = posts.find((x) => x.codigo === n.codigo);
  if (p) {
    for (const k of ['me_gusta', 'comentarios', 'fijada']) if (n[k] !== null && n[k] !== undefined) p[k] = n[k];
    if (n.texto && !p.texto) p.texto = n.texto;
    p.revisado = hoy;
  } else if (n.fecha) {
    posts.push({ codigo: n.codigo, url: n.url, tipo: n.tipo, fecha: n.fecha, me_gusta: n.me_gusta, comentarios: n.comentarios, texto: n.texto, fijada: !!n.fijada, revisado: hoy });
    nuevas++;
  }
}
posts.sort((a, b) => b.fecha.localeCompare(a.fecha));

estado.ok = true;
estado.metodo = res.metodo || 'navegador';
estado.mensaje = `Seguidores: ${res.seguidores_texto ?? '—'} · publicaciones leídas: ${(res.posts || []).length} · nuevas: ${nuevas}`;
await guardar('ig_diario.json', diario);
await guardar('ig_posts.json', posts);
await guardar('estado.json', estado);
console.log(JSON.stringify(estado));
