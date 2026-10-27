dash.calc('ig_ultimo', {
  title: 'Seguidores al último día revisado',
  description: 'El último conteo de seguidores y publicaciones del perfil público, el anterior y su cambio.',
  inputs: ['ig_diario'],
  fn: (ig_diario) => {
    const r = ig_diario.slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    const s = r.filter((x) => x.seguidores !== null && x.seguidores !== undefined && x.seguidores !== '');
    const last = s[s.length - 1];
    const prev = s[s.length - 2];
    const p = r.filter((x) => x.publicaciones !== null && x.publicaciones !== undefined && x.publicaciones !== '');
    return [{
      fecha: last ? last.fecha : null,
      seguidores: last ? Number(last.seguidores) : null,
      seguidores_texto: last ? last.seguidores_texto : null,
      fecha_anterior: prev ? prev.fecha : null,
      cambio: last && prev ? Number(last.seguidores) - Number(prev.seguidores) : null,
      publicaciones: p.length ? Number(p[p.length - 1].publicaciones) : null,
    }];
  },
});

dash.calc('posts_calc', {
  title: 'Publicaciones con su interacción',
  description: 'Cada publicación con su interacción pública: (me gusta + comentarios) ÷ seguidores al último día revisado.',
  inputs: ['ig_posts', 'ig_diario'],
  fn: (ig_posts, ig_diario) => {
    const s = ig_diario.filter((x) => x.seguidores !== null && x.seguidores !== undefined && x.seguidores !== '').sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    const seg = s.length ? Number(s[s.length - 1].seguidores) : null;
    return ig_posts.map((p) => ({
      ...p,
      interaccion: seg ? Math.round(((Number(p.me_gusta) + Number(p.comentarios)) / seg) * 10000) / 10000 : null,
    }));
  },
});

dash.calc('kpi_posts', {
  title: 'Publicaciones de los últimos 30 días',
  description: 'Publicaciones con fecha en los 30 días antes de la última revisión: cuántas, me gusta y comentarios promedio, e interacción pública promedio.',
  inputs: ['ig_posts', 'ig_diario'],
  fn: (ig_posts, ig_diario) => {
    const fechas = ig_diario.map((d) => String(d.fecha)).sort();
    const hasta = fechas[fechas.length - 1];
    const desde = new Date(Date.parse(hasta) - 30 * 864e5).toISOString().slice(0, 10);
    const s = ig_diario.filter((x) => x.seguidores !== null && x.seguidores !== undefined && x.seguidores !== '').sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    const seg = s.length ? Number(s[s.length - 1].seguidores) : null;
    const ps = ig_posts.filter((p) => String(p.fecha) > desde && String(p.fecha) <= hasta);
    const n = ps.length;
    const likes = ps.reduce((a, p) => a + Number(p.me_gusta), 0);
    const com = ps.reduce((a, p) => a + Number(p.comentarios), 0);
    return [{
      desde,
      hasta,
      publicaciones_30d: n,
      me_gusta_prom: n ? Math.round(likes / n) : null,
      me_gusta_mediana: n ? (() => { const v = ps.map((p) => Number(p.me_gusta)).sort((a, b) => a - b); const m = Math.floor(n / 2); return n % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2); })() : null,
      comentarios_prom: n ? Math.round(com / n) : null,
      interaccion_prom: n && seg ? Math.round(((likes + com) / n / seg) * 10000) / 10000 : null,
      por_semana: Math.round((n / (30 / 7)) * 10) / 10,
    }];
  },
});

dash.calc('por_tipo', {
  title: 'Reels frente a posts',
  description: 'Me gusta y comentarios promedio por tipo de publicación, con las publicaciones revisadas.',
  inputs: ['ig_posts'],
  fn: (ig_posts) => ['Reel', 'Post'].map((tipo) => {
    const ps = ig_posts.filter((p) => p.tipo === tipo);
    return {
      tipo,
      publicaciones: ps.length,
      me_gusta_prom: ps.length ? Math.round(ps.reduce((a, p) => a + Number(p.me_gusta), 0) / ps.length) : 0,
      mediana_me_gusta: ps.length ? (() => { const v = ps.map((p) => Number(p.me_gusta)).sort((a, b) => a - b); const m = Math.floor(v.length / 2); return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2); })() : 0,
      comentarios_prom: ps.length ? Math.round(ps.reduce((a, p) => a + Number(p.comentarios), 0) / ps.length) : 0,
    };
  }),
});

dash.calc('ultimo', {
  title: 'Último valor de sus estadísticas',
  description: 'Para cada métrica que Pamela comparte de sus Estadísticas, el registro más reciente que la tiene y el anterior.',
  inputs: ['seguimiento'],
  fn: (seguimiento) => {
    const rows = seguimiento.slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    const keys = ['vistas_30d_ig', 'compartidos_prom_reel', 'guardados_prom_reel', 'retencion_3s', 'pct_no_seguidores', 'mensajes_directos', 'seguidores_nuevos_semana'];
    return keys.map((k) => {
      const has = rows.filter((r) => r[k] !== null && r[k] !== undefined && r[k] !== '');
      const last = has[has.length - 1];
      const prev = has[has.length - 2];
      return {
        metrica: k,
        valor: last ? Number(last[k]) : null,
        fecha: last ? last.fecha : null,
        fecha_anterior: prev ? prev.fecha : null,
        cambio: last && prev ? Number(last[k]) - Number(prev[k]) : null,
      };
    });
  },
});

dash.calc('progreso', {
  title: 'Avance hacia cada meta',
  description: 'Seguidores del último día revisado y vistas de 30 días de sus estadísticas, frente a cada meta del plan, con lo que falta y el ritmo semanal necesario.',
  inputs: ['ig_diario', 'seguimiento', 'metas'],
  fn: (ig_diario, seguimiento, metas) => {
    const s = ig_diario.filter((x) => x.seguidores !== null && x.seguidores !== undefined && x.seguidores !== '').sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))).pop();
    const v = seguimiento.filter((x) => x.vistas_30d_ig !== null && x.vistas_30d_ig !== undefined && x.vistas_30d_ig !== '').sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))).pop();
    return metas.map((m) => {
      const meta = Number(m.seguidores_min);
      const actual = s ? Number(s.seguidores) : null;
      const dias = s ? (Date.parse(m.fecha) - Date.parse(s.fecha)) / 864e5 : null;
      const semanas = dias === null ? null : Math.max(1, Math.round(dias / 7));
      const faltan = actual === null ? null : Math.max(0, meta - actual);
      const vistas = v ? Number(v.vistas_30d_ig) : null;
      return {
        id: m.id,
        plazo: m.plazo,
        fecha: m.fecha,
        meta_seguidores: meta,
        avance: actual === null ? null : Math.round((actual / meta) * 1000) / 1000,
        faltan,
        semanas,
        por_semana: faltan === null ? null : Math.ceil(faltan / semanas),
        meta_vistas: Number(m.vistas_30d),
        avance_vistas: vistas === null ? null : Math.round((vistas / Number(m.vistas_30d)) * 1000) / 1000,
        otra_meta: m.otra_meta,
      };
    });
  },
});
