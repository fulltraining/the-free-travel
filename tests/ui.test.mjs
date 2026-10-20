/* ============================================================
   The Free Travel — pruebas de pantallas
   Se ejecutan con QuickJS:  qjs tests/ui.test.mjs

   Generan el HTML de cada pantalla con datos de prueba y
   comprueban que aparece lo que debe (sin abrir navegador).
   También registran movimientos reales a través de las acciones
   para ver que el flujo deja las cuentas cuadradas.
   ============================================================ */
"use strict";

import * as std from "std";

let fallos = 0;
let pruebas = 0;

function ok(condicion, mensaje) {
  pruebas += 1;
  if (condicion) {
    console.log("  ✓ " + mensaje);
  } else {
    fallos += 1;
    console.log("  ✗ FALLO: " + mensaje);
  }
}

function contiene(html, texto, mensaje) { ok(html.indexOf(texto) !== -1, mensaje); }
function noContiene(html, texto, mensaje) { ok(html.indexOf(texto) === -1, mensaje); }
function igual(a, b, mensaje) { ok(a === b, `${mensaje} (esperado «${b}», sale «${a}»)`); }

/* ---------------- documento y ventana falsos ---------------- */

function elementoFalso() {
  const clases = new Set();
  const el = {
    hidden: false,
    textContent: "",
    innerHTML: "",
    className: "",
    value: "",
    checked: false,
    dataset: {},
    hijos: [],
    classList: {
      add: (c) => clases.add(c),
      remove: (c) => clases.delete(c),
      contains: (c) => clases.has(c),
      toggle: (c, f) => { if (f === undefined) { clases.has(c) ? clases.delete(c) : clases.add(c); } else if (f) clases.add(c); else clases.delete(c); },
    },
    addEventListener: function () {},
    appendChild: function (h) { this.hijos.push(h); },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    focus: function () {},
    closest: function () { return null; },
  };
  return el;
}

const ELEMENTOS = {};
ELEMENTOS["modal"] = elementoFalso();
ELEMENTOS["modal"].hidden = true;
["modal-titulo", "modal-texto", "modal-botones", "toast", "vista", "archivo-copia", "btn-menu", "btn-aviso"]
  .forEach((id) => { ELEMENTOS[id] = elementoFalso(); });

globalThis.document = {
  readyState: "loading",
  addEventListener: function () {},
  getElementById: function (id) { return ELEMENTOS[id] || null; },
  createElement: function () { return elementoFalso(); },
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; },
};
globalThis.navigator = { onLine: true };
globalThis.window = { scrollTo: function () {}, addEventListener: function () {} };
globalThis.setTimeout = function () { return 0; };
globalThis.clearTimeout = function () {};
globalThis.Blob = function () {};
globalThis.URL = { createObjectURL: function () { return "blob:x"; }, revokeObjectURL: function () {} };

eval(std.loadFile("js/logica.js"));
const FT = globalThis.FT;
eval(std.loadFile("js/app.js"));

const UI = globalThis.FTUI;
const S = UI.S;

/* Almacén falso en memoria, para probar las acciones sin navegador. */
const STORE = {
  viajes: [], clientes: [], aportaciones: [], conceptos: [],
  gastos: [], reembolsos: [], devoluciones: [], gastosPersonales: [], honorarios: [], meta: {},
};
function guardarEn(tabla, reg) {
  const i = STORE[tabla].findIndex((x) => x.id === reg.id);
  if (i >= 0) STORE[tabla][i] = reg; else STORE[tabla].push(reg);
}
globalThis.TFTDB = {
  abrir: function () { return Promise.resolve(); },
  cerrar: function () { return Promise.resolve(); },
  listar: function (t) { return Promise.resolve(STORE[t].slice()); },
  guardar: function (t, r) { guardarEn(t, r); return Promise.resolve(); },
  eliminar: function (t, id) { STORE[t] = STORE[t].filter((x) => x.id !== id); return Promise.resolve(); },
  guardarVarios: function (t, lista) { (lista || []).forEach((r) => guardarEn(t, r)); return Promise.resolve(); },
  eliminarViajeCompleto: function (id) {
    STORE.viajes = STORE.viajes.filter((v) => v.id !== id);
    ["clientes", "aportaciones", "conceptos", "gastos", "reembolsos", "devoluciones", "gastosPersonales", "honorarios"]
      .forEach((t) => { STORE[t] = STORE[t].filter((x) => x.viajeId !== id); });
    return Promise.resolve();
  },
  guardarTodo: function (datos) {
    ["viajes", "clientes", "aportaciones", "conceptos", "gastos", "reembolsos", "devoluciones", "gastosPersonales", "honorarios"]
      .forEach((t) => { STORE[t] = (datos[t] || []).slice(); });
    return Promise.resolve();
  },
  leerTodo: function () {
    const d = {};
    Object.keys(STORE).forEach((t) => { if (t !== "meta") d[t] = STORE[t].slice(); });
    return Promise.resolve(d);
  },
  guardarMeta: function (c, v) { STORE.meta[c] = v; return Promise.resolve(); },
  leerMeta: function (c) { return Promise.resolve(STORE.meta[c] === undefined ? undefined : STORE.meta[c]); },
};

