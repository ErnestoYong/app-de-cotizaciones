// Cálculo de la lista de equipos y la cotización.
// Regla: línea = tarifa diaria × días × unidades. El precio de compra nunca se usa aquí.

export function indexarCatalogo(catalogo) {
  const porId = new Map();
  for (const eq of catalogo.equipos) porId.set(eq.id, eq);
  return porId;
}

// Unidades que se cobran de un elemento colocado. Las pantallas LED se cobran por m².
export function unidadesCobradas(elemento, equipo) {
  const cantidad = Number(elemento.cantidad) || 0;
  if (equipo.unidad_cobro === 'm²' && elemento.medidas_m) {
    const area = (Number(elemento.medidas_m.ancho) || 0) * (Number(elemento.medidas_m.alto) || 0);
    return Math.round(area * 100) / 100;
  }
  return cantidad;
}

export function tarifaDelProyecto(proyecto, equipo) {
  const ajuste = (proyecto.ajustes_tarifa || []).find(a => a.equipo_id === equipo.id);
  if (ajuste && ajuste.tarifa_renta_dia_usd != null) {
    return { tarifa: Number(ajuste.tarifa_renta_dia_usd), ajustada: true };
  }
  return { tarifa: Number(equipo.tarifa_renta_dia_usd) || 0, ajustada: false };
}

// Agrupa elementos colocados y líneas extra por equipo.
export function listaDeEquipos(proyecto, porId) {
  const grupos = new Map();
  const agregar = (equipoId, unidades, etiqueta) => {
    const equipo = porId.get(equipoId);
    if (!equipo) return;
    const g = grupos.get(equipoId) || { equipo, unidades: 0, etiquetas: [] };
    g.unidades += unidades;
    if (etiqueta) g.etiquetas.push(etiqueta);
    grupos.set(equipoId, g);
  };
  for (const el of proyecto.elementos || []) {
    const equipo = porId.get(el.equipo_id);
    if (equipo) agregar(el.equipo_id, unidadesCobradas(el, equipo), el.etiqueta);
  }
  for (const ex of proyecto.lineas_extra || []) agregar(ex.equipo_id, Number(ex.cantidad) || 0, null);
  return [...grupos.values()].sort((a, b) =>
    a.equipo.categoria.localeCompare(b.equipo.categoria, 'es') || a.equipo.modelo.localeCompare(b.equipo.modelo, 'es'));
}

export function cotizar(proyecto, catalogo) {
  const porId = indexarCatalogo(catalogo);
  const dias = Math.max(0, Number(proyecto.dias_renta) || 0);
  const lineas = listaDeEquipos(proyecto, porId).map(g => {
    const { tarifa, ajustada } = tarifaDelProyecto(proyecto, g.equipo);
    return {
      equipo_id: g.equipo.id,
      modelo: g.equipo.modelo,
      categoria: g.equipo.categoria,
      unidad_cobro: g.equipo.unidad_cobro,
      unidades: g.unidades,
      dias,
      tarifa,
      ajustada,
      es_ejemplo: g.equipo.tarifa_renta_estado === 'ejemplo' && !ajustada,
      subtotal: redondear(tarifa * dias * g.unidades),
    };
  });
  const subtotal = redondear(lineas.reduce((s, l) => s + l.subtotal, 0));
  const tasa = proyecto.impuesto && proyecto.impuesto.tasa != null ? Number(proyecto.impuesto.tasa) : null;
  const impuesto = tasa == null ? null : redondear(subtotal * tasa / 100);
  return {
    lineas,
    subtotal,
    impuesto,
    tasa,
    total: impuesto == null ? subtotal : redondear(subtotal + impuesto),
    hay_ejemplos: lineas.some(l => l.es_ejemplo),
  };
}

function redondear(n) {
  return Math.round(n * 100) / 100;
}

export function formatoUSD(n) {
  return 'US$' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
