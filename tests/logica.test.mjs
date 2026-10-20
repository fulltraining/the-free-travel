/* ============================================================
   The Free Travel — pruebas de cálculos y reglas de negocio
   Se ejecutan con QuickJS:  qjs tests/logica.test.mjs

   Comprueban con datos temporales:
   - las seis formas de cálculo del presupuesto,
   - las aportaciones parciales al bote común,
   - los adelantos y sus reembolsos (sin contar dos veces),
   - el saldo real del bote,
   - las monedas (dírhams marroquíes, etc.),
   - los honorarios y mis gastos personales,
   - la exportación e importación.
   Ningún dato de estas pruebas se guarda en la aplicación.
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

function igual(a, b, mensaje) {
  ok(a === b, `${mensaje} (esperado «${b}», sale «${a}»)`);
}

function casi(a, b, mensaje) {
  ok(Math.abs(Number(a) - Number(b)) < 0.005, `${mensaje} (esperado «${b}», sale «${a}»)`);
}

eval(std.loadFile("js/logica.js"));
const FT = globalThis.FT;

/* ---------------- 0. catálogos ---------------- */

console.log("\n0. Catálogos");
igual(FT.APP, "the-free-travel", "la app se identifica como the-free-travel");
igual(FT.MONEDA_BASE, "EUR", "la moneda base es el euro");
igual(FT.CATEGORIAS.length, 5, "hay 5 categorías de gasto del grupo");
igual(FT.TIPOS_CALCULO_ORDEN.length, 6, "hay 6 formas de cálculo del presupuesto");
igual(FT.FORMAS_PAGO_ORDEN.length, 2, "hay 2 formas de pago (metálico y transferencia)");
igual(FT.PAGADORES_ORDEN.length, 3, "hay 3 pagadores (bote, yo, cliente)");
ok(FT.MONEDAS.some((m) => m.id === "MAD"), "el dírham marroquí está entre las monedas");
ok(!!FT.TIPOS_CALCULO.personaNoche, "existe el cálculo por persona y noche");
ok(!!FT.TIPOS_CALCULO.habitacionNoche, "existe el cálculo por habitación y noche");

/* ---------------- 1. dinero y monedas ---------------- */

console.log("\n1. Dinero y monedas");
igual(FT.euros(1234.5), "1.234,50 €", "1.234,50 € se formatea con puntos de millar");
igual(FT.euros(0), "0,00 €", "0 se formatea como 0,00 €");
igual(FT.aNumero("1.234,56"), 1234.56, "se lee «1.234,56» como número");
igual(FT.aNumero("1234.56"), 1234.56, "se lee «1234.56» como número");
igual(FT.aNumero("10,50"), 10.5, "se lee «10,50» como número");
igual(FT.aNumero(""), 0, "un importe vacío vale 0");
igual(FT.aNumero("abc"), 0, "un importe sin números vale 0");
casi(FT.aEuros(1080, "MAD", 10.8), 100, "1.080 MAD a 10,8 son 100 €");
casi(FT.aEuros(100, "EUR", 1), 100, "100 € son 100 €");
casi(FT.aEuros(10800, "MAD", 10.8), 1000, "10.800 MAD a 10,8 son 1.000 €");
igual(FT.deEuros(100, "MAD", 10.8), 1080, "100 € a 10,8 son 1.080 MAD");
igual(FT.etiquetaCambio("MAD", 10.8), "1 € = 10.8 MAD", "la etiqueta del cambio dice «1 € = 10.8 MAD»");
igual(FT.aEuros(100, "MAD", 0), 0, "sin cambio no se puede convertir (0)");
igual(FT.formatearMoneda(1234.5, "MAD"), "1.234,50 MAD", "el importe en dírhams lleva su símbolo");
igual(FT.formatearMoneda(1000, "JPY"), "1.000 ¥", "el yen no lleva decimales");

/* ---------------- 2. fechas ---------------- */

console.log("\n2. Fechas");
igual(FT.fechaDia("2026-10-18T21:04:07"), "2026-10-18", "se extrae el día de una fecha con hora");
igual(FT.fechaCorta("2026-10-18T21:04:07"), "18/10/2026", "la fecha se muestra como 18/10/2026");
igual(FT.fechaHoraCorta("2026-10-18T21:04:07"), "18/10/2026 21:04", "la fecha con hora muestra 21:04");
igual(FT.diasEntre("2026-10-01", "2026-10-05"), 4, "del 1 al 5 de octubre hay 4 días de diferencia");
igual(FT.diasEntre("2026-10-01", "2026-10-01"), 0, "el mismo día son 0 días de diferencia");
const viajePrueba = FT.crearViaje({ nombre: "Marruecos", destino: "Chefchaouen", inicio: "2026-10-01", fin: "2026-10-05", moneda: "EUR" });
igual(FT.duracionViaje(viajePrueba), 5, "un viaje del 1 al 5 de octubre dura 5 días (ambos incluidos)");
igual(FT.nochesViaje(viajePrueba), 4, "ese mismo viaje son 4 noches");