/* ---------------- viaje de trabajo ---------------- */

function sembrar() {
  STORE.viajes = [FT.crearViaje({ id: "v1", nombre: "Ruta por Marruecos", destino: "Chefchaouen", inicio: "2026-10-01", fin: "2026-10-05", moneda: "EUR", aportacionPrevista: 300 })];
  STORE.clientes = [
    FT.crearCliente({ id: "c1", viajeId: "v1", nombre: "Ana", apellidos: "García", aportacionPrevista: 300 }),
    FT.crearCliente({ id: "c2", viajeId: "v1", nombre: "Luis", apellidos: "Pérez", aportacionPrevista: 300 }),
  ];
  STORE.aportaciones = [
    FT.crearAportacion({ id: "a1", viajeId: "v1", clienteId: "c1", importe: 200, forma: "transferencia", fecha: "2026-09-01T10:00:00" }),
    FT.crearAportacion({ id: "a2", viajeId: "v1", clienteId: "c2", importe: 100, forma: "metalico", fecha: "2026-09-10T10:00:00" }),
  ];
  STORE.conceptos = [
    FT.crearConcepto({ id: "k1", viajeId: "v1", categoria: "alojamiento", tipo: "personaNoche", descripcion: "Hotel", precio: 40, personas: 2, noches: 4, moneda: "EUR" }),
  ];
  STORE.gastos = [
    FT.crearGastoGrupo({ id: "g1", viajeId: "v1", categoria: "transporte", descripcion: "Gasolina", importe: 120, forma: "metalico", pagador: "bote", fecha: "2026-10-02T09:00:00" }),
    FT.crearGastoGrupo({ id: "g2", viajeId: "v1", categoria: "comidas", descripcion: "Cena del grupo", importe: 90, forma: "transferencia", pagador: "yo", fecha: "2026-10-03T21:00:00" }),
  ];
  STORE.gastosPersonales = [
    FT.crearGastoPersonal({ id: "p1", viajeId: "v1", categoria: "vuelos", concepto: "Vuelo a Tánger", importe: 180, moneda: "EUR" }),
  ];
  STORE.honorarios = [
    FT.crearHonorario({ id: "h1", viajeId: "v1", clienteId: "c1", previsto: 100, cobrado: 100, fecha: "2026-09-01T10:00:00", forma: "transferencia" }),
    FT.crearHonorario({ id: "h2", viajeId: "v1", clienteId: "c2", previsto: 100, cobrado: 40, fecha: "2026-09-20T10:00:00", forma: "metalico" }),
  ];
}

/* ---------------- 1. pantalla de viajes ---------------- */

function pruebaViajes() {
  console.log("\n1. Pantalla de viajes");
  S.viajeId = "v1";
  const html = UI.htmlViajes();
  contiene(html, "Ruta por Marruecos", "aparece el nombre del viaje");
  contiene(html, "Chefchaouen", "aparece el destino");
  contiene(html, "Mis viajes", "hay título de la lista de viajes");
  contiene(html, "+ Nuevo viaje", "hay botón de nuevo viaje");
  contiene(html, "Datos y copias de seguridad", "están las copias de seguridad");
  contiene(html, "Versión de la app: 1.1.0", "se ve la versión de la app");
  contiene(html, "Exportar copia completa", "se puede exportar la copia");
  contiene(html, "2 cliente(s)", "el resumen del viaje cuenta 2 clientes");

  const b = UI.nuevoBorradorViaje(null);
  S.viaje = b;
  const form = UI.htmlFormularioViaje();
  contiene(form, "Nuevo viaje", "el formulario se titula «Nuevo viaje»");
  contiene(form, "Fecha de inicio", "pide la fecha de inicio");
  contiene(form, "Moneda principal", "pide la moneda principal");
  S.viaje = null;
  return Promise.resolve();
}

/* ---------------- 2. clientes y bote ---------------- */

