// Escena 3D: recinto genérico, zonas y equipos colocados.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const COLORES = {
  'Cámara': 0x3b82f6,
  'Switcher': 0xf59e0b,
  'Panel de control': 0xf59e0b,
  'Grabador': 0x8b5cf6,
  'Router': 0x8b5cf6,
  'Conversor': 0x64748b,
  'Fibra': 0x06b6d4,
  'IP 2110': 0x06b6d4,
  'Monitor': 0x10b981,
  'Pantalla LED': 0x10b981,
  'Audio': 0xef4444,
  'Truss': 0x9ca3af,
  'Soporte': 0x6b7280,
  'Cableado': 0x6b7280,
  'Energía': 0xeab308,
};

export class Escena {
  constructor(contenedor, { alSeleccionar, alMover }) {
    this.contenedor = contenedor;
    this.alSeleccionar = alSeleccionar;
    this.alMover = alMover;
    this.objetos = new Map(); // id de elemento -> Group
    this.seleccionado = null;
    this.mostrarEtiquetas = true;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    contenedor.appendChild(this.renderer.domElement);

    this.etiquetas = new CSS2DRenderer();
    this.etiquetas.domElement.className = 'capa-etiquetas';
    contenedor.appendChild(this.etiquetas.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    this.camera.position.set(28, 26, 38);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.49;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.1));
    const sol = new THREE.DirectionalLight(0xffffff, 1.4);
    sol.position.set(20, 40, 25);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    Object.assign(sol.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60 });
    this.scene.add(sol);

    this.recinto = new THREE.Group();
    this.scene.add(this.recinto);
    this.equipos = new THREE.Group();
    this.scene.add(this.equipos);

    this.raycaster = new THREE.Raycaster();
    this.puntero = new THREE.Vector2();
    this.planoPiso = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.arrastrando = null;
    this._eventos();

    new ResizeObserver(() => this.ajustarTamano()).observe(contenedor);
    this.ajustarTamano();
    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.etiquetas.render(this.scene, this.camera);
    });
  }

  ajustarTamano() {
    const { clientWidth: w, clientHeight: h } = this.contenedor;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.etiquetas.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---- Recinto ----
  dibujarRecinto(recinto) {
    this.recinto.clear();
    const { ancho, largo, alto } = recinto.medidas_m;
    const piso = new THREE.Mesh(
      new THREE.PlaneGeometry(ancho, largo),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.95 }));
    piso.rotation.x = -Math.PI / 2;
    piso.receiveShadow = true;
    this.recinto.add(piso);

    // rejilla de 1 m ajustada al piso
    const rejilla = new THREE.GridHelper(largo, largo, 0x334155, 0x273449);
    rejilla.scale.x = ancho / largo;
    rejilla.position.y = 0.01;
    this.recinto.add(rejilla);

    const paredes = new THREE.Mesh(
      new THREE.BoxGeometry(ancho, alto, largo),
      new THREE.MeshStandardMaterial({ color: 0x475569, transparent: true, opacity: 0.08, side: THREE.BackSide, depthWrite: false }));
    paredes.position.y = alto / 2;
    this.recinto.add(paredes);
    const bordes = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(ancho, alto, largo)),
      new THREE.LineBasicMaterial({ color: 0x64748b }));
    bordes.position.y = alto / 2;
    this.recinto.add(bordes);

    for (const z of recinto.zonas || []) {
      const h = Math.max(Number(z.alto) || 0, 0.02);
      const caja = new THREE.Mesh(
        new THREE.BoxGeometry(z.ancho, h, z.largo),
        new THREE.MeshStandardMaterial({ color: z.id === 'escenario' ? 0x111827 : 0x334155, roughness: 0.8 }));
      caja.position.set(z.x, h / 2, z.z);
      caja.receiveShadow = caja.castShadow = true;
      this.recinto.add(caja);
      this.recinto.add(etiqueta(z.nombre, 'etiqueta-zona', new THREE.Vector3(z.x, h + 0.3, z.z)));
    }
    this.limites = { ancho, largo };
    this.zonas = recinto.zonas || [];
    this.controls.target.set(0, 1, 0);
  }

  // ---- Equipos ----
  sincronizar(proyecto, porId) {
    const vivos = new Set();
    for (const el of proyecto.elementos) {
      const equipo = porId.get(el.equipo_id);
      if (!equipo) continue;
      vivos.add(el.id);
      let g = this.objetos.get(el.id);
      const firma = JSON.stringify([el.equipo_id, el.medidas_m, el.cantidad, el.etiqueta, el.posicion.y]);
      if (!g || g.userData.firma !== firma) {
        if (g) this.equipos.remove(g);
        g = construirEquipo(el, equipo);
        g.userData = { id: el.id, firma, elevado: equipo.forma_3d === 'camara' || equipo.forma_3d === 'pantalla' };
        this.equipos.add(g);
        this.objetos.set(el.id, g);
      }
      g.position.set(el.posicion.x, g.userData.elevado ? (el.posicion.y || 0) : this.alturaPiso(el.posicion.x, el.posicion.z), el.posicion.z);
      g.rotation.y = THREE.MathUtils.degToRad(el.rotacion_y || 0);
    }
    for (const [id, g] of this.objetos) {
      if (!vivos.has(id)) { this.equipos.remove(g); this.objetos.delete(id); }
    }
    this.resaltar(this.seleccionado);
    this.ponerEtiquetas(this.mostrarEtiquetas);
  }

  // Altura del piso en un punto: sobre el escenario u otra zona elevada, si la hay.
  alturaPiso(x, z) {
    let h = 0;
    for (const zn of this.zonas || []) {
      if (Math.abs(x - zn.x) <= zn.ancho / 2 && Math.abs(z - zn.z) <= zn.largo / 2) h = Math.max(h, Number(zn.alto) || 0);
    }
    return h;
  }

  resaltar(id) {
    this.seleccionado = id;
    for (const [oid, g] of this.objetos) {
      g.traverse(o => {
        if (o.isMesh && o.material.emissive && !o.userData.esPantalla) {
          o.material.emissive.setHex(oid === id ? 0x444444 : 0x000000);
        }
      });
      const et = g.getObjectByName('etiqueta');
      if (et) et.element.classList.toggle('activa', oid === id);
    }
  }

  ponerEtiquetas(visible) {
    this.mostrarEtiquetas = visible;
    for (const g of this.objetos.values()) {
      const et = g.getObjectByName('etiqueta');
      if (et) et.visible = visible;
    }
  }

  // Encuadre de vistas rápidas
  vista(nombre) {
    const { ancho = 30, largo = 50 } = this.limites || {};
    const d = Math.max(ancho, largo);
    const pos = {
      general: [d * 0.42, d * 0.38, d * 0.55],
      planta: [0, d * 1.3, 0.01],
      publico: [0, 2.5, largo * 0.45],
      escenario: [0, 5, -largo * 0.1],
    }[nombre];
    if (!pos) return;
    this.camera.position.set(...pos);
    this.controls.target.set(0, nombre === 'publico' ? 3 : 1, nombre === 'escenario' ? -largo * 0.4 : 0);
  }

  capturaPNG() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  // ---- Interacción: clic para seleccionar, arrastrar para mover sobre el piso ----
  _eventos() {
    const el = this.renderer.domElement;
    const pick = (e) => {
      const r = el.getBoundingClientRect();
      this.puntero.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.raycaster.setFromCamera(this.puntero, this.camera);
    };
    el.addEventListener('pointerdown', (e) => {
      if (this.soloLectura || e.button !== 0) return;
      pick(e);
      const hit = this.raycaster.intersectObjects(this.equipos.children, true)[0];
      if (!hit) { this.alSeleccionar(null); return; }
      let g = hit.object;
      while (g.parent && g.parent !== this.equipos) g = g.parent;
      this.alSeleccionar(g.userData.id);
      const p = new THREE.Vector3();
      this.planoPiso.constant = g.userData.elevado ? -g.position.y : 0;
      this.raycaster.ray.intersectPlane(this.planoPiso, p);
      this.arrastrando = { g, desfase: p.sub(g.position) };
      this.controls.enabled = false;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.arrastrando) return;
      pick(e);
      const p = new THREE.Vector3();
      if (!this.raycaster.ray.intersectPlane(this.planoPiso, p)) return;
      p.sub(this.arrastrando.desfase);
      const { ancho, largo } = this.limites;
      p.x = THREE.MathUtils.clamp(Math.round(p.x * 10) / 10, -ancho / 2, ancho / 2);
      p.z = THREE.MathUtils.clamp(Math.round(p.z * 10) / 10, -largo / 2, largo / 2);
      const g = this.arrastrando.g;
      g.position.x = p.x;
      g.position.z = p.z;
      if (!g.userData.elevado) g.position.y = this.alturaPiso(p.x, p.z);
    });
    const soltar = () => {
      if (!this.arrastrando) return;
      const { g } = this.arrastrando;
      this.arrastrando = null;
      this.controls.enabled = true;
      this.alMover(g.userData.id, { x: g.position.x, z: g.position.z });
    };
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', soltar);
  }
}