/* ---------------- 3. viajes ---------------- */

console.log("\n3. Viajes");
const viaje = FT.crearViaje({
  nombre: "  Ruta por Marruecos  ",
  destino: "Chefchaouen",
  inicio: "2026-10-01",
  fin: "2026-10-08",
  moneda: "MAD",
  observaciones: "Grupo de amigos",
});
igual(viaje.nombre, "Ruta por Marruecos", "el nombre del viaje se recorta");
igual(viaje.destino, "Chefchaouen", "el destino se guarda");
igual(viaje.moneda, "MAD", "la moneda principal del viaje se guarda");
ok(!!viaje.id, "el viaje recibe un identificador");
ok(!!viaje.creado, "el viaje guarda cuándo se creó");

igual(FT.validarViaje({}).length, 4, "un viaje vacío da 4 errores (nombre, destino, inicio y fin)");
igual(FT.validarViaje({ nombre: "X", destino: "Y", inicio: "2026-10-05", fin: "2026-10-01" }).length, 1,
  "si el fin es anterior al inicio se avisa");
igual(FT.validarViaje({ nombre: "X", destino: "Y", inicio: "2026-10-01", fin: "2026-10-05" }).length, 0,
  "un viaje correcto no da errores");
igual(FT.validarViaje({ nombre: "X", destino: "Y", inicio: "2026-10-01", fin: "2026-10-05", moneda: "XXX" }).length, 1,
  "una moneda inventada se rechaza");

const viajeMarruecos = FT.crearViaje({ id: "v1", nombre: "Marruecos", destino: "Chefchaouen", inicio: "2026-10-01", fin: "2026-10-07", moneda: "EUR" });
const viajePeru = FT.crearViaje({ id: "v2", nombre: "Perú", destino: "Cusco", inicio: "2027-04-10", fin: "2027-04-20", moneda: "PEN" });
const viajes = [viajeMarruecos, viajePeru];
igual(FT.viajePorId(viajes, "v2").nombre, "Perú", "se encuentra un viaje por su id");
igual(FT.viajePorId(viajes, "nada"), null, "un viaje que no existe devuelve null");
igual(FT.compararViajes(viajeMarruecos, viajePeru), 1, "los viajes se ordenan con el más reciente primero");

/* ---------------- 4. clientes y nº de clientes ---------------- */

console.log("\n4. Clientes");
const ana = FT.crearCliente({ id: "c1", viajeId: "v1", nombre: "Ana", apellidos: "García", aportacionPrevista: 300 });
const luis = FT.crearCliente({ id: "c2", viajeId: "v1", nombre: "Luis", apellidos: "Pérez", aportacionPrevista: 300 });
const marta = FT.crearCliente({ id: "c3", viajeId: "v1", nombre: "Marta", apellidos: "Ruiz", aportacionPrevista: 300 });
const clienteOtroViaje = FT.crearCliente({ id: "c9", viajeId: "v2", nombre: "Pedro", apellidos: "Soto", aportacionPrevista: 100 });
const clientes = [ana, luis, marta, clienteOtroViaje];

igual(FT.nombreCliente(ana), "Ana García", "el nombre completo une nombre y apellidos");
igual(FT.validarCliente({}).length, 2, "un cliente sin nombre ni apellidos da 2 errores");
igual(FT.validarCliente({ nombre: "Ana" }).length, 1, "un cliente sin apellidos da 1 error");
igual(FT.clientesDeViaje(clientes, "v1").length, 3, "el viaje de Marruecos tiene 3 clientes");
igual(FT.numeroDeClientes(clientes, "v1"), 3, "el número de clientes se calcula: 3");
igual(FT.numeroDeClientes(clientes, "v2"), 1, "el viaje de Perú tiene 1 cliente");
igual(FT.numeroDeClientes(clientes, "v9"), 0, "un viaje sin clientes tiene 0");

/* aportación común a todos y luego cambio individual */
const conComun = FT.aplicarAportacionComun(clientes, "v1", 350);
igual(FT.clientePorId(conComun, "c1").aportacionPrevista, 350, "la aportación común se aplica a Ana");
igual(FT.clientePorId(conComun, "c9").aportacionPrevista, 100, "la aportación común no toca otros viajes");
const soloAna = conComun.map((c) => (c.id === "c1" ? Object.assign({}, c, { aportacionPrevista: 400 }) : c));
igual(FT.clientePorId(soloAna, "c1").aportacionPrevista, 400, "la aportación de Ana se cambia solo para ella");
igual(FT.clientePorId(soloAna, "c2").aportacionPrevista, 350, "Luis conserva la aportación común");