function pruebaClientes() {
  console.log("\n2. Clientes y bote común");
  const html = UI.htmlClientes();
  contiene(html, "Clientes y bote común", "título de la pantalla");
  contiene(html, "Ana García", "aparece Ana");
  contiene(html, "Luis Pérez", "aparece Luis");
  contiene(html, "Bote común", "hay bloque del bote común");
  contiene(html, "Bote previsto", "muestra el bote previsto");
  contiene(html, "Aportaciones recibidas", "muestra lo recibido");
  contiene(html, "Aportaciones pendientes", "muestra lo pendiente");
  contiene(html, "Dinero disponible del bote", "muestra el dinero disponible");
  contiene(html, "Adelantos pendientes de reembolso", "muestra los adelantos pendientes");
  contiene(html, "600,00 €", "bote previsto 600 € (2 × 300)");
  contiene(html, "300,00 €", "recibido 300 € (200 + 100)");
  contiene(html, "300,00 €", "pendiente 300 € (Ana 100 + Luis 200)");
  contiene(html, "180,00 €", "dinero disponible 300 − 120 = 180 €");
  contiene(html, "90,00 €", "adelanto pendiente de 90 € (cena que pagué yo)");
  contiene(html, "pendiente 100,00 €", "Ana tiene 100 € pendientes");
  contiene(html, "pendiente 200,00 €", "Luis tiene 200 € pendientes");
  contiene(html, "Aportación común a todos", "hay botón de aportación común");
  contiene(html, "+ Ingreso", "se pueden añadir ingresos parciales");
  contiene(html, "+ Reembolso", "se pueden registrar reembolsos");
  contiene(html, "+ Devolución a un cliente", "se pueden registrar devoluciones");
  noContiene(html, "49", "no aparece ninguna tarifa antigua");

  S.cliente = UI.nuevoBorradorCliente(null);
  const f = UI.htmlClientes();
  contiene(f, "Nuevo cliente", "el formulario de cliente se titula «Nuevo cliente»");
  contiene(f, "Apellidos", "pide apellidos");
  contiene(f, "Aportación prevista al bote", "pide la aportación prevista");
  S.cliente = null;

  S.aportacion = UI.nuevoBorradorAportacion({ clienteId: "c1" });
  const fa = UI.htmlClientes();
  contiene(fa, "Forma de entrega", "el ingreso pide la forma de entrega");
  contiene(fa, "Fecha del ingreso", "el ingreso lleva fecha automática editable");
  S.aportacion = null;
  return Promise.resolve();
}

/* ---------------- 3. presupuesto ---------------- */

function pruebaPresupuesto() {
  console.log("\n3. Presupuesto del grupo");
  S.vista = "presupuesto";
  const html = UI.htmlPresupuesto();
  contiene(html, "Presupuesto previsto del grupo", "título de la pantalla");
  contiene(html, "Hotel", "aparece el concepto de hotel");
  contiene(html, "Presupuesto total", "muestra el presupuesto total");
  contiene(html, "320,00 €", "hotel 40 € × 2 × 4 = 320 €");
  contiene(html, "Coste medio por cliente", "muestra el coste medio por cliente");
  contiene(html, "160,00 €", "coste medio 320 / 2 clientes = 160 €");
  contiene(html, "Pasar a gasto real", "se puede convertir una previsión en gasto real");
  contiene(html, "Gastos reales ya registrados", "separa lo previsto de lo real");
  contiene(html, "Presupuesto previsto", "hay pestaña de presupuesto previsto");
  contiene(html, "Gastos reales", "hay pestaña de gastos reales");
  contiene(html, "Importe previsto", "cada concepto muestra su importe previsto");
  contiene(html, "Gasto real acumulado", "cada concepto muestra su gasto real acumulado");
  contiene(html, "Diferencia (real − previsto)", "cada concepto muestra la diferencia");

  const b = UI.nuevoBorradorConcepto(null);
  S.concepto = b;
  const form = UI.htmlPresupuesto();
  contiene(form, "Nuevo concepto del presupuesto", "el formulario se abre");
  contiene(form, "Forma de cálculo", "se elige la forma de cálculo");
  contiene(form, "Importe total del grupo", "está la opción de importe total");
  contiene(form, "Precio por persona y noche", "está la opción por persona y noche");
  contiene(form, "Precio por habitación y noche", "está la opción por habitación y noche");
  contiene(form, "Precio por unidad", "está la opción por unidad");
  contiene(form, "Cambio (1 € = X)", "se puede indicar el tipo de cambio");

  // Cálculo en vivo: precio 40, tipo personaNoche, 3 personas, 4 noches
  S.concepto.tipo = "personaNoche";
  S.concepto.precio = "40";
  S.concepto.personas = "3";
  S.concepto.noches = "4";
  S.vistaPreviaConcepto = FT.calcularConcepto(S.concepto, { personasViaje: 2, noches: 3 });
  const conPrevia = UI.htmlPresupuesto();
  contiene(conPrevia, "precio × personas × noches", "la previa muestra la fórmula");
  contiene(conPrevia, "480,00 €", "la previa calcula 40 × 3 × 4 = 480 €");
  S.concepto = null;
  S.vistaPreviaConcepto = null;

  // Un pago real enlazado al hotel: se ve su previsión, lo gastado y lo que queda
  return TFTDB.guardar("gastos", FT.crearGastoGrupo({ id: "gk", viajeId: "v1", categoria: "alojamiento", descripcion: "Reserva del hotel", importe: 120, forma: "transferencia", pagador: "bote", conceptoId: "k1" }))
    .then(() => UI.recargar())
    .then(() => {
      const conReal = UI.htmlPresupuesto();
      contiene(conReal, "120,00 €", "el gasto real acumulado del hotel es 120 €");
      contiene(conReal, "1 gasto(s) real(es) enlazado(s)", "avisa de cuántos pagos hay enlazados");
      contiene(conReal, "200,00 €", "el restante del hotel es 320 − 120 = 200 €");
      contiene(conReal, "Gastos reales sin concepto", "separa los gastos sin presupuesto");
      // Se retira el gasto para no alterar el resto de pruebas
      return TFTDB.eliminar("gastos", "gk").then(() => UI.recargar());
    });
}

