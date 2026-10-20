"use strict";
/* ============================================================
   The Free Travel · Gestión de viajes
   js/app.js — interfaz y conexión con el almacén.

   Pantallas: Viajes, Clientes y bote, Gastos del grupo,
   Mis gastos y Resumen.

   El módulo se expone como globalThis.FTUI para poder probar el
   HTML de cada pantalla sin abrir un navegador (tests/ui.test.mjs).
   Las funciones «html…» son puras: reciben el estado y devuelven
   texto HTML. Los botones llevan data-accion / data-valor y un
   único manejador de clics reparte el trabajo.
   ============================================================ */

globalThis.FTUI = (function () {
  const VERSION = "1.1.0";

  /* ---------------- estado ---------------- */

  function hoyISO() { return FT.fechaLocalAhora(); }
  function hoyDia() { return FT.fechaDia(FT.fechaLocalAhora()); }

  function anioDe(v) { return FT.fechaDia((v && v.inicio) || "").slice(0, 4); }

  const S = {
    vista: "viajes",
    // Gastos del grupo tiene dos pestañas: presupuesto previsto y gastos reales.
    pestanaGastos: "real",
    viajeId: null,
    cargando: true,
    datos: {
      viajes: [], clientes: [], aportaciones: [], conceptos: [],
      gastos: [], reembolsos: [], devoluciones: [], gastosPersonales: [], honorarios: [],
    },
    copiaMeta: { ultimaImportacion: null },
    // formularios en curso (los rellena cada pantalla al abrirse)
    viaje: null,
    cliente: null,
    aportacion: null,
    concepto: null,
    gasto: null,
    reembolso: null,
    devolucion: null,
    gastoPersonal: null,
    honorario: null,
    filtros: { clientes: "", gastos: "", categoriaGasto: "" },
    // cálculo en vivo del presupuesto (se muestra antes de guardar)
    vistaPreviaConcepto: null,
    // al añadir un concepto desde el formulario de gasto, se vuelve a él
    volverAGastoTrasConcepto: false,
    // menú lateral abierto
    menuAbierto: false,
  };

  /* ---------------- utilidades ---------------- */

  const esc = FT.esc;
  const euros = FT.euros;

  function porId(id) {
    return (typeof document !== "undefined" && document.getElementById) ? document.getElementById(id) : null;
  }

  function pintarEn(id, html) {
    const el = porId(id);
    if (el) el.innerHTML = html;
  }

  function avisar(texto, tipo) {
    const t = porId("toast");
    if (!t) return;
    t.textContent = texto;
    t.className = "toast visible" + (tipo === "error" ? " toast-error" : "");
    if (typeof setTimeout === "function") {
      setTimeout(() => { t.className = "toast"; }, 3600);
    }
  }

  function mostrarModal() {
    const m = porId("modal");
    if (!m) return;
    m.hidden = false;
    if (m.classList) m.classList.add("abierto");
  }

  function ocultarModal() {
    const m = porId("modal");
    if (!m) return;
    m.hidden = true;
    if (m.classList) m.classList.remove("abierto");
  }

  let resolverModal = null;
  function preguntar(opciones) {
    return new Promise((resolver) => {
      resolverModal = resolver;
      pintarEn("modal-titulo", esc(opciones.titulo || ""));
      pintarEn("modal-texto", opciones.texto || "");
      const cont = porId("modal-botones");
      if (cont) {
        cont.innerHTML = "";
        (opciones.botones || []).forEach((b) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "btn " + (b.clase || "btn-secundario");
          btn.textContent = b.texto;
          btn.dataset.valorModal = String(b.valor);
          cont.appendChild(btn);
        });
      }
      mostrarModal();
    });
  }

  function cerrarModal(valor) {
    ocultarModal();
    if (resolverModal) {
      const r = resolverModal;
      resolverModal = null;
      r(valor);
    }
  }

  function confirmar(titulo, texto, textoAceptar) {
    return preguntar({
      titulo: titulo,
      texto: texto,
      botones: [
        { texto: textoAceptar, valor: true, clase: "btn-peligro" },
        { texto: "Cancelar", valor: false, clase: "btn-ghost" },
      ],
    }).then((v) => v === true);
  }

  function descargar(nombre, contenido, tipo) {
    const blob = new Blob([contenido], { type: tipo });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /* ---------------- datos ---------------- */

  function recargar() {
    return TFTDB.leerTodo().then((datos) => {
      S.datos = datos;
      // Si el viaje abierto ya no existe, se vuelve a la lista.
      if (S.viajeId && !FT.viajePorId(S.datos.viajes, S.viajeId)) S.viajeId = null;
    }).then(() => TFTDB.leerMeta("ultimaImportacion").then((v) => { S.copiaMeta.ultimaImportacion = v || null; }));
  }

  function viajeActual() {
    return FT.viajePorId(S.datos.viajes, S.viajeId);
  }

  function conViaje() {
    const v = viajeActual();
    if (!v) return {};
    return v;
  }

  function clientes() { return FT.clientesDeViaje(S.datos.clientes, S.viajeId); }
  function aportaciones() { return FT.aportacionesDeViaje(S.datos.aportaciones, S.viajeId); }
  function conceptos() { return FT.conceptosDeViaje(S.datos.conceptos, S.viajeId); }
  function gastos() { return FT.gastosDeViaje(S.datos.gastos, S.viajeId); }
  function gastosPersonales() { return FT.gastosPersonalesDeViaje(S.datos.gastosPersonales, S.viajeId); }
  function honorarios() { return FT.honorariosDeViaje(S.datos.honorarios, S.viajeId); }

  function resumen() {
    const v = conViaje();
    if (!v.id) return null;
    return FT.resumenDelViaje({
      viaje: v,
      clientes: S.datos.clientes,
      aportaciones: S.datos.aportaciones,
      conceptos: S.datos.conceptos,
      gastos: S.datos.gastos,
      reembolsos: S.datos.reembolsos,
      devoluciones: S.datos.devoluciones,
      gastosPersonales: S.datos.gastosPersonales,
      honorarios: S.datos.honorarios,
    });
  }

  /* ---------------- piezas de HTML reutilizables ---------------- */

  function campo(etiqueta, interior, ayuda) {
    return `<div class="campo"><label class="campo-etiqueta">${esc(etiqueta)}</label>${interior}` +
      (ayuda ? `<p class="campo-ayuda">${esc(ayuda)}</p>` : "") + `</div>`;
  }

  function opcionesMoneda(seleccion) {
    return FT.MONEDAS.map((m) =>
      `<option value="${m.id}"${m.id === seleccion ? " selected" : ""}>${esc(m.nombre)} (${esc(m.simbolo)})</option>`
    ).join("");
  }

  function opcionesFormaPago(seleccion, conVacio) {
    let html = conVacio
      ? `<option value=""${!seleccion ? " selected" : ""}>— Elegir —</option>`
      : "";
    FT.FORMAS_PAGO_ORDEN.forEach((k) => {
      html += `<option value="${k}"${k === seleccion ? " selected" : ""}>${esc(FT.FORMAS_PAGO.filter((f) => f.id === k)[0].nombre)}</option>`;
    });
    return html;
  }

  function opcionesClientes(seleccion, conVacio) {
    let html = conVacio
      ? `<option value=""${!seleccion ? " selected" : ""}>— Elegir —</option>`
      : "";
    clientes().forEach((c) => {
      html += `<option value="${c.id}"${c.id === seleccion ? " selected" : ""}>${esc(FT.nombreCliente(c))}</option>`;
    });
    return html;
  }

  function opcionesCategoria(seleccion, categorias) {
    return categorias.map((c) =>
      `<option value="${c.id}"${c.id === seleccion ? " selected" : ""}>${esc(c.nombre)}</option>`
    ).join("");
  }

  function boton(accion, valor, texto, clase) {
    return `<button type="button" class="btn ${clase || ""}" data-accion="${esc(accion)}" data-valor="${esc(valor)}">${esc(texto)}</button>`;
  }

  function botonPequeno(accion, valor, texto, clase) {
    return `<button type="button" class="btn btn-pequeno ${clase || ""}" data-accion="${esc(accion)}" data-valor="${esc(valor)}">${esc(texto)}</button>`;
  }

  function filaCifra(etiqueta, valor, clase) {
    return `<li class="${clase || ""}"><span class="cifra-etiqueta">${esc(etiqueta)}</span><span class="cifra-valor">${esc(valor)}</span></li>`;
  }

  function cabeceraViaje() {
    const v = conViaje();
    if (!v.id) return "Gestión de viajes";
    return v.nombre + (v.destino ? " · " + v.destino : "");
  }

  /* ============================================================
     1. VIAJES
     ============================================================ */

  function nuevoBorradorViaje(v) {
    const x = v || {};
    return {
      id: x.id || null,
      nombre: x.nombre || "",
      destino: x.destino || "",
      inicio: FT.fechaDia(x.inicio) || hoyDia(),
      fin: FT.fechaDia(x.fin) || hoyDia(),
      moneda: x.moneda || FT.MONEDA_PRINCIPAL,
      observaciones: x.observaciones || "",
      errores: [],
      avisos: [],
      editando: !!x.id,
    };
  }

  function htmlViajes() {
    if (S.cargando) return `<p class="vacio">Cargando…</p>`;
    if (S.datos.viajes.length === 0) {
      return `<div class="tarjeta">
        <h2 class="tarjeta-titulo">Todavía no hay viajes</h2>
        <p class="tarjeta-sub">Crea tu primer viaje para empezar a organizar clientes, presupuesto y gastos. Cada viaje guarda sus propios datos.</p>
        ${boton("viaje-nuevo", "", "+ Crear un viaje")}
        ${htmlCopiasResumen()}
      </div>`;
    }
    const lista = S.datos.viajes.map((v) => {
      const r = FT.resumenDelViaje({
        viaje: v, clientes: S.datos.clientes, aportaciones: S.datos.aportaciones,
        conceptos: S.datos.conceptos, gastos: S.datos.gastos, reembolsos: S.datos.reembolsos,
        devoluciones: S.datos.devoluciones, gastosPersonales: S.datos.gastosPersonales, honorarios: S.datos.honorarios,
      });
      const activo = v.id === S.viajeId;
      return `<li>
        <div class="item-cabecera">
          <span class="item-titulo">${esc(v.nombre)}${activo ? ` <span class="insignia insignia-ok">abierto</span>` : ""}</span>
        </div>
        <div class="item-meta">${esc(v.destino || "Sin destino")} · ${esc(FT.fechaCorta(v.inicio))} – ${esc(FT.fechaCorta(v.fin))} · ${esc(FT.nombreMoneda(v.moneda))}</div>
        <div class="item-meta">${r.nClientes} cliente(s) · presupuesto ${esc(euros(r.presupuesto.total))} · gastado ${esc(euros(r.gastos.total))} · bote ${esc(euros(r.dineroDisponible))}</div>
        <div class="item-acciones">
          ${botonPequeno("viaje-abrir", v.id, activo ? "Ir al viaje" : "Abrir", "btn-secundario")}
          ${botonPequeno("viaje-editar", v.id, "Editar", "btn-ghost")}
          ${botonPequeno("viaje-eliminar", v.id, "Eliminar", "btn-ghost")}
        </div>
      </li>`;
    }).join("");
    return `<div class="tarjeta">
      <h2 class="tarjeta-titulo">Mis viajes</h2>
      <p class="tarjeta-sub">Toca «Abrir» para trabajar con un viaje. Los datos de cada viaje están separados.</p>
      ${boton("viaje-nuevo", "", "+ Nuevo viaje")}
    </div>
    <ul class="lista">${lista}</ul>
    ${htmlCopiasResumen()}`;
  }

  function htmlFormularioViaje() {
    const b = S.viaje;
    if (!b) return "";
    return `<div class="tarjeta">
      <h2 class="tarjeta-titulo">${b.editando ? "Editar viaje" : "Nuevo viaje"}</h2>
      ${b.errores.length ? `<div class="nota nota-aviso"><ul>${b.errores.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>` : ""}
      ${campo("Nombre del viaje", `<input type="text" id="viaje-nombre" value="${esc(b.nombre)}" placeholder="Ruta por Marruecos">`)}
      ${campo("Destino", `<input type="text" id="viaje-destino" value="${esc(b.destino)}" placeholder="Chefchaouen">`)}
      <div class="rejilla">
        ${campo("Fecha de inicio", `<input type="date" id="viaje-inicio" value="${esc(b.inicio)}">`)}
        ${campo("Fecha de fin", `<input type="date" id="viaje-fin" value="${esc(b.fin)}">`)}
      </div>
      ${campo("Moneda principal", `<select id="viaje-moneda">${opcionesMoneda(b.moneda)}</select>`, "Los totales del grupo se muestran en euros; cada gasto puede ir en otra moneda.")}
      ${campo("Observaciones", `<textarea id="viaje-observaciones" placeholder="Notas del viaje">${esc(b.observaciones)}</textarea>`)}
      <div class="fila-botones">
        ${boton("viaje-guardar", "", b.editando ? "Guardar cambios" : "Guardar viaje", "btn-verde")}
        ${boton("viaje-cancelar", "", "Cancelar", "btn-ghost")}
      </div>
    </div>`;
  }

  /* ============================================================
     2. CLIENTES Y BOTE COMÚN
     ============================================================ */

  function nuevoBorradorCliente(c) {
    const x = c || {};
    return {
      id: x.id || null,
      nombre: x.nombre || "",
      apellidos: x.apellidos || "",
      aportacionPrevista: x.aportacionPrevista != null ? String(x.aportacionPrevista) : String((conViaje().aportacionPrevista) || ""),
      observaciones: x.observaciones || "",
      errores: [],
      editando: !!x.id,
    };
  }

  function nuevoBorradorAportacion(a) {
    const x = a || {};
    return {
      id: x.id || null,
      clienteId: x.clienteId || "",
      importe: x.importe != null ? String(x.importe) : "",
      fecha: String(x.fecha || hoyISO()).slice(0, 16),
      forma: x.forma || "",
      observaciones: x.observaciones || "",
      errores: [],
      editando: !!x.id,
    };
  }

  function htmlClientes() {
    const v = conViaje();
    if (!v.id) return `<p class="vacio">Abre o crea un viaje para ver sus clientes.</p>`;
    if (S.cliente) return htmlFormularioCliente();
    if (S.aportacion) return htmlFormularioAportacion();

    const r = resumen();
    const lista = S.filtros.clientes
      ? FT.buscarClientes(S.datos.clientes, S.viajeId, S.filtros.clientes)
      : clientes();
    const filas = lista.map((c) => {
      const rc = FT.aportacionesDeClienteResumen(S.datos.aportaciones, c);
      const insignia = rc.completo
        ? (rc.exceso > 0 ? `<span class="insignia insignia-exceso">exceso ${esc(euros(rc.exceso))}</span>` : `<span class="insignia insignia-ok">completo</span>`)
        : `<span class="insignia insignia-pend">pendiente ${esc(euros(rc.pendiente))}</span>`;
      const ingresos = rc.aportaciones.map((a) =>
        `<div class="item-meta">${esc(FT.fechaHoraCorta(a.fecha))} · ${esc(euros(a.importe))} · ${esc(FT.nombreForma(a.forma))} ${botonPequeno("aportacion-editar", a.id, "Editar", "btn-ghost")} ${botonPequeno("aportacion-eliminar", a.id, "Borrar", "btn-ghost")}</div>`
      ).join("");
      return `<li>
        <div class="item-cabecera">
          <span class="item-titulo">${esc(FT.nombreCliente(c))}</span>
          ${insignia}
        </div>
        <div class="item-meta">Previsto ${esc(euros(rc.previsto))} · entregado ${esc(euros(rc.entregado))} · ${rc.nIngresos} ingreso(s)</div>
        ${ingresos}
        <div class="item-acciones">
          ${botonPequeno("aportacion-nueva", c.id, "+ Ingreso", "btn-secundario")}
          ${botonPequeno("cliente-editar", c.id, "Editar", "btn-ghost")}
          ${botonPequeno("cliente-eliminar", c.id, "Eliminar", "btn-ghost")}
        </div>
      </li>`;
    }).join("");

    return `<div class="tarjeta">
      <h2 class="tarjeta-titulo">Clientes y bote común</h2>
      <p class="tarjeta-sub">${r.nClientes} cliente(s) en este viaje. Cada cliente entrega su aportación al bote, en uno o varios ingresos.</p>
      ${boton("cliente-nuevo", "", "+ Añadir cliente", "btn-verde")}
      <div class="rejilla">
        ${boton("aportacion-comun", "", "Aportación común a todos", "btn-secundario")}
        ${boton("viaje-aportacion", "", "Cambiar aportación del viaje", "btn-ghost")}
      </div>
    </div>

    <div class="tarjeta">
      <h2 class="tarjeta-titulo">Bote común</h2>
      <ul class="cifras">
        ${filaCifra("Bote previsto", euros(r.botePrevisto))}
        ${filaCifra("Aportaciones recibidas", euros(r.recibido))}
        ${filaCifra("Aportaciones pendientes", euros(r.pendienteAportaciones), r.pendienteAportaciones > 0 ? "negativa" : "")}
        ${filaCifra("Dinero disponible del bote", euros(r.dineroDisponible), "destacada")}
        ${filaCifra("Adelantos pendientes de reembolso", euros(r.pendienteReembolso))}
      </ul>
      <p class="nota">El dinero disponible son las aportaciones recibidas menos los pagos hechos con el bote, los reembolsos y las devoluciones. Los adelantos que aún no se han reembolsado no se descuentan aquí: aparecen aparte como obligación pendiente.</p>
      <div class="fila-botones">
        ${boton("reembolso-nuevo", "", "+ Reembolso", "btn-secundario")}
        ${boton("devolucion-nueva", "", "+ Devolución a un cliente", "btn-secundario")}
      </div>
    </div>

    ${campo("Buscar cliente", `<input type="search" id="filtro-clientes" value="${esc(S.filtros.clientes)}" placeholder="Escribe un nombre">`)}

    <ul class="lista">${filas || `<li class="vacio">Todavía no hay clientes en este viaje.</li>`}</ul>
    ${htmlMovimientosBote()}`;
  }

  function htmlFormularioCliente() {
    const b = S.cliente;
    return `<div class="tarjeta">
      <h2 class="tarjeta-titulo">${b.editando ? "Editar cliente" : "Nuevo cliente"}</h2>
      ${b.errores.length ? `<div class="nota nota-aviso"><ul>${b.errores.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>` : ""}
      ${campo("Nombre", `<input type="text" id="cliente-nombre" value="${esc(b.nombre)}">`)}
      ${campo("Apellidos", `<input type="text" id="cliente-apellidos" value="${esc(b.apellidos)}">`)}
      ${campo("Aportación prevista al bote (€)", `<input type="number" inputmode="decimal" step="0.01" id="cliente-aportacion" value="${esc(b.aportacionPrevista)}">`, "Se puede cambiar solo para este cliente.")}
      ${campo("Observaciones", `<textarea id="cliente-observaciones">${esc(b.observaciones)}</textarea>`)}
      <div class="fila-botones">
        ${boton("cliente-guardar", "", "Guardar", "btn-verde")}
        ${boton("cliente-cancelar", "", "Cancelar", "btn-ghost")}
      </div>
    </div>`;
  }

  function htmlFormularioAportacion() {
    const b = S.aportacion;
    return `<div class="tarjeta">
      <h2 class="tarjeta-titulo">${b.editando ? "Editar ingreso" : "Nuevo ingreso al bote"}</h2>
      ${b.errores.length ? `<div class="nota nota-aviso"><ul>${b.errores.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>` : ""}
      ${campo("Cliente", `<select id="aportacion-cliente">${opcionesClientes(b.clienteId, true)}</select>`)}
      ${campo("Importe (€)", `<input type="number" inputmode="decimal" step="0.01" id="aportacion-importe" value="${esc(b.importe)}">`)}
      ${campo("Fecha del ingreso", `<input type="datetime-local" id="aportacion-fecha" value="${esc(b.fecha)}">`, "Se rellena con el momento actual; puedes cambiarla.")}
      ${campo("Forma de entrega", `<select id="aportacion-forma">${opcionesFormaPago(b.forma, true)}</select>`)}
      ${campo("Observaciones", `<textarea id="aportacion-observaciones">${esc(b.observaciones)}</textarea>`)}
      <div class="fila-botones">
        ${boton("aportacion-guardar", "", "Guardar ingreso", "btn-verde")}
        ${boton("aportacion-cancelar", "", "Cancelar", "btn-ghost")}
      </div>
    </div>`;
  }

  function htmlMovimientosBote() {
    const reembolsos = FT.reembolsosDeViaje(S.datos.reembolsos, S.viajeId);
    const devoluciones = FT.devolucionesDeViaje(S.datos.devoluciones, S.viajeId);
    if (reembolsos.length === 0 && devoluciones.length === 0) return "";
    const porGasto = {};
    gastos().forEach((g) => { porGasto[g.id] = g; });
    const filasR = reembolsos.map((r) => {
      const g = porGasto[r.gastoId];
      return `<li><div class="item-cabecera"><span class="item-titulo">Reembolso${g ? " · " + esc(g.descripcion) : ""}</span><span class="item-importe">${esc(euros(r.importe))}</span></div><div class="item-meta">${esc(FT.fechaHoraCorta(r.fecha))} · ${esc(FT.nombreForma(r.forma))} · beneficiario: ${esc(r.beneficiario === "yo" ? "yo (organizador)" : (FT.nombreCliente(FT.clientePorId(S.datos.clientes, r.beneficiario)) || "cliente"))} ${botonPequeno("reembolso-eliminar", r.id, "Borrar", "btn-ghost")}</div></li>`;
    }).join("");
    const filasD = devoluciones.map((d) => `<li><div class="item-cabecera"><span class="item-titulo">Devolución · ${esc(FT.nombreCliente(FT.clientePorId(S.datos.clientes, d.clienteId)) || "cliente")}</span><span class="item-importe">${esc(euros(d.importe))}</span></div><div class="item-meta">${esc(FT.fechaHoraCorta(d.fecha))} · ${esc(FT.nombreForma(d.forma))} ${botonPequeno("devolucion-eliminar", d.id, "Borrar", "btn-ghost")}</div></li>`).join("");
    return `<h3 class="seccion-titulo">Movimientos del bote</h3>
      <ul class="lista">${filasR}${filasD}</ul>`;
  }

  /* ============================================================
     3. PRESUPUESTO DEL GRUPO
     ============================================================ */

  function nuevoBorradorConcepto(k) {
    const x = k || {};
    const v = conViaje();
    return {
      id: x.id || null,
      categoria: x.categoria || "transporte",
      tipo: x.tipo || "total",
      descripcion: x.descripcion || "",
      proveedor: x.proveedor || "",
      fecha: FT.fechaDia(x.fecha) || hoyDia(),
      moneda: x.moneda || v.moneda || FT.MONEDA_BASE,
      cambio: String(x.cambio != null && x.cambio !== "" ? x.cambio : FT.tipoCambio(x.moneda || v.moneda || FT.MONEDA_BASE)),
      precio: x.precio != null ? String(x.precio) : "",
      personas: x.personas != null ? String(x.personas) : "",
      noches: x.noches != null ? String(x.noches) : "",
      habitaciones: x.habitaciones != null ? String(x.habitaciones) : "",
      dias: x.dias != null ? String(x.dias) : "",
      unidades: x.unidades != null ? String(x.unidades) : "",
      observaciones: x.observaciones || "",
      errores: [],
      editando: !!x.id,
    };
  }

  function htmlPestanasGastos(activa) {
    const t = [
      { id: "previsto", texto: "Presupuesto previsto" },
      { id: "real", texto: "Gastos reales" },
    ];
    return `<div class="pestanas" role="tablist" aria-label="Gastos del grupo">` +
      t.map((x) => `<button type="button" role="tab" class="pestana${x.id === activa ? " activa" : ""}" data-accion="pestana-gastos" data-valor="${x.id}" aria-selected="${x.id === activa}">${esc(x.texto)}</button>`).join("") +
      `</div>`;
  }

  function htmlPresupuesto() {
    const v = conViaje();
    if (!v.id) return `<p class="vacio">Abre un viaje para preparar su presupuesto.</p>`;
    if (S.concepto) return htmlFormularioConcepto();
    const r = resumen();
    const p = r.presupuesto;
    const acumulado = FT.gastoRealPorConcepto({
      viajeId: S.viajeId, conceptos: S.datos.conceptos, gastos: S.datos.gastos,
      personas: r.nClientes, noches: r.noches,
    });
    const bloques = FT.CATEGORIAS_ORDEN.map((k) => {
      const items = conceptos().filter((c) => c.categoria === k).map((c) => {
        const calc = FT.calcularConcepto(c, { personasViaje: r.nClientes, noches: r.noches });
        const info = acumulado[c.id];
        const prov = c.proveedor ? ` · ${esc(c.proveedor)}` : "";
        const cambio = c.moneda !== FT.MONEDA_BASE ? ` · ${esc(FT.etiquetaCambio(c.moneda, c.cambio))}` : "";
        return `<li>
          <div class="item-cabecera"><span class="item-titulo">${esc(c.descripcion)}</span><span class="item-importe">${esc(FT.formatearMoneda(calc.importe, c.moneda))}</span></div>
          <div class="item-meta">${esc(FT.nombreTipoCalculo(c.tipo))} · ${esc(calc.formula)} · ${esc(FT.fechaCorta(c.fecha))}${prov}${cambio}</div>
          <div class="item-meta">En euros: ${esc(euros(calc.importeEuros))}${calc.personasCubiertas ? " · cubre " + calc.personasCubiertas + " persona(s)" : ""}</div>
          <ul class="cifras">
            ${filaCifra("Importe previsto", euros(info.previsto))}
            ${filaCifra("Gasto real acumulado", euros(info.real))}
            ${filaCifra("Diferencia (real − previsto)", euros(info.diferencia), info.diferencia > 0 ? "negativa" : "positiva")}
          </ul>
          <div class="item-meta">${info.nGastos > 0
            ? `<span class="insignia insignia-ok">${info.nGastos} gasto(s) real(es) enlazado(s)</span>`
            : `<span class="insignia">sin gasto real todavía</span>`}</div>
          <div class="item-acciones">
            ${botonPequeno("pestana-gastos", "real", "Ver gastos reales", "btn-ghost")}
            ${botonPequeno("concepto-editar", c.id, "Editar", "btn-ghost")}
            ${botonPequeno("concepto-eliminar", c.id, "Eliminar", "btn-ghost")}
            ${botonPequeno("concepto-a-gasto", c.id, "Pasar a gasto real", "btn-secundario")}
          </div>
        </li>`;
      }).join("");
      const total = p.porCategoria[k] ? p.porCategoria[k].total : 0;
      return `<h3 class="seccion-titulo">${esc(FT.nombreCategoria(k))} · ${esc(euros(total))}</h3>
        <ul class="lista">${items || `<li class="vacio">Sin conceptos en esta categoría.</li>`}</ul>`;
    }).join("");

    const gastado = gastosGrupoEuros();
    const sinConcepto = FT.gastoRealSinConcepto({ viajeId: S.viajeId, gastos: S.datos.gastos });
    const hayPresupuesto = p.total > 0;
    return `${htmlPestanasGastos("previsto")}<div class="tarjeta">
      <h2 class="tarjeta-titulo">Presupuesto previsto del grupo</h2>
      <p class="tarjeta-sub">Lo que está previsto gastar. Son estimaciones: no se mezclan con los gastos reales.</p>
      ${boton("concepto-nuevo", "", "+ Añadir concepto", "btn-verde")}
      ${hayPresupuesto ? `<ul class="cifras">
        ${filaCifra("Presupuesto total", euros(p.total), "destacada")}
        ${filaCifra("Clientes", String(r.nClientes))}
        ${filaCifra("Coste medio por cliente", euros(p.costeMedio))}
        ${filaCifra("Gastos reales ya registrados", euros(gastado))}
        ${filaCifra("Gastos reales sin concepto", euros(sinConcepto))}
        ${filaCifra("Sobrecoste real (real − previsto)", euros(r.desviacion), r.desviacion > 0 ? "negativa" : "positiva")}
        ${filaCifra("Desviación sobre el presupuesto", (r.desviacionPct > 0 ? "+" : "") + r.desviacionPct + " %")}
      </ul>` : `<p class="nota nota-vacio" id="sin-presupuesto">Sin presupuesto definido. Añade conceptos para comparar lo previsto con lo gastado.</p>`}
      <p class="nota">Los conceptos del presupuesto y los gastos reales se llevan aparte para no sumarlos dos veces. Cuando una previsión se convierte en pago, usa «Pasar a gasto real».</p>
    </div>
    ${hayPresupuesto ? bloques : ""}`;
  }

  function gastosGrupoEuros() {
    return FT.gastosGrupoPorCategoria(S.datos.gastos, S.viajeId).total;
  }

  function opcionesTipoCalculo(seleccion) {
    return FT.TIPOS_CALCULO_ORDEN.map((k) => {
      const t = FT.TIPOS_CALCULO[k];
      return `<option value="${k}"${k === seleccion ? " selected" : ""}>${esc(t.nombre)} — ${esc(t.formula)}</option>`;
    }).join("");
  }

  function htmlFormularioConcepto() {
    const b = S.concepto;
    const v = conViaje();
    const calc = S.vistaPreviaConcepto;
    const t = FT.TIPOS_CALCULO[b.tipo] || FT.TIPOS_CALCULO.total;
    const camposUnidad = [];
    if (t.unidades.indexOf("personas") !== -1) camposUnidad.push(campo("Personas cubiertas", `<input type="number" inputmode="numeric" id="concepto-personas" value="${esc(b.personas)}" placeholder="${esc(String(resumen().nClientes))}">`, "Déjalo vacío para usar los clientes del viaje."));
    if (t.unidades.indexOf("habitaciones") !== -1) camposUnidad.push(campo("Habitaciones", `<input type="number" inputmode="numeric" id="concepto-habitaciones" value="${esc(b.habitaciones)}">`));
    if (t.unidades.indexOf("noches") !== -1) camposUnidad.push(campo("Noches", `<input type="number" inputmode="numeric" id="concepto-noches" value="${esc(b.noches)}" placeholder="${esc(String(resumen().noches))}">`));
    if (t.unidades.indexOf("dias") !== -1) camposUnidad.push(campo("Días", `<input type="number" inputmode="numeric" id="concepto-dias" value="${esc(b.dias)}" placeholder="${esc(String(resumen().duracion))}">`));
    if (t.unidades.indexOf("unidades") !== -1) camposUnidad.push(campo("Unidades", `<input type="number" inputmode="numeric" id="concepto-unidades" value="${esc(b.unidades)}">`));

    return `<div class="tarjeta">
      <h2 class="tarjeta-titulo">${b.editando ? "Editar concepto" : "Nuevo concepto del presupuesto"}</h2>
      ${b.errores.length ? `<div class="nota nota-aviso"><ul>${b.errores.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>` : ""}
      ${campo("Categoría", `<select id="concepto-categoria">${opcionesCategoria(b.categoria, FT.CATEGORIAS)}</select>`)}
      ${campo("Descripción", `<input type="text" id="concepto-descripcion" value="${esc(b.descripcion)}" placeholder="Alquiler de furgoneta">`)}
      ${campo("Proveedor", `<input type="text" id="concepto-proveedor" value="${esc(b.proveedor)}" placeholder="Nombre del proveedor">`)}
      ${campo("Fecha", `<input type="date" id="concepto-fecha" value="${esc(b.fecha)}">`)}
      ${campo("Forma de cálculo", `<select id="concepto-tipo">${opcionesTipoCalculo(b.tipo)}</select>`)}
      <div class="rejilla">
        ${campo("Moneda", `<select id="concepto-moneda">${opcionesMoneda(b.moneda)}</select>`)}
        ${campo("Cambio (1 € = X)", `<input type="number" inputmode="decimal" step="0.0001" id="concepto-cambio" value="${esc(b.cambio)}">`)}
      </div>
      ${campo("Precio", `<input type="number" inputmode="decimal" step="0.01" id="concepto-precio" value="${esc(b.precio)}">`)}
      ${camposUnidad.join("")}
      <div class="nota" id="concepto-previa">${calc ? htmlPreviaConcepto(calc) : "El cálculo aparecerá aquí antes de guardar."}</div>
      ${campo("Observaciones", `<textarea id="concepto-observaciones">${esc(b.observaciones)}</textarea>`)}
      <div class="fila-botones">
        ${boton("concepto-guardar", "", "Guardar concepto", "btn-verde")}
        ${boton("concepto-cancelar", "", "Cancelar", "btn-ghost")}
      </div>
    </div>`;
  }

  function htmlPreviaConcepto(calc) {
    const partes = calc.partes.map((p) => `${esc(p.etiqueta)}: ${p.valor}`).join(" · ");
    return `<strong>Cálculo: ${esc(calc.formula)}</strong><br>${partes}<br>Importe: <strong>${esc(FT.formatearMoneda(calc.importe, calc.moneda))}</strong>` +
      (calc.moneda !== FT.MONEDA_BASE ? ` (${esc(euros(calc.importeEuros))} a ${esc(FT.etiquetaCambio(calc.moneda, calc.cambio))})` : "");
  }

  /* ============================================================
     4. GASTOS REALES DEL GRUPO
     ============================================================ */

  function nuevoBorradorGasto(g) {
    const x = g || {};
    return {
      id: x.id || null,
      categoria: x.categoria || "transporte",
      descripcion: x.descripcion || "",
      fecha: String(x.fecha || hoyISO()).slice(0, 16),
      moneda: x.moneda || conViaje().moneda || FT.MONEDA_BASE,
      cambio: String(x.cambio != null && x.cambio !== "" ? x.cambio : FT.tipoCambio(x.moneda || FT.MONEDA_BASE)),
      importe: x.importe != null ? String(x.importe) : "",
      forma: x.forma || "",
      pagador: x.pagador || "bote",
      clienteId: x.clienteId || "",
      conceptoId: x.conceptoId || "",
      observaciones: x.observaciones || "",
      errores: [],
      editando: !!x.id,
    };
  }

  function htmlGastos() {
    const v = conViaje();
    if (!v.id) return `<p class="vacio">Abre un viaje para registrar sus gastos.</p>`;
    if (S.gasto) return htmlFormularioGasto();
    if (S.reembolso) return htmlFormularioReembolso();
    if (S.devolucion) return htmlFormularioDevolucion();
    // Las dos pestañas viven dentro de «Gastos del grupo».
    if (S.concepto) return htmlFormularioConcepto();
    if (S.pestanaGastos === "previsto") return htmlPresupuesto();

    const r = resumen();
    const porGasto = {};
    gastos().forEach((g) => { porGasto[g.id] = g; });
    const lista = gastos()
      .filter((g) => !S.filtros.categoriaGasto || g.categoria === S.filtros.categoriaGasto)
      .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0))
      .map((g) => {
        const pendiente = FT.pendienteDeGastoCon(g, FT.reembolsosDeViaje(S.datos.reembolsos, S.viajeId));
        const quien = g.pagador === "cliente"
          ? (FT.nombreCliente(FT.clientePorId(S.datos.clientes, g.clienteId)) || "cliente")
          : FT.nombrePagador(g.pagador);
        const concepto = FT.conceptosDeViaje(S.datos.conceptos, S.viajeId).filter((c) => c.id === g.conceptoId)[0];
        const cambio = g.moneda !== FT.MONEDA_BASE ? ` · ${esc(FT.etiquetaCambio(g.moneda, g.cambio))} (${esc(euros(FT.aEuros(g.importe, g.moneda, g.cambio)))})` : "";
        return `<li>
          <div class="item-cabecera"><span class="item-titulo">${esc(g.descripcion)}</span><span class="item-importe">${esc(FT.formatearMoneda(g.importe, g.moneda))}</span></div>
          <div class="item-meta">${esc(FT.nombreCategoria(g.categoria))} · ${esc(FT.fechaHoraCorta(g.fecha))} · ${esc(FT.nombreForma(g.forma))}${cambio}</div>
          <div class="item-meta">Paga: ${esc(quien)}${concepto ? ` · previsto: ${esc(concepto.descripcion)}` : ""}</div>
          ${pendiente > 0 ? `<div class="item-meta"><span class="insignia insignia-pend">pendiente de reembolso ${esc(euros(pendiente))}</span></div>` : ""}
          <div class="item-acciones">
            ${(g.pagador === "yo" || g.pagador === "cliente") && pendiente > 0 ? botonPequeno("reembolso-gasto", g.id, "+ Reembolsar", "btn-secundario") : ""}
            ${botonPequeno("gasto-editar", g.id, "Editar", "btn-ghost")}
            ${botonPequeno("gasto-eliminar", g.id, "Eliminar", "btn-ghost")}
          </div>
        </li>`;
      }).join("");

    const porCategoria = FT.CATEGORIAS_ORDEN.map((k) =>
      filaCifra(FT.nombreCategoria(k), euros(r.gastos.porCategoria[k].total))
    ).join("");

    const hayPresupuesto = r.presupuesto.total > 0;
    const acumulado = FT.gastoRealPorConcepto({
      viajeId: S.viajeId, conceptos: S.datos.conceptos, gastos: S.datos.gastos,
      personas: r.nClientes, noches: r.noches,
    });
    const comparativa = comparativaPresupuesto(r, acumulado);

    return `${htmlPestanasGastos("real")}<div class="tarjeta">
      <h2 class="tarjeta-titulo">Gastos reales del grupo</h2>
      <p class="tarjeta-sub">Pagos que ya se han hecho. Se llevan aparte del presupuesto para no contar dos veces.</p>
      ${boton("gasto-nuevo", "", "+ Registrar gasto", "btn-verde")}
      ${campo("Filtrar por categoría", `<select id="filtro-categoria-gasto"><option value="">Todas las categorías</option>${opcionesCategoria(S.filtros.categoriaGasto, FT.CATEGORIAS)}</select>`)}
      <ul class="cifras">
        ${filaCifra("Gasto real total", euros(r.gastos.total), "destacada")}
        ${hayPresupuesto ? filaCifra("Presupuesto previsto", euros(r.presupuesto.total)) : ""}
        ${hayPresupuesto
          ? filaCifra("Sobrecoste (real − previsto)", euros(r.desviacion), r.desviacion > 0 ? "negativa" : "positiva")
          : filaCifra("Presupuesto previsto", "Sin presupuesto definido")}
      </ul>
      ${hayPresupuesto ? "" : `<p class="nota" id="sin-presupuesto">Sin presupuesto definido. ${botonPequeno("pestana-gastos", "previsto", "Ir al presupuesto previsto", "btn-secundario")}</p>`}
      <h3 class="seccion-titulo">Por categoría</h3>
      <ul class="cifras">${porCategoria}</ul>
    </div>

    ${comparativa}

    ${htmlAdelantos(r)}
    <ul class="lista">${lista || `<li class="vacio">Todavía no hay gastos registrados.</li>`}</ul>`;
  }

  /**
   * Tabla de comparación previsto / real por concepto.
   * Solo se dibuja si hay conceptos de presupuesto. La diferencia es
   * gasto real − importe previsto: positiva quiere decir sobrecoste.
   */
  function comparativaPresupuesto(r, acumulado) {
    const lista = conceptos();
    if (lista.length === 0) return "";
    const filas = lista.map((c) => {
      const info = acumulado[c.id];
      const cat = FT.nombreCategoria(c.categoria);
      return `<tr>
        <td>${esc(c.descripcion)}<br><span class="tabla-sub">${esc(cat)}</span></td>
        <td class="num">${esc(euros(info.previsto))}</td>
        <td class="num">${esc(euros(info.real))}</td>
        <td class="num ${info.diferencia > 0 ? "negativa" : "positiva"}">${esc(euros(info.diferencia))}</td>
      </tr>`;
    }).join("");
    const sinConcepto = FT.gastoRealSinConcepto({ viajeId: S.viajeId, gastos: S.datos.gastos });
    return `<div class="tarjeta">
      <h2 class="tarjeta-titulo">Presupuesto previsto y gasto real por concepto</h2>
      <p class="tarjeta-sub">La diferencia es gasto real − presupuesto: positiva significa sobrecoste.</p>
      <div class="tabla-envoltorio">
        <table class="tabla">
          <thead><tr><th>Descripción</th><th class="num">Importe previsto</th><th class="num">Gasto real acumulado</th><th class="num">Diferencia</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
      <ul class="cifras">
        ${filaCifra("Total previsto", euros(r.presupuesto.total))}
        ${filaCifra("Gasto real en conceptos", euros(r.gastos.total - sinConcepto))}
        ${filaCifra("Gastos reales sin concepto (no previstos)", euros(sinConcepto))}
        ${filaCifra("Total gasto real", euros(r.gastos.total), "destacada")}
      </ul>
    </div>`;
  }

  function htmlAdelantos(r) {
    if (r.adelantosPendientes.length === 0) return "";
    const filas = r.adelantosPendientes.map((x) => {
      const g = x.gasto;
      const quien = g.pagador === "cliente"
        ? (FT.nombreCliente(FT.clientePorId(S.datos.clientes, g.clienteId)) || "cliente")
        : "yo (organizador)";
      return `<li>
        <div class="item-cabecera"><span class="item-titulo">${esc(g.descripcion)}</span><span class="item-importe">${esc(euros(x.pendiente))}</span></div>
        <div class="item-meta">Lo adelantó ${esc(quien)} · reembolsado ${esc(euros(x.reembolsado))} de ${esc(FT.formatearMoneda(g.importe, g.moneda))}</div>
        <div class="item-acciones">${botonPequeno("reembolso-gasto", g.id, "+ Registrar reembolso", "btn-secundario")}</div>
      </li>`;
    }).join("");
    return `<div class="tarjeta">
      <h2 class="tarjeta-titulo">Adelantos pendientes de reembolso</h2>
      <p class="tarjeta-sub">Gastos que pagó alguien por el grupo y todavía no se le han devuelto. No salen del bote hasta que se reembolsan.</p>
      <ul class="lista">${filas}</ul>
      <ul class="cifras">${filaCifra("Total pendiente", euros(r.pendienteReembolso), "destacada")}</ul>
    </div>`;
  }

  /**
   * Campo «Concepto del presupuesto» del formulario de gastos reales.
   *
   * Carga los conceptos del viaje activo con descripción, categoría e
   * importe previsto. Al elegir uno se enseña su previsión, lo ya gastado
   * (sin contar el gasto que se está editando) y lo que queda o se ha
   * pasado. Si no hay conceptos, invita a crear uno conservando lo escrito.
   */
  function campoConceptoDelGasto(b) {
    const lista = conceptos();
    const v = conViaje();
    if (lista.length === 0) {
      return campo("Concepto del presupuesto",
        `<select id="gasto-concepto" disabled><option value="">No hay presupuesto creado</option></select>` +
        `<p class="campo-ayuda">No hay presupuesto creado para este viaje.</p>` +
        `<p class="campo-ayuda">Lo que ya hayas escrito seguirá aquí al volver. ${botonPequeno("concepto-nuevo-desde-gasto", "", "+ Añadir concepto", "btn-secundario")}</p>`);
    }
    const r = resumen();
    const acumulado = FT.gastoRealPorConcepto({
      viajeId: S.viajeId, conceptos: S.datos.conceptos, gastos: S.datos.gastos,
      personas: r.nClientes, noches: r.noches, excluirGastoId: b.id || "",
    });
    const opciones = lista.map((c) => {
      const info = acumulado[c.id];
      return `<option value="${c.id}"${c.id === b.conceptoId ? " selected" : ""}>` +
        `${esc(c.descripcion)} · ${esc(FT.nombreCategoria(c.categoria))} · Previsto: ${esc(FT.formatearMoneda(info.previsto, c.moneda))}</option>`;
    }).join("");
    const elegido = b.conceptoId ? acumulado[b.conceptoId] : null;
    const resumenConcepto = elegido
      ? `<p class="campo-ayuda" id="gasto-concepto-detalle">Previsto: <strong>${esc(euros(elegido.previsto))}</strong> · ` +
        `Gasto real acumulado: <strong>${esc(euros(elegido.real))}</strong> · ` +
        (elegido.diferencia > 0
          ? `Sobrecoste: <strong>${esc(euros(elegido.diferencia))}</strong>`
          : `Restante: <strong>${esc(euros(-elegido.diferencia))}</strong>`) +
        (elegido.nGastos > 0 ? ` · ${elegido.nGastos} pago(s) ya enlazado(s)` : "") + `</p>`
      : "";
    return campo("Concepto del presupuesto (opcional)",
      `<select id="gasto-concepto"><option value=""${!b.conceptoId ? " selected" : ""}>Gasto no previsto</option>${opciones}</select>` +
      `<p class="campo-ayuda">Puedes enlazar varios pagos al mismo concepto (una reserva y el pago final, por ejemplo).</p>` +
      resumenConcepto);
  }

  function htmlFormularioGasto() {
    const b = S.gasto;
    return `<div class="tarjeta">
      <h2 class="tarjeta-titulo">${b.editando ? "Editar gasto" : "Registrar gasto del grupo"}</h2>
      ${b.errores.length ? `<div class="nota nota-aviso"><ul>${b.errores.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>` : ""}
      ${campo("Categoría", `<select id="gasto-categoria">${opcionesCategoria(b.categoria, FT.CATEGORIAS)}</select>`)}
      ${campo("Descripción", `<input type="text" id="gasto-descripcion" value="${esc(b.descripcion)}">`)}
      ${campo("Fecha", `<input type="datetime-local" id="gasto-fecha" value="${esc(b.fecha)}">`)}
      <div class="rejilla">
        ${campo("Moneda", `<select id="gasto-moneda">${opcionesMoneda(b.moneda)}</select>`)}
        ${campo("Cambio (1 € = X)", `<input type="number" inputmode="decimal" step="0.0001" id="gasto-cambio" value="${esc(b.cambio)}">`)}
      </div>
      ${campo("Importe", `<input type="number" inputmode="decimal" step="0.01" id="gasto-importe" value="${esc(b.importe)}">`)}
      ${campo("Forma de pago", `<select id="gasto-forma">${opcionesFormaPago(b.forma, true)}</select>`)}
      ${campo("Quién lo ha pagado", `<select id="gasto-pagador"><option value="bote"${b.pagador === "bote" ? " selected" : ""}>Bote común</option><option value="yo"${b.pagador === "yo" ? " selected" : ""}>Yo (organizador)</option><option value="cliente"${b.pagador === "cliente" ? " selected" : ""}>Un cliente</option></select>`)}
      ${b.pagador === "cliente" ? campo("Cliente que paga", `<select id="gasto-cliente">${opcionesClientes(b.clienteId, true)}</select>`) : ""}
      ${campoConceptoDelGasto(b)}
      ${campo("Observaciones", `<textarea id="gasto-observaciones">${esc(b.observaciones)}</textarea>`)}
      <div class="fila-botones">
        ${boton("gasto-guardar", "", "Guardar gasto", "btn-verde")}
        ${boton("gasto-cancelar", "", "Cancelar", "btn-ghost")}
      </div>
    </div>`;
  }

  function nuevoBorradorReembolso(gasto) {
    const pendiente = gasto ? FT.pendienteDeGastoCon(gasto, FT.reembolsosDeViaje(S.datos.reembolsos, S.viajeId)) : 0;
    return {
      gastoId: gasto ? gasto.id : "",
      beneficiario: gasto ? (gasto.pagador === "cliente" ? gasto.clienteId : "yo") : "yo",
      importe: String(pendiente || ""),
      fecha: hoyISO().slice(0, 16),
      forma: "transferencia",
      observaciones: "",
      errores: [],
    };
  }

  function htmlFormularioReembolso() {
    const b = S.reembolso;
    const gasto = gastos().filter((g) => g.id === b.gastoId)[0];
    return `<div class="tarjeta">
      <h2 class="tarjeta-titulo">Reembolso a quien adelantó</h2>
      ${b.errores.length ? `<div class="nota nota-aviso"><ul>${b.errores.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>` : ""}
      ${campo("Gasto adelantado", `<select id="reembolso-gasto">${gastos().filter((g) => (g.pagador === "yo" || g.pagador === "cliente")).map((g) => `<option value="${g.id}"${g.id === b.gastoId ? " selected" : ""}>${esc(g.descripcion)} · ${esc(FT.formatearMoneda(g.importe, g.moneda))}</option>`).join("")}</select>`)}
      ${gasto ? `<p class="campo-ayuda">Pendiente ahora: ${esc(euros(FT.pendienteDeGastoCon(gasto, FT.reembolsosDeViaje(S.datos.reembolsos, S.viajeId))))}. El reembolso no cuenta como gasto nuevo.</p>` : ""}
      ${campo("Importe a reembolsar", `<input type="number" inputmode="decimal" step="0.01" id="reembolso-importe" value="${esc(b.importe)}">`)}
      ${campo("Fecha", `<input type="datetime-local" id="reembolso-fecha" value="${esc(b.fecha)}">`)}
      ${campo("Forma de pago", `<select id="reembolso-forma">${opcionesFormaPago(b.forma, true)}</select>`)}
      ${campo("Observaciones", `<textarea id="reembolso-observaciones">${esc(b.observaciones)}</textarea>`)}
      <div class="fila-botones">
        ${boton("reembolso-guardar", "", "Guardar reembolso", "btn-verde")}
        ${boton("reembolso-cancelar", "", "Cancelar", "btn-ghost")}
      </div>
    </div>`;
  }

  function htmlFormularioDevolucion() {
    const b = S.devolucion;
    return `<div class="tarjeta">
      <h2 class="tarjeta-titulo">Devolución del bote a un cliente</h2>
      <p class="tarjeta-sub">Cuando sobra dinero del bote y se devuelve a un cliente. Sale del bote como movimiento real.</p>
      ${b.errores.length ? `<div class="nota nota-aviso"><ul>${b.errores.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>` : ""}
      ${campo("Cliente", `<select id="devolucion-cliente">${opcionesClientes(b.clienteId, true)}</select>`)}
      ${campo("Importe a devolver (€)", `<input type="number" inputmode="decimal" step="0.01" id="devolucion-importe" value="${esc(b.importe)}">`)}
      ${campo("Fecha", `<input type="datetime-local" id="devolucion-fecha" value="${esc(b.fecha)}">`)}
      ${campo("Forma", `<select id="devolucion-forma">${opcionesFormaPago(b.forma, true)}</select>`)}
      ${campo("Observaciones", `<textarea id="devolucion-observaciones">${esc(b.observaciones)}</textarea>`)}
      <div class="fila-botones">
        ${boton("devolucion-guardar", "", "Guardar devolución", "btn-verde")}
        ${boton("devolucion-cancelar", "", "Cancelar", "btn-ghost")}
      </div>
    </div>`;
  }

  /* ============================================================
     5. MIS GASTOS
     ============================================================ */

  function nuevoBorradorGastoPersonal(g) {
    const x = g || {};
    return {
      id: x.id || null,
      categoria: x.categoria || "vuelos",
      concepto: x.concepto || "",
      fecha: String(x.fecha || hoyISO()).slice(0, 16),
      moneda: x.moneda || conViaje().moneda || FT.MONEDA_BASE,
      cambio: String(x.cambio != null && x.cambio !== "" ? x.cambio : FT.tipoCambio(x.moneda || FT.MONEDA_BASE)),
      importe: x.importe != null ? String(x.importe) : "",
      cubiertoPorGrupo: !!x.cubiertoPorGrupo,
      observaciones: x.observaciones || "",
      errores: [],
      editando: !!x.id,
    };
  }

  function htmlMios() {
    const v = conViaje();
    if (!v.id) return `<p class="vacio">Abre un viaje para ver tus gastos.</p>`;
    if (S.gastoPersonal) return htmlFormularioGastoPersonal();
    if (S.honorario) return htmlFormularioHonorario();
    const r = resumen();
    const lista = gastosPersonales().map((g) => `<li>
        <div class="item-cabecera"><span class="item-titulo">${esc(g.concepto)}</span><span class="item-importe">${esc(FT.formatearMoneda(g.importe, g.moneda))}</span></div>
        <div class="item-meta">${esc(FT.nombreCategoriaPersonal(g.categoria))} · ${esc(FT.fechaHoraCorta(g.fecha))}${g.moneda !== FT.MONEDA_BASE ? ` · ${esc(FT.etiquetaCambio(g.moneda, g.cambio))} (${esc(euros(FT.aEuros(g.importe, g.moneda, g.cambio)))})` : ""}</div>
        ${g.cubiertoPorGrupo ? `<div class="item-meta"><span class="insignia insignia-exceso">cubierto por el grupo</span></div>` : ""}
        <div class="item-acciones">
          ${botonPequeno("personal-editar", g.id, "Editar", "btn-ghost")}
          ${botonPequeno("personal-eliminar", g.id, "Eliminar", "btn-ghost")}
        </div>
      </li>`).join("");

    return `<div class="tarjeta">
      <h2 class="tarjeta-titulo">Mis gastos de viaje</h2>
      <p class="tarjeta-sub">Gastos personales del organizador. Por defecto son tuyos y NO se descuentan del bote común.</p>
      ${boton("personal-nuevo", "", "+ Añadir gasto mío", "btn-verde")}
      <ul class="cifras">
        ${filaCifra("Mis gastos personales", euros(r.misGastos.total), "destacada")}
        ${filaCifra("Cubiertos por el grupo", euros(r.misGastos.cubiertosPorGrupo))}
      </ul>
      <p class="nota">Si marcas un gasto como «cubierto por el grupo», se contabiliza una sola vez como gasto del grupo y deja de contar como gasto tuyo.</p>
    </div>
    <ul class="lista">${lista || `<li class="vacio">Todavía no has registrado gastos personales.</li>`}</ul>
    ${htmlHonorarios(r)}`;
  }

  function htmlFormularioGastoPersonal() {
    const b = S.gastoPersonal;
    return `<div class="tarjeta">
      <h2 class="tarjeta-titulo">${b.editando ? "Editar gasto mío" : "Nuevo gasto mío"}</h2>
      ${b.errores.length ? `<div class="nota nota-aviso"><ul>${b.errores.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>` : ""}
      ${campo("Categoría", `<select id="personal-categoria">${opcionesCategoria(b.categoria, FT.CATEGORIAS_PERSONALES)}</select>`)}
      ${campo("Concepto", `<input type="text" id="personal-concepto" value="${esc(b.concepto)}" placeholder="Vuelo a Tánger">`)}
      ${campo("Fecha", `<input type="datetime-local" id="personal-fecha" value="${esc(b.fecha)}">`)}
      <div class="rejilla">
        ${campo("Moneda", `<select id="personal-moneda">${opcionesMoneda(b.moneda)}</select>`)}
        ${campo("Cambio (1 € = X)", `<input type="number" inputmode="decimal" step="0.0001" id="personal-cambio" value="${esc(b.cambio)}">`)}
      </div>
      ${campo("Importe", `<input type="number" inputmode="decimal" step="0.01" id="personal-importe" value="${esc(b.importe)}">`)}
      <label class="opcion ${b.cubiertoPorGrupo ? "marcada" : ""}" data-accion="personal-cubierto" data-valor="1">
        <input type="checkbox" ${b.cubiertoPorGrupo ? "checked" : ""} data-accion="personal-cubierto" data-valor="1">
        <span class="opcion-texto"><span class="opcion-titulo">Cubierto por el grupo</span><span class="opcion-detalle">Se contabiliza como gasto del grupo, una sola vez.</span></span>
      </label>
      ${campo("Observaciones", `<textarea id="personal-observaciones">${esc(b.observaciones)}</textarea>`)}
      <div class="fila-botones">
        ${boton("personal-guardar", "", "Guardar gasto", "btn-verde")}
        ${boton("personal-cancelar", "", "Cancelar", "btn-ghost")}
      </div>
    </div>`;
  }

  /* ============================================================
     6. MIS HONORARIOS (dentro de «Mis gastos»)
     ============================================================ */

  function nuevoBorradorHonorario(h) {
    const x = h || {};
    return {
      id: x.id || null,
      clienteId: x.clienteId || "",
      concepto: x.concepto || "Honorarios de gestión",
      previsto: x.previsto != null ? String(x.previsto) : "",
      cobrado: x.cobrado != null ? String(x.cobrado) : "",
      fecha: String(x.fecha || hoyISO()).slice(0, 16),
      forma: x.forma || "transferencia",
      observaciones: x.observaciones || "",
      errores: [],
      editando: !!x.id,
    };
  }

  function htmlHonorarios(r) {
    const lista = honorarios().map((h) => {
      const pend = FT.redondear((Number(h.previsto) || 0) - (Number(h.cobrado) || 0), 2);
      return `<li>
        <div class="item-cabecera"><span class="item-titulo">${esc(FT.nombreCliente(FT.clientePorId(S.datos.clientes, h.clienteId)) || "Cliente")} · ${esc(h.concepto)}</span><span class="item-importe">${esc(euros(h.previsto))}</span></div>
        <div class="item-meta">Cobrado ${esc(euros(h.cobrado))} · ${pend > 0 ? "pendiente " + esc(euros(pend)) : "cobrado del todo"} · ${esc(FT.fechaHoraCorta(h.fecha))} · ${esc(FT.nombreForma(h.forma))}</div>
        <div class="item-acciones">
          ${botonPequeno("honorario-editar", h.id, "Editar", "btn-ghost")}
          ${botonPequeno("honorario-eliminar", h.id, "Eliminar", "btn-ghost")}
        </div>
      </li>`;
    }).join("");

    return `<div class="tarjeta">
      <h2 class="tarjeta-titulo">Mis honorarios</h2>
      <p class="tarjeta-sub">Honorarios de diseño, planificación, coordinación y acompañamiento. NO forman parte del bote común.</p>
      ${boton("honorario-nuevo", "", "+ Añadir honorarios", "btn-verde")}
      <ul class="cifras">
        ${filaCifra("Honorarios previstos", euros(r.honorarios.previsto))}
        ${filaCifra("Honorarios cobrados", euros(r.honorarios.cobrado))}
        ${filaCifra("Pendiente de cobro", euros(r.honorarios.pendiente), r.honorarios.pendiente > 0 ? "negativa" : "")}
      </ul>
    </div>
    <ul class="lista">${lista || `<li class="vacio">Todavía no has registrado honorarios.</li>`}</ul>
    <div class="tarjeta">
      <h2 class="tarjeta-titulo">Resultado del organizador</h2>
      <p class="tarjeta-sub">Cálculos de gestión antes de impuestos.</p>
      <ul class="cifras">
        ${filaCifra("Honorarios previstos", euros(r.honorarios.previsto))}
        ${filaCifra("− Mis gastos personales previstos", euros(r.misGastos.total))}
        ${filaCifra("Resultado previsto", euros(r.resultadoPrevisto), "destacada")}
        ${filaCifra("Honorarios cobrados", euros(r.honorarios.cobrado))}
        ${filaCifra("− Mis gastos personales realizados", euros(r.misGastos.total))}
        ${filaCifra("Resultado real", euros(r.resultadoReal), "destacada")}
      </ul>
      <p class="nota">Estos resultados son cálculos de gestión antes de impuestos. No incluyen el bote común.</p>
    </div>`;
  }

  function htmlFormularioHonorario() {
    const b = S.honorario;
    return `<div class="tarjeta">
      <h2 class="tarjeta-titulo">${b.editando ? "Editar honorarios" : "Nuevos honorarios"}</h2>
      ${b.errores.length ? `<div class="nota nota-aviso"><ul>${b.errores.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>` : ""}
      ${campo("Cliente", `<select id="honorario-cliente">${opcionesClientes(b.clienteId, true)}</select>`)}
      ${campo("Concepto", `<input type="text" id="honorario-concepto" value="${esc(b.concepto)}">`)}
      <div class="rejilla">
        ${campo("Honorarios previstos (€)", `<input type="number" inputmode="decimal" step="0.01" id="honorario-previsto" value="${esc(b.previsto)}">`)}
        ${campo("Importe cobrado (€)", `<input type="number" inputmode="decimal" step="0.01" id="honorario-cobrado" value="${esc(b.cobrado)}">`)}
      </div>
      ${campo("Fecha de cobro", `<input type="datetime-local" id="honorario-fecha" value="${esc(b.fecha)}">`)}
      ${campo("Forma de cobro", `<select id="honorario-forma">${opcionesFormaPago(b.forma, true)}</select>`)}
      ${campo("Observaciones", `<textarea id="honorario-observaciones">${esc(b.observaciones)}</textarea>`)}
      <div class="fila-botones">
        ${boton("honorario-guardar", "", "Guardar honorarios", "btn-verde")}
        ${boton("honorario-cancelar", "", "Cancelar", "btn-ghost")}
      </div>
    </div>`;
  }

  /* ============================================================
     7. RESUMEN DEL VIAJE
     ============================================================ */

  function htmlResumen() {
    const v = conViaje();
    if (!v.id) return `<p class="vacio">Abre un viaje para ver su resumen.</p>`;
    const r = resumen();
    const porCliente = r.porCliente.map((x) => filaCifra(
      FT.nombreCliente(x.cliente),
      x.exceso > 0 ? "exceso " + euros(x.exceso) : (x.pendiente > 0 ? "pendiente " + euros(x.pendiente) : "completo"),
      x.pendiente > 0 ? "negativa" : "positiva"
    )).join("");
    const porCat = FT.CATEGORIAS_ORDEN.map((k) => filaCifra(FT.nombreCategoria(k), euros(r.gastos.porCategoria[k].total))).join("");
    const monedas = FT.saldosPorMoneda({
      viajeId: S.viajeId, viaje: v,
      gastos: S.datos.gastos, gastosPersonales: S.datos.gastosPersonales, aportaciones: S.datos.aportaciones,
    });
    const filasMoneda = monedas.monedas.map((m) => filaCifra(
      FT.nombreMoneda(m.moneda) + " (" + FT.etiquetaCambio(m.moneda, m.cambio) + ")",
      "gastos " + FT.formatearMoneda(m.gastosGrupo, m.moneda) + " = " + euros(m.gastosGrupoEuros)
    )).join("");

    const hayPresupuesto = r.presupuesto.total > 0;
    const acumulado = FT.gastoRealPorConcepto({
      viajeId: S.viajeId, conceptos: S.datos.conceptos, gastos: S.datos.gastos,
      personas: r.nClientes, noches: r.noches,
    });
    const comparativa = comparativaPresupuesto(r, acumulado);

    return `<div class="tarjeta">
      <h2 class="tarjeta-titulo">${esc(v.nombre)}</h2>
      <p class="tarjeta-sub">${esc(v.destino)} · ${esc(FT.fechaCorta(v.inicio))} – ${esc(FT.fechaCorta(v.fin))} · ${r.duracion} día(s), ${r.noches} noche(s)</p>
      <ul class="cifras">
        ${filaCifra("Número de clientes", String(r.nClientes), "destacada")}
        ${hayPresupuesto
          ? filaCifra("Presupuesto del grupo", euros(r.presupuesto.total))
          : filaCifra("Presupuesto del grupo", "Sin presupuesto definido")}
        ${filaCifra("Gasto real del grupo", euros(r.gastos.total))}
        ${hayPresupuesto
          ? filaCifra("Sobrecoste (real − presupuesto)", euros(r.desviacion), r.desviacion > 0 ? "negativa" : "positiva")
          : filaCifra("Presupuesto previsto", "Sin presupuesto definido")}
        ${filaCifra("Coste medio por cliente", euros(r.presupuesto.costeMedio))}
      </ul>
      ${hayPresupuesto ? "" : `<p class="nota">Sin presupuesto definido: todavía no hay previsiones con las que comparar el gasto real.</p>`}
      <h3 class="seccion-titulo">Gastos reales por categoría</h3>
      <ul class="cifras">${porCat}</ul>
    </div>

    ${comparativa}

    <div class="tarjeta">
      <h2 class="tarjeta-titulo">Bote común</h2>
      <ul class="cifras">
        ${filaCifra("Bote previsto", euros(r.botePrevisto))}
        ${filaCifra("Aportaciones recibidas", euros(r.recibido))}
        ${filaCifra("Aportaciones pendientes", euros(r.pendienteAportaciones), r.pendienteAportaciones > 0 ? "negativa" : "")}
        ${filaCifra("Dinero disponible del bote", euros(r.dineroDisponible), "destacada")}
        ${filaCifra("Adelantos pendientes de reembolso", euros(r.pendienteReembolso))}
        ${filaCifra("Devoluciones hechas a clientes", euros(r.devuelto))}
      </ul>
      <h3 class="seccion-titulo">Aportaciones por cliente</h3>
      <ul class="cifras">${porCliente || `<li class="vacio">Sin clientes.</li>`}</ul>
      <p class="nota">El saldo del bote usa los movimientos reales: aportaciones recibidas − pagos hechos con el bote − reembolsos − devoluciones. Los adelantos que aún no se han reembolsado no se descuentan del efectivo: aparecen aparte como obligación pendiente.</p>
    </div>

    ${monedas.monedas.length > 1 ? `<div class="tarjeta">
      <h2 class="tarjeta-titulo">Saldos por moneda</h2>
      <p class="tarjeta-sub">No se suman monedas distintas sin convertir. Cada movimiento conserva el cambio con el que se registró.</p>
      <ul class="cifras">${filasMoneda}${filaCifra("Gastos del grupo en euros", euros(monedas.totalGastosGrupoEuros), "destacada")}</ul>
    </div>` : ""}

    <div class="tarjeta">
      <h2 class="tarjeta-titulo">Mis honorarios y mis gastos</h2>
      <ul class="cifras">
        ${filaCifra("Honorarios previstos", euros(r.honorarios.previsto))}
        ${filaCifra("Honorarios cobrados", euros(r.honorarios.cobrado))}
        ${filaCifra("Mis gastos personales", euros(r.misGastos.total))}
        ${filaCifra("Resultado previsto (antes de impuestos)", euros(r.resultadoPrevisto), "destacada")}
        ${filaCifra("Resultado real (antes de impuestos)", euros(r.resultadoReal), "destacada")}
      </ul>
    </div>

    ${htmlCopiasResumen()}`;
  }

  /* ============================================================
     9. DATOS Y COPIAS
     ============================================================ */

  function htmlCopiasResumen() {
    const ultima = S.copiaMeta.ultimaImportacion
      ? `Última importación: ${esc(FT.fechaHoraCorta(S.copiaMeta.ultimaImportacion))}`
      : "Todavía no has importado ninguna copia.";
    return `<div class="tarjeta">
      <h2 class="tarjeta-titulo">Datos y copias de seguridad</h2>
      <p class="tarjeta-sub">Los datos se guardan solo en este dispositivo. Haz copias de vez en cuando.</p>
      <p class="campo-ayuda">${ultima} · Versión de la app: ${VERSION}</p>
      ${boton("copia-exportar", "", "Exportar copia completa (JSON)", "btn-secundario")}
      ${boton("copia-importar", "", "Importar una copia (JSON)", "btn-ghost")}
      <div class="fila-botones">
        ${boton("csv-clientes", "", "CSV clientes", "btn-ghost")}
        ${boton("csv-aportaciones", "", "CSV aportaciones", "btn-ghost")}
        ${boton("csv-gastos", "", "CSV gastos", "btn-ghost")}
      </div>
      <p class="nota">Las copias guardan las aportaciones, el presupuesto, los gastos, mis gastos y los honorarios. En el repositorio solo está el código: tus nombres y cuentas nunca salen de este dispositivo.</p>
    </div>`;
  }

  /* ============================================================
     MENÚ
     ============================================================ */

  function htmlMenu() {
    return `<div class="tarjeta">
      <h2 class="tarjeta-titulo">Menú</h2>
      <ul class="menu-lista">
        <li>${boton("vista", "viajes", "🧭 Viajes", "btn-secundario")}</li>
        <li>${boton("vista", "clientes", "👥 Clientes y bote", "btn-secundario")}</li>
        <li>${boton("vista", "presupuesto", "📋 Presupuesto del grupo", "btn-secundario")}</li>
        <li>${boton("vista", "gastos", "🧾 Gastos del grupo", "btn-secundario")}</li>
        <li>${boton("vista", "mios", "🎒 Mis gastos", "btn-secundario")}</li>
        <li>${boton("vista", "resumen", "📊 Resumen del viaje", "btn-secundario")}</li>
      </ul>
      <div class="nota">The Free Travel · Gestión de viajes · versión ${VERSION}</div>
    </div>`;
  }

  /* ============================================================
     RENDER
     ============================================================ */

  function htmlVista() {
    if (S.menuAbierto) return htmlMenu();
    // Formularios abiertos tienen prioridad dentro de su pantalla.
    if (S.vista === "viajes") return S.viaje ? htmlFormularioViaje() : htmlViajes();
    if (S.vista === "presupuesto") { S.pestanaGastos = "previsto"; return htmlPresupuesto(); }
    if (S.vista === "clientes") return htmlClientes();
    if (S.vista === "gastos") return htmlGastos();
    if (S.vista === "mios") return htmlMios();
    if (S.vista === "resumen") return htmlResumen();
    return htmlViajes();
  }

  function render() {
    pintarEn("vista", htmlVista());
    pintarEn("cabecera-viaje", esc(cabeceraViaje()));
    document.querySelectorAll(".barra-btn").forEach((b) => {
      if (b.dataset.valor === S.vista) b.classList.add("activa");
      else b.classList.remove("activa");
    });
    window.scrollTo(0, 0);
  }

  /* ============================================================
     LECTURA DE FORMULARIOS
     ============================================================ */

  function valorDe(id) {
    const el = porId(id);
    return el ? String(el.value == null ? "" : el.value) : "";
  }

  function marcado(id) {
    const el = porId(id);
    return el ? !!el.checked : false;
  }

  /* ---------------- acciones: viajes ---------------- */

  function accionViajeNuevo() {
    S.viaje = nuevoBorradorViaje(null);
    render();
  }

  function accionViajeEditar(id) {
    S.viaje = nuevoBorradorViaje(FT.viajePorId(S.datos.viajes, id));
    render();
  }

  function accionViajeAbrir(id) {
    S.viajeId = id;
    S.vista = "clientes";
    S.viaje = null;
    render();
  }

  function accionViajeGuardar() {
    const b = S.viaje;
    b.nombre = valorDe("viaje-nombre");
    b.destino = valorDe("viaje-destino");
    b.inicio = valorDe("viaje-inicio");
    b.fin = valorDe("viaje-fin");
    b.moneda = valorDe("viaje-moneda");
    b.observaciones = valorDe("viaje-observaciones");
    const errores = FT.validarViaje(b);
    if (errores.length) { b.errores = errores; render(); return; }
    const viaje = FT.crearViaje(b);
    return TFTDB.guardar("viajes", viaje)
      .then(() => recargar())
      .then(() => {
        S.viaje = null;
        if (!S.viajeId) S.viajeId = viaje.id;
        avisar("Viaje guardado");
        render();
      })
      .catch((e) => avisar(e.message || "No se pudo guardar", "error"));
  }

  function accionViajeEliminar(id) {
    const v = FT.viajePorId(S.datos.viajes, id);
    return confirmar(
      "Eliminar el viaje",
      `¿Seguro que quieres eliminar «${esc(v.nombre)}»? Se borrarán también sus clientes, aportaciones, presupuesto, gastos, honorarios y movimientos del bote. Esta acción no se puede deshacer.`,
      "Eliminar el viaje"
    ).then((si) => {
      if (!si) return;
      return TFTDB.eliminarViajeCompleto(id)
        .then(() => recargar())
        .then(() => {
          if (S.viajeId === id) S.viajeId = null;
          avisar("Viaje eliminado");
          render();
        });
    });
  }

  /* ---------------- acciones: clientes ---------------- */

  function accionClienteNuevo() {
    S.cliente = nuevoBorradorCliente(null);
    S.aportacion = null;
    render();
  }

  function accionClienteEditar(id) {
    S.cliente = nuevoBorradorCliente(FT.clientePorId(S.datos.clientes, id));
    render();
  }

  function accionClienteGuardar() {
    const b = S.cliente;
    b.nombre = valorDe("cliente-nombre");
    b.apellidos = valorDe("cliente-apellidos");
    b.aportacionPrevista = valorDe("cliente-aportacion");
    b.observaciones = valorDe("cliente-observaciones");
    const errores = FT.validarCliente(b);
    if (errores.length) { b.errores = errores; render(); return; }
    const cliente = FT.crearCliente(Object.assign({ viajeId: S.viajeId }, b));
    return TFTDB.guardar("clientes", cliente).then(() => recargar()).then(() => {
      S.cliente = null; avisar("Cliente guardado"); render();
    });
  }

  function accionClienteEliminar(id) {
    const c = FT.clientePorId(S.datos.clientes, id);
    const n = FT.aportacionesDeCliente(S.datos.aportaciones, id).length;
    return confirmar(
      "Eliminar el cliente",
      `¿Eliminar a «${esc(FT.nombreCliente(c))}»? Se borrarán sus ${n} ingreso(s) al bote y sus honorarios.`,
      "Eliminar"
    ).then((si) => {
      if (!si) return;
      const quitar = (tabla, filtro) => TFTDB.listar(tabla).then((lista) =>
        Promise.all(lista.filter(filtro).map((x) => TFTDB.eliminar(tabla, x.id))));
      return TFTDB.eliminar("clientes", id)
        .then(() => quitar("aportaciones", (a) => a.clienteId === id))
        .then(() => quitar("honorarios", (h) => h.clienteId === id))
        .then(() => recargar())
        .then(() => { avisar("Cliente eliminado"); render(); });
    });
  }

  function accionAportacionComun() {
    return preguntar({
      titulo: "Aportación común a todos",
      texto: `<p>Escribe el importe que quieres poner como aportación prevista a <strong>todos los clientes</strong> de este viaje. Después puedes cambiarlo a cada uno por separado.</p>
        ${campo("Aportación prevista (€)", `<input type="number" inputmode="decimal" step="0.01" id="comun-importe" value="${esc(String(conViaje().aportacionPrevista || ""))}">`)}`,
      botones: [
        { texto: "Aplicar a todos", valor: "aplicar", clase: "btn-verde" },
        { texto: "Cancelar", valor: null, clase: "btn-ghost" },
      ],
    }).then((v) => {
      if (v !== "aplicar") return;
      const valor = FT.aNumero(porId("comun-importe") ? porId("comun-importe").value : 0);
      const actualizados = FT.aplicarAportacionComun(S.datos.clientes, S.viajeId, valor).filter((c) => c.viajeId === S.viajeId);
      const viaje = FT.crearViaje(Object.assign({}, conViaje(), { aportacionPrevista: valor }));
      return TFTDB.guardarVarios("clientes", actualizados)
        .then(() => TFTDB.guardar("viajes", viaje))
        .then(() => recargar())
        .then(() => { avisar("Aportación común aplicada"); render(); });
    });
  }

  function accionViajeAportacion() {
    return preguntar({
      titulo: "Aportación del viaje",
      texto: `${campo("Aportación prevista por defecto (€)", `<input type="number" inputmode="decimal" step="0.01" id="viaje-aportacion-valor" value="${esc(String(conViaje().aportacionPrevista || ""))}">`)}<p class="campo-ayuda">Se usa como valor inicial al crear un cliente nuevo.</p>`,
      botones: [
        { texto: "Guardar", valor: "guardar", clase: "btn-verde" },
        { texto: "Cancelar", valor: null, clase: "btn-ghost" },
      ],
    }).then((v) => {
      if (v !== "guardar") return;
      const valor = FT.aNumero(porId("viaje-aportacion-valor") ? porId("viaje-aportacion-valor").value : 0);
      return TFTDB.guardar("viajes", FT.crearViaje(Object.assign({}, conViaje(), { aportacionPrevista: valor })))
        .then(() => recargar()).then(() => { avisar("Guardado"); render(); });
    });
  }

  function accionAportacionNueva(clienteId) {
    const b = nuevoBorradorAportacion({ clienteId: clienteId });
    S.aportacion = b;
    render();
  }

  function accionAportacionEditar(id) {
    const a = S.datos.aportaciones.filter((x) => x.id === id)[0];
    S.aportacion = nuevoBorradorAportacion(a);
    render();
  }

  function accionAportacionGuardar() {
    const b = S.aportacion;
    b.clienteId = valorDe("aportacion-cliente");
    b.importe = valorDe("aportacion-importe");
    b.fecha = valorDe("aportacion-fecha");
    b.forma = valorDe("aportacion-forma");
    b.observaciones = valorDe("aportacion-observaciones");
    const errores = FT.validarAportacion(Object.assign({ viajeId: S.viajeId }, b));
    if (errores.length) { b.errores = errores; render(); return; }
    const aportacion = FT.crearAportacion(Object.assign({ viajeId: S.viajeId }, b));
    return TFTDB.guardar("aportaciones", aportacion).then(() => recargar()).then(() => {
      S.aportacion = null; avisar("Ingreso guardado"); render();
    });
  }

  function accionAportacionEliminar(id) {
    return confirmar("Borrar el ingreso", "¿Borrar este ingreso del bote?", "Borrar")
      .then((si) => si ? TFTDB.eliminar("aportaciones", id).then(recargar).then(() => { avisar("Ingreso borrado"); render(); }) : null);
  }

  /* ---------------- acciones: movimientos del bote ---------------- */

  function accionReembolsoNuevo() {
    const adelantos = gastos().filter((g) => (g.pagador === "yo" || g.pagador === "cliente") && FT.pendienteDeGastoCon(g, S.datos.reembolsos) > 0);
    if (adelantos.length === 0) { avisar("No hay adelantos pendientes de reembolso", "error"); return; }
    S.reembolso = nuevoBorradorReembolso(adelantos[0]);
    S.vista = "gastos";
    render();
  }

  function accionReembolsoGasto(gastoId) {
    const g = gastos().filter((x) => x.id === gastoId)[0];
    S.reembolso = nuevoBorradorReembolso(g);
    S.vista = "gastos";
    render();
  }

  function accionReembolsoGuardar() {
    const b = S.reembolso;
    b.gastoId = valorDe("reembolso-gasto");
    b.importe = valorDe("reembolso-importe");
    b.fecha = valorDe("reembolso-fecha");
    b.forma = valorDe("reembolso-forma");
    b.observaciones = valorDe("reembolso-observaciones");
    const gasto = gastos().filter((g) => g.id === b.gastoId)[0];
    if (!gasto) { b.errores = ["Elige el gasto adelantado."]; render(); return; }
    if (!(FT.aNumero(b.importe) > 0)) { b.errores = ["El importe debe ser mayor que 0."]; render(); return; }
    b.beneficiario = gasto.pagador === "cliente" ? gasto.clienteId : "yo";
    const reembolso = FT.crearReembolso(Object.assign({ viajeId: S.viajeId }, b));
    return TFTDB.guardar("reembolsos", reembolso).then(() => recargar()).then(() => {
      S.reembolso = null; avisar("Reembolso guardado"); render();
    });
  }

  function accionReembolsoEliminar(id) {
    return confirmar("Borrar el reembolso", "¿Borrar este reembolso? El adelanto volverá a quedar pendiente.", "Borrar")
      .then((si) => si ? TFTDB.eliminar("reembolsos", id).then(recargar).then(() => { avisar("Reembolso borrado"); render(); }) : null);
  }

  function accionDevolucionNueva() {
    S.devolucion = { clienteId: "", importe: "", fecha: hoyISO().slice(0, 16), forma: "metalico", observaciones: "", errores: [] };
    render();
  }

  function accionDevolucionGuardar() {
    const b = S.devolucion;
    b.clienteId = valorDe("devolucion-cliente");
    b.importe = valorDe("devolucion-importe");
    b.fecha = valorDe("devolucion-fecha");
    b.forma = valorDe("devolucion-forma");
    b.observaciones = valorDe("devolucion-observaciones");
    const errores = [];
    if (!b.clienteId) errores.push("Selecciona el cliente.");
    if (!(FT.aNumero(b.importe) > 0)) errores.push("El importe debe ser mayor que 0.");
    if (errores.length) { b.errores = errores; render(); return; }
    return TFTDB.guardar("devoluciones", FT.crearDevolucion(Object.assign({ viajeId: S.viajeId }, b)))
      .then(() => recargar()).then(() => { S.devolucion = null; avisar("Devolución guardada"); render(); });
  }

  function accionDevolucionEliminar(id) {
    return confirmar("Borrar la devolución", "¿Borrar esta devolución del bote?", "Borrar")
      .then((si) => si ? TFTDB.eliminar("devoluciones", id).then(recargar).then(() => { avisar("Devolución borrada"); render(); }) : null);
  }

  /* ---------------- acciones: presupuesto ---------------- */

  function accionConceptoNuevo() {
    S.concepto = nuevoBorradorConcepto(null);
    S.vistaPreviaConcepto = null;
    S.volverAGastoTrasConcepto = false;
    render();
  }

  /**
   * Abre el formulario de concepto desde el formulario de gasto sin perder
   * lo escrito: al guardar o cancelar se vuelve al gasto.
   */
  function accionConceptoNuevoDesdeGasto() {
    if (S.gasto) leerGastoParcial();
    S.concepto = nuevoBorradorConcepto(null);
    S.vistaPreviaConcepto = null;
    S.volverAGastoTrasConcepto = true;
    S.pestanaGastos = "previsto";
    render();
  }

  function accionConceptoCancelar() {
    S.concepto = null;
    S.vistaPreviaConcepto = null;
    const volver = S.volverAGastoTrasConcepto && S.gasto;
    S.volverAGastoTrasConcepto = false;
    S.pestanaGastos = volver ? "real" : "previsto";
    S.vista = "gastos";
    render();
  }

  function accionConceptoEditar(id) {
    S.concepto = nuevoBorradorConcepto(conceptos().filter((c) => c.id === id)[0]);
    S.vistaPreviaConcepto = null;
    render();
  }

  function leerConceptoDeFormulario() {
    const b = S.concepto;
    b.categoria = valorDe("concepto-categoria");
    b.descripcion = valorDe("concepto-descripcion");
    b.proveedor = valorDe("concepto-proveedor");
    b.fecha = valorDe("concepto-fecha");
    b.tipo = valorDe("concepto-tipo");
    b.moneda = valorDe("concepto-moneda");
    b.cambio = valorDe("concepto-cambio");
    b.precio = valorDe("concepto-precio");
    b.observaciones = valorDe("concepto-observaciones");
    ["personas", "noches", "habitaciones", "dias", "unidades"].forEach((k) => {
      const el = porId("concepto-" + k);
      b[k] = el ? String(el.value) : b[k];
    });
  }

  function accionConceptoPrevia() {
    leerConceptoDeFormulario();
    const r = resumen();
    S.vistaPreviaConcepto = FT.calcularConcepto(S.concepto, { personasViaje: r.nClientes, noches: r.noches });
    render();
  }

  function accionConceptoGuardar() {
    leerConceptoDeFormulario();
    const errores = FT.validarConcepto(S.concepto);
    if (errores.length) { S.concepto.errores = errores; render(); return; }
    const eraNuevo = !S.concepto.id;
    const concepto = FT.crearConcepto(Object.assign({ viajeId: S.viajeId }, S.concepto));
    return TFTDB.guardar("conceptos", concepto)
      .then(() => recargar()).then(() => {
        S.concepto = null;
        S.vistaPreviaConcepto = null;
        // Si se venía del formulario de gasto, se vuelve a él con lo escrito y,
        // para uno nuevo, se enlaza directamente el gasto con el concepto recién creado.
        if (S.volverAGastoTrasConcepto && S.gasto) {
          S.volverAGastoTrasConcepto = false;
          if (eraNuevo) S.gasto.conceptoId = concepto.id;
        }
        S.pestanaGastos = S.gasto ? "real" : "previsto";
        S.vista = "gastos";
        avisar("Concepto guardado");
        render();
      });
  }

  function accionConceptoEliminar(id) {
    return confirmar("Eliminar el concepto", "¿Eliminar este concepto del presupuesto?", "Eliminar")
      .then((si) => si ? TFTDB.eliminar("conceptos", id).then(recargar).then(() => { avisar("Concepto eliminado"); render(); }) : null);
  }

  function accionConceptoAGasto(id) {
    const c = conceptos().filter((x) => x.id === id)[0];
    const calc = FT.calcularConcepto(c, { personasViaje: resumen().nClientes, noches: resumen().noches });
    const borrador = nuevoBorradorGasto({
      categoria: c.categoria, descripcion: c.descripcion, fecha: hoyISO(),
      moneda: c.moneda, cambio: c.cambio, importe: String(calc.importe), conceptoId: c.id,
    });
    S.gasto = borrador;
    S.vista = "gastos";
    S.pestanaGastos = "real";
    render();
  }

  /* ---------------- acciones: gastos del grupo ---------------- */

  /** Cambia entre las pestañas «Presupuesto previsto» y «Gastos reales». */
  function accionPestanaGastos(valor) {
    S.pestanaGastos = valor === "previsto" ? "previsto" : "real";
    S.concepto = null;
    S.vistaPreviaConcepto = null;
    S.vista = "gastos";
    render();
  }

  function accionGastoNuevo() {
    S.gasto = nuevoBorradorGasto(null);
    S.pestanaGastos = "real";
    render();
  }

  function accionGastoEditar(id) {
    S.gasto = nuevoBorradorGasto(gastos().filter((g) => g.id === id)[0]);
    render();
  }

  function accionGastoGuardar() {
    const b = S.gasto;
    b.categoria = valorDe("gasto-categoria");
    b.descripcion = valorDe("gasto-descripcion");
    b.fecha = valorDe("gasto-fecha");
    b.moneda = valorDe("gasto-moneda");
    b.cambio = valorDe("gasto-cambio");
    b.importe = valorDe("gasto-importe");
    b.forma = valorDe("gasto-forma");
    b.pagador = valorDe("gasto-pagador");
    b.clienteId = porId("gasto-cliente") ? valorDe("gasto-cliente") : "";
    b.conceptoId = valorDe("gasto-concepto");
    b.observaciones = valorDe("gasto-observaciones");
    const errores = FT.validarGastoGrupo(Object.assign({ viajeId: S.viajeId }, b));
    if (errores.length) { b.errores = errores; render(); return; }
    const gasto = FT.crearGastoGrupo(Object.assign({ viajeId: S.viajeId }, b));
    return TFTDB.guardar("gastos", gasto).then(() => recargar()).then(() => {
      S.gasto = null; avisar("Gasto guardado"); render();
    });
  }

  function accionGastoEliminar(id) {
    return confirmar("Eliminar el gasto", "¿Eliminar este gasto del grupo?", "Eliminar")
      .then((si) => si ? TFTDB.eliminar("gastos", id).then(recargar).then(() => { avisar("Gasto eliminado"); render(); }) : null);
  }

  /* ---------------- acciones: mis gastos ---------------- */

  function accionPersonalNuevo() {
    S.gastoPersonal = nuevoBorradorGastoPersonal(null);
    render();
  }

  function accionPersonalEditar(id) {
    S.gastoPersonal = nuevoBorradorGastoPersonal(gastosPersonales().filter((g) => g.id === id)[0]);
    render();
  }

  function accionPersonalCubierto() {
    // Cambia la casilla sin volcar el resto del formulario todavía.
    if (S.gastoPersonal) {
      S.gastoPersonal.cubiertoPorGrupo = !S.gastoPersonal.cubiertoPorGrupo;
      leerPersonalDeFormulario();
      render();
    }
  }

  function leerPersonalDeFormulario() {
    const b = S.gastoPersonal;
    b.categoria = valorDe("personal-categoria");
    b.concepto = valorDe("personal-concepto");
    b.fecha = valorDe("personal-fecha");
    b.moneda = valorDe("personal-moneda");
    b.cambio = valorDe("personal-cambio");
    b.importe = valorDe("personal-importe");
    b.observaciones = valorDe("personal-observaciones");
  }

  function accionPersonalGuardar() {
    const b = S.gastoPersonal;
    leerPersonalDeFormulario();
    const errores = FT.validarGastoPersonal(Object.assign({ viajeId: S.viajeId }, b));
    if (errores.length) { b.errores = errores; render(); return; }
    const gasto = FT.crearGastoPersonal(Object.assign({ viajeId: S.viajeId }, b));
    const pendientes = [TFTDB.guardar("gastosPersonales", gasto)];
    // Si está cubierto por el grupo, aparece una sola vez como gasto del grupo.
    if (gasto.cubiertoPorGrupo) {
      const yaEnGrupo = gastos().filter((g) => g.gastoPersonalId === gasto.id)[0];
      const gastoGrupo = FT.crearGastoGrupo({
        id: yaEnGrupo ? yaEnGrupo.id : undefined, viajeId: S.viajeId, categoria: "otros",
        descripcion: gasto.concepto, fecha: gasto.fecha, moneda: gasto.moneda, cambio: gasto.cambio,
        importe: gasto.importe, forma: "metalico", pagador: "bote",
        origen: FT.ORIGEN_PERSONAL, gastoPersonalId: gasto.id,
      });
      pendientes.push(TFTDB.guardar("gastos", gastoGrupo));
    } else {
      // Si antes estaba cubierto y ya no lo está, se retira del grupo.
      const yaEnGrupo = gastos().filter((g) => g.gastoPersonalId === gasto.id)[0];
      if (yaEnGrupo) pendientes.push(TFTDB.eliminar("gastos", yaEnGrupo.id));
    }
    return Promise.all(pendientes).then(() => recargar()).then(() => {
      S.gastoPersonal = null; avisar("Gasto guardado"); render();
    });
  }

  function accionPersonalEliminar(id) {
    return confirmar("Eliminar el gasto", "¿Eliminar este gasto tuyo?", "Eliminar").then((si) => {
      if (!si) return null;
      const enGrupo = gastos().filter((g) => g.gastoPersonalId === id)[0];
      return TFTDB.eliminar("gastosPersonales", id)
        .then(() => (enGrupo ? TFTDB.eliminar("gastos", enGrupo.id) : null))
        .then(() => recargar()).then(() => { avisar("Gasto eliminado"); render(); });
    });
  }

  /* ---------------- acciones: honorarios ---------------- */

  function accionHonorarioNuevo() {
    S.honorario = nuevoBorradorHonorario(null);
    render();
  }

  function accionHonorarioEditar(id) {
    S.honorario = nuevoBorradorHonorario(honorarios().filter((h) => h.id === id)[0]);
    render();
  }

  function accionHonorarioGuardar() {
    const b = S.honorario;
    b.clienteId = valorDe("honorario-cliente");
    b.concepto = valorDe("honorario-concepto");
    b.previsto = valorDe("honorario-previsto");
    b.cobrado = valorDe("honorario-cobrado");
    b.fecha = valorDe("honorario-fecha");
    b.forma = valorDe("honorario-forma");
    b.observaciones = valorDe("honorario-observaciones");
    const errores = FT.validarHonorario(Object.assign({ viajeId: S.viajeId }, b));
    if (errores.length) { b.errores = errores; render(); return; }
    return TFTDB.guardar("honorarios", FT.crearHonorario(Object.assign({ viajeId: S.viajeId }, b)))
      .then(() => recargar()).then(() => { S.honorario = null; avisar("Honorarios guardados"); render(); });
  }

  function accionHonorarioEliminar(id) {
    return confirmar("Eliminar los honorarios", "¿Eliminar estos honorarios?", "Eliminar")
      .then((si) => si ? TFTDB.eliminar("honorarios", id).then(recargar).then(() => { avisar("Honorarios eliminados"); render(); }) : null);
  }

  /* ---------------- acciones: copias ---------------- */

  function accionCopiaExportar() {
    const copia = FT.exportarDatos(S.datos);
    descargar(FT.nombreCopia(), JSON.stringify(copia, null, 2), "application/json");
    avisar("Copia descargada");
  }

  function accionCopiaImportar() {
    const input = porId("archivo-copia");
    if (input) input.click();
  }

  function leerArchivoCopia(archivo) {
    const lector = new FileReader();
    lector.onload = () => {
      const leido = FT.leerImportacion(String(lector.result || ""));
      if (!leido.ok) { avisar(leido.error, "error"); return; }
      preguntar({
        titulo: "Importar copia",
        texto: `<p>La copia trae ${leido.viajes.length} viaje(s) y ${leido.clientes.length} cliente(s). ¿Quieres reemplazar los datos o mezclarlos con los que ya hay?</p>`,
        botones: [
          { texto: "Reemplazar todo", valor: "reemplazar", clase: "btn-peligro" },
          { texto: "Mezclar", valor: "fusionar", clase: "btn-secundario" },
          { texto: "Cancelar", valor: null, clase: "btn-ghost" },
        ],
      }).then((modo) => {
        if (!modo) return;
        let datos = leido;
        if (modo === "fusionar") datos = FT.combinarDatos(S.datos, leido);
        return TFTDB.guardarTodo(datos)
          .then(() => TFTDB.guardarMeta("ultimaImportacion", FT.fechaLocalAhora()))
          .then(() => recargar())
          .then(() => { avisar("Copia importada"); render(); });
      });
    };
    lector.readAsText(archivo);
  }

  function accionCsv(tipo) {
    const v = conViaje();
    if (!v.id) { avisar("Abre un viaje primero", "error"); return; }
    const datos = { viaje: v, clientes: S.datos.clientes, aportaciones: S.datos.aportaciones, conceptos: S.datos.conceptos, gastos: S.datos.gastos };
    if (tipo === "clientes") descargar(FT.nombreCSV("clientes"), FT.csvClientes(datos), "text/csv");
    else if (tipo === "aportaciones") descargar(FT.nombreCSV("aportaciones"), FT.csvAportaciones(datos), "text/csv");
    else descargar(FT.nombreCSV("gastos"), FT.csvGastos(datos), "text/csv");
    avisar("CSV descargado");
  }

  /* ---------------- reparto de acciones ---------------- */

  function ejecutar(accion, valor) {
    switch (accion) {
      case "vista": S.vista = valor; S.menuAbierto = false; if (valor === "gastos") S.pestanaGastos = "real"; if (valor === "presupuesto") S.pestanaGastos = "previsto"; render(); break;
      case "menu": S.menuAbierto = !S.menuAbierto; render(); break;
      // viajes
      case "viaje-nuevo": accionViajeNuevo(); break;
      case "viaje-editar": accionViajeEditar(valor); break;
      case "viaje-abrir": accionViajeAbrir(valor); break;
      case "viaje-guardar": accionViajeGuardar(); break;
      case "viaje-cancelar": S.viaje = null; render(); break;
      case "viaje-eliminar": accionViajeEliminar(valor); break;
      case "viaje-aportacion": accionViajeAportacion(); break;
      // clientes
      case "cliente-nuevo": accionClienteNuevo(); break;
      case "cliente-editar": accionClienteEditar(valor); break;
      case "cliente-guardar": accionClienteGuardar(); break;
      case "cliente-cancelar": S.cliente = null; render(); break;
      case "cliente-eliminar": accionClienteEliminar(valor); break;
      case "aportacion-comun": accionAportacionComun(); break;
      case "aportacion-nueva": accionAportacionNueva(valor); break;
      case "aportacion-editar": accionAportacionEditar(valor); break;
      case "aportacion-guardar": accionAportacionGuardar(); break;
      case "aportacion-cancelar": S.aportacion = null; render(); break;
      case "aportacion-eliminar": accionAportacionEliminar(valor); break;
      // movimientos del bote
      case "reembolso-nuevo": accionReembolsoNuevo(); break;
      case "reembolso-gasto": accionReembolsoGasto(valor); break;
      case "reembolso-guardar": accionReembolsoGuardar(); break;
      case "reembolso-cancelar": S.reembolso = null; render(); break;
      case "reembolso-eliminar": accionReembolsoEliminar(valor); break;
      case "devolucion-nueva": accionDevolucionNueva(); break;
      case "devolucion-guardar": accionDevolucionGuardar(); break;
      case "devolucion-cancelar": S.devolucion = null; render(); break;
      case "devolucion-eliminar": accionDevolucionEliminar(valor); break;
      // presupuesto
      case "concepto-nuevo": accionConceptoNuevo(); break;
      case "concepto-nuevo-desde-gasto": accionConceptoNuevoDesdeGasto(); break;
      case "concepto-editar": accionConceptoEditar(valor); break;
      case "concepto-previa": accionConceptoPrevia(); break;
      case "concepto-guardar": accionConceptoGuardar(); break;
      case "concepto-cancelar": accionConceptoCancelar(); break;
      case "concepto-eliminar": accionConceptoEliminar(valor); break;
      case "concepto-a-gasto": accionConceptoAGasto(valor); break;
      // gastos del grupo
      case "pestana-gastos": accionPestanaGastos(valor); break;
      case "gasto-nuevo": accionGastoNuevo(); break;
      case "gasto-editar": accionGastoEditar(valor); break;
      case "gasto-guardar": accionGastoGuardar(); break;
      case "gasto-cancelar": S.gasto = null; render(); break;
      case "gasto-eliminar": accionGastoEliminar(valor); break;
      // mis gastos
      case "personal-nuevo": accionPersonalNuevo(); break;
      case "personal-editar": accionPersonalEditar(valor); break;
      case "personal-cubierto": accionPersonalCubierto(); break;
      case "personal-guardar": accionPersonalGuardar(); break;
      case "personal-cancelar": S.gastoPersonal = null; render(); break;
      case "personal-eliminar": accionPersonalEliminar(valor); break;
      // honorarios
      case "honorario-nuevo": accionHonorarioNuevo(); break;
      case "honorario-editar": accionHonorarioEditar(valor); break;
      case "honorario-guardar": accionHonorarioGuardar(); break;
      case "honorario-cancelar": S.honorario = null; render(); break;
      case "honorario-eliminar": accionHonorarioEliminar(valor); break;
      // copias
      case "copia-exportar": accionCopiaExportar(); break;
      case "copia-importar": accionCopiaImportar(); break;
      case "csv-clientes": accionCsv("clientes"); break;
      case "csv-aportaciones": accionCsv("aportaciones"); break;
      case "csv-gastos": accionCsv("gastos"); break;
      default: break;
    }
  }

  /* ---------------- eventos ---------------- */

  function manejarClic(evento) {
    // Botones de la capa modal
    const enModal = evento.target.closest ? evento.target.closest("#modal-botones [data-valor-modal]") : null;
    if (enModal) { cerrarModal(enModal.dataset.valorModal === "true" ? true : enModal.dataset.valorModal === "false" ? false : (enModal.dataset.valorModal === "null" ? null : enModal.dataset.valorModal)); return; }
    const el = evento.target.closest ? evento.target.closest("[data-accion]") : null;
    if (!el) {
      // clic en el fondo oscuro cierra el modal
      if (evento.target.id === "modal") cerrarModal(null);
      return;
    }
    const accion = el.dataset.accion;
    const valor = el.dataset.valor;
    if (el.tagName === "INPUT" && el.type === "checkbox") return; // lo maneja «change»
    evento.preventDefault();
    if (accion === "personal-cubierto") { accionPersonalCubierto(); return; }
    ejecutar(accion, valor);
  }

  function manejarCambio(evento) {
    const el = evento.target;
    if (!el || !el.dataset) return;
    if (el.dataset.accion === "personal-cubierto") { accionPersonalCubierto(); return; }
    if (el.id === "filtro-clientes") { S.filtros.clientes = el.value; render(); return; }
    if (el.id === "filtro-categoria-gasto") { S.filtros.categoriaGasto = el.value; render(); return; }
    if (el.id === "concepto-tipo") { accionConceptoPrevia(); return; }
    if (el.id === "gasto-pagador") {
      if (S.gasto) { S.gasto.pagador = el.value; leerGastoParcial(); render(); }
      return;
    }
    if (el.id === "gasto-concepto") {
      // Al cambiar de concepto se conserva lo ya escrito y se enseña su previsión.
      if (S.gasto) { S.gasto.conceptoId = el.value; leerGastoParcial(); render(); }
      return;
    }
    if (el.id === "gasto-moneda") {
      if (S.gasto) { S.gasto.moneda = el.value; S.gasto.cambio = String(FT.tipoCambio(el.value)); render(); }
      return;
    }
    if (el.id === "reembolso-gasto") {
      if (S.reembolso) { S.reembolso.gastoId = el.value; S.reembolso = nuevoBorradorReembolso(gastos().filter((g) => g.id === el.value)[0]); render(); }
      return;
    }
  }

  function leerGastoParcial() {
    const b = S.gasto;
    if (!b) return;
    b.categoria = valorDe("gasto-categoria");
    b.descripcion = valorDe("gasto-descripcion");
    b.fecha = valorDe("gasto-fecha");
    b.moneda = valorDe("gasto-moneda");
    b.cambio = valorDe("gasto-cambio");
    b.importe = valorDe("gasto-importe");
    b.forma = valorDe("gasto-forma");
    b.conceptoId = valorDe("gasto-concepto");
    b.observaciones = valorDe("gasto-observaciones");
  }

  function manejarEntrada(evento) {
    const el = evento.target;
    if (el && el.id === "concepto-precio") accionConceptoPrevia();
  }

  /* ---------------- arranque ---------------- */

  function conectarEventos() {
    document.addEventListener("click", manejarClic);
    document.addEventListener("change", manejarCambio);
    document.addEventListener("input", manejarEntrada);
    const input = porId("archivo-copia");
    if (input) input.addEventListener("change", (e) => {
      const archivo = e.target.files && e.target.files[0];
      if (archivo) leerArchivoCopia(archivo);
      e.target.value = "";
    });
    window.addEventListener("online", () => { const a = porId("btn-aviso"); if (a) a.hidden = true; });
    window.addEventListener("offline", () => { const a = porId("btn-aviso"); if (a) a.hidden = false; });
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const a = porId("btn-aviso"); if (a) a.hidden = false;
    }
  }

  function registrarServiceWorker() {
    // Sin esto, la app no funcionaría sin conexión tras la primera carga.
    if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
    try {
      navigator.serviceWorker.register("sw.js");
    } catch (e) { /* si no se puede, la app sigue funcionando en línea */ }
  }

  function arrancar() {
    conectarEventos();
    registrarServiceWorker();
    return TFTDB.abrir()
      .catch(() => null)
      .then(() => recargar())
      .then(() => {
        S.cargando = false;
        if (!S.viajeId && S.datos.viajes.length) S.viajeId = S.datos.viajes[0].id;
        render();
      })
      .catch((e) => {
        S.cargando = false;
        render();
        avisar(e.message || "No se pudieron cargar los datos", "error");
      });
  }

  if (typeof document !== "undefined" && document.addEventListener) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => { arrancar(); });
    } else {
      setTimeout(() => { arrancar(); }, 0);
    }
  }

  /* ---------------- API para las pruebas ---------------- */

  return {
    VERSION: VERSION,
    S: S,
    // datos
    recargar: recargar,
    resumen: resumen,
    viajeActual: viajeActual,
    // render de cada pantalla
    htmlVista: htmlVista,
    htmlViajes: htmlViajes,
    htmlFormularioViaje: htmlFormularioViaje,
    htmlClientes: htmlClientes,
    htmlPresupuesto: htmlPresupuesto,
    htmlGastos: htmlGastos,
    htmlMios: htmlMios,
    htmlResumen: htmlResumen,
    htmlCopiasResumen: htmlCopiasResumen,
    htmlMenu: htmlMenu,
    cabeceraViaje: cabeceraViaje,
    // borradores (para probar formularios)
    nuevoBorradorViaje: nuevoBorradorViaje,
    nuevoBorradorCliente: nuevoBorradorCliente,
    nuevoBorradorAportacion: nuevoBorradorAportacion,
    nuevoBorradorConcepto: nuevoBorradorConcepto,
    nuevoBorradorGasto: nuevoBorradorGasto,
    nuevoBorradorGastoPersonal: nuevoBorradorGastoPersonal,
    nuevoBorradorHonorario: nuevoBorradorHonorario,
    // acciones programáticas
    ejecutar: ejecutar,
    arrancar: arrancar,
  };
})();