const buscados = FT.buscarClientes(clientes, "v1", "marta");
igual(buscados.length, 1, "se busca «marta» sin importar mayúsculas");
igual(FT.buscarClientes(clientes, "v1", "garcia").length, 1, "se busca «garcia» sin acento");

/* ---------------- 5. aportaciones parciales al bote ---------------- */

console.log("\n5. Aportaciones al bote común");
const aportaciones = [
  FT.crearAportacion({ id: "a1", viajeId: "v1", clienteId: "c1", importe: 100, fecha: "2026-09-01T10:00:00", forma: "transferencia" }),
  FT.crearAportacion({ id: "a2", viajeId: "v1", clienteId: "c1", importe: 100, fecha: "2026-09-15T10:00:00", forma: "metalico" }),
  FT.crearAportacion({ id: "a3", viajeId: "v1", clienteId: "c2", importe: 150, fecha: "2026-09-10T10:00:00", forma: "transferencia" }),
];
igual(FT.validarAportacion({ viajeId: "v1", clienteId: "c1", importe: 50, forma: "metalico" }).length, 0,
  "una aportación correcta no da errores");
igual(FT.validarAportacion({ viajeId: "v1", clienteId: "c1", importe: 50 }).length, 1,
  "una aportación sin forma de entrega se rechaza");
igual(FT.validarAportacion({ viajeId: "v1", clienteId: "c1", importe: 0, forma: "metalico" }).length, 1,
  "una aportación de 0 € se rechaza");

const resumenAna = FT.aportacionesDeClienteResumen(aportaciones, ana);
igual(resumenAna.entregado, 200, "Ana ha entregado 200 € en dos ingresos");
igual(resumenAna.nIngresos, 2, "Ana tiene 2 ingresos registrados");
igual(resumenAna.previsto, 300, "la aportación prevista de Ana es 300 €");
igual(resumenAna.pendiente, 100, "a Ana le quedan 100 € por entregar");
igual(resumenAna.exceso, 0, "Ana no ha aportado de más");
ok(!resumenAna.completo, "Ana aún no ha completado su aportación");

const resumenLuis = FT.aportacionesDeClienteResumen(aportaciones, luis);
igual(resumenLuis.entregado, 150, "Luis ha entregado 150 €");
igual(resumenLuis.pendiente, 150, "a Luis le quedan 150 €");

const anaExcedida = FT.crearCliente({ id: "c1", viajeId: "v1", nombre: "Ana", apellidos: "García", aportacionPrevista: 150 });
const resumenExceso = FT.aportacionesDeClienteResumen(aportaciones, anaExcedida);
igual(resumenExceso.exceso, 50, "si aporta 200 € con previsión de 150 €, el exceso es 50 €");
igual(resumenExceso.pendiente, 0, "con exceso no queda pendiente");
ok(resumenExceso.completo, "con exceso la aportación está completa");

const sinAportaciones = FT.aportacionesDeClienteResumen([], marta);
igual(sinAportaciones.entregado, 0, "un cliente sin ingresos ha entregado 0 €");
igual(sinAportaciones.pendiente, 300, "un cliente sin ingresos debe todo lo previsto");
igual(sinAportaciones.nIngresos, 0, "un cliente sin ingresos tiene 0 ingresos");

/* ---------------- 6. presupuesto: las seis formas de cálculo ---------------- */

console.log("\n6. Presupuesto del grupo");

const presu = {
  total: FT.crearConcepto({ id: "k1", viajeId: "v1", categoria: "transporte", tipo: "total", descripcion: "Furgoneta", precio: 600, moneda: "EUR" }),
  persona: FT.crearConcepto({ id: "k2", viajeId: "v1", categoria: "actividades", tipo: "persona", descripcion: "Entrada museo", precio: 15, personas: 3, moneda: "EUR" }),
  personaNoche: FT.crearConcepto({ id: "k3", viajeId: "v1", categoria: "alojamiento", tipo: "personaNoche", descripcion: "Hotel", precio: 40, personas: 3, noches: 4, moneda: "EUR" }),
  habitacionNoche: FT.crearConcepto({ id: "k4", viajeId: "v1", categoria: "alojamiento", tipo: "habitacionNoche", descripcion: "Casa rural", precio: 90, habitaciones: 2, noches: 3, moneda: "EUR" }),
  dia: FT.crearConcepto({ id: "k5", viajeId: "v1", categoria: "transporte", tipo: "dia", descripcion: "Conductor", precio: 120, dias: 5, moneda: "EUR" }),
  unidad: FT.crearConcepto({ id: "k6", viajeId: "v1", categoria: "otros", tipo: "unidad", descripcion: "Seguros", precio: 12, unidades: 3, moneda: "EUR" }),
};

const cTotal = FT.calcularConcepto(presu.total, { personasViaje: 3, noches: 4 });
igual(cTotal.importe, 600, "importe total del grupo: 600 €");
igual(cTotal.importeEuros, 600, "importe total del grupo en euros: 600 €");

