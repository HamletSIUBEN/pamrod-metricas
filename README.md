# Métricas de @pamrod

Tablero de Instagram de Pamela Rodríguez. Se abre con un enlace, sin iniciar sesión.

**Enlace:** https://hamletsiuben.github.io/pamrod-metricas/

## Cómo se actualiza

- **Cada día a las 4:43 a. m. (hora de RD)**, para que esté listo a las 5:00, una tarea programada de Claude abre `instagram.com/pamrod` en el Chrome de Hamlet (sin iniciar sesión), lee seguidores, número de publicaciones, y me gusta y comentarios de las publicaciones visibles, y sube los datos aquí. Las publicaciones nuevas se agregan solas.
- La computadora tiene que estar encendida con Chrome abierto. Si no se pudo leer, la franja de arriba del tablero lo avisa.
- Cada cambio en `data/` vuelve a publicar la página automáticamente (Actions → **Publicar tablero**).
- Instagram bloquea las lecturas desde los servidores de GitHub (error 429), por eso la lectura se hace desde un navegador.

## Lo que solo ve Pamela

Vistas de 30 días, compartidos, guardados, retención y % de no seguidores no son públicos. Se cargan cada domingo desde sus capturas en `data/seguimiento.json` (una fila por domingo):

```json
{"fecha": "2026-11-01", "vistas_30d_ig": 80000, "compartidos_prom_reel": 12, "guardados_prom_reel": 9, "retencion_3s": 0.62, "pct_no_seguidores": 0.41, "mensajes_directos": 15, "seguidores_nuevos_semana": 180, "nota": ""}
```

Los porcentajes van de 0 a 1 (62 % = 0.62).

## Archivos

- `index.html`, `app.js`, `calcs.js`, `shim.js`: la página.
- `data/`: los datos. `metas.json` tiene las metas del plan de marca.
- `scripts/leer-perfil.js`: se ejecuta en una pestaña de `instagram.com/pamrod` y devuelve los datos públicos.
- `scripts/guardar.mjs`: agrega esa lectura a `data/`.
- `.github/workflows/actualizar.yml`: publica la página en GitHub Pages.
