# Métricas de @pamrod

Tablero de Instagram de Pamela Rodríguez. Se abre con un enlace, sin iniciar sesión.

**Enlace:** https://hamletsiuben.github.io/pamrod-metricas/

## Cómo se actualiza

- **Cada día a las 5:00 a. m. (hora de RD)** GitHub lee el perfil público `instagram.com/pamrod`: seguidores, número de publicaciones, y me gusta y comentarios de las publicaciones visibles. Las nuevas se agregan solas.
- **Para actualizar al momento** (por ejemplo, justo después de publicar): pestaña **Actions** → **Actualizar métricas** → **Run workflow**.
- Si un día Instagram bloquea la lectura, el tablero lo avisa en la franja de arriba y se reintenta al día siguiente.

## Lo que solo ve Pamela

Vistas de 30 días, compartidos, guardados, retención y % de no seguidores no son públicos. Se cargan cada domingo desde sus capturas en `data/seguimiento.json` (una fila por domingo):

```json
{"fecha": "2026-11-01", "vistas_30d_ig": 80000, "compartidos_prom_reel": 12, "guardados_prom_reel": 9, "retencion_3s": 0.62, "pct_no_seguidores": 0.41, "mensajes_directos": 15, "seguidores_nuevos_semana": 180, "nota": ""}
```

Los porcentajes van de 0 a 1 (62 % = 0.62).

## Archivos

- `index.html`, `app.js`, `calcs.js`, `shim.js`: la página.
- `data/`: los datos. `metas.json` tiene las metas del plan de marca.
- `scripts/actualizar.mjs`: el lector del perfil público.
- `.github/workflows/actualizar.yml`: la tarea diaria y la publicación en GitHub Pages.