const cPersona = FT.calcularConcepto(presu.persona, { personasViaje: 3, noches: 4 });
igual(cPersona.importe, 45, "precio por persona: 15 € × 3 = 45 €");
igual(cPersona.formula, "precio × personas", "la fórmula mostrada es «precio × personas»");

const cPersonaNoche = FT.calcularConcepto(presu.personaNoche, { personasViaje: 3, noches: 4 });
igual(cPersonaNoche.importe, 480, "precio por persona y noche: 40 € × 3 × 4 = 480 €");
igual(cPersonaNoche.formula, "precio × personas × noches", "la fórmula es «precio × personas × noches»");

const cHabitacionNoche = FT.calcularConcepto(presu.habitacionNoche, { personasViaje: 3, noches: 4 });
igual(cHabitacionNoche.importe, 540, "precio por habitación y noche: 90 € × 2 × 3 = 540 €");

const cDia = FT.calcularConcepto(presu.dia, { personasViaje: 3, noches: 4 });
igual(cDia.importe, 600, "precio por día: 120 € × 5 = 600 €");

const cUnidad = FT.calcularConcepto(presu.unidad, { personasViaje: 3, noches: 4 });
igual(cUnidad.importe, 36, "precio por unidad: 12 € × 3 = 36 €");

const cSinPersonas = FT.calcularConcepto(
  FT.crearConcepto({ viajeId: "v1", categoria: "actividades", tipo: "persona", descripcion: "Cena", precio: 20 }),
  { personasViaje: 3, noches: 4 }
);
igual(cSinPersonas.importe, 60, "si no se indica, «personas» toma las del viaje: 20 € × 3 = 60 €");

const cParcial = FT.calcularConcepto(
  FT.crearConcepto({ viajeId: "v1", categoria: "comidas", tipo: "persona", descripcion: "Cena de 2", precio: 30, personas: 2 }),
  { personasViaje: 6, noches: 4 }
);
igual(cParcial.importe, 60, "un gasto puede cubrir solo a 2 personas de las 6: 30 € × 2 = 60 €");

const cParcialNoche = FT.calcularConcepto(
  FT.crearConcepto({ viajeId: "v1", categoria: "alojamiento", tipo: "personaNoche", descripcion: "Solo 2 duermen", precio: 50, personas: 2, noches: 3 }),
  { personasViaje: 6, noches: 5 }
);
igual(cParcialNoche.importe, 300, "2 personas × 3 noches a 50 € = 300 € (no se asume el grupo entero)");

const cMarruecos = FT.calcularConcepto(
  FT.crearConcepto({ viajeId: "v1", categoria: "alojamiento", tipo: "total", descripcion: "Riad", precio: 5400, moneda: "MAD", cambio: 10.8 }),
  { personasViaje: 3, noches: 4 }
);
igual(cMarruecos.importe, 5400, "el riad cuesta 5.400 MAD");
casi(cMarruecos.importeEuros, 500, "5.400 MAD a 10,8 son 500 €");

const totalPresupuesto = FT.presupuestoDeViaje(Object.keys(presu).map((k) => presu[k]), "v1", { personas: 3, noches: 4 });
igual(totalPresupuesto.total, 2301, "el presupuesto total del grupo suma 2.301 €");
igual(totalPresupuesto.nConceptos, 6, "hay 6 conceptos en el presupuesto");
igual(totalPresupuesto.costeMedio, 767, "el coste medio por cliente es 2.301 € / 3 = 767 €");
igual(totalPresupuesto.porCategoria.transporte.total, 1200, "transporte: 600 € + 600 € = 1.200 €");
igual(totalPresupuesto.porCategoria.alojamiento.total, 1020, "alojamiento: 480 € + 540 € = 1.020 €");

const presupuestoSinClientes = FT.presupuestoDeViaje(Object.keys(presu).map((k) => presu[k]), "v1", { personas: 0, noches: 4 });
igual(presupuestoSinClientes.costeMedio, 0, "sin clientes el coste medio es 0 (no se divide por cero)");

/* los conceptos con tipo desconocido no rompen nada */
const conceptoRaro = FT.calcularConcepto({ tipo: "inventado", precio: 100 }, {});
igual(conceptoRaro.importe, 100, "un tipo de cálculo desconocido se trata como importe total");

/* ---------------- 7. gastos reales del grupo ---------------- */