function etiqueta(texto, clase, posicion) {
  const div = document.createElement('div');
  div.className = clase;
  div.textContent = texto;
  const o = new CSS2DObject(div);
  o.position.copy(posicion);
  return o;
}

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2, ...extra });
}

// Formas simples pero reconocibles para cada tipo de equipo.
function construirEquipo(el, equipo) {
  const g = new THREE.Group();
  const color = COLORES[equipo.categoria] ?? 0x94a3b8;
  const m = equipo.medidas_m;
  const esc = 3; // los equipos pequeños se agrandan para que se vean desde lejos
  const add = (geo, material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  let alturaEtiqueta = 1.5;

  switch (equipo.forma_3d) {
    case 'camara': {
      // trípode + cuerpo + lente; el cuerpo queda a la altura de posicion.y (por defecto 1.6 m)
      const alto = el.posicion.y || 1.6;
      g.userData.alto = alto;
      add(new THREE.CylinderGeometry(0.03, 0.03, alto), mat(0x374151), 0, -alto / 2, 0);
      for (let i = 0; i < 3; i++) {
        const pata = add(new THREE.CylinderGeometry(0.02, 0.02, alto * 1.05), mat(0x374151));
        const a = (i / 3) * Math.PI * 2;
        pata.position.set(Math.cos(a) * 0.25, -alto / 2, Math.sin(a) * 0.25);
        pata.rotation.set(Math.sin(a) * 0.15, 0, -Math.cos(a) * 0.15);
      }
      const ec = 4;
      add(new THREE.BoxGeometry(m.ancho * ec, m.alto * ec, m.profundidad * ec), mat(color), 0, 0.2, 0);
      const lente = add(new THREE.CylinderGeometry(0.14, 0.17, 0.5), mat(0x111827), 0, 0.2, -(m.profundidad * ec) / 2 - 0.22);
      lente.rotation.x = Math.PI / 2;
      alturaEtiqueta = 0.8;
      break;
    }
    case 'pantalla': {
      const w = Number(el.medidas_m?.ancho) || m.ancho;
      const h = Number(el.medidas_m?.alto) || m.alto;
      add(new THREE.BoxGeometry(w, h, 0.15), mat(0x111827), 0, 0, -0.08);
      const cara = add(new THREE.PlaneGeometry(w * 0.98, h * 0.96), new THREE.MeshStandardMaterial({
        color: 0x0ea5e9, emissive: 0x0b4f7a, emissiveIntensity: 1.2, roughness: 0.3 }), 0, 0, 0.01);
      cara.userData.esPantalla = true;
      alturaEtiqueta = h / 2 + 0.5;
      break;
    }
    case 'truss': {
      const tramo = add(new THREE.BoxGeometry(m.ancho, m.alto, m.profundidad), mat(color, { wireframe: true }), 0, m.alto / 2, 0);
      tramo.castShadow = false;
      alturaEtiqueta = 1;
      break;
    }
    case 'bocina': {
      add(new THREE.BoxGeometry(m.ancho, m.alto, m.profundidad), mat(0x1f2937), 0, m.alto / 2, 0);
      add(new THREE.CircleGeometry(Math.min(m.ancho, m.alto) * 0.35, 24), mat(color), 0, m.alto / 2, -m.profundidad / 2 - 0.01).rotation.y = Math.PI;
      alturaEtiqueta = m.alto + 0.6;
      break;
    }
    case 'tripode': {
      add(new THREE.ConeGeometry(0.35, m.alto, 3, 1, true), mat(color, { wireframe: true }), 0, m.alto / 2, 0);
      alturaEtiqueta = m.alto + 0.4;
      break;
    }
    case 'consola':
    case 'rack':
    case 'monitor':
    case 'caja':
    default: {
      // sobre una mesa o rack de 0.8 m para que se lea como estación de trabajo
      const base = equipo.forma_3d === 'caja' ? 0 : 0.75;
      if (base) add(new THREE.BoxGeometry(Math.max(m.ancho * esc, 0.8), base, Math.max(m.profundidad * esc, 0.6)), mat(0x334155), 0, base / 2, 0);
      add(new THREE.BoxGeometry(m.ancho * esc, Math.max(m.alto * esc, 0.12), m.profundidad * esc), mat(color), 0, base + Math.max(m.alto * esc, 0.12) / 2, 0);
      alturaEtiqueta = base + m.alto * esc + 0.6;
    }
  }
  const texto = el.etiqueta || equipo.modelo;
  const cant = Number(el.cantidad) > 1 && equipo.unidad_cobro !== 'm²' ? ` ×${el.cantidad}` : '';
  const et = etiqueta(texto + cant, 'etiqueta-equipo', new THREE.Vector3(0, alturaEtiqueta, 0));
  et.name = 'etiqueta';
  g.add(et);
  return g;
}
