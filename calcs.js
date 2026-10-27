// Cálculos del tablero. Cada dash.calc toma datasets de data/ y devuelve filas.
(function () {
  const sinAcentos = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  // El primer tema que coincide gana; el orden importa.
  const TEMAS = [
    ['Marcas', ['powered by', '#ad ', 'publicidad', 'patrocin', 'codigo de descuento', 'descuento', 'colaboracion pagada', 'suplemento']],
    ['Running', ['running', 'correr', 'corr', ' km', 'maraton', '5k', '10k', '21k', 'sdc', 'tenis', 'carrera', ' run']],
    ['HYROX y fuerza', ['hyrox', 'wall ball', 'gym', 'fuerza', 'pesas', 'entren', 'pft', 'sled', 'burpee', 'crossfit', 'coach']],
    ['Baile', ['zumba', 'baile', 'bailar', 'dance', 'coreo', 'latin']],
    ['Bienestar', ['rutina', 'comida', 'skincare', 'cabello', 'recuper', 'descanso', 'salud', 'estres', 'grwm', 'hidrat']],
    ['Mentalidad', ['version', 'miedo', 'nunca es tarde', 'logr', 'miro atras', 'proceso', 'suen', 'dias buenos', 'historia', 'gracias']],
  ];
  const tema = (texto) => {
    const t = ' ' + sinAcentos(texto) + ' ';
    for (const [nombre, claves] of TEMAS) if (claves.some((k) => t.includes(k))) return nombre;
    return 'Humor y día a día';
  };
  const mediana = (arr) => {
    const v = arr.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  };
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const diaDe = (f) => DIAS[new Date(f + 'T12:00:00Z').getUTCDay()];
  const ultimaRevision = (ig_diario, ig_posts) => [...ig_diario.map((d) => d.fecha), ...ig_posts.map((p) => p.revisado || p.fecha)].sort().pop();
  const restarDias = (f, n) => new Date(Date.parse(f) - n * 864e5).toISOString().slice(0, 10);
  const etiqueta = (x) => (x === null ? null : x >= 5 ? 'Viral' : x >= 1.5 ? 'Arriba' : x >= 0.67 ? 'Normal' : 'Abajo');
  window.PRA = { tema, mediana, DIAS, diaDe };

  dash.calc('ig_ultimo', {
    title: 'Seguidores al último día revisado',
    inputs: ['ig_diario'],
    fn: (ig_diario) => {
      const s = ig_diario.filter((x) => Number.isFinite(x.seguidores)).sort((a, b) => a.fecha.localeCompare(b.fecha));
      const last = s[s.length - 1];
      const prev = s[s.length - 2];
      const p = ig_diario.filter((x) => Number.isFinite(x.publicaciones)).sort((a, b) => a.fecha.localeCompare(b.fecha)).pop();
      return [{
        fecha: last ? last.fecha : null,
        seguidores: last ? last.seguidores : null,
        seguidores_texto: last ? last.seguidores_texto : null,
        fecha_anterior: prev ? prev.fecha : null,
        cambio: last && prev ? last.seguidores - prev.seguidores : null,
        publicaciones: p ? p.publicaciones : null,
      }];
    },
  });

  // Cada publicación con su tema, su comparación contra lo normal de ella, enganche y conversación.
  dash.calc('posts_calc', {
    title: 'Publicaciones analizadas',
    inputs: ['ig_posts', 'ig_diario'],
    fn: (ig_posts, ig_diario) => {
      const hasta = ultimaRevision(ig_diario, ig_posts);
      const desde = restarDias(hasta, 90);
      const reciente = ig_posts.filter((p) => p.fecha > desde);
      const normalReel = mediana(reciente.filter((p) => p.tipo === 'Reel').map((p) => Number(p.vistas)));
      const normalPost = mediana(reciente.filter((p) => p.tipo !== 'Reel').map((p) => Number(p.me_gusta)));
      return ig_posts.map((p) => {
        const vistas = Number.isFinite(Number(p.vistas)) && p.vistas !== null ? Number(p.vistas) : null;
        const likes = Number(p.me_gusta) || 0;
        const com = Number(p.comentarios) || 0;
        let indice = null;
        let base = null;
        if (p.tipo === 'Reel' && vistas !== null && normalReel) { indice = vistas / normalReel; base = 'vistas'; }
        else if (p.tipo !== 'Reel' && normalPost) { indice = likes / normalPost; base = 'me gusta'; }
        return {
          ...p,
          tema: tema(p.texto),
          dia: diaDe(p.fecha),
          vistas,
          indice: indice === null ? null : Math.round(indice * 100) / 100,
          indice_base: base,
          etiqueta: etiqueta(indice),
          enganche: vistas ? Math.round(((likes + com) / vistas) * 10000) / 10000 : null,
          conversacion: likes ? Math.round((com / likes) * 1000) / 10 : null,
        };
      });
    },
  });

  dash.calc('kpi', {
    title: 'Indicadores de los últimos 30 días',
    inputs: ['posts_calc', 'ig_diario'],
    fn: (posts, ig_diario) => {
      const hasta = ultimaRevision(ig_diario, posts);
      const desde = restarDias(hasta, 30);
      const p30 = posts.filter((p) => p.fecha > desde && p.fecha <= hasta);
      const r30 = p30.filter((p) => p.tipo === 'Reel' && p.vistas !== null);
      const r90 = posts.filter((p) => p.tipo === 'Reel' && p.vistas !== null && p.fecha > restarDias(hasta, 90));
      return [{
        desde, hasta,
        publicaciones_30d: p30.length,
        por_semana: Math.round((p30.length / (30 / 7)) * 10) / 10,
        reels_30d: r30.length,
        vistas_reels_30d: r30.reduce((a, p) => a + p.vistas, 0),
        reel_normal: Math.round(mediana(r90.map((p) => p.vistas)) || 0),
        enganche_normal: mediana(r90.map((p) => p.enganche)),
        conversacion_normal: mediana(p30.map((p) => p.conversacion)),
      }];
    },
  });

  dash.calc('por_tema', {
    title: 'Vistas por tema',
    inputs: ['posts_calc'],
    fn: (posts) => {
      const reels = posts.filter((p) => p.tipo === 'Reel' && p.vistas !== null);
      const nombres = [...new Set(posts.map((p) => p.tema))];
      return nombres.map((t) => {
        const rs = reels.filter((p) => p.tema === t);
        const ps = posts.filter((p) => p.tema === t);
        return {
          tema: t,
          publicaciones: ps.length,
          reels: rs.length,
          vistas_mediana: rs.length ? Math.round(mediana(rs.map((p) => p.vistas))) : null,
          enganche_mediano: rs.length ? mediana(rs.map((p) => p.enganche)) : null,
          me_gusta_mediana: Math.round(mediana(ps.map((p) => Number(p.me_gusta))) || 0),
        };
      }).sort((a, b) => (b.vistas_mediana ?? -1) - (a.vistas_mediana ?? -1));
    },
  });

  dash.calc('por_dia', {
    title: 'Vistas por día de publicación',
    inputs: ['posts_calc'],
    fn: (posts) => {
      const orden = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
      return orden.map((d) => {
        const rs = posts.filter((p) => p.tipo === 'Reel' && p.vistas !== null && p.dia === d);
        return { dia: d, reels: rs.length, vistas_mediana: rs.length ? Math.round(mediana(rs.map((p) => p.vistas))) : null, publicaciones: posts.filter((p) => p.dia === d).length };
      });
    },
  });

  // Frases de acción a partir de los datos. Cada una dice por qué.
  dash.calc('recomendaciones', {
    title: 'Qué hacer esta semana',
    inputs: ['posts_calc', 'kpi', 'por_tema', 'por_dia'],
    fn: (posts, kpi, por_tema, por_dia) => {
      const k = kpi[0];
      const out = [];
      const fmt = (n) => Math.round(n).toLocaleString('en-US');
      const fx = (x) => (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10).toString();
      const reels = posts.filter((p) => p.tipo === 'Reel' && p.vistas !== null).sort((a, b) => b.fecha.localeCompare(a.fecha));

      const ult = reels[0];
      if (ult && ult.indice !== null) {
        if (ult.indice >= 1.5) out.push({ tipo: 'bien', titulo: 'Empuja tu último reel', texto: `"${ult.texto.slice(0, 50)}" lleva ${fmt(ult.vistas)} vistas, ${fx(ult.indice)} veces lo normal. Compártelo en historias con una encuesta y respóndele a cada comentario hoy.` });
        else if (ult.indice < 0.67) out.push({ tipo: 'ojo', titulo: 'Cambia el gancho', texto: `Tu último reel lleva ${fmt(ult.vistas)} vistas, por debajo de tu normal (${fmt(k.reel_normal)}). En el próximo, di la frase gancho en el primer segundo y ponla también en texto.` });
      }

      const temas = por_tema.filter((t) => t.reels >= 2 && t.vistas_mediana);
      if (temas.length >= 2) {
        const mejor = temas[0];
        const peor = temas[temas.length - 1];
        const r = mejor.vistas_mediana / peor.vistas_mediana;
        if (r >= 1.2) out.push({ tipo: 'idea', titulo: `Más ${mejor.tema.toLowerCase()}`, texto: `Tus reels de ${mejor.tema} tienen ${fmt(mejor.vistas_mediana)} vistas típicas, ${fx(r)} veces más que los de ${peor.tema} (${fmt(peor.vistas_mediana)}). Haz 2 de ${mejor.tema} esta semana.${mejor.reels < 4 ? ` Ojo: sale de solo ${mejor.reels} reels; se afina con más semanas.` : ''}` });
      }

      const virales = posts.filter((p) => p.etiqueta === 'Viral').sort((a, b) => b.indice - a.indice);
      if (virales.length) {
        const v = virales[0];
        out.push({ tipo: 'idea', titulo: 'Repite lo que se hizo viral', texto: `"${v.texto.slice(0, 50)}" llegó a ${fmt(v.vistas ?? v.me_gusta)} ${v.vistas ? 'vistas' : 'me gusta'} (${fx(v.indice)} veces lo normal). Rehaz la idea con otro ángulo: mismo formato, otro momento.` });
      }

      const dias = por_dia.filter((d) => d.reels >= 1 && d.vistas_mediana);
      if (dias.length >= 3) {
        const best = dias.slice().sort((a, b) => b.vistas_mediana - a.vistas_mediana)[0];
        out.push({ tipo: 'idea', titulo: `Publica el ${best.dia}`, texto: `Los reels del ${best.dia} tienen ${fmt(best.vistas_mediana)} vistas típicas, su mejor día con lo publicado hasta ahora (${best.reels} ${best.reels === 1 ? 'reel' : 'reels'}).` });
      }

      if (k.por_semana < 4) out.push({ tipo: 'ojo', titulo: 'Sube el ritmo', texto: `Va a ${k.por_semana} publicaciones por semana; el plan pide 4 (3 reels y 1 carrusel). Graba en bloque un día fijo para llegar.` });
      else out.push({ tipo: 'bien', titulo: 'Buen ritmo', texto: `Va a ${k.por_semana} publicaciones por semana, igual o por encima de las 4 del plan.` });

      if (k.conversacion_normal !== null && k.conversacion_normal < 8) out.push({ tipo: 'ojo', titulo: 'Más conversación', texto: `Recibe ${fx(k.conversacion_normal)} comentarios por cada 100 me gusta. Cierra cada video con una pregunta concreta ("¿A qué edad empezaste tú?") y responde en la primera hora.` });

      return out.slice(0, 4).map((r, i) => ({ n: i + 1, ...r }));
    },
  });

  dash.calc('ultimo', {
    title: 'Último valor de sus estadísticas',
    inputs: ['seguimiento'],
    fn: (seguimiento) => {
      const rows = seguimiento.slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
      const keys = ['vistas_30d_ig', 'compartidos_prom_reel', 'guardados_prom_reel', 'retencion_3s', 'pct_no_seguidores', 'mensajes_directos', 'seguidores_nuevos_semana'];
      return keys.map((k) => {
        const has = rows.filter((r) => r[k] !== null && r[k] !== undefined && r[k] !== '');
        const last = has[has.length - 1];
        const prev = has[has.length - 2];
        return { metrica: k, valor: last ? Number(last[k]) : null, fecha: last ? last.fecha : null, fecha_anterior: prev ? prev.fecha : null, cambio: last && prev ? Number(last[k]) - Number(prev[k]) : null };
      });
    },
  });

  dash.calc('progreso', {
    title: 'Avance hacia cada meta',
    inputs: ['ig_diario', 'seguimiento', 'metas'],
    fn: (ig_diario, seguimiento, metas) => {
      const s = ig_diario.filter((x) => Number.isFinite(x.seguidores)).sort((a, b) => a.fecha.localeCompare(b.fecha)).pop();
      const v = seguimiento.filter((x) => x.vistas_30d_ig !== null && x.vistas_30d_ig !== undefined && x.vistas_30d_ig !== '').sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))).pop();
      return metas.map((m) => {
        const meta = Number(m.seguidores_min);
        const actual = s ? s.seguidores : null;
        const semanas = s ? Math.max(1, Math.round((Date.parse(m.fecha) - Date.parse(s.fecha)) / 864e5 / 7)) : null;
        const faltan = actual === null ? null : Math.max(0, meta - actual);
        const vistas = v ? Number(v.vistas_30d_ig) : null;
        return {
          id: m.id, plazo: m.plazo, fecha: m.fecha, meta_seguidores: meta,
          avance: actual === null ? null : Math.round((actual / meta) * 1000) / 1000,
          faltan, semanas, por_semana: faltan === null ? null : Math.ceil(faltan / semanas),
          meta_vistas: Number(m.vistas_30d),
          avance_vistas: vistas === null ? null : Math.round((vistas / Number(m.vistas_30d)) * 1000) / 1000,
          otra_meta: m.otra_meta,
        };
      });
    },
  });
})();