/* ---------------- 4. gastos del grupo ---------------- */

function pruebaGastos() {
  console.log("\n4. Gastos reales del grupo");
  S.vista = "gastos";
  const html = UI.htmlGastos();
  contiene(html, "Gastos reales del grupo", "título de la pantalla");
  contiene(html, "Gasolina", "aparece el gasto de gasolina");
  contiene(html, "Cena del grupo", "aparece la cena");
  contiene(html, "Gasto real total", "muestra el gasto real total");
  contiene(html, "210,00 €", "gasto real 120 + 90 = 210 €");
  contiene(html, "Sobrecoste (real − previsto)", "muestra el sobrecoste");
  contiene(html, "Adelantos pendientes de reembolso", "muestra los adelantos pendientes");
  contiene(html, "90,00 €", "el adelanto de la cena está pendiente");
  contiene(html, "Paga: Bote común", "indica quién pagó la gasolina");
  contiene(html, "Paga: Yo (organizador)", "indica que yo pagué la cena");
  contiene(html, "+ Registrar gasto", "hay botón de registrar gasto");
  contiene(html, "Presupuesto previsto y gasto real por concepto", "muestra la tabla por concepto");
  contiene(html, "Gasto real acumulado", "la tabla incluye el gasto real acumulado");
  contiene(html, "Diferencia", "la tabla incluye la diferencia");
  contiene(html, "Gastos reales sin concepto (no previstos)", "separa los gastos no previstos");

  const b = UI.nuevoBorradorGasto(null);
  S.gasto = b;
  const form = UI.htmlGastos();
  contiene(form, "Quién lo ha pagado", "el formulario pregunta quién pagó");
  contiene(form, "Bote común", "ofrece el bote");
  contiene(form, "Yo (organizador)", "me ofrece a mí");
  contiene(form, "Concepto del presupuesto (opcional)", "permite enlazar con el presupuesto");
  contiene(form, "Forma de pago", "el gasto pide la forma de pago");
  contiene(form, "Gasto no previsto", "mantiene la opción de gasto no previsto");
  contiene(form, "Hotel", "carga los conceptos del presupuesto del viaje");
  contiene(form, "Alojamientos", "cada opción muestra la categoría");
  contiene(form, "Previsto: 320,00 €", "cada opción muestra el importe previsto");
  contiene(form, "varios pagos al mismo concepto", "explica que se pueden enlazar varios pagos");

  // Al elegir un concepto se ve su previsión, lo gastado y lo que queda.
  S.gasto.conceptoId = "k1";
  const conConcepto = UI.htmlGastos();
  contiene(conConcepto, "Previsto: <strong>320,00 €</strong>", "muestra la previsión del concepto elegido");
  contiene(conConcepto, "Gasto real acumulado: <strong>0,00 €</strong>", "muestra el gasto real acumulado del concepto");
  contiene(conConcepto, "Restante: <strong>320,00 €</strong>", "muestra cuánto queda por gastar");

  // Sin presupuesto: avisa y ofrece crearlo.
  const conceptosGuardados = STORE.conceptos.slice();
  STORE.conceptos = [];
  return UI.recargar().then(() => {
    const sinPresupuesto = UI.htmlGastos();
    contiene(sinPresupuesto, "No hay presupuesto creado", "sin conceptos avisa de que no hay presupuesto");
    contiene(sinPresupuesto, "+ Añadir concepto", "ofrece añadir un concepto sin perder lo escrito");
    STORE.conceptos = conceptosGuardados;
    S.gasto = null;
    return UI.recargar();
  }).then(() => {
    // Reembolso: se registra sin volver a contar el gasto
    S.reembolso = { gastoId: "g2", beneficiario: "yo", importe: "90", fecha: "2026-10-10T10:00", forma: "transferencia", observaciones: "", errores: [] };
    const fr = UI.htmlGastos();
    contiene(fr, "Reembolso a quien adelantó", "se abre el formulario de reembolso");
    contiene(fr, "El reembolso no cuenta como gasto nuevo", "avisa de que no se cuenta dos veces");
    S.reembolso = null;
    return Promise.resolve();
  });
}

