import { Escena } from './escena.js';
import { cotizar, indexarCatalogo, formatoUSD } from './cotizacion.js';

const CLAVE_GUARDADO = 'app-cotizaciones:proyecto';

const PLANTILLAS = {
  salon: {
    nombre: 'Salón de eventos', medidas_m: { ancho: 30, largo: 50, alto: 10 },
    zonas: [
      { id: 'escenario', nombre: 'Escenario', x: 0, z: -20, ancho: 12, largo: 6, alto: 1.2 },
      { id: 'foh', nombre: 'Control (FOH)', x: 0, z: 12, ancho: 6, largo: 4, alto: 0 },
    ],
  },
  auditorio: {
    nombre: 'Auditorio / centro de convenciones', medidas_m: { ancho: 40, largo: 60, alto: 14 },
    zonas: [
      { id: 'escenario', nombre: 'Escenario', x: 0, z: -24, ancho: 20, largo: 10, alto: 1.2 },
      { id: 'publico', nombre: 'Público', x: 0, z: 4, ancho: 34, largo: 30, alto: 0 },
      { id: 'foh', nombre: 'Control (FOH)', x: 0, z: 22, ancho: 8, largo: 4, alto: 0 },
    ],
  },
  estadio: {
    nombre: 'Estadio', medidas_m: { ancho: 90, largo: 130, alto: 30 },
    zonas: [
      { id: 'cancha', nombre: 'Cancha', x: 0, z: 0, ancho: 68, largo: 105, alto: 0 },
      { id: 'escenario', nombre: 'Escenario', x: 0, z: -45, ancho: 30, largo: 12, alto: 2 },
      { id: 'control', nombre: 'Control de producción', x: 40, z: 0, ancho: 6, largo: 12, alto: 0 },
    ],
  },
};

const estado = { catalogo: null, porId: null, proyecto: null, seleccionado: null, presentando: false };
const $ = (s) => document.querySelector(s);

// ---------- Inicio ----------
async function iniciar() {
  estado.catalogo = await (await fetch('datos/catalogo.json')).json();
  estado.porId = indexarCatalogo(estado.catalogo);

  estado.escena = new Escena($('#visor'), {
    alSeleccionar: seleccionar,
    alMover: (id, { x, z }) => {
      const el = elemento(id);
      if (el) { el.posicion.x = x; el.posicion.z = z; guardar(); pintarSeleccion(); }
    },
  });

  const guardado = leerGuardado();
  cargarProyecto(guardado || await (await fetch('datos/proyecto-ejemplo.json')).json());

  conectarControles();
  pintarCatalogo();
}

function leerGuardado() {
  try {
    const t = localStorage.getItem(CLAVE_GUARDADO);
    return t ? JSON.parse(t) : null;
  } catch { return null; }
}

function guardar() {
  try { localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(estado.proyecto)); } catch { /* sin almacenamiento */ }
  pintarCotizacion();
}

function cargarProyecto(p) {
  p.elementos ||= []; p.lineas_extra ||= []; p.ajustes_tarifa ||= []; p.conexiones ||= [];
  p.personal ||= []; p.cronograma ||= [];
  p.impuesto ||= { nombre: 'Impuesto', tasa: null };
  estado.proyecto = p;
  estado.seleccionado = null;
  estado.escena.dibujarRecinto(p.recinto);
  estado.escena.vista('general');
  refrescar();
  pintarProyecto();
}

function refrescar() {
  estado.escena.sincronizar(estado.proyecto, estado.porId);
  pintarSeleccion();
  guardar();
}

const elemento = (id) => estado.proyecto.elementos.find(e => e.id === id);

// ---------- Catálogo ----------
function pintarCatalogo() {
  const filtro = $('#buscar').value.trim().toLowerCase();
  const cat = $('#filtro-categoria').value;
  const sel = $('#filtro-categoria');
  if (sel.options.length === 1) {
    [...new Set(estado.catalogo.equipos.map(e => e.categoria))].sort((a, b) => a.localeCompare(b, 'es'))
      .forEach(c => sel.add(new Option(c, c)));
  }
  const lista = $('#lista-catalogo');
  lista.innerHTML = '';
  for (const eq of estado.catalogo.equipos) {
    if (cat && eq.categoria !== cat) continue;
    if (filtro && !(`${eq.modelo} ${eq.fabricante} ${eq.categoria}`.toLowerCase().includes(filtro))) continue;
    const li = document.createElement('li');
    li.className = 'item-catalogo';
    const compra = eq.precio_compra_oficial_usd != null
      ? `<span class="dato">Compra oficial ${formatoUSD(eq.precio_compra_oficial_usd)}</span>` : '';
    li.innerHTML = `
      <div class="item-texto">
        <strong>${esc(eq.modelo)}</strong>
        <span class="dato">${esc(eq.fabricante)} · ${esc(eq.categoria)}</span>
        <span class="dato">Renta ${formatoUSD(eq.tarifa_renta_dia_usd)}/día${eq.unidad_cobro === 'm²' ? ' por m²' : ''}
          ${eq.tarifa_renta_estado === 'ejemplo' ? '<em class="sello">EJEMPLO</em>' : ''}</span>
        ${compra}
      </div>
      <button class="btn pequeno" title="Agregar a la escena">Agregar</button>`;
    li.querySelector('button').onclick = () => agregarEquipo(eq);
    lista.appendChild(li);
  }
}