console.log("\n7. Gastos reales del grupo");
const gBote = FT.crearGastoGrupo({ id: "g1", viajeId: "v1", categoria: "transporte", descripcion: "Gasolina", importe: 120, forma: "metalico", pagador: "bote", fecha: "2026-10-02T09:00:00" });
const gYo = FT.crearGastoGrupo({ id: "g2", viajeId: "v1", categoria: "comidas", descripcion: "Cena del grupo", importe: 90, forma: "transferencia", pagador: "yo", fecha: "2026-10-03T21:00:00" });
const gCliente = FT.crearGastoGrupo({ id: "g3", viajeId: "v1", categoria: "actividades", descripcion: "Entradas", importe: 60, forma: "metalico", pagador: "cliente", clienteId: "c1", fecha: "2026-10-04T11:00:00" });
const gastos = [gBote, gYo, gCliente];

igual(FT.validarGastoGrupo({ viajeId: "v1", descripcion: "X", importe: 10, forma: "metalico", pagador: "bote" }).length, 0,
  "un gasto del grupo correcto no da errores");
igual(FT.validarGastoGrupo({ viajeId: "v1", descripcion: "X", importe: 10, forma: "metalico", pagador: "cliente" }).length, 1,
  "si paga un cliente hay que elegirlo");
igual(FT.validarGastoGrupo({ viajeId: "v1", descripcion: "X", importe: 10, pagador: "bote" }).length, 1,
  "un gasto sin forma de pago se rechaza");

igual(FT.reembolsadoDeGasto(gYo), 0, "un adelanto sin reembolsos tiene 0 € devueltos");
igual(FT.pendienteDeGasto(gYo), 90, "el adelanto de 90 € está pendiente de reembolso");
igual(FT.pendienteDeGasto(gBote), 0, "un gasto pagado con el bote no genera reembolso");
igual(FT.pendienteDeGasto(gCliente), 60, "el adelanto del cliente de 60 € está pendiente");

const gYoConReembolso = FT.crearGastoGrupo({
  id: "g2", viajeId: "v1", categoria: "comidas", descripcion: "Cena del grupo", importe: 90,
  forma: "transferencia", pagador: "yo", reembolsos: [{ id: "r1", fecha: "2026-10-10T10:00:00", importe: 50, forma: "transferencia" }],
});
igual(FT.reembolsadoDeGasto(gYoConReembolso), 50, "se han reembolsado 50 € de los 90 €");
igual(FT.pendienteDeGasto(gYoConReembolso), 40, "quedan 40 € pendientes de reembolso");

const gReembolsadoDelTodo = FT.crearGastoGrupo({
  id: "g4", viajeId: "v1", categoria: "comidas", descripcion: "Comida", importe: 90,
  forma: "transferencia", pagador: "yo", reembolsos: [{ id: "r2", fecha: "2026-10-10T10:00:00", importe: 90, forma: "transferencia" }],
});
igual(FT.pendienteDeGasto(gReembolsadoDelTodo), 0, "un adelanto ya reembolsado no queda pendiente");

const porCategoria = FT.gastosGrupoPorCategoria(gastos, "v1");
igual(porCategoria.total, 270, "el gasto real del grupo suma 270 € (bote 120 + yo 90 + cliente 60)");
igual(porCategoria.nGastos, 3, "hay 3 gastos reales");
igual(porCategoria.porCategoria.transporte.total, 120, "transporte real: 120 €");
igual(porCategoria.porCategoria.comidas.total, 90, "comidas reales: 90 €");
igual(porCategoria.porCategoria.actividades.total, 60, "actividades reales: 60 €");

/* un gasto mío cubierto por el grupo se cuenta una sola vez */
const gMioCubierto = FT.crearGastoGrupo({ id: "g5", viajeId: "v1", categoria: "otros", descripcion: "Seguro", importe: 30, forma: "transferencia", pagador: "yo", origen: FT.ORIGEN_PERSONAL });
ok(!FT.gastoGrupoCuentaComoGasto(gMioCubierto), "un gasto personal no se cuenta como gasto del grupo");
ok(FT.gastoGrupoCuentaComoGasto(gYo), "un gasto normal sí cuenta como gasto del grupo");

/* ---------------- 8. mis gastos personales ---------------- */

console.log("\n8. Mis gastos personales");
const misGastos = [
  FT.crearGastoPersonal({ id: "p1", viajeId: "v1", categoria: "vuelos", concepto: "Vuelo a Tánger", importe: 180, moneda: "EUR" }),
  FT.crearGastoPersonal({ id: "p2", viajeId: "v1", categoria: "comidas", concepto: "Comida", importe: 40, moneda: "EUR" }),
  FT.crearGastoPersonal({ id: "p3", viajeId: "v1", categoria: "otros", concepto: "Cubierto por el grupo", importe: 25, moneda: "EUR", cubiertoPorGrupo: true }),
];
igual(FT.validarGastoPersonal({ viajeId: "v1", concepto: "X", importe: 10 }).length, 0, "un gasto personal correcto no da errores");
igual(FT.validarGastoPersonal({ viajeId: "v1", concepto: "", importe: 0 }).length, 2, "sin concepto ni importe da 2 errores");