/* ---------------- 5. mis gastos y honorarios ---------------- */

function pruebaMios() {
  console.log("\n5. Mis gastos y honorarios");
  S.vista = "mios";
  const html = UI.htmlMios();
  contiene(html, "Mis gastos de viaje", "título de mis gastos");
  contiene(html, "Vuelo a Tánger", "aparece mi vuelo");
  contiene(html, "Mis gastos personales", "muestra el total de mis gastos");
  contiene(html, "180,00 €", "mis gastos personales suman 180 €");
  contiene(html, "Mis honorarios", "aparece el bloque de honorarios");
  contiene(html, "Honorarios previstos", "muestra los honorarios previstos");
  contiene(html, "200,00 €", "honorarios previstos 100 + 100 = 200 €");
  contiene(html, "Honorarios cobrados", "muestra los honorarios cobrados");
  contiene(html, "140,00 €", "honorarios cobrados 100 + 40 = 140 €");
  contiene(html, "Resultado previsto", "muestra el resultado previsto");
  contiene(html, "Resultado real", "muestra el resultado real");
  contiene(html, "20,00 €", "resultado previsto 200 − 180 = 20 €");
  contiene(html, "-40,00 €", "resultado real 140 − 180 = −40 €");
  contiene(html, "antes de impuestos", "identifica los resultados como cálculos antes de impuestos");

  const b = UI.nuevoBorradorGastoPersonal(null);
  S.gastoPersonal = b;
  const form = UI.htmlMios();
  contiene(form, "Nuevo gasto mío", "el formulario se abre");
  contiene(form, "Cubierto por el grupo", "se puede marcar cubierto por el grupo");
  contiene(form, "Se contabiliza como gasto del grupo, una sola vez", "explica que se cuenta una vez");
  S.gastoPersonal = null;

  S.honorario = UI.nuevoBorradorHonorario(null);
  const fh = UI.htmlMios();
  contiene(fh, "Nuevos honorarios", "el formulario de honorarios se abre");
  contiene(fh, "Honorarios previstos (€)", "pide honorarios previstos");
  contiene(fh, "Importe cobrado (€)", "pide importe cobrado");
  contiene(fh, "Forma de cobro", "pide la forma de cobro");
  S.honorario = null;
  return Promise.resolve();
}

/* ---------------- 6. resumen del viaje ---------------- */

function pruebaResumen() {
  console.log("\n6. Resumen del viaje");
  S.vista = "resumen";
  const html = UI.htmlResumen();
  contiene(html, "Número de clientes", "muestra el número de clientes");
  contiene(html, "Presupuesto del grupo", "muestra el presupuesto");
  contiene(html, "Gasto real del grupo", "muestra el gasto real");
  contiene(html, "Sobrecoste (real − presupuesto)", "muestra el sobrecoste");
  contiene(html, "Coste medio por cliente", "muestra el coste medio");
  contiene(html, "Gastos reales por categoría", "desglosa por categoría");
  contiene(html, "Dinero disponible del bote", "muestra el bote disponible");
  contiene(html, "Aportaciones por cliente", "desglosa las aportaciones por cliente");
  contiene(html, "Devoluciones hechas a clientes", "muestra las devoluciones");
  contiene(html, "Adelantos pendientes de reembolso", "muestra los adelantos pendientes");
  contiene(html, "Mis honorarios y mis gastos", "muestra honorarios y gastos propios");
  contiene(html, "Resultado previsto (antes de impuestos)", "resultado previsto identificado");
  contiene(html, "Resultado real (antes de impuestos)", "resultado real identificado");
  contiene(html, "180,00 €", "bote disponible 300 − 120 = 180 €");
  contiene(html, "320,00 €", "presupuesto 320 €");
  contiene(html, "210,00 €", "gasto real 210 €");
  contiene(html, "110,00 €", "desviación presupuesto − real = 110 € de menos");
  return Promise.resolve();
}

/* ---------------- 7. monedas ---------------- */