function agregarEquipo(eq) {
  const id = `el-${Date.now().toString(36)}`;
  const el = {
    id, equipo_id: eq.id, etiqueta: eq.modelo, cantidad: 1, rotacion_y: 0,
    posicion: { x: 0, y: eq.forma_3d === 'camara' ? 1.6 : eq.forma_3d === 'pantalla' ? 4 : 0, z: 0 },
  };
  if (eq.unidad_cobro === 'm²') el.medidas_m = { ancho: 4, alto: 2.5 };
  if (eq.forma_3d === 'pantalla' && eq.unidad_cobro !== 'm²') el.posicion.y = 1.5;
  estado.proyecto.elementos.push(el);
  refrescar();
  seleccionar(id);
}

// ---------- Elemento seleccionado ----------
function seleccionar(id) {
  estado.seleccionado = id;
  estado.escena.resaltar(id);
  pintarSeleccion();
}

function pintarSeleccion() {
  const panel = $('#panel-seleccion');
  const el = estado.seleccionado && elemento(estado.seleccionado);
  if (!el || estado.presentando) { panel.hidden = true; return; }
  const eq = estado.porId.get(el.equipo_id);
  const ajuste = estado.proyecto.ajustes_tarifa.find(a => a.equipo_id === eq.id);
  const elevado = eq.forma_3d === 'camara' || eq.forma_3d === 'pantalla';
  panel.hidden = false;
  panel.innerHTML = `
    <div class="cabecera-panel"><strong>${esc(eq.modelo)}</strong><button class="btn-x" data-accion="cerrar" aria-label="Cerrar">×</button></div>
    <label>Etiqueta en la escena<input data-campo="etiqueta" value="${esc(el.etiqueta || '')}"></label>
    ${eq.unidad_cobro === 'm²' ? `
      <div class="fila">
        <label>Ancho (m)<input type="number" step="0.5" min="0.5" data-campo="ancho" value="${el.medidas_m.ancho}"></label>
        <label>Alto (m)<input type="number" step="0.5" min="0.5" data-campo="alto" value="${el.medidas_m.alto}"></label>
      </div>
      <p class="nota">Se cobran ${(el.medidas_m.ancho * el.medidas_m.alto).toFixed(2)} m².</p>` : `
      <label>Unidades<input type="number" min="1" step="1" data-campo="cantidad" value="${el.cantidad}"></label>`}
    <div class="fila">
      ${elevado ? `<label>Altura (m)<input type="number" step="0.1" min="0" data-campo="y" value="${el.posicion.y}"></label>` : ''}
      <label>Giro (°)<input type="number" step="15" data-campo="rotacion_y" value="${el.rotacion_y || 0}"></label>
    </div>
    <label>Tarifa diaria en este proyecto (USD)
      <input type="number" min="0" step="5" data-campo="tarifa" placeholder="${eq.tarifa_renta_dia_usd} (catálogo)" value="${ajuste ? ajuste.tarifa_renta_dia_usd : ''}">
    </label>
    <p class="nota">Vacío = tarifa del catálogo${eq.tarifa_renta_estado === 'ejemplo' ? ' (EJEMPLO)' : ''}. Aplica a todos los ${esc(eq.modelo)} del proyecto.</p>
    <div class="fila acciones">
      <button class="btn" data-accion="duplicar">Duplicar</button>
      <button class="btn peligro" data-accion="quitar">Quitar</button>
    </div>
    <p class="nota">Arrastra el equipo en la escena para moverlo.</p>`;

  panel.querySelectorAll('input').forEach(inp => inp.onchange = () => {
    const v = inp.value;
    switch (inp.dataset.campo) {
      case 'etiqueta': el.etiqueta = v; break;
      case 'cantidad': el.cantidad = Math.max(1, Math.round(Number(v) || 1)); break;
      case 'ancho': el.medidas_m.ancho = Math.max(0.5, Number(v) || 0.5); break;
      case 'alto': el.medidas_m.alto = Math.max(0.5, Number(v) || 0.5); break;
      case 'y': el.posicion.y = Math.max(0, Number(v) || 0); break;
      case 'rotacion_y': el.rotacion_y = Number(v) || 0; break;
      case 'tarifa': {
        const lista = estado.proyecto.ajustes_tarifa.filter(a => a.equipo_id !== eq.id);
        if (v !== '') lista.push({ equipo_id: eq.id, tarifa_renta_dia_usd: Math.max(0, Number(v)) });
        estado.proyecto.ajustes_tarifa = lista;
        break;
      }
    }
    refrescar();
  });
  panel.querySelectorAll('[data-accion]').forEach(b => b.onclick = () => {
    if (b.dataset.accion === 'cerrar') seleccionar(null);
    if (b.dataset.accion === 'quitar') {
      estado.proyecto.elementos = estado.proyecto.elementos.filter(e => e.id !== el.id);
      estado.proyecto.conexiones = estado.proyecto.conexiones.filter(c => c.desde !== el.id && c.hacia !== el.id);
      estado.seleccionado = null;
      refrescar();
    }
    if (b.dataset.accion === 'duplicar') {
      const copia = structuredClone(el);
      copia.id = `el-${Date.now().toString(36)}`;
      copia.posicion.x += 2;
      estado.proyecto.elementos.push(copia);
      refrescar();
      seleccionar(copia.id);
    }
  });
}