const misResumen = FT.misGastosPersonales(misGastos, "v1");
igual(misResumen.total, 220, "mis gastos personales suman 220 € (180 + 40); el cubierto por el grupo no cuenta");
igual(misResumen.cubiertosPorGrupo, 25, "25 € de mis gastos están cubiertos por el grupo");
igual(misResumen.nGastos, 3, "hay 3 gastos personales registrados");
igual(misResumen.porCategoria.vuelos.total, 180, "vuelos: 180 €");

/* ---------------- 9. honorarios ---------------- */

console.log("\n9. Mis honorarios");
const honorarios = [
  FT.crearHonorario({ id: "h1", viajeId: "v1", clienteId: "c1", previsto: 100, cobrado: 100, fecha: "2026-09-01T10:00:00", forma: "transferencia" }),
  FT.crearHonorario({ id: "h2", viajeId: "v1", clienteId: "c2", previsto: 100, cobrado: 40, fecha: "2026-09-20T10:00:00", forma: "metalico" }),
  FT.crearHonorario({ id: "h3", viajeId: "v1", clienteId: "c3", previsto: 100, cobrado: 0, fecha: "2026-09-25T10:00:00" }),
];
igual(FT.validarHonorario({ viajeId: "v1", clienteId: "c1", previsto: 100 }).length, 0, "un honorario correcto no da errores");
igual(FT.validarHonorario({ viajeId: "v1", clienteId: "c1" }).length, 1, "un honorario sin importes se rechaza");

const resHon = FT.resumenHonorarios(honorarios, "v1");
igual(resHon.previsto, 300, "los honorarios previstos suman 300 €");
igual(resHon.cobrado, 140, "los honorarios cobrados suman 140 €");
igual(resHon.pendiente, 160, "quedan 160 € pendientes de cobro");
igual(resHon.nClientes, 3, "hay 3 clientes con honorarios previstos");

/* ---------------- 10. resumen del viaje: saldo del bote ---------------- */

console.log("\n10. Resumen del viaje (saldo del bote)");

/* Caso de control completo:
   - 3 clientes con 300 € previstos cada uno (bote previsto 900 €).
   - Aportaciones recibidas: Ana 200 €, Luis 150 € → 350 €.
   - Gasto pagado con el bote: 120 €.
   - Adelanto mío de 90 € (pendiente de reembolso).
   - Reembolso registrado: 50 € al organizador.
   - Resto del bote: 350 − 120 − 50 = 180 €. El adelanto pendiente (40 €) NO se descuenta.
*/
const reembolsos = [FT.crearReembolso({ id: "r1", viajeId: "v1", gastoId: "g2", beneficiario: "yo", importe: 50, forma: "transferencia", fecha: "2026-10-10T10:00:00" })];
const devoluciones = [FT.crearDevolucion({ id: "d1", viajeId: "v1", clienteId: "c3", importe: 20, forma: "metalico", fecha: "2026-10-12T10:00:00" })];

const resumen = FT.resumenDelViaje({
  viaje: viajeMarruecos,
  clientes: [ana, luis, marta],
  aportaciones: aportaciones,
  conceptos: Object.keys(presu).map((k) => presu[k]),
  gastos: [gBote, gYo, gCliente],
  reembolsos: reembolsos,
  devoluciones: devoluciones,
  gastosPersonales: misGastos,
  honorarios: honorarios,
});

igual(resumen.nClientes, 3, "el resumen cuenta 3 clientes");
igual(resumen.botePrevisto, 900, "el bote previsto es 900 € (3 × 300 €)");
igual(resumen.recibido, 350, "las aportaciones recibidas suman 350 €");
igual(resumen.pendienteAportaciones, 550, "quedan 550 € de aportaciones pendientes (Ana 100 + Luis 150 + Marta 300)");
igual(resumen.excesoAportaciones, 0, "nadie ha aportado de más");
igual(resumen.pagadoConBote, 120, "se han pagado 120 € con el bote");
igual(resumen.devoluciones.length, 1, "hay una devolución registrada");
igual(resumen.devuelto, 20, "se han devuelto 20 € del bote a un cliente");
igual(resumen.dineroDisponible, 160, "el bote disponible es 350 − 120 − 50 − 20 = 160 €");
igual(resumen.pendienteReembolso, 100, "quedan 100 € de adelantos por reembolsar (yo 40 tras el reembolso + cliente 60)");
igual(resumen.adelantosPendientes.length, 2, "hay 2 adelantos pendientes de reembolso");
igual(resumen.presupuesto.total, 2301, "el presupuesto del grupo es 2.301 €");
igual(resumen.gastos.total, 270, "el gasto real del grupo es 270 €");
igual(resumen.desviacion, -2031, "la desviación es −2.031 € (gastado menos que el presupuesto)");