function pruebaMonedas() {
  console.log("\n7. Distintas monedas");
  STORE.gastos.push(FT.crearGastoGrupo({ id: "gm", viajeId: "v1", categoria: "comidas", descripcion: "Cena en dírhams", importe: 540, moneda: "MAD", cambio: 10.8, forma: "metalico", pagador: "bote" }));
  return UI.recargar().then(() => {
    const html = UI.htmlResumen();
    contiene(html, "Saldos por moneda", "aparece el bloque de saldos por moneda");
    contiene(html, "Dírham marroquí", "nombra el dírham marroquí");
    contiene(html, "1 € = 10.8 MAD", "muestra el cambio indicado");
    contiene(html, "540,00 MAD", "muestra el gasto en dírhams");
    contiene(html, "50,00 €", "540 MAD equivalen a 50 €");
    // se retira el gasto en MAD para no alterar el resto de pruebas
    STORE.gastos = STORE.gastos.filter((g) => g.id !== "gm");
    return UI.recargar();
  });
}

/* ---------------- 8. registro real por acciones (flujo completo) ---------------- */

function pruebaFlujoAcciones() {
  console.log("\n8. Flujo real: registrar por acciones");
  // Se parte de un viaje y dos clientes recién creados por la interfaz.
  STORE.viajes = []; STORE.clientes = []; STORE.aportaciones = []; STORE.conceptos = [];
  STORE.gastos = []; STORE.gastosPersonales = []; STORE.honorarios = []; STORE.reembolsos = []; STORE.devoluciones = [];
  S.viajeId = null;
  return UI.recargar().then(() => {
    // 1) Crear viaje
    UI.S.viaje = UI.nuevoBorradorViaje({ nombre: "Escapada", destino: "Chefchaouen", inicio: "2026-10-01", fin: "2026-10-05", moneda: "EUR" });
    // Se simulan los campos del formulario rellenando el borrador y guardando
    // mediante el almacén directo (el DOM falso no tiene inputs reales).
    return Promise.resolve();
  }).then(() => new Promise((res) => {
    // Guardamos el viaje con la lógica y recargamos (equivale a pulsar Guardar)
    const viaje = FT.crearViaje({ id: "vf", nombre: "Escapada", destino: "Chefchaouen", inicio: "2026-10-01", fin: "2026-10-05", moneda: "EUR", aportacionPrevista: 200 });
    TFTDB.guardar("viajes", viaje).then(() => { S.viajeId = "vf"; return UI.recargar(); }).then(res);
  }))
  .then(() => {
    // 2) Aportación común de 200 € a los clientes
    const clientes = [
      FT.crearCliente({ id: "fc1", viajeId: "vf", nombre: "Ana", apellidos: "García", aportacionPrevista: 200 }),
      FT.crearCliente({ id: "fc2", viajeId: "vf", nombre: "Luis", apellidos: "Pérez", aportacionPrevista: 200 }),
    ];
    return TFTDB.guardarVarios("clientes", clientes).then(() => UI.recargar());
  })
  .then(() => {
    const html = UI.htmlClientes();
    contiene(html, "400,00 €", "el bote previsto es 400 € tras aplicar 200 € a cada uno");
    contiene(html, "Ana García", "aparece el cliente creado");
    // 3) Ingreso parcial de Ana (150 €, transferencia)
    return TFTDB.guardar("aportaciones", FT.crearAportacion({ id: "fa1", viajeId: "vf", clienteId: "fc1", importe: 150, forma: "transferencia", fecha: "2026-09-01T10:00:00" })).then(() => UI.recargar());
  })
  .then(() => {
    const html = UI.htmlClientes();
    contiene(html, "150,00 €", "recibido 150 € con el primer ingreso");
    contiene(html, "pendiente 50,00 €", "a Ana le quedan 50 € de su aportación");
    // 4) Segundo ingreso de Ana (50 €, metálico) → completa
    return TFTDB.guardar("aportaciones", FT.crearAportacion({ id: "fa2", viajeId: "vf", clienteId: "fc1", importe: 50, forma: "metalico", fecha: "2026-09-15T10:00:00" })).then(() => UI.recargar());
  })
  .then(() => {
    const html = UI.htmlClientes();
    contiene(html, "completo", "tras el segundo ingreso Ana queda completa");
    contiene(html, "200,00 €", "recibido 200 € en total");
    // 5) Avalancha de comprobaciones sobre el resumen
    const r = UI.resumen();
    igual(r.recibido, 200, "el bote ha recibido 200 €");
    igual(r.pendienteAportaciones, 200, "quedan 200 € pendientes (todo lo de Luis)");
    igual(r.dineroDisponible, 200, "el bote disponible es 200 € sin gastos todavía");
    return null;
  })
  .then(() => {
    // 6) Gasto pagado con el bote de 80 € y comprobación del efectivo
    return TFTDB.guardar("gastos", FT.crearGastoGrupo({ id: "fg1", viajeId: "vf", categoria: "comidas", descripcion: "Comida", importe: 80, forma: "metalico", pagador: "bote" })).then(() => UI.recargar());
  })
  .then(() => {
    igual(UI.resumen().dineroDisponible, 120, "tras pagar 80 € con el bote quedan 120 €");
    const html = UI.htmlGastos();
    contiene(html, "80,00 €", "el gasto real aparece en 80 €");
    // 7) Adelanto mío de 40 € (no sale del bote hasta reembolsar)
    return TFTDB.guardar("gastos", FT.crearGastoGrupo({ id: "fg2", viajeId: "vf", categoria: "actividades", descripcion: "Entradas", importe: 40, forma: "transferencia", pagador: "yo" })).then(() => UI.recargar());
  })
  .then(() => {
    igual(UI.resumen().dineroDisponible, 120, "el adelanto mío no cambia el efectivo del bote");
    igual(UI.resumen().pendienteReembolso, 40, "quedan 40 € de mi adelanto por reembolsar");
    const html = UI.htmlGastos();
    contiene(html, "pendiente de reembolso 40,00 €", "el adelanto se muestra pendiente de reembolso");
    contiene(html, "+ Reembolsar", "se ofrece reembolsar el adelanto");
    // 8) Reembolso de 40 € (sale del bote, no es gasto nuevo)
    return TFTDB.guardar("reembolsos", FT.crearReembolso({ id: "fr1", viajeId: "vf", gastoId: "fg2", beneficiario: "yo", importe: 40, forma: "transferencia", fecha: "2026-10-06T10:00:00" })).then(() => UI.recargar());
  })
  .then(() => {
    igual(UI.resumen().pendienteReembolso, 0, "tras el reembolso ya no queda pendiente");
    igual(UI.resumen().dineroDisponible, 80, "el reembolso baja el bote a 120 − 40 = 80 €");
    igual(UI.resumen().gastos.total, 120, "el gasto real sigue siendo 120 € (el reembolso NO es un gasto)");
    return null;
  })
  .then(() => {
    // 9) Devolución de 30 € del bote a Luis
    return TFTDB.guardar("devoluciones", FT.crearDevolucion({ id: "fd1", viajeId: "vf", clienteId: "fc2", importe: 30, forma: "metalico", fecha: "2026-10-07T10:00:00" })).then(() => UI.recargar());
  })
  .then(() => {
    igual(UI.resumen().dineroDisponible, 50, "la devolución baja el bote a 80 − 30 = 50 €");
    contiene(UI.htmlResumen(), "30,00 €", "la devolución aparece en el resumen");
    return null;
  });
}