// ---------- Datos del proyecto ----------
function pintarProyecto() {
  const p = estado.proyecto;
  $('#p-nombre').value = p.nombre || '';
  $('#p-cliente').value = p.cliente?.nombre || '';
  $('#p-dias').value = p.dias_renta ?? 1;
  $('#p-evento').value = p.fechas?.evento || '';
  $('#p-tasa').value = p.impuesto.tasa ?? '';
  $('#p-plantilla').value = p.recinto.plantilla || 'salon';
  $('#p-ancho').value = p.recinto.medidas_m.ancho;
  $('#p-largo').value = p.recinto.medidas_m.largo;
  $('#p-alto').value = p.recinto.medidas_m.alto;
  $('#titulo-proyecto').textContent = p.nombre || 'Proyecto sin nombre';
}

function leerProyecto() {
  const p = estado.proyecto;
  p.nombre = $('#p-nombre').value;
  p.cliente = { ...(p.cliente || {}), nombre: $('#p-cliente').value };
  p.dias_renta = Math.max(1, Math.round(Number($('#p-dias').value) || 1));
  p.fechas = { ...(p.fechas || {}), evento: $('#p-evento').value };
  const t = $('#p-tasa').value;
  p.impuesto = { ...p.impuesto, tasa: t === '' ? null : Number(t) };
  const medidas = { ancho: +$('#p-ancho').value || 30, largo: +$('#p-largo').value || 50, alto: +$('#p-alto').value || 10 };
  const cambioRecinto = JSON.stringify(medidas) !== JSON.stringify(p.recinto.medidas_m);
  p.recinto.medidas_m = medidas;
  $('#titulo-proyecto').textContent = p.nombre || 'Proyecto sin nombre';
  if (cambioRecinto) estado.escena.dibujarRecinto(p.recinto);
  guardar();
}

function aplicarPlantilla(clave) {
  const t = PLANTILLAS[clave];
  const r = estado.proyecto.recinto;
  r.plantilla = clave;
  r.medidas_m = { ...t.medidas_m };
  r.zonas = structuredClone(t.zonas);
  estado.escena.dibujarRecinto(r);
  estado.escena.vista('general');
  pintarProyecto();
  guardar();
}

function proyectoNuevo() {
  const t = PLANTILLAS.salon;
  return {
    version: 1, id: `proyecto-${Date.now().toString(36)}`, nombre: 'Nuevo proyecto',
    cliente: { nombre: '', contacto: '' }, fechas: {}, dias_renta: 1, moneda: 'USD',
    impuesto: { nombre: 'Impuesto', tasa: null },
    recinto: {
      tipo: 'generico', plantilla: 'salon', medidas_m: { ...t.medidas_m },
      plano: { archivo: null, formato: null, escala_m_por_pixel: null, origen: { x: 0, y: 0 }, rotacion_grados: 0 },
      zonas: structuredClone(t.zonas),
    },
    elementos: [], lineas_extra: [], ajustes_tarifa: [], conexiones: [], personal: [], cronograma: [],
  };
}