/* Honorarios y resultado del organizador */
igual(resumen.honorarios.previsto, 300, "honorarios previstos: 300 €");
igual(resumen.honorarios.cobrado, 140, "honorarios cobrados: 140 €");
igual(resumen.misGastos.total, 220, "mis gastos personales: 220 €");
igual(resumen.resultadoPrevisto, 80, "resultado previsto: 300 − 220 = 80 €");
igual(resumen.resultadoReal, -80, "resultado real: 140 − 220 = −80 €");

/* Clave del enunciado: el bote disponible NO descuenta lo adelantado y no reembolsado.
   El adelanto mío de 90 € recibió un reembolso de 50 €, así que quedan 40 € pendientes;
   con el adelanto del cliente (60 €) hay 100 € de obligaciones pendientes, aparte. */
ok(resumen.dineroDisponible === 160 && resumen.pendienteReembolso === 100,
  "el efectivo del bote (160 €) no incluye los adelantos por reembolsar (100 €), que salen aparte");

/* El reembolso NO se cuenta dos veces como gasto */
const resumenSinReembolso = FT.resumenDelViaje({
  viaje: viajeMarruecos, clientes: [ana, luis, marta], aportaciones: aportaciones,
  conceptos: [], gastos: [gBote, gYo, gCliente], reembolsos: [], devoluciones: [], gastosPersonales: [], honorarios: [],
});
igual(resumenSinReembolso.gastos.total, resumen.gastos.total,
  "registrar un reembolso no cambia el gasto real del grupo");

/* bote vacío: sin movimientos, todo a cero */
const resumenVacio = FT.resumenDelViaje({ viaje: viajeMarruecos, clientes: [], aportaciones: [], conceptos: [], gastos: [], reembolsos: [], devoluciones: [], gastosPersonales: [], honorarios: [] });
igual(resumenVacio.dineroDisponible, 0, "sin movimientos el bote está a 0 €");
igual(resumenVacio.nClientes, 0, "sin clientes el resumen cuenta 0");
igual(resumenVacio.resultadoPrevisto, 0, "sin honorarios ni gastos el resultado es 0 €");

/* ---------------- 11. monedas en el resumen ---------------- */

console.log("\n11. Saldos por moneda");
const gastoMAD = FT.crearGastoGrupo({ id: "g6", viajeId: "v1", categoria: "comidas", descripcion: "Cena en dírhams", importe: 540, moneda: "MAD", cambio: 10.8, forma: "metalico", pagador: "bote" });
const gastoEUR = FT.crearGastoGrupo({ id: "g7", viajeId: "v1", categoria: "transporte", descripcion: "Taxi", importe: 30, moneda: "EUR", forma: "metalico", pagador: "bote" });
const saldos = FT.saldosPorMoneda({
  viajeId: "v1",
  viaje: viajeMarruecos,
  gastos: [gastoMAD, gastoEUR],
  gastosPersonales: [FT.crearGastoPersonal({ id: "p9", viajeId: "v1", categoria: "vuelos", concepto: "Vuelo", importe: 1080, moneda: "MAD", cambio: 10.8 })],
  aportaciones: aportaciones,
});
igual(saldos.monedas.length, 2, "hay movimientos en 2 monedas distintas (EUR y MAD)");
const filaMAD = saldos.monedas.filter((m) => m.moneda === "MAD")[0];
igual(filaMAD.gastosGrupo, 540, "en dírhams se han gastado 540 MAD para el grupo");
casi(filaMAD.gastosGrupoEuros, 50, "540 MAD equivalen a 50 €");
igual(filaMAD.cambio, 10.8, "el cambio guardado es 1 € = 10,8 MAD");
casi(saldos.totalGastosGrupoEuros, 80, "el total de gastos del grupo es 80 € al convertir monedas (50 € + 30 €)");

/* El cambio guardado no cambia si luego cambia el cambio general */
const gastoViejo = FT.crearGastoGrupo({ id: "g8", viajeId: "v1", categoria: "otros", descripcion: "Antiguo", importe: 1080, moneda: "MAD", cambio: 10.8, forma: "metalico", pagador: "bote" });
casi(FT.aEuros(gastoViejo.importe, gastoViejo.moneda, gastoViejo.cambio), 100,
  "un gasto antiguo en MAD conserva su cambio guardado (100 €)");

/* ---------------- 12. exportación e importación ---------------- */

console.log("\n12. Exportación e importación");
const csvC = FT.csvClientes({ viaje: viajeMarruecos, clientes: [ana, luis, marta], aportaciones: aportaciones });
ok(csvC.indexOf("Aportación prevista") !== -1, "el CSV de clientes tiene cabecera de aportación prevista");
ok(csvC.indexOf("Ana") !== -1, "el CSV de clientes incluye a Ana");
ok(csvC.indexOf("2") !== -1, "el CSV de clientes incluye el nº de ingresos");