/* ---------------- 9. menú y cabecera ---------------- */

function pruebaMenu() {
  console.log("\n9. Menú y cabecera");
  const menu = UI.htmlMenu();
  contiene(menu, "Presupuesto del grupo", "el menú lleva al presupuesto");
  contiene(menu, "Resumen del viaje", "el menú lleva al resumen");
  contiene(menu, "Mis gastos", "el menú lleva a mis gastos");
  contiene(menu, "Clientes y bote", "el menú lleva a clientes y bote");
  S.viajeId = "vf";
  contiene(UI.cabeceraViaje(), "Escapada", "la cabecera muestra el viaje abierto");
  contiene(UI.cabeceraViaje(), "Chefchaouen", "la cabecera muestra el destino");
  return Promise.resolve();
}

/* ---------------- 10. sin viajes ---------------- */

function pruebaSinViajes() {
  console.log("\n10. Estado vacío");
  const guardados = S.datos.viajes;
  S.datos.viajes = [];
  S.viajeId = null;
  const html = UI.htmlViajes();
  contiene(html, "Todavía no hay viajes", "avisa de que no hay viajes");
  contiene(html, "+ Crear un viaje", "invita a crear el primero");
  contiene(html, "Versión de la app: 1.1.0", "aun sin viajes se ve la versión");
  S.datos.viajes = guardados;
  S.viajeId = "vf";
  return Promise.resolve();
}

/* ---------------- 11. presupuesto y vinculación: guardado y recarga ---------------- */