// ---------- Cotización ----------
function pintarCotizacion() {
  const c = cotizar(estado.proyecto, estado.catalogo);
  const filas = c.lineas.map(l => `
    <tr>
      <td>
        <strong>${esc(l.modelo)}</strong>
        <span class="dato">${formatoNumero(l.unidades)}${l.unidad_cobro === 'm²' ? ' m²' : ' u.'} × ${l.dias} ${l.dias === 1 ? 'día' : 'días'} × ${formatoUSD(l.tarifa)}/día</span>
        ${l.es_ejemplo ? '<em class="sello">EJEMPLO</em>' : ''}${l.ajustada ? '<em class="sello ajuste">AJUSTADA</em>' : ''}
      </td>
      <td class="num">${formatoUSD(l.subtotal)}</td>
    </tr>`).join('');
  $('#tabla-cotizacion').innerHTML = `
    <table>
      <thead><tr><th>Equipo</th><th class="num">Subtotal</th></tr></thead>
      <tbody>${filas || '<tr><td colspan="2" class="vacio">Agrega equipos desde el catálogo.</td></tr>'}</tbody>
    </table>
    <dl class="totales">
      <dt>Subtotal</dt><dd>${formatoUSD(c.subtotal)}</dd>
      <dt>${esc(estado.proyecto.impuesto.nombre || 'Impuesto')}${c.tasa != null ? ` (${c.tasa}%)` : ''}</dt>
      <dd>${c.impuesto == null ? '<span class="pendiente">Por definir</span>' : formatoUSD(c.impuesto)}</dd>
      <dt class="total">Total${c.impuesto == null ? ' antes de impuesto' : ''}</dt><dd class="total">${formatoUSD(c.total)}</dd>
    </dl>
    ${c.hay_ejemplos ? '<p class="aviso">Las tarifas marcadas EJEMPLO son valores ficticios, no tarifas reales.</p>' : ''}`;
  $('#total-barra').textContent = formatoUSD(c.total);
  $('#pres-total').textContent = formatoUSD(c.total);
  $('#pres-ejemplo').hidden = !c.hay_ejemplos;
}

// ---------- Controles generales ----------
function conectarControles() {
  document.querySelectorAll('.pestana').forEach(b => b.onclick = () => {
    document.querySelectorAll('.pestana').forEach(x => x.classList.toggle('activa', x === b));
    document.querySelectorAll('.contenido-pestana').forEach(x => x.hidden = x.id !== b.dataset.destino);
  });
  $('#buscar').oninput = pintarCatalogo;
  $('#filtro-categoria').onchange = pintarCatalogo;
  document.querySelectorAll('#form-proyecto input').forEach(i => i.onchange = leerProyecto);
  $('#p-plantilla').onchange = (e) => aplicarPlantilla(e.target.value);

  document.querySelectorAll('[data-vista]').forEach(b => b.onclick = () => estado.escena.vista(b.dataset.vista));
  $('#btn-etiquetas').onclick = (e) => {
    const v = !estado.escena.mostrarEtiquetas;
    estado.escena.ponerEtiquetas(v);
    e.currentTarget.setAttribute('aria-pressed', String(v));
  };

  $('#btn-nuevo').onclick = () => {
    if (confirm('¿Empezar un proyecto nuevo? Exporta el actual primero si quieres conservarlo.')) cargarProyecto(proyectoNuevo());
  };
  $('#btn-ejemplo').onclick = async () => {
    if (confirm('¿Cargar el proyecto de ejemplo? Se reemplaza el proyecto actual.')) {
      cargarProyecto(await (await fetch('datos/proyecto-ejemplo.json')).json());
    }
  };
  $('#btn-exportar').onclick = () => {
    const blob = new Blob([JSON.stringify(estado.proyecto, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(estado.proyecto.nombre || 'proyecto').replace(/[^\w\-áéíóúñ ]/gi, '').trim().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  $('#btn-importar').onclick = () => $('#archivo-importar').click();
  $('#archivo-importar').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try { cargarProyecto(JSON.parse(await f.text())); } catch { alert('El archivo no es un proyecto válido.'); }
    e.target.value = '';
  };

  $('#btn-presentar').onclick = () => modoPresentacion(true);
  $('#btn-salir-pres').onclick = () => modoPresentacion(false);
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && estado.presentando) modoPresentacion(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && estado.presentando) modoPresentacion(false);
    if ((e.key === 'Delete' || e.key === 'Backspace') && estado.seleccionado && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) {
      document.querySelector('[data-accion="quitar"]')?.click();
    }
  });
}

function modoPresentacion(activo) {
  estado.presentando = activo;
  document.body.classList.toggle('presentando', activo);
  estado.escena.soloLectura = activo;
  $('#pres-nombre').textContent = estado.proyecto.nombre || '';
  $('#pres-cliente').textContent = estado.proyecto.cliente?.nombre ? `Para ${estado.proyecto.cliente.nombre}` : '';
  if (activo) {
    seleccionar(null);
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
  pintarSeleccion();
  setTimeout(() => estado.escena.ajustarTamano(), 50);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function formatoNumero(n) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);
}

iniciar().catch(err => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<div class="error-carga">No se pudo cargar la app: ${esc(err.message)}</div>`);
});