const csvA = FT.csvAportaciones({ viaje: viajeMarruecos, clientes: [ana, luis, marta], aportaciones: aportaciones });
ok(csvA.indexOf("Forma de entrega") !== -1, "el CSV de aportaciones incluye la forma de entrega");
ok(csvA.indexOf("transferencia") !== -1 || csvA.indexOf("Transferencia") !== -1, "el CSV de aportaciones nombra la transferencia");

const csvG = FT.csvGastos({ viaje: viajeMarruecos, clientes: [ana, luis, marta], conceptos: [], gastos: [gBote, gYo, gCliente] });
ok(csvG.indexOf("Cambio (1 € = X)") !== -1, "el CSV de gastos incluye el tipo de cambio");
ok(csvG.indexOf("Quién paga") !== -1, "el CSV de gastos incluye quién paga");
ok(csvG.indexOf("Pendiente de reembolso") !== -1, "el CSV de gastos marca el pendiente de reembolso");
ok(csvG.indexOf("Bote común") !== -1, "el CSV nombra el bote común");

const exportado = FT.exportarDatos({
  viajes: [viajeMarruecos, viajePeru], clientes: clientes, aportaciones: aportaciones,
  conceptos: Object.keys(presu).map((k) => presu[k]), gastos: gastos, reembolsos: reembolsos,
  devoluciones: devoluciones, gastosPersonales: misGastos, honorarios: honorarios,
});
igual(exportado.app, "the-free-travel", "la copia se identifica como the-free-travel");
igual(exportado.viajes.length, 2, "la copia guarda los 2 viajes");
igual(exportado.clientes.length, 4, "la copia guarda los 4 clientes");
igual(exportado.gastos.length, 3, "la copia guarda los 3 gastos del grupo");
igual(exportado.honorarios.length, 3, "la copia guarda los 3 honorarios");

const leido = FT.leerImportacion(JSON.stringify(exportado));
ok(leido.ok, "una copia exportada se vuelve a leer sin errores");
igual(leido.viajes.length, 2, "se recuperan los 2 viajes de la copia");
igual(leido.clientes.length, 4, "se recuperan los 4 clientes de la copia");
igual(leido.gastos.length, 3, "se recuperan los 3 gastos del grupo de la copia");
igual(leido.gastosPersonales.length, 3, "se recuperan mis 3 gastos personales de la copia");
igual(leido.honorarios.length, 3, "se recuperan los 3 honorarios de la copia");
igual(leido.conceptos.length, 6, "se recuperan los 6 conceptos del presupuesto");
igual(leido.descartados, 0, "no se descarta ningún registro válido");

ok(!FT.leerImportacion("no es json").ok, "un texto que no es JSON se rechaza");
ok(!FT.leerImportacion("{}").ok, "un JSON sin lista de viajes se rechaza");
ok(!FT.leerImportacion("[1,2,3]").ok, "un JSON que no es un objeto se rechaza");

const conBasura = FT.leerImportacion(JSON.stringify({ viajes: [{ nombre: "Ok", destino: "D", inicio: "2026-01-01", fin: "2026-01-02" }, { nombre: "" }] }));
igual(conBasura.viajes.length, 1, "se descarta un viaje sin nombre al importar");
igual(conBasura.descartados, 1, "se cuenta 1 registro descartado");

/* Fusión: lo entrante manda por id, lo propio se conserva */
const fusion = FT.combinarDatos(
  { viajes: [viajeMarruecos], clientes: [ana, luis], aportaciones: [], conceptos: [], gastos: [], reembolsos: [], devoluciones: [], gastosPersonales: [], honorarios: [] },
  { viajes: [viajePeru], clientes: [marta], aportaciones: [], conceptos: [], gastos: [], reembolsos: [], devoluciones: [], gastosPersonales: [], honorarios: [] }
);
igual(fusion.viajes.length, 2, "al fusionar se conservan los viajes de ambos lados");
igual(fusion.clientes.length, 3, "al fusionar se juntan los clientes sin duplicar");

const fusionMismoId = FT.combinarDatos(
  { clientes: [FT.crearCliente({ id: "c1", viajeId: "v1", nombre: "Ana", apellidos: "García", aportacionPrevista: 300 })] },
  { clientes: [FT.crearCliente({ id: "c1", viajeId: "v1", nombre: "Ana", apellidos: "García", aportacionPrevista: 500 })] }
);
igual(fusionMismoId.clientes.length, 1, "el mismo cliente no se duplica al fusionar");
igual(fusionMismoId.clientes[0].aportacionPrevista, 500, "en caso de conflicto manda el registro importado");

/* ---------------- resumen final ---------------- */

console.log("\n" + "=".repeat(50));
console.log(`Pruebas: ${pruebas}   Fallos: ${fallos}`);
console.log("=".repeat(50));

if (fallos > 0) {
  console.log("RESULTADO: HAY FALLOS");
} else {
  console.log("RESULTADO: TODO CORRECTO");
}