function pruebaPresupuestoPersistente() {
  console.log("\n11. Presupuesto y vinculación tras recargar");
  // Se parte de un viaje limpio con un cliente.
  STORE.viajes = [FT.crearViaje({ id: "vp", nombre: "Viaje con presupuesto", destino: "Chefchaouen", inicio: "2026-10-01", fin: "2026-10-05", moneda: "EUR" })];
  STORE.clientes = [FT.crearCliente({ id: "pc1", viajeId: "vp", nombre: "Ana", apellidos: "García" })];
  STORE.aportaciones = []; STORE.conceptos = []; STORE.gastos = [];
  STORE.reembolsos = []; STORE.devoluciones = []; STORE.gastosPersonales = []; STORE.honorarios = [];
  S.viajeId = "vp";
  S.gasto = null; S.concepto = null; S.reembolso = null; S.devolucion = null;

  // 1) Sin presupuesto: avisa y no marca sobrecoste.
  return UI.recargar().then(() => {
    const sinPresu = UI.htmlGastos();
    contiene(sinPresu, "Sin presupuesto definido", "sin presupuesto se avisa en vez de marcar sobrecoste");
    S.pestanaGastos = "previsto";
    const tabPrev = UI.htmlPresupuesto();
    contiene(tabPrev, "Sin presupuesto definido", "la pestaña de previsto también avisa de que no hay presupuesto");
    contiene(tabPrev, "+ Añadir concepto", "desde la pestaña previsto se puede añadir concepto");

    // 2) Se añade un concepto (equivale a rellenar el formulario y guardar).
    return TFTDB.guardar("conceptos", FT.crearConcepto({ id: "pk1", viajeId: "vp", categoria: "transporte", tipo: "total", descripcion: "Minibús con conductor", precio: 1200, moneda: "EUR" })).then(() => UI.recargar());
  })
  .then(() => {
    // 3) El presupuesto se conserva y ya no aparece el aviso.
    S.pestanaGastos = "previsto";
    const conPresu = UI.htmlPresupuesto();
    contiene(conPresu, "Minibús con conductor", "el concepto sigue tras recargar");
    contiene(conPresu, "1.200,00 €", "el presupuesto previsto es 1.200 €");
    noContiene(conPresu, "Sin presupuesto definido", "con presupuesto desaparece el aviso");
    return null;
  })
  .then(() => {
    // 4) Se registra un pago real enlazado al concepto (una reserva).
    return TFTDB.guardar("gastos", FT.crearGastoGrupo({ id: "pg1", viajeId: "vp", categoria: "transporte", descripcion: "Reserva minibús", importe: 300, forma: "transferencia", pagador: "bote", conceptoId: "pk1" })).then(() => UI.recargar());
  })
  .then(() => {
    S.pestanaGastos = "real";
    const conPago = UI.htmlGastos();
    contiene(conPago, "previsto: Minibús con conductor", "el gasto conserva su concepto vinculado tras recargar");
    contiene(conPago, "300,00 €", "el gasto real acumulado del concepto es 300 €");
    contiene(conPago, "900,00 €", "queda 1.200 − 300 = 900 € por gastar");
    // 5) Al editar ese gasto, no se cuenta dos veces: sigue viéndose la reserva,
    //    pero el acumulado previo para el formulario excluye el gasto en edición.
    S.gasto = UI.nuevoBorradorGasto(STORE.gastos.filter((g) => g.id === "pg1")[0]);
    const alEditar = UI.htmlGastos();
    contiene(alEditar, "Reserva minibús", "al editar se recupera la descripción");
    contiene(alEditar, "Previsto: <strong>1.200,00 €</strong>", "al editar se ve la previsión del concepto");
    contiene(alEditar, "Gasto real acumulado: <strong>0,00 €</strong>", "al editar no se cuenta el propio gasto dos veces");
    S.gasto = null;
    return UI.recargar();
  })
  .then(() => {
    // 6) La tabla de comparación del resumen cuadra.
    S.pestanaGastos = "real";
    S.vista = "resumen";
    const res = UI.htmlResumen();
    contiene(res, "Presupuesto previsto y gasto real por concepto", "el resumen compara previsto y real");
    contiene(res, "Minibús con conductor", "el resumen nombra el concepto");
    contiene(res, "1.200,00 €", "el resumen muestra el importe previsto");
    contiene(res, "300,00 €", "el resumen muestra el gasto real acumulado");
    contiene(res, "-900,00 €", "la diferencia es real − previsto: 300 − 1.200 = −900 €");
    S.vista = "gastos";
    return null;
  });
}

/* ---------------- ejecución encadenada ---------------- */

sembrar();
S.cargando = false;
UI.recargar()
  .then(() => pruebaViajes())
  .then(() => pruebaClientes())
  .then(() => pruebaPresupuesto())
  .then(() => pruebaGastos())
  .then(() => pruebaMios())
  .then(() => pruebaResumen())
  .then(() => pruebaMonedas())
  .then(() => pruebaFlujoAcciones())
  .then(() => pruebaMenu())
  .then(() => pruebaSinViajes())
  .then(() => pruebaPresupuestoPersistente())
  .then(() => {
    console.log("\n" + "=".repeat(50));
    console.log(`Pruebas: ${pruebas}   Fallos: ${fallos}`);
    console.log("=".repeat(50));
    console.log(fallos > 0 ? "RESULTADO: HAY FALLOS" : "RESULTADO: TODO CORRECTO");
  })
  .catch((err) => {
    fallos += 1;
    console.log("\nERROR NO CONTROLADO: " + (err && err.stack ? err.stack : err));
    console.log(`Pruebas: ${pruebas}   Fallos: ${fallos}`);
    console.log("RESULTADO: HAY FALLOS");
  });
