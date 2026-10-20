"use strict";
/* ============================================================
   The Free Travel · Gestión de viajes
   js/logica.js — reglas de negocio y cálculos.
   No toca el DOM ni IndexedDB: se usa en el navegador y en las
   pruebas con QuickJS (tests/logica.test.mjs).

   Idea clave de las cuentas:
   - El BOTE COMÚN es dinero de los clientes. Su saldo real es
     aportaciones cobradas − pagos hechos con el bote −
     reembolsos pagados − devoluciones a clientes.
   - Lo que ha adelantado una persona (yo o un cliente) NO sale
     del bote hasta que se le reembolsa: se muestra aparte como
     obligación pendiente.
   ============================================================ */

globalThis.FT = (function () {
  const APP = "the-free-travel";
  const VERSION = "1.0.0";

  const MONEDA_BASE = "EUR";
  const MONEDA_PRINCIPAL = "EUR"; // moneda en la que se muestran los totales globales

  /* Monedas habituales. El tipo de cambio se escribe siempre como
     «1 € = X unidades de la moneda», así que EUR vale 1. */
  const MONEDAS = [
    { id: "EUR", nombre: "Euro", simbolo: "€", porEuro: 1, decimales: 2 },
    { id: "MAD", nombre: "Dírham marroquí", simbolo: "MAD", porEuro: 10.8, decimales: 2 },
    { id: "USD", nombre: "Dólar estadounidense", simbolo: "$", porEuro: 1.08, decimales: 2 },
    { id: "GBP", nombre: "Libra esterlina", simbolo: "£", porEuro: 0.85, decimales: 2 },
    { id: "CHF", nombre: "Franco suizo", simbolo: "CHF", porEuro: 0.95, decimales: 2 },
    { id: "MXN", nombre: "Peso mexicano", simbolo: "MXN", porEuro: 18.5, decimales: 2 },
    { id: "ARS", nombre: "Peso argentino", simbolo: "ARS", porEuro: 950, decimales: 2 },
    { id: "COP", nombre: "Peso colombiano", simbolo: "COP", porEuro: 4200, decimales: 0 },
    { id: "PEN", nombre: "Sol peruano", simbolo: "S/", porEuro: 4.05, decimales: 2 },
    { id: "CLP", nombre: "Peso chileno", simbolo: "CLP", porEuro: 980, decimales: 0 },
    { id: "BRL", nombre: "Real brasileño", simbolo: "R$", porEuro: 5.4, decimales: 2 },
    { id: "TND", nombre: "Dinar tunecino", simbolo: "TND", porEuro: 3.35, decimales: 3 },
    { id: "TRY", nombre: "Lira turca", simbolo: "₺", porEuro: 35, decimales: 2 },
    { id: "THB", nombre: "Baht tailandés", simbolo: "฿", porEuro: 38, decimales: 2 },
    { id: "JPY", nombre: "Yen japonés", simbolo: "¥", porEuro: 160, decimales: 0 },
  ];

  const CATEGORIAS = [
    { id: "transporte", nombre: "Desplazamientos", detalle: "Vehículo, conductor, combustible, peajes, aparcamientos y otros transportes" },
    { id: "alojamiento", nombre: "Alojamientos", detalle: "Hoteles, casas, apartamentos…" },
    { id: "comidas", nombre: "Comidas", detalle: "Restaurantes, compras de comida…" },
    { id: "actividades", nombre: "Actividades y entradas", detalle: "Excursiones, museos, espectáculos…" },
    { id: "otros", nombre: "Otros gastos", detalle: "Seguros, tasas, imprevistos…" },
  ];
  const CATEGORIAS_ORDEN = ["transporte", "alojamiento", "comidas", "actividades", "otros"];

  /* Los mismos bloques que las categorías del grupo, para «Mis gastos». */
  const CATEGORIAS_PERSONALES = [
    { id: "vuelos", nombre: "Vuelos", detalle: "Billetes de avión y tasas" },
    { id: "alojamiento", nombre: "Alojamientos", detalle: "Mis noches de hotel" },
    { id: "comidas", nombre: "Comidas", detalle: "Mis comidas durante el viaje" },
    { id: "desplazamientos", nombre: "Desplazamientos", detalle: "Trenes, coches, taxis…" },
    { id: "actividades", nombre: "Actividades", detalle: "Entradas y excursiones" },
    { id: "otros", nombre: "Otros", detalle: "Cualquier otro gasto mío" },
  ];
  const CATEGORIAS_PERSONALES_ORDEN = ["vuelos", "alojamiento", "comidas", "desplazamientos", "actividades", "otros"];

  const FORMAS_PAGO = [
    { id: "metalico", nombre: "Metálico", detalle: "En efectivo" },
    { id: "transferencia", nombre: "Transferencia", detalle: "Banco o aplicación" },
  ];
  const FORMAS_PAGO_ORDEN = ["metalico", "transferencia"];

  /* Quién paga un gasto del grupo. */
  const PAGADORES = [
    { id: "bote", nombre: "Bote común", detalle: "Dinero de las aportaciones" },
    { id: "yo", nombre: "Yo (organizador)", detalle: "Lo adelanto y me lo reembolsan" },
    { id: "cliente", nombre: "Un cliente", detalle: "Lo adelanta y se le reembolsa" },
  ];
  const PAGADORES_ORDEN = ["bote", "yo", "cliente"];

  /* Formas de cálculo del presupuesto. «unidades» es lo que multiplica
     al precio: personas, noches, habitaciones, días o unidades. */
  const TIPOS_CALCULO = {
    total: { id: "total", nombre: "Importe total del grupo", detalle: "El precio ya es el total", formula: "precio", unidadesEtiqueta: "", unidades: ["fijo"] },
    persona: { id: "persona", nombre: "Precio por persona", detalle: "precio × personas", formula: "precio × personas", unidadesEtiqueta: "Personas", unidades: ["personas"] },
    personaNoche: { id: "personaNoche", nombre: "Precio por persona y noche", detalle: "precio × personas × noches", formula: "precio × personas × noches", unidadesEtiqueta: "Personas", unidades: ["personas", "noches"] },
    habitacionNoche: { id: "habitacionNoche", nombre: "Precio por habitación y noche", detalle: "precio × habitaciones × noches", formula: "precio × habitaciones × noches", unidadesEtiqueta: "Habitaciones", unidades: ["habitaciones", "noches"] },
    dia: { id: "dia", nombre: "Precio por día", detalle: "precio × días", formula: "precio × días", unidadesEtiqueta: "Días", unidades: ["dias"] },
    unidad: { id: "unidad", nombre: "Precio por unidad", detalle: "precio × unidades", formula: "precio × unidades", unidadesEtiqueta: "Unidades", unidades: ["unidades"] },
  };
  const TIPOS_CALCULO_ORDEN = ["total", "persona", "personaNoche", "habitacionNoche", "dia", "unidad"];

  /* Estados de un gasto personal: si está cubierto por el grupo se
     contabiliza UNA sola vez como gasto del grupo. */
  const ORIGEN_PERSONAL = "personal";
  const ORIGEN_GRUPO = "grupo";

  /* ---------------- utilidades de texto ---------------- */

  function dos(valor) {
    return String(valor).padStart(2, "0");
  }

  function nuevoId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function esc(texto) {
    return String(texto == null ? "" : texto)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const ACENTOS = {
    "á": "a", "à": "a", "ä": "a", "â": "a",
    "é": "e", "è": "e", "ë": "e", "ê": "e",
    "í": "i", "ì": "i", "ï": "i", "î": "i",
    "ó": "o", "ò": "o", "ö": "o", "ô": "o",
    "ú": "u", "ù": "u", "ü": "u", "û": "u",
    "ñ": "n", "ç": "c",
  };

  /** Minúsculas y sin acentos, para buscar sin importar cómo se escriba. */
  function plano(texto) {
    return String(texto == null ? "" : texto)
      .toLowerCase()
      .replace(/[áàäâéèëêíìïîóòöôúùüûñç]/g, (c) => ACENTOS[c] || c);
  }

  /* ---------------- fechas (hora local del móvil) ---------------- */

  /** Fecha y hora locales en ISO sin zona horaria: "2026-10-18T21:04:07". */
  function fechaLocalAhora(ahora) {
    const d = ahora || new Date();
    return (
      d.getFullYear() + "-" + dos(d.getMonth() + 1) + "-" + dos(d.getDate()) +
      "T" + dos(d.getHours()) + ":" + dos(d.getMinutes()) + ":" + dos(d.getSeconds())
    );
  }

  /** Fecha sin hora: "2026-10-18". */
  function fechaDia(iso) {
    return String(iso == null ? "" : iso).slice(0, 10);
  }

  function partesFecha(iso) {
    const s = String(iso == null ? "" : iso);
    const trozos = s.split("T");
    const p = trozos[0].split("-");
    const hora = trozos[1] ? trozos[1].slice(0, 5) : "";
    if (p.length !== 3) return { fecha: s, hora: "", dia: "", mes: "", anio: "" };
    return { fecha: p[2] + "/" + p[1] + "/" + p[0], hora: hora, dia: p[2], mes: p[1], anio: p[0] };
  }

  /** "2026-10-18T21:04:07" → "18/10/2026" */
  function fechaCorta(iso) { return partesFecha(iso).fecha; }

  /** "2026-10-18T21:04:07" → "18/10/2026 21:04" */
  function fechaHoraCorta(iso) {
    const p = partesFecha(iso);
    return p.hora ? p.fecha + " " + p.hora : p.fecha;
  }

  /** Días naturales entre dos fechas (inicio y fin incluidos → duración). */
  function diasEntre(desde, hasta) {
    const a = fechaDia(desde);
    const b = fechaDia(hasta);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return 0;
    const ms = new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime();
    if (!isFinite(ms)) return 0;
    return Math.round(ms / 86400000);
  }

  /** Duración de un viaje en días, contando el día de inicio y el de fin. */
  function duracionViaje(viaje) {
    const v = viaje || {};
    if (!v.inicio || !v.fin) return 0;
    return Math.max(0, diasEntre(v.inicio, v.fin) + 1);
  }

  function nochesViaje(viaje) {
    const v = viaje || {};
    if (!v.inicio || !v.fin) return 0;
    return Math.max(0, diasEntre(v.inicio, v.fin));
  }

  /* ---------------- dinero y monedas ---------------- */

  function decimalesDe(moneda) {
    const m = MONEDAS.filter((x) => x.id === moneda)[0];
    return m ? m.decimales : 2;
  }

  function monedaPorDefecto(moneda) {
    return MONEDAS.filter((m) => m.id === moneda)[0] || null;
  }

  /** Formatea con los decimales de la moneda y su símbolo: 1234.5 → "1.234,50 €" */
  function formatearMoneda(valor, moneda) {
    const id = moneda || MONEDA_BASE;
    const dec = decimalesDe(id);
    const m = monedaPorDefecto(id);
    const v = redondear(Number(valor) || 0, dec);
    const signo = v < 0 ? "-" : "";
    const trozos = Math.abs(v).toFixed(dec).split(".");
    const enteros = trozos[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const decimales = trozos[1] ? "," + trozos[1] : "";
    return signo + enteros + decimales + " " + (m ? m.simbolo : id);
  }

  function euros(valor) {
    return formatearMoneda(valor, MONEDA_BASE);
  }

  function redondear(valor, decimales) {
    const f = Math.pow(10, decimales == null ? 2 : decimales);
    return Math.round((Number(valor) || 0) * f) / f;
  }

  /** Acepta "1.234,56", "1234,56", "1234.56" y devuelve número. */
  function aNumero(valor) {
    if (typeof valor === "number") return isFinite(valor) ? valor : 0;
    let s = String(valor == null ? "" : valor).trim().replace(/\s/g, "");
    if (!s) return 0;
    const ultimaComa = s.lastIndexOf(",");
    const ultimoPunto = s.lastIndexOf(".");
    if (ultimaComa !== -1 && ultimoPunto !== -1) {
      // El último separador es el decimal; el otro es de millares.
      if (ultimaComa > ultimoPunto) s = s.replace(/\./g, "").replace(",", ".");
      else s = s.replace(/,/g, "");
    } else if (ultimaComa !== -1) {
      s = s.replace(",", ".");
    }
    s = s.replace(/[^0-9.\-]/g, "");
    const n = Number(s);
    return isFinite(n) ? n : 0;
  }

  /** Tipo de cambio: unidades de `moneda` por 1 €. "1 € = 10,8 MAD". */
  function tipoCambio(moneda, monedaPrincipal) {
    if (!moneda || moneda === (monedaPrincipal || MONEDA_BASE)) return 1;
    const m = monedaPorDefecto(moneda);
    return m ? m.porEuro : 1;
  }

  /** Convierte un importe de una moneda a euros con el cambio indicado. */
  function aEuros(importe, moneda, cambio) {
    if (!moneda || moneda === MONEDA_BASE) return redondear(importe, 2);
    const t = aNumero(cambio);
    if (!t) return 0;
    return redondear(aNumero(importe) / t, 2);
  }

  /** Convierte euros a otra moneda. */
  function deEuros(importeEuros, moneda, cambio) {
    if (!moneda || moneda === MONEDA_BASE) return redondear(importeEuros, 2);
    const t = aNumero(cambio);
    if (!t) return 0;
    return redondear(aNumero(importeEuros) * t, decimalesDe(moneda));
  }

  function etiquetaCambio(moneda, cambio) {
    if (!moneda || moneda === MONEDA_BASE) return "1 € = 1 €";
    return "1 € = " + String(cambio) + " " + moneda;
  }

  /* ---------------- viajes ---------------- */

  function crearViaje(datos) {
    const d = datos || {};
    return {
      id: String(d.id || "") || nuevoId(),
      nombre: String(d.nombre || "").trim(),
      destino: String(d.destino || "").trim(),
      inicio: fechaDia(d.inicio),
      fin: fechaDia(d.fin),
      moneda: monedaPorDefecto(d.moneda) ? d.moneda : MONEDA_PRINCIPAL,
      aportacionPrevista: Math.max(0, redondear(aNumero(d.aportacionPrevista), 2)),
      observaciones: String(d.observaciones || "").trim(),
      creado: String(d.creado || "") || fechaLocalAhora(),
    };
  }

  function validarViaje(datos) {
    const d = datos || {};
    const errores = [];
    if (!String(d.nombre || "").trim()) errores.push("Escribe el nombre del viaje.");
    if (!String(d.destino || "").trim()) errores.push("Escribe el destino.");
    if (!fechaDia(d.inicio)) errores.push("Indica la fecha de inicio.");
    if (!fechaDia(d.fin)) errores.push("Indica la fecha de fin.");
    if (fechaDia(d.inicio) && fechaDia(d.fin) && fechaDia(d.fin) < fechaDia(d.inicio)) {
      errores.push("La fecha de fin no puede ser anterior a la de inicio.");
    }
    if (d.moneda && !monedaPorDefecto(d.moneda)) errores.push("Elige una moneda válida.");
    return errores;
  }

  /* ---------------- clientes ---------------- */

  function crearCliente(datos) {
    const d = datos || {};
    return {
      id: String(d.id || "") || nuevoId(),
      viajeId: String(d.viajeId || ""),
      nombre: String(d.nombre || "").trim(),
      apellidos: String(d.apellidos || "").trim(),
      aportacionPrevista: Math.max(0, redondear(aNumero(d.aportacionPrevista), 2)),
      observaciones: String(d.observaciones || "").trim(),
      creado: String(d.creado || "") || fechaLocalAhora(),
    };
  }

  function validarCliente(datos) {
    const d = datos || {};
    const errores = [];
    if (!String(d.nombre || "").trim()) errores.push("Escribe el nombre del cliente.");
    if (!String(d.apellidos || "").trim()) errores.push("Escribe los apellidos del cliente.");
    return errores;
  }

  function nombreCliente(cliente) {
    if (!cliente) return "";
    return (String(cliente.nombre || "") + " " + String(cliente.apellidos || ""))
      .replace(/\s+/g, " ").trim();
  }

  function compararClientes(a, b) {
    const x = plano(nombreCliente(a));
    const y = plano(nombreCliente(b));
    return x < y ? -1 : x > y ? 1 : 0;
  }

  function clientesDeViaje(clientes, viajeId) {
    return (clientes || [])
      .filter((c) => c.viajeId === viajeId)
      .sort(compararClientes);
  }

  /** Nº de clientes del viaje (se calcula, no se guarda a mano). */
  function numeroDeClientes(clientes, viajeId) {
    return clientesDeViaje(clientes, viajeId).length;
  }

  /**
   * Cambia la aportación prevista de todos los clientes a la vez.
   * Devuelve los clientes nuevos (no modifica los que recibe).
   */
  function aplicarAportacionComun(clientes, viajeId, importe) {
    const valor = Math.max(0, redondear(aNumero(importe), 2));
    return (clientes || []).map((c) =>
      c.viajeId === viajeId ? Object.assign({}, c, { aportacionPrevista: valor }) : c
    );
  }

  /* ---------------- aportaciones al bote común ---------------- */

  function crearAportacion(datos) {
    const d = datos || {};
    return {
      id: String(d.id || "") || nuevoId(),
      viajeId: String(d.viajeId || ""),
      clienteId: String(d.clienteId || ""),
      importe: Math.max(0, redondear(aNumero(d.importe), 2)),
      fecha: String(d.fecha || "") || fechaLocalAhora(), // automática, editable
      forma: FORMAS_PAGO_ORDEN.indexOf(d.forma) !== -1 ? d.forma : "metalico",
      observaciones: String(d.observaciones || "").trim(),
    };
  }

  function validarAportacion(datos) {
    const d = datos || {};
    const errores = [];
    if (!String(d.viajeId || "").trim()) errores.push("Falta el viaje.");
    if (!String(d.clienteId || "").trim()) errores.push("Selecciona el cliente.");
    if (!(aNumero(d.importe) > 0)) errores.push("El importe de la aportación debe ser mayor que 0.");
    if (FORMAS_PAGO_ORDEN.indexOf(d.forma) === -1) errores.push("Selecciona la forma de entrega.");
    return errores;
  }

  function aportacionesDeCliente(aportaciones, clienteId) {
    return (aportaciones || []).filter((a) => a.clienteId === clienteId);
  }

  function aportacionesDeViaje(aportaciones, viajeId) {
    return (aportaciones || []).filter((a) => a.viajeId === viajeId);
  }

  /**
   * Aportaciones recursivas: total entregado, previsto, pendiente y exceso.
   * El saldo del bote se calcula SIEMPRE con lo realmente entregado.
   */
  function aportacionesDeClienteResumen(aportaciones, cliente) {
    const c = cliente || {};
    const lista = aportacionesDeCliente(aportaciones, c.id)
      .slice()
      .sort((x, y) => (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : 0));
    const entregado = redondear(lista.reduce((s, a) => s + (Number(a.importe) || 0), 0), 2);
    const previsto = redondear(Number(c.aportacionPrevista) || 0, 2);
    const saldo = redondear(previsto - entregado, 2);
    return {
      cliente: c,
      aportaciones: lista,
      entregado: entregado,
      previsto: previsto,
      pendiente: saldo > 0 ? saldo : 0,
      exceso: saldo < 0 ? -saldo : 0,
      nIngresos: lista.length,
      completo: saldo <= 0.009,
    };
  }

  /* ---------------- presupuesto del grupo ---------------- */

  /**
   * Las cantidades (personas, noches…) se guardan como número entero o
   * como null si no se indican. El null es importante: significa «no se
   * ha concretado», y entonces el cálculo toma las personas o las noches
   * del viaje. Un 0 explícito significa «cubre a nadie» y no se sustituye.
   */
  function cantidadOpcional(valor) {
    if (valor === undefined || valor === null || valor === "") return null;
    return Math.max(0, Math.floor(aNumero(valor)));
  }

  function crearConcepto(datos) {
    const d = datos || {};
    const tipo = TIPOS_CALCULO[d.tipo] ? d.tipo : "total";
    return {
      id: String(d.id || "") || nuevoId(),
      viajeId: String(d.viajeId || ""),
      categoria: CATEGORIAS_ORDEN.indexOf(d.categoria) !== -1 ? d.categoria : "otros",
      tipo: tipo,
      descripcion: String(d.descripcion || "").trim(),
      proveedor: String(d.proveedor || "").trim(),
      fecha: fechaDia(d.fecha),
      moneda: monedaPorDefecto(d.moneda) ? d.moneda : MONEDA_BASE,
      cambio: aNumero(d.cambio) > 0 ? aNumero(d.cambio) : tipoCambio(d.moneda),
      precio: redondear(aNumero(d.precio), 2),
      personas: cantidadOpcional(d.personas),
      noches: cantidadOpcional(d.noches),
      habitaciones: cantidadOpcional(d.habitaciones),
      dias: cantidadOpcional(d.dias),
      unidades: cantidadOpcional(d.unidades),
      observaciones: String(d.observaciones || "").trim(),
    };
  }

  function validarConcepto(datos) {
    const d = datos || {};
    const errores = [];
    if (!String(d.descripcion || "").trim()) errores.push("Escribe una descripción del concepto.");
    if (!TIPOS_CALCULO[d.tipo]) errores.push("Elige la forma de cálculo.");
    if (!(aNumero(d.precio) > 0)) errores.push("El precio debe ser mayor que 0.");
    if (d.moneda && !monedaPorDefecto(d.moneda)) errores.push("Elige una moneda válida.");
    return errores;
  }

  /**
   * Calcula un concepto sin guardarlo: sirve para mostrar el cálculo
   * antes de guardar. Devuelve las unidades usadas y el importe.
   */
  function calcularConcepto(concepto, opciones) {
    const c = concepto || {};
    const o = opciones || {};
    const personasViaje = Math.max(0, Math.floor(aNumero(o.personasViaje)));
    const nochesViaje = Math.max(0, Math.floor(aNumero(o.noches)));
    const precio = aNumero(c.precio);
    const partes = [];
    let total = 0;

    switch (c.tipo) {
      case "persona": {
        const p = c.personas == null ? personasViaje : c.personas;
        total = precio * (Number(p) || 0);
        partes.push({ etiqueta: "Precio por persona", valor: precio });
        partes.push({ etiqueta: "Personas cubiertas", valor: Number(p) || 0 });
        break;
      }
      case "personaNoche": {
        const p = c.personas == null ? personasViaje : c.personas;
        const n = c.noches == null ? nochesViaje : c.noches;
        total = precio * (Number(p) || 0) * (Number(n) || 0);
        partes.push({ etiqueta: "Precio por persona y noche", valor: precio });
        partes.push({ etiqueta: "Personas cubiertas", valor: Number(p) || 0 });
        partes.push({ etiqueta: "Noches", valor: Number(n) || 0 });
        break;
      }
      case "habitacionNoche": {
        const h = Number(c.habitaciones) || 0;
        const n = c.noches == null ? nochesViaje : c.noches;
        total = precio * h * (Number(n) || 0);
        partes.push({ etiqueta: "Precio por habitación y noche", valor: precio });
        partes.push({ etiqueta: "Habitaciones", valor: h });
        partes.push({ etiqueta: "Noches", valor: Number(n) || 0 });
        break;
      }
      case "dia": {
        const d = Number(c.dias) || 0;
        total = precio * d;
        partes.push({ etiqueta: "Precio por día", valor: precio });
        partes.push({ etiqueta: "Días", valor: d });
        break;
      }
      case "unidad": {
        const u = Number(c.unidades) || 0;
        total = precio * u;
        partes.push({ etiqueta: "Precio por unidad", valor: precio });
        partes.push({ etiqueta: "Unidades", valor: u });
        break;
      }
      default: {
        total = precio;
        partes.push({ etiqueta: "Importe total del grupo", valor: precio });
      }
    }

    const moneda = c.moneda || MONEDA_BASE;
    const cambio = aNumero(c.cambio) > 0 ? aNumero(c.cambio) : tipoCambio(moneda);
    const importe = redondear(total, decimalesDe(moneda));
    return {
      tipo: c.tipo || "total",
      formula: (TIPOS_CALCULO[c.tipo] || TIPOS_CALCULO.total).formula,
      partes: partes,
      importe: importe,
      moneda: moneda,
      cambio: cambio,
      importeEuros: aEuros(importe, moneda, cambio),
      personasCubiertas: c.tipo === "total" ? 0 : (Number(c.personas) || personasViaje),
    };
  }

  function conceptosDeViaje(conceptos, viajeId) {
    return (conceptos || []).filter((c) => c.viajeId === viajeId);
  }

  /** Presupuesto total del viaje y su coste medio por cliente. */
  function presupuestoDeViaje(conceptos, viajeId, opciones) {
    const o = opciones || {};
    const lista = conceptosDeViaje(conceptos, viajeId);
    let total = 0;
    const porCategoria = {};
    CATEGORIAS_ORDEN.forEach((k) => { porCategoria[k] = { cantidad: 0, total: 0 }; });
    lista.forEach((c) => {
      const r = calcularConcepto(c, { personasViaje: o.personas, noches: o.noches });
      total += r.importeEuros; // importe en € con el cambio guardado en el concepto
      const k = CATEGORIAS_ORDEN.indexOf(c.categoria) !== -1 ? c.categoria : "otros";
      porCategoria[k].cantidad += 1;
      porCategoria[k].total = redondear(porCategoria[k].total + r.importeEuros, 2);
    });
    total = redondear(total, 2);
    const nClientes = Number(o.personas) || 0;
    return {
      conceptos: lista,
      total: total,
      nConceptos: lista.length,
      porCategoria: porCategoria,
      nClientes: nClientes,
      costeMedio: nClientes > 0 ? redondear(total / nClientes, 2) : 0,
    };
  }

  /* ---------------- gastos reales del grupo ---------------- */

  function crearGastoGrupo(datos) {
    const d = datos || {};
    const origen = String(d.origen || "");
    return {
      id: String(d.id || "") || nuevoId(),
      viajeId: String(d.viajeId || ""),
      categoria: CATEGORIAS_ORDEN.indexOf(d.categoria) !== -1 ? d.categoria : "otros",
      descripcion: String(d.descripcion || "").trim(),
      fecha: String(d.fecha || "") || fechaLocalAhora(), // automática, editable
      moneda: monedaPorDefecto(d.moneda) ? d.moneda : MONEDA_BASE,
      cambio: aNumero(d.cambio) > 0 ? aNumero(d.cambio) : tipoCambio(d.moneda),
      importe: redondear(aNumero(d.importe), decimalesDe(d.moneda)),
      forma: FORMAS_PAGO_ORDEN.indexOf(d.forma) !== -1 ? d.forma : "metalico",
      pagador: PAGADORES_ORDEN.indexOf(d.pagador) !== -1 ? d.pagador : "bote",
      clienteId: d.pagador === "cliente" ? String(d.clienteId || "") : "",
      conceptoId: String(d.conceptoId || ""),
      observaciones: String(d.observaciones || "").trim(),
      // Marca para no contar dos veces un gasto mío cubierto por el grupo.
      origen: origen === ORIGEN_PERSONAL ? ORIGEN_PERSONAL : ORIGEN_GRUPO,
      gastoPersonalId: String(d.gastoPersonalId || ""),
      reembolsos: (d.reembolsos || []).map((r) => ({
        id: String(r.id || "") || nuevoId(),
        fecha: String(r.fecha || "") || fechaLocalAhora(),
        importe: redondear(aNumero(r.importe), 2),
        forma: FORMAS_PAGO_ORDEN.indexOf(r.forma) !== -1 ? r.forma : "metalico",
        observaciones: String(r.observaciones || "").trim(),
      })),
    };
  }

  function validarGastoGrupo(datos) {
    const d = datos || {};
    const errores = [];
    if (!String(d.viajeId || "").trim()) errores.push("Falta el viaje.");
    if (!String(d.descripcion || "").trim()) errores.push("Escribe una descripción del gasto.");
    if (!(aNumero(d.importe) > 0)) errores.push("El importe debe ser mayor que 0.");
    if (FORMAS_PAGO_ORDEN.indexOf(d.forma) === -1) errores.push("Selecciona la forma de pago.");
    if (PAGADORES_ORDEN.indexOf(d.pagador) === -1) errores.push("Indica quién ha pagado.");
    if (d.pagador === "cliente" && !String(d.clienteId || "").trim()) errores.push("Selecciona el cliente que ha pagado.");
    if (d.moneda && !monedaPorDefecto(d.moneda)) errores.push("Elige una moneda válida.");
    return errores;
  }

  function gastosDeViaje(gastos, viajeId) {
    return (gastos || []).filter((g) => g.viajeId === viajeId);
  }

  /** Lo reembolsado de un gasto adelantado por una persona. */
  function reembolsadoDeGasto(gasto) {
    return redondear(((gasto && gasto.reembolsos) || []).reduce((s, r) => s + (Number(r.importe) || 0), 0), 2);
  }

  /**
   * Pendiente de reembolso de un gasto: solo tiene sentido si lo
   * adelantó una persona (yo o un cliente) y no el bote común.
   */
  function pendienteDeGasto(gasto) {
    const g = gasto || {};
    if (g.pagador !== "yo" && g.pagador !== "cliente") return 0;
    const importe = redondear(aNumero(g.importe), 2);
    return Math.max(0, redondear(importe - reembolsadoDeGasto(g), 2));
  }

  /**
   * Igual que pendienteDeGasto, pero además tiene en cuenta los
   * reembolsos guardados en su propia tabla y enlazados por gastoId.
   * Así da lo mismo si el reembolso se guardó dentro del gasto o
   * aparte: nunca se cuenta dos veces ni se queda sin descontar.
   */
  function reembolsadoDeGastoCon(gasto, reembolsos) {
    const g = gasto || {};
    const dentro = reembolsadoDeGasto(g);
    const fuera = (reembolsos || [])
      .filter((r) => r && r.gastoId === g.id)
      .reduce((s, r) => s + (Number(r.importe) || 0), 0);
    return redondear(dentro + fuera, 2);
  }

  function pendienteDeGastoCon(gasto, reembolsos) {
    const g = gasto || {};
    if (g.pagador !== "yo" && g.pagador !== "cliente") return 0;
    const importe = redondear(aNumero(g.importe), 2);
    return Math.max(0, redondear(importe - reembolsadoDeGastoCon(g, reembolsos), 2));
  }

  /** Un gasto mío cubierto por el grupo se cuenta una sola vez: en el grupo. */
  function gastoGrupoCuentaComoGasto(gasto) {
    return !!gasto && gasto.origen !== ORIGEN_PERSONAL;
  }

  /**
   * Gasto real del grupo agrupado por categoría. Incluye siempre los
   * gastos adelantados por personas: el gasto existe aunque todavía no
   * se haya reembolsado (el reembolso NO es un gasto nuevo).
   */
  function gastosGrupoPorCategoria(gastos, viajeId) {
    const lista = gastosDeViaje(gastos, viajeId);
    const porCategoria = {};
    CATEGORIAS_ORDEN.forEach((k) => { porCategoria[k] = { cantidad: 0, total: 0 }; });
    let total = 0;
    lista.forEach((g) => {
      const e = aEuros(g.importe, g.moneda, g.cambio);
      total = redondear(total + e, 2);
      const k = CATEGORIAS_ORDEN.indexOf(g.categoria) !== -1 ? g.categoria : "otros";
      porCategoria[k].cantidad += 1;
      porCategoria[k].total = redondear(porCategoria[k].total + e, 2);
    });
    return { total: total, nGastos: lista.length, porCategoria: porCategoria, gastos: lista };
  }

  /* ---------------- movimientos del bote y reembolsos ---------------- */

  function crearReembolso(datos) {
    const d = datos || {};
    return {
      id: String(d.id || "") || nuevoId(),
      viajeId: String(d.viajeId || ""),
      gastoId: String(d.gastoId || ""),
      beneficiario: String(d.beneficiario || ""), // "yo" o el id del cliente
      importe: Math.max(0, redondear(aNumero(d.importe), 2)),
      fecha: String(d.fecha || "") || fechaLocalAhora(),
      forma: FORMAS_PAGO_ORDEN.indexOf(d.forma) !== -1 ? d.forma : "metalico",
      observaciones: String(d.observaciones || "").trim(),
    };
  }

  function reembolsosDeViaje(reembolsos, viajeId) {
    return (reembolsos || []).filter((r) => r.viajeId === viajeId);
  }

  function crearDevolucion(datos) {
    const d = datos || {};
    return {
      id: String(d.id || "") || nuevoId(),
      viajeId: String(d.viajeId || ""),
      clienteId: String(d.clienteId || ""),
      importe: Math.max(0, redondear(aNumero(d.importe), 2)),
      fecha: String(d.fecha || "") || fechaLocalAhora(),
      forma: FORMAS_PAGO_ORDEN.indexOf(d.forma) !== -1 ? d.forma : "metalico",
      observaciones: String(d.observaciones || "").trim(),
    };
  }

  function devolucionesDeViaje(devoluciones, viajeId) {
    return (devoluciones || []).filter((d) => d.viajeId === viajeId);
  }

  /* ---------------- mis gastos ---------------- */

  function crearGastoPersonal(datos) {
    const d = datos || {};
    return {
      id: String(d.id || "") || nuevoId(),
      viajeId: String(d.viajeId || ""),
      categoria: CATEGORIAS_PERSONALES_ORDEN.indexOf(d.categoria) !== -1 ? d.categoria : "otros",
      concepto: String(d.concepto || "").trim(),
      fecha: String(d.fecha || "") || fechaLocalAhora(),
      moneda: monedaPorDefecto(d.moneda) ? d.moneda : MONEDA_BASE,
      cambio: aNumero(d.cambio) > 0 ? aNumero(d.cambio) : tipoCambio(d.moneda),
      importe: redondear(aNumero(d.importe), decimalesDe(d.moneda)),
      // Por defecto es personal y NO se descuenta del bote común.
      cubiertoPorGrupo: !!d.cubiertoPorGrupo,
      observaciones: String(d.observaciones || "").trim(),
    };
  }

  function validarGastoPersonal(datos) {
    const d = datos || {};
    const errores = [];
    if (!String(d.viajeId || "").trim()) errores.push("Falta el viaje.");
    if (!String(d.concepto || "").trim()) errores.push("Escribe el concepto del gasto.");
    if (!(aNumero(d.importe) > 0)) errores.push("El importe debe ser mayor que 0.");
    if (d.moneda && !monedaPorDefecto(d.moneda)) errores.push("Elige una moneda válida.");
    return errores;
  }

  function gastosPersonalesDeViaje(gastos, viajeId) {
    return (gastos || []).filter((g) => g.viajeId === viajeId);
  }

  /**
   * Mis gastos personales en €. Los que están cubiertos por el grupo se
   * excluyen (ya se contabilizan como gasto del grupo, una sola vez).
   */
  function misGastosPersonales(gastosPersonales, viajeId) {
    const lista = gastosPersonalesDeViaje(gastosPersonales, viajeId);
    let propios = 0;
    let cubiertos = 0;
    const porCategoria = {};
    CATEGORIAS_PERSONALES_ORDEN.forEach((k) => { porCategoria[k] = { cantidad: 0, total: 0 }; });
    lista.forEach((g) => {
      const e = aEuros(g.importe, g.moneda, g.cambio);
      if (g.cubiertoPorGrupo) {
        cubiertos = redondear(cubiertos + e, 2);
        return; // cubierto por el grupo: no se descuenta como gasto mío
      }
      propios = redondear(propios + e, 2);
      const k = CATEGORIAS_PERSONALES_ORDEN.indexOf(g.categoria) !== -1 ? g.categoria : "otros";
      porCategoria[k].cantidad += 1;
      porCategoria[k].total = redondear(porCategoria[k].total + e, 2);
    });
    return {
      gastos: lista,
      total: propios,
      cubiertosPorGrupo: cubiertos,
      nGastos: lista.length,
      porCategoria: porCategoria,
    };
  }

  /* ---------------- mis honorarios ---------------- */

  function crearHonorario(datos) {
    const d = datos || {};
    return {
      id: String(d.id || "") || nuevoId(),
      viajeId: String(d.viajeId || ""),
      clienteId: String(d.clienteId || ""),
      concepto: String(d.concepto || "").trim() || "Honorarios de gestión",
      previsto: Math.max(0, redondear(aNumero(d.previsto), 2)),
      cobrado: Math.max(0, redondear(aNumero(d.cobrado), 2)),
      fecha: String(d.fecha || "") || fechaLocalAhora(),
      forma: FORMAS_PAGO_ORDEN.indexOf(d.forma) !== -1 ? d.forma : "transferencia",
      observaciones: String(d.observaciones || "").trim(),
    };
  }

  function validarHonorario(datos) {
    const d = datos || {};
    const errores = [];
    if (!String(d.viajeId || "").trim()) errores.push("Falta el viaje.");
    if (!String(d.clienteId || "").trim()) errores.push("Selecciona el cliente.");
    if (!(aNumero(d.previsto) > 0) && !(aNumero(d.cobrado) > 0)) {
      errores.push("Indica los honorarios previstos o los cobrados.");
    }
    return errores;
  }

  function honorariosDeViaje(honorarios, viajeId) {
    return (honorarios || []).filter((h) => h.viajeId === viajeId);
  }

  /**
   * Honorarios previstos, cobrados y pendientes de cobro.
   * No forman parte del bote común.
   */
  function resumenHonorarios(honorarios, viajeId) {
    const lista = honorariosDeViaje(honorarios, viajeId);
    const previsto = redondear(lista.reduce((s, h) => s + (Number(h.previsto) || 0), 0), 2);
    const cobrado = redondear(lista.reduce((s, h) => s + (Number(h.cobrado) || 0), 0), 2);
    return {
      honorarios: lista,
      previsto: previsto,
      cobrado: cobrado,
      pendiente: Math.max(0, redondear(previsto - cobrado, 2)),
      nClientes: lista.filter((h) => Number(h.previsto) > 0).length,
    };
  }

  /* ---------------- resumen del viaje ---------------- */

  /**
   * Todas las cuentas del viaje. El saldo del bote usa los movimientos
   * reales; los adelantos pendientes de reembolso se muestran aparte
   * como obligaciones, sin descontarlos del efectivo disponible.
   */
  function resumenDelViaje(datos) {
    const d = datos || {};
    const viaje = d.viaje || {};
    const clientes = clientesDeViaje(d.clientes || [], viaje.id);
    const nClientes = clientes.length;
    const noches = nochesViaje(viaje);

    const presupuesto = presupuestoDeViaje(d.conceptos || [], viaje.id, { personas: nClientes, noches: noches });
    const gastos = gastosGrupoPorCategoria(d.gastos || [], viaje.id);
    const aportaciones = aportacionesDeViaje(d.aportaciones || [], viaje.id);
    const recibido = redondear(aportaciones.reduce((s, a) => s + (Number(a.importe) || 0), 0), 2);

    const porCliente = clientes.map((c) => aportacionesDeClienteResumen(d.aportaciones || [], c));
    const previsto = redondear(porCliente.reduce((s, r) => s + r.previsto, 0), 2);
    const pendienteAportaciones = redondear(porCliente.reduce((s, r) => s + r.pendiente, 0), 2);
    const excesoAportaciones = redondear(porCliente.reduce((s, r) => s + r.exceso, 0), 2);

    // Pagos hechos con dinero del bote.
    const gastosDelBote = gastos.gastos.filter((g) => g.pagador === "bote");
    const pagadoConBote = redondear(gastosDelBote.reduce((s, g) => s + aEuros(g.importe, g.moneda, g.cambio), 0), 2);

    // Adelantos de personas (yo o clientes) y lo que queda por devolverles.
    // El reembolso puede estar guardado dentro del gasto o en su propia
    // tabla enlazado por gastoId: se tienen en cuenta los dos.
    const reembolsos = reembolsosDeViaje(d.reembolsos || [], viaje.id);
    const adelantos = gastos.gastos.filter((g) => g.pagador === "yo" || g.pagador === "cliente");
    const adelantadoTotal = redondear(adelantos.reduce((s, g) => s + aEuros(g.importe, g.moneda, g.cambio), 0), 2);
    const reembolsadoTotal = redondear(adelantos.reduce((s, g) => s + reembolsadoDeGastoCon(g, reembolsos), 0), 2);
    const pendienteReembolso = redondear(adelantos.reduce((s, g) => s + pendienteDeGastoCon(g, reembolsos), 0), 2);
    const adelantosPendientes = adelantos
      .map((g) => ({ gasto: g, pendiente: pendienteDeGastoCon(g, reembolsos), reembolsado: reembolsadoDeGastoCon(g, reembolsos) }))
      .filter((x) => x.pendiente > 0);

    // Reembolsos y devoluciones: movimiento real del bote.
    const reembolsadoRegistrado = redondear(reembolsos.reduce((s, r) => s + (Number(r.importe) || 0), 0), 2);
    const devoluciones = devolucionesDeViaje(d.devoluciones || [], viaje.id);
    const devuelto = redondear(devoluciones.reduce((s, x) => s + (Number(x.importe) || 0), 0), 2);

    // Saldo real del bote: solo movimientos reales de dinero.
    const dineroDisponible = redondear(recibido - pagadoConBote - reembolsadoRegistrado - devuelto, 2);

    const honorarios = resumenHonorarios(d.honorarios || [], viaje.id);
    const misGastos = misGastosPersonales(d.gastosPersonales || [], viaje.id);

    const desviacion = redondear(gastos.total - presupuesto.total, 2);

    return {
      viaje: viaje,
      nClientes: nClientes,
      duracion: duracionViaje(viaje),
      noches: noches,
      // Presupuesto
      presupuesto: presupuesto,
      // Gastos reales
      gastos: gastos,
      nGastos: gastos.nGastos,
      // Bote
      botePrevisto: previsto,
      recibido: recibido,
      nAportaciones: aportaciones.length,
      porCliente: porCliente,
      pendienteAportaciones: pendienteAportaciones,
      excesoAportaciones: excesoAportaciones,
      pagadoConBote: pagadoConBote,
      dineroDisponible: dineroDisponible,
      // Adelantos
      adelantadoTotal: adelantadoTotal,
      reembolsadoTotal: reembolsadoTotal,
      reembolsadoRegistrado: reembolsadoRegistrado,
      pendienteReembolso: pendienteReembolso,
      adelantosPendientes: adelantosPendientes,
      // Devoluciones
      devoluciones: devoluciones,
      devuelto: devuelto,
      // Honorarios y gastos propios
      honorarios: honorarios,
      misGastos: misGastos,
      resultadoPrevisto: redondear(honorarios.previsto - misGastos.total, 2),
      resultadoReal: redondear(honorarios.cobrado - misGastos.total, 2),
      // Comparaciones
      desviacion: desviacion,
      desviacionPct: presupuesto.total > 0 ? redondear((desviacion / presupuesto.total) * 100, 1) : 0,
    };
  }

  /* ---------------- saldos por moneda ---------------- */

  /**
   * Agrupa movimientos por moneda y da su equivalencia en euros.
   * Nunca se suman monedas distintas sin convertir.
   */
  function saldosPorMoneda(datos) {
    const d = datos || {};
    const viajeId = d.viajeId;
    const acumulado = {};

    function apuntar(moneda, cambio, concepto, importe) {
      const id = moneda || MONEDA_BASE;
      if (!acumulado[id]) {
        acumulado[id] = {
          moneda: id,
          cambio: aNumero(cambio) > 0 ? aNumero(cambio) : tipoCambio(id),
          gastosGrupo: 0,
          gastosPersonales: 0,
          aportaciones: 0,
          n: 0,
        };
      }
      acumulado[id][concepto] = redondear(acumulado[id][concepto] + (Number(importe) || 0), decimalesDe(id));
      acumulado[id].n += 1;
    }

    gastosDeViaje(d.gastos || [], viajeId).forEach((g) => apuntar(g.moneda, g.cambio, "gastosGrupo", g.importe));
    gastosPersonalesDeViaje(d.gastosPersonales || [], viajeId).forEach((g) => apuntar(g.moneda, g.cambio, "gastosPersonales", g.importe));
    aportacionesDeViaje(d.aportaciones || [], viajeId).forEach((a) => apuntar(d.viaje ? d.viaje.moneda : MONEDA_BASE, 1, "aportaciones", a.importe));

    const lista = Object.keys(acumulado).map((k) => {
      const x = acumulado[k];
      return Object.assign({}, x, {
        gastosGrupoEuros: aEuros(x.gastosGrupo, x.moneda, x.cambio),
        gastosPersonalesEuros: aEuros(x.gastosPersonales, x.moneda, x.cambio),
        aportacionesEuros: aEuros(x.aportaciones, x.moneda, x.cambio),
      });
    });
    lista.sort((a, b) => (a.moneda === MONEDA_BASE ? -1 : b.moneda === MONEDA_BASE ? 1 : a.moneda < b.moneda ? -1 : 1));

    return {
      monedas: lista,
      totalGastosGrupoEuros: redondear(lista.reduce((s, x) => s + x.gastosGrupoEuros, 0), 2),
      totalGastosPersonalesEuros: redondear(lista.reduce((s, x) => s + x.gastosPersonalesEuros, 0), 2),
    };
  }

  /* ---------------- exportación ---------------- */

  function csv(cabecera, filas, nombreHoja) {
    const lineas = [cabecera].concat(filas).map((fila) =>
      fila.map((celda) => '"' + String(celda == null ? "" : celda).replace(/"/g, '""') + '"').join(";")
    );
    // BOM para que Excel abra bien los acentos; «;» es el separador en español.
    return "\ufeff" + lineas.join("\r\n") + "\r\n";
  }

  function csvClientes(datos) {
    const d = datos || {};
    const viaje = d.viaje || {};
    const clientes = clientesDeViaje(d.clientes || [], viaje.id);
    const cabecera = [
      "Viaje", "Nombre", "Apellidos", "Aportación prevista (€)", "Aportaciones entregadas (€)",
      "Nº de ingresos", "Pendiente (€)", "Exceso aportado (€)",
    ];
    const filas = clientes.map((c) => {
      const r = aportacionesDeClienteResumen(d.aportaciones || [], c);
      return [
        viaje.nombre, c.nombre, c.apellidos, String(r.previsto).replace(".", ","),
        String(r.entregado).replace(".", ","), String(r.nIngresos),
        String(r.pendiente).replace(".", ","), String(r.exceso).replace(".", ","),
      ];
    });
    return csv(cabecera, filas);
  }

  function csvAportaciones(datos) {
    const d = datos || {};
    const viaje = d.viaje || {};
    const mapa = {};
    clientesDeViaje(d.clientes || [], viaje.id).forEach((c) => { mapa[c.id] = c; });
    const lista = aportacionesDeViaje(d.aportaciones || [], viaje.id)
      .slice()
      .sort((x, y) => (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : 0));
    const cabecera = ["Viaje", "Fecha", "Cliente", "Importe (€)", "Forma de entrega", "Observaciones"];
    const filas = lista.map((a) => {
      const c = mapa[a.clienteId];
      return [
        viaje.nombre, fechaHoraCorta(a.fecha), c ? nombreCliente(c) : "",
        String(a.importe).replace(".", ","), nombreForma(a.forma), a.observaciones,
      ];
    });
    return csv(cabecera, filas);
  }

  function csvGastos(datos) {
    const d = datos || {};
    const viaje = d.viaje || {};
    const mapaClientes = {};
    clientesDeViaje(d.clientes || [], viaje.id).forEach((c) => { mapaClientes[c.id] = c; });
    const mapaConceptos = {};
    conceptosDeViaje(d.conceptos || [], viaje.id).forEach((c) => { mapaConceptos[c.id] = c; });
    const lista = gastosDeViaje(d.gastos || [], viaje.id)
      .slice()
      .sort((x, y) => (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : 0));
    const cabecera = [
      "Viaje", "Fecha", "Categoría", "Descripción", "Importe", "Moneda", "Cambio (1 € = X)",
      "Importe (€)", "Forma de pago", "Quién paga", "Pendiente de reembolso (€)",
      "Concepto del presupuesto", "Observaciones",
    ];
    const filas = lista.map((g) => {
      const quien = g.pagador === "cliente"
        ? (mapaClientes[g.clienteId] ? nombreCliente(mapaClientes[g.clienteId]) : "Cliente")
        : nombrePagador(g.pagador);
      const concepto = mapaConceptos[g.conceptoId];
      return [
        viaje.nombre, fechaHoraCorta(g.fecha), nombreCategoria(g.categoria), g.descripcion,
        String(g.importe).replace(".", ","), g.moneda, String(g.cambio || 1).replace(".", ","),
        String(aEuros(g.importe, g.moneda, g.cambio)).replace(".", ","),
        nombreForma(g.forma), quien, String(pendienteDeGasto(g)).replace(".", ","),
        concepto ? concepto.descripcion : "", g.observaciones,
      ];
    });
    return csv(cabecera, filas);
  }

  function exportarDatos(datos) {
    const d = datos || {};
    return {
      app: APP,
      version: VERSION,
      exportado: fechaLocalAhora(),
      viajes: (d.viajes || []).map(sanearViaje).filter(Boolean),
      clientes: (d.clientes || []).map(sanearCliente).filter(Boolean),
      aportaciones: (d.aportaciones || []).map(sanearAportacion).filter(Boolean),
      conceptos: (d.conceptos || []).map(sanearConcepto).filter(Boolean),
      gastos: (d.gastos || []).map(sanearGastoGrupo).filter(Boolean),
      reembolsos: (d.reembolsos || []).map(sanearReembolso).filter(Boolean),
      devoluciones: (d.devoluciones || []).map(sanearDevolucion).filter(Boolean),
      gastosPersonales: (d.gastosPersonales || []).map(sanearGastoPersonal).filter(Boolean),
      honorarios: (d.honorarios || []).map(sanearHonorario).filter(Boolean),
    };
  }

  function nombreCopia() {
    const d = new Date();
    return "the-free-travel-copia-" + d.getFullYear() + "-" + dos(d.getMonth() + 1) + "-" + dos(d.getDate()) + ".json";
  }

  function nombreCSV(prefijo) {
    const d = new Date();
    return "the-free-travel-" + (prefijo || "datos") + "-" + d.getFullYear() + "-" + dos(d.getMonth() + 1) + "-" + dos(d.getDate()) + ".csv";
  }

  /* ---------------- importación ---------------- */

  function sanearViaje(obj) {
    if (!obj || typeof obj !== "object") return null;
    const nombre = String(obj.nombre || "").trim();
    if (!nombre) return null;
    return crearViaje(obj);
  }

  function sanearCliente(obj) {
    if (!obj || typeof obj !== "object") return null;
    if (!String(obj.nombre || "").trim() && !String(obj.apellidos || "").trim()) return null;
    return crearCliente(obj);
  }

  function sanearAportacion(obj) {
    if (!obj || typeof obj !== "object") return null;
    if (!String(obj.clienteId || "").trim()) return null;
    return crearAportacion(obj);
  }

  function sanearConcepto(obj) {
    if (!obj || typeof obj !== "object") return null;
    if (!String(obj.descripcion || "").trim()) return null;
    return crearConcepto(obj);
  }

  function sanearGastoGrupo(obj) {
    if (!obj || typeof obj !== "object") return null;
    if (!String(obj.descripcion || "").trim()) return null;
    return crearGastoGrupo(obj);
  }

  function sanearReembolso(obj) {
    if (!obj || typeof obj !== "object") return null;
    if (!String(obj.gastoId || "").trim()) return null;
    return crearReembolso(obj);
  }

  function sanearDevolucion(obj) {
    if (!obj || typeof obj !== "object") return null;
    if (!String(obj.clienteId || "").trim()) return null;
    return crearDevolucion(obj);
  }

  function sanearGastoPersonal(obj) {
    if (!obj || typeof obj !== "object") return null;
    if (!String(obj.concepto || "").trim()) return null;
    return crearGastoPersonal(obj);
  }

  function sanearHonorario(obj) {
    if (!obj || typeof obj !== "object") return null;
    if (!String(obj.clienteId || "").trim()) return null;
    return crearHonorario(obj);
  }

  /** Lee y valida una copia JSON. Devuelve { ok, error?, ...listas }. */
  function leerImportacion(texto) {
    let obj;
    try {
      obj = JSON.parse(texto);
    } catch (e) {
      return { ok: false, error: "El archivo no es un JSON válido." };
    }
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      return { ok: false, error: "El archivo no contiene una copia válida." };
    }
    if (!Array.isArray(obj.viajes)) {
      return { ok: false, error: "El archivo no tiene la estructura de una copia de The Free Travel (falta la lista de viajes)." };
    }
    const lista = (nombre, saneador) => (Array.isArray(obj[nombre]) ? obj[nombre] : []).map(saneador).filter(Boolean);
    const viajes = lista("viajes", sanearViaje);
    const clientes = lista("clientes", sanearCliente);
    const aportaciones = lista("aportaciones", sanearAportacion);
    const conceptos = lista("conceptos", sanearConcepto);
    const gastos = lista("gastos", sanearGastoGrupo);
    const reembolsos = lista("reembolsos", sanearReembolso);
    const devoluciones = lista("devoluciones", sanearDevolucion);
    const gastosPersonales = lista("gastosPersonales", sanearGastoPersonal);
    const honorarios = lista("honorarios", sanearHonorario);
    return {
      ok: true,
      viajes: viajes,
      clientes: clientes,
      aportaciones: aportaciones,
      conceptos: conceptos,
      gastos: gastos,
      reembolsos: reembolsos,
      devoluciones: devoluciones,
      gastosPersonales: gastosPersonales,
      honorarios: honorarios,
      descartados:
        (Array.isArray(obj.viajes) ? obj.viajes.length : 0) - viajes.length +
        (Array.isArray(obj.clientes) ? obj.clientes.length : 0) - clientes.length +
        (Array.isArray(obj.gastos) ? obj.gastos.length : 0) - gastos.length,
    };
  }

  /** Fusión: por id manda lo importado; lo que solo está en el dispositivo se conserva. */
  function combinarDatos(actuales, entrantes) {
    const out = {};
    ["viajes", "clientes", "aportaciones", "conceptos", "gastos", "reembolsos",
      "devoluciones", "gastosPersonales", "honorarios"].forEach((clave) => {
      const mapa = {};
      ((actuales && actuales[clave]) || []).forEach((x) => { if (x && x.id) mapa[x.id] = x; });
      ((entrantes && entrantes[clave]) || []).forEach((x) => { if (x && x.id) mapa[x.id] = x; });
      out[clave] = Object.keys(mapa).map((k) => mapa[k]);
    });
    out.viajes.sort(compararViajes);
    return out;
  }

  function compararViajes(a, b) {
    const x = fechaDia(a && a.inicio) || "";
    const y = fechaDia(b && b.inicio) || "";
    return x < y ? 1 : x > y ? -1 : 0; // el más reciente primero
  }

  /* ---------------- búsquedas y etiquetas ---------------- */

  function buscarClientes(clientes, viajeId, texto) {
    const q = plano(texto).trim();
    let lista = clientesDeViaje(clientes, viajeId);
    if (q) lista = lista.filter((c) => plano(nombreCliente(c)).indexOf(q) !== -1);
    return lista;
  }

  function clientePorId(clientes, id) {
    return (clientes || []).filter((c) => c.id === id)[0] || null;
  }

  function viajePorId(viajes, id) {
    return (viajes || []).filter((v) => v.id === id)[0] || null;
  }

  function nombreForma(forma) {
    const f = FORMAS_PAGO.filter((x) => x.id === forma)[0];
    return f ? f.nombre : String(forma || "");
  }

  function nombrePagador(pagador) {
    const p = PAGADORES.filter((x) => x.id === pagador)[0];
    return p ? p.nombre : String(pagador || "");
  }

  function nombreCategoria(categoria) {
    const c = CATEGORIAS.filter((x) => x.id === categoria)[0];
    return c ? c.nombre : String(categoria || "");
  }

  function nombreCategoriaPersonal(categoria) {
    const c = CATEGORIAS_PERSONALES.filter((x) => x.id === categoria)[0];
    return c ? c.nombre : String(categoria || "");
  }

  function nombreTipoCalculo(tipo) {
    const t = TIPOS_CALCULO[tipo];
    return t ? t.nombre : String(tipo || "");
  }

  function nombreMoneda(moneda) {
    const m = monedaPorDefecto(moneda);
    return m ? m.nombre : String(moneda || "");
  }

  return {
    APP: APP,
    VERSION: VERSION,
    MONEDA_BASE: MONEDA_BASE,
    MONEDA_PRINCIPAL: MONEDA_PRINCIPAL,
    MONEDAS: MONEDAS,
    CATEGORIAS: CATEGORIAS,
    CATEGORIAS_ORDEN: CATEGORIAS_ORDEN,
    CATEGORIAS_PERSONALES: CATEGORIAS_PERSONALES,
    CATEGORIAS_PERSONALES_ORDEN: CATEGORIAS_PERSONALES_ORDEN,
    FORMAS_PAGO: FORMAS_PAGO,
    FORMAS_PAGO_ORDEN: FORMAS_PAGO_ORDEN,
    PAGADORES: PAGADORES,
    PAGADORES_ORDEN: PAGADORES_ORDEN,
    TIPOS_CALCULO: TIPOS_CALCULO,
    TIPOS_CALCULO_ORDEN: TIPOS_CALCULO_ORDEN,
    ORIGEN_PERSONAL: ORIGEN_PERSONAL,
    ORIGEN_GRUPO: ORIGEN_GRUPO,
    /* texto y fechas */
    nuevoId: nuevoId,
    esc: esc,
    plano: plano,
    fechaLocalAhora: fechaLocalAhora,
    fechaDia: fechaDia,
    partesFecha: partesFecha,
    fechaCorta: fechaCorta,
    fechaHoraCorta: fechaHoraCorta,
    diasEntre: diasEntre,
    duracionViaje: duracionViaje,
    nochesViaje: nochesViaje,
    /* dinero */
    euros: euros,
    formatearMoneda: formatearMoneda,
    decimalesDe: decimalesDe,
    monedaPorDefecto: monedaPorDefecto,
    redondear: redondear,
    aNumero: aNumero,
    tipoCambio: tipoCambio,
    aEuros: aEuros,
    deEuros: deEuros,
    etiquetaCambio: etiquetaCambio,
    nombreMoneda: nombreMoneda,
    /* viajes */
    crearViaje: crearViaje,
    validarViaje: validarViaje,
    viajePorId: viajePorId,
    compararViajes: compararViajes,
    /* clientes */
    crearCliente: crearCliente,
    validarCliente: validarCliente,
    nombreCliente: nombreCliente,
    compararClientes: compararClientes,
    clientesDeViaje: clientesDeViaje,
    numeroDeClientes: numeroDeClientes,
    aplicarAportacionComun: aplicarAportacionComun,
    buscarClientes: buscarClientes,
    clientePorId: clientePorId,
    /* aportaciones */
    crearAportacion: crearAportacion,
    validarAportacion: validarAportacion,
    aportacionesDeCliente: aportacionesDeCliente,
    aportacionesDeViaje: aportacionesDeViaje,
    aportacionesDeClienteResumen: aportacionesDeClienteResumen,
    /* presupuesto */
    crearConcepto: crearConcepto,
    validarConcepto: validarConcepto,
    calcularConcepto: calcularConcepto,
    conceptosDeViaje: conceptosDeViaje,
    presupuestoDeViaje: presupuestoDeViaje,
    /* gastos del grupo */
    crearGastoGrupo: crearGastoGrupo,
    validarGastoGrupo: validarGastoGrupo,
    gastosDeViaje: gastosDeViaje,
    reembolsadoDeGasto: reembolsadoDeGasto,
    pendienteDeGasto: pendienteDeGasto,
    reembolsadoDeGastoCon: reembolsadoDeGastoCon,
    pendienteDeGastoCon: pendienteDeGastoCon,
    gastoGrupoCuentaComoGasto: gastoGrupoCuentaComoGasto,
    gastosGrupoPorCategoria: gastosGrupoPorCategoria,
    /* movimientos del bote */
    crearReembolso: crearReembolso,
    reembolsosDeViaje: reembolsosDeViaje,
    crearDevolucion: crearDevolucion,
    devolucionesDeViaje: devolucionesDeViaje,
    /* mis gastos */
    crearGastoPersonal: crearGastoPersonal,
    validarGastoPersonal: validarGastoPersonal,
    gastosPersonalesDeViaje: gastosPersonalesDeViaje,
    misGastosPersonales: misGastosPersonales,
    /* honorarios */
    crearHonorario: crearHonorario,
    validarHonorario: validarHonorario,
    honorariosDeViaje: honorariosDeViaje,
    resumenHonorarios: resumenHonorarios,
    /* resumen */
    resumenDelViaje: resumenDelViaje,
    saldosPorMoneda: saldosPorMoneda,
    /* etiquetas */
    nombreForma: nombreForma,
    nombrePagador: nombrePagador,
    nombreCategoria: nombreCategoria,
    nombreCategoriaPersonal: nombreCategoriaPersonal,
    nombreTipoCalculo: nombreTipoCalculo,
    /* copias */
    csvClientes: csvClientes,
    csvAportaciones: csvAportaciones,
    csvGastos: csvGastos,
    exportarDatos: exportarDatos,
    nombreCopia: nombreCopia,
    nombreCSV: nombreCSV,
    leerImportacion: leerImportacion,
    combinarDatos: combinarDatos,
  };
})();
