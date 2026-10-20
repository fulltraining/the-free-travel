/* ============================================================
   The Free Travel — pruebas de almacenamiento (IndexedDB)
   Se ejecutan con QuickJS:  qjs tests/db.test.mjs

   Simulan el flujo completo sobre un IndexedDB falso:
   crear viaje → añadir clientes → registrar aportaciones →
   presupuesto → gastos → reembolsos → cerrar y reabrir →
   exportar → importar → eliminar un viaje con todo lo suyo.

   Lo importante que se comprueba aquí:
   - los datos se conservan al cerrar y reabrir la app,
   - al eliminar un viaje se borra también todo lo que cuelga de él,
   - al importar una copia no se mezcla nada de otros viajes.
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

/* ---------------- IndexedDB falso ---------------- */

function crearIndexedDBFake() {
  const tablas = {};
  const keyPaths = {};
  const creadas = new Set();
  let version = 0;

  function micro(funcion) { Promise.resolve().then(funcion); }
  function copia(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }

  function programarPeticion(peticion) {
    if (peticion._tx) peticion._tx._pendientes.push(peticion);
  }

  function nuevaPeticion(tx) {
    return { result: undefined, error: null, onsuccess: null, onerror: null, _tx: tx };
  }

  class ObjetoStore {
    constructor(nombre, tx) {
      this.nombre = nombre;
      this._tx = tx;
    }
    _tabla() { return tablas[this.nombre]; }
    _clave(obj) {
      const kp = keyPaths[this.nombre];
      if (kp && obj[kp] !== undefined) return obj[kp];
      return obj.id;
    }
    put(obj) {
      const tx = this._tx;
      const req = nuevaPeticion(tx);
      const clave = this._clave(obj);
      this._tabla().set(clave, copia(obj));
      req.result = clave;
      programarPeticion(req);
      return req;
    }
    get(clave) {
      const tx = this._tx;
      const req = nuevaPeticion(tx);
      req.result = copia(this._tabla().get(clave));
      programarPeticion(req);
      return req;
    }
    getAll() {
      const tx = this._tx;
      const req = nuevaPeticion(tx);
      req.result = Array.from(this._tabla().values()).map(copia);
      programarPeticion(req);
      return req;
    }
    delete(clave) {
      const tx = this._tx;
      const req = nuevaPeticion(tx);
      this._tabla().delete(clave);
      req.result = undefined;
      programarPeticion(req);
      return req;
    }
    clear() {
      const tx = this._tx;
      const req = nuevaPeticion(tx);
      this._tabla().clear();
      req.result = undefined;
      programarPeticion(req);
      return req;
    }
  }

  class Transaccion {
    constructor(tiendas, modo) {
      this.tiendas = tiendas;
      this.modo = modo;
      this.error = null;
      this.oncomplete = null;
      this.onerror = null;
      this.onabort = null;
      this._pendientes = [];
      // Como en el navegador: primero las peticiones y luego oncomplete.
      // Se repite hasta que no queden peticiones nuevas (getAll encadena deletes).
      Promise.resolve()
        .then(() => {
          let vueltas = 0;
          const paso = () => {
            const pendientes = this._pendientes;
            this._pendientes = [];
            pendientes.forEach((req) => { if (req.onsuccess) req.onsuccess({ target: req }); });
            vueltas += 1;
            if (this._pendientes.length > 0 && vueltas < 50) return Promise.resolve().then(paso);
            return null;
          };
          return paso();
        })
        .then(() => { if (this.oncomplete) this.oncomplete({ target: this }); });
    }
    objectStore(nombre) {
      if (!creadas.has(nombre)) {
        throw new Error("NotFoundError: no existe la tienda " + nombre);
      }
      return new ObjetoStore(nombre, this);
    }
    abort() { /* las pruebas no lo usan */ }
  }

  class BaseFake {
    constructor() {
      this.objectStoreNames = { contains: (n) => creadas.has(n) };
      this.onversionchange = null;
    }
    createObjectStore(nombre, opciones) {
      creadas.add(nombre);
      if (!tablas[nombre]) tablas[nombre] = new Map();
      if (opciones && opciones.keyPath) keyPaths[nombre] = opciones.keyPath;
      return new ObjetoStore(nombre, null);
    }
    transaction(tiendas, modo) {
      return new Transaccion(tiendas, modo);
    }
    close() { /* nada */ }
  }

  return {
    open(nombre, versionPedida) {
      const req = { result: null, error: null, onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null };
      micro(() => {
        const db = new BaseFake();
        req.result = db;
        const nueva = versionPedida || 1;
        if (nueva > version) {
          version = nueva;
          if (req.onupgradeneeded) req.onupgradeneeded({ target: { result: db } });
        }
        if (req.onsuccess) req.onsuccess({ target: req });
      });
      return req;
    },
    _estado: { tablas: tablas, creadas: creadas, version: () => version },
  };
}

const fake = crearIndexedDBFake();
globalThis.indexedDB = fake;

eval(std.loadFile("js/logica.js"));
eval(std.loadFile("js/db.js"));
const FT = globalThis.FT;
const TFTDB = globalThis.TFTDB;

/* ---------------- 1. apertura y tablas ---------------- */

console.log("\n1. Apertura del almacén");

function pruebaApertura() {
  return TFTDB.abrir()
    .then(() => {
      TFTDB.TIENDAS.forEach((t) => {
        ok(fake._estado.creadas.has(t), `se ha creado la tabla «${t}»`);
      });
      igual(TFTDB.VERSION, 1, "la versión del almacén es 1");
      igual(TFTDB.NOMBRE, "the-free-travel", "el almacén se llama the-free-travel");
    });
}

/* ---------------- 2. guardar y volver a leer ---------------- */

function pruebaGuardarYLeer() {
  const viaje = FT.crearViaje({ id: "v1", nombre: "Marruecos", destino: "Chefchaouen", inicio: "2026-10-01", fin: "2026-10-07", moneda: "EUR" });
  const ana = FT.crearCliente({ id: "c1", viajeId: "v1", nombre: "Ana", apellidos: "García", aportacionPrevista: 300 });
  const luis = FT.crearCliente({ id: "c2", viajeId: "v1", nombre: "Luis", apellidos: "Pérez", aportacionPrevista: 300 });
  const a1 = FT.crearAportacion({ id: "a1", viajeId: "v1", clienteId: "c1", importe: 100, forma: "transferencia", fecha: "2026-09-01T10:00:00" });
  const a2 = FT.crearAportacion({ id: "a2", viajeId: "v1", clienteId: "c1", importe: 100, forma: "metalico", fecha: "2026-09-15T10:00:00" });
  const concepto = FT.crearConcepto({ id: "k1", viajeId: "v1", categoria: "transporte", tipo: "total", descripcion: "Furgoneta", precio: 600 });
  const gasto = FT.crearGastoGrupo({ id: "g1", viajeId: "v1", categoria: "transporte", descripcion: "Gasolina", importe: 120, forma: "metalico", pagador: "bote" });
  const personal = FT.crearGastoPersonal({ id: "p1", viajeId: "v1", categoria: "vuelos", concepto: "Vuelo", importe: 180 });
  const honorario = FT.crearHonorario({ id: "h1", viajeId: "v1", clienteId: "c1", previsto: 100, cobrado: 100 });

  return TFTDB.guardar("viajes", viaje)
    .then(() => TFTDB.guardarVarios("clientes", [ana, luis]))
    .then(() => TFTDB.guardarVarios("aportaciones", [a1, a2]))
    .then(() => TFTDB.guardar("conceptos", concepto))
    .then(() => TFTDB.guardar("gastos", gasto))
    .then(() => TFTDB.guardar("gastosPersonales", personal))
    .then(() => TFTDB.guardar("honorarios", honorario))
    .then(() => TFTDB.listar("viajes"))
    .then((viajes) => {
      igual(viajes.length, 1, "se ha guardado 1 viaje");
      igual(viajes[0].nombre, "Marruecos", "el viaje guardado se llama Marruecos");
      return TFTDB.listar("aportaciones");
    })
    .then((aportaciones) => {
      igual(aportaciones.length, 2, "se han guardado 2 ingresos al bote");
      const resumenAna = FT.aportacionesDeClienteResumen(aportaciones, ana);
      igual(resumenAna.entregado, 200, "Ana ha entregado 200 € (100 € + 100 €)");
    });
}

/* ---------------- 3. conservar datos al cerrar y reabrir ---------------- */

function pruebaCerrarYReabrir() {
  return TFTDB.cerrar()
    .then(() => fake._estado.tablas.viajes.size === 1
      ? true
      : Promise.reject(new Error("el viaje debería seguir en el dispositivo")))
    .then(() => TFTDB.abrir())
    .then(() => TFTDB.listar("viajes"))
    .then((viajes) => {
      igual(viajes.length, 1, "el viaje sigue ahí después de cerrar y reabrir");
      return TFTDB.listar("clientes");
    })
    .then((clientes) => {
      igual(clientes.length, 2, "los 2 clientes siguen ahí tras cerrar y reabrir");
      return TFTDB.listar("aportaciones");
    })
    .then((aportaciones) => {
      igual(aportaciones.length, 2, "los 2 ingresos siguen ahí tras cerrar y reabrir");
      return TFTDB.listar("gastos");
    })
    .then((gastos) => {
      igual(gastos.length, 1, "el gasto del grupo sigue ahí tras cerrar y reabrir");
      return TFTDB.listar("meta");
    })
    .then(() => TFTDB.guardarMeta("prueba", "ok"))
    .then(() => TFTDB.leerMeta("prueba"))
    .then((valor) => {
      igual(valor, "ok", "la tabla meta guarda y devuelve valores");
      return TFTDB.leerMeta("no-existe");
    })
    .then((valor) => {
      igual(valor, undefined, "una clave que no existe devuelve undefined");
    });
}

/* ---------------- 4. leer todo y exportar ---------------- */

let copiaExportada = null;

function pruebaLeerTodoYExportar() {
  return TFTDB.leerTodo()
    .then((datos) => {
      igual(datos.viajes.length, 1, "leerTodo trae el viaje");
      igual(datos.clientes.length, 2, "leerTodo trae los clientes");
      igual(datos.aportaciones.length, 2, "leerTodo trae las aportaciones");
      igual(datos.conceptos.length, 1, "leerTodo trae los conceptos del presupuesto");
      igual(datos.gastos.length, 1, "leerTodo trae los gastos del grupo");
      igual(datos.gastosPersonales.length, 1, "leerTodo trae mis gastos");
      igual(datos.honorarios.length, 1, "leerTodo trae los honorarios");
      copiaExportada = FT.exportarDatos(datos);
      ok(!!copiaExportada.exportado, "la copia lleva la fecha de exportación");
      return null;
    });
}

/* ---------------- 5. sustituir todo con una copia importada ---------------- */

function pruebaImportarCopia() {
  const leido = FT.leerImportacion(JSON.stringify(copiaExportada));
  ok(leido.ok, "la copia guardada se vuelve a leer sin errores");
  return TFTDB.guardarTodo(leido)
    .then(() => TFTDB.leerTodo())
    .then((datos) => {
      igual(datos.viajes.length, 1, "tras importar sigue habiendo 1 viaje");
      igual(datos.clientes.length, 2, "tras importar siguen los 2 clientes");
      igual(datos.aportaciones.length, 2, "tras importar siguen los 2 ingresos");
      igual(datos.honorarios.length, 1, "tras importar sigue el honorario");
    });
}

/* ---------------- 6. eliminar un viaje con todo lo suyo ---------------- */

function pruebaEliminarViaje() {
  const viajePeru = FT.crearViaje({ id: "v2", nombre: "Perú", destino: "Cusco", inicio: "2027-04-10", fin: "2027-04-20", moneda: "EUR" });
  const clientePeru = FT.crearCliente({ id: "c20", viajeId: "v2", nombre: "Pedro", apellidos: "Soto", aportacionPrevista: 500 });
  const aportacionPeru = FT.crearAportacion({ id: "a20", viajeId: "v2", clienteId: "c20", importe: 200, forma: "transferencia" });
  const gastoPeru = FT.crearGastoGrupo({ id: "g20", viajeId: "v2", categoria: "comidas", descripcion: "Cena", importe: 50, forma: "metalico", pagador: "bote" });

  return TFTDB.guardar("viajes", viajePeru)
    .then(() => TFTDB.guardar("clientes", clientePeru))
    .then(() => TFTDB.guardar("aportaciones", aportacionPeru))
    .then(() => TFTDB.guardar("gastos", gastoPeru))
    .then(() => TFTDB.listar("viajes"))
    .then((viajes) => {
      igual(viajes.length, 2, "ahora hay 2 viajes (Marruecos y Perú)");
      return TFTDB.eliminarViajeCompleto("v2");
    })
    .then(() => Promise.all([
      TFTDB.listar("viajes"), TFTDB.listar("clientes"),
      TFTDB.listar("aportaciones"), TFTDB.listar("gastos"),
    ]))
    .then(([viajes, clientes, aportaciones, gastos]) => {
      igual(viajes.length, 1, "al eliminar Perú queda 1 viaje");
      igual(viajes[0].id, "v1", "el viaje que queda es el de Marruecos");
      igual(clientes.length, 2, "los clientes de Perú se han borrado con el viaje (quedan los 2 de Marruecos)");
      igual(aportaciones.length, 2, "las aportaciones de Perú se han borrado con el viaje");
      igual(gastos.length, 1, "los gastos de Perú se han borrado con el viaje");
      ok(clientes.every((c) => c.viajeId === "v1"), "no queda ningún cliente de Perú");
    });
}

/* ---------------- 7. flujo completo de cuentas sobre el almacén ---------------- */

function pruebaFlujoCompleto() {
  const viaje = FT.crearViaje({ id: "vf", nombre: "Escapada", destino: "Chefchaouen", inicio: "2026-10-01", fin: "2026-10-05", moneda: "EUR" });
  const p1 = FT.crearCliente({ id: "cf1", viajeId: "vf", nombre: "Ana", apellidos: "García", aportacionPrevista: 250 });
  const p2 = FT.crearCliente({ id: "cf2", viajeId: "vf", nombre: "Luis", apellidos: "Pérez", aportacionPrevista: 250 });
  const aportaciones = [
    FT.crearAportacion({ id: "af1", viajeId: "vf", clienteId: "cf1", importe: 250, forma: "transferencia", fecha: "2026-09-01T10:00:00" }),
    FT.crearAportacion({ id: "af2", viajeId: "vf", clienteId: "cf2", importe: 100, forma: "metalico", fecha: "2026-09-10T10:00:00" }),
  ];
  const gastoBote = FT.crearGastoGrupo({ id: "gf1", viajeId: "vf", categoria: "alojamiento", descripcion: "Hotel", importe: 200, moneda: "MAD", cambio: 10.8, forma: "metalico", pagador: "bote" });
  const gastoMio = FT.crearGastoGrupo({ id: "gf2", viajeId: "vf", categoria: "comidas", descripcion: "Cena", importe: 40, forma: "transferencia", pagador: "yo" });
  const reembolso = FT.crearReembolso({ id: "rf1", viajeId: "vf", gastoId: "gf2", beneficiario: "yo", importe: 40, forma: "transferencia", fecha: "2026-10-06T10:00:00" });
  const concepto = FT.crearConcepto({ id: "kf1", viajeId: "vf", categoria: "alojamiento", tipo: "personaNoche", descripcion: "Hotel previsto", precio: 25, personas: 2, noches: 4 });

  return Promise.all([
    TFTDB.guardar("viajes", viaje),
    TFTDB.guardarVarios("clientes", [p1, p2]),
    TFTDB.guardarVarios("aportaciones", aportaciones),
    TFTDB.guardarVarios("gastos", [gastoBote, gastoMio]),
    TFTDB.guardar("reembolsos", reembolso),
    TFTDB.guardar("conceptos", concepto),
  ])
    .then(() => TFTDB.leerTodo())
    .then((datos) => {
      const r = FT.resumenDelViaje({
        viaje: viaje, clientes: datos.clientes, aportaciones: datos.aportaciones,
        conceptos: datos.conceptos, gastos: datos.gastos, reembolsos: datos.reembolsos,
        devoluciones: datos.devoluciones, gastosPersonales: datos.gastosPersonales, honorarios: datos.honorarios,
      });
      igual(r.nClientes, 2, "el flujo completo cuenta 2 clientes");
      igual(r.botePrevisto, 500, "el bote previsto es 500 € (2 × 250 €)");
      igual(r.recibido, 350, "se han recibido 350 € (250 € + 100 €)");
      igual(r.pendienteAportaciones, 150, "quedan 150 € de aportaciones pendientes (Luis)");
      // 200 MAD = 18,51 € (200 / 10,8) pagados con el bote
      casi(r.pagadoConBote, 18.52, "el pago con el bote de 200 MAD equivale a 18,52 €");
      igual(r.reembolsadoRegistrado, 40, "se ha reembolsado 40 € del adelanto");
      igual(r.pendienteReembolso, 0, "el adelanto ya está reembolsado del todo");
      casi(r.dineroDisponible, 350 - 18.52 - 40, "el bote disponible es recibido − pagado − reembolsado");
      igual(r.presupuesto.total, 200, "el presupuesto previsto es 200 € (25 € × 2 × 4)");
    });
}

function casi(a, b, mensaje) {
  ok(Math.abs(Number(a) - Number(b)) < 0.02, `${mensaje} (esperado «${b}», sale «${a}»)`);
}

/* ---------------- ejecución encadenada ---------------- */

console.log("\n1. Apertura del almacén");
pruebaApertura()
  .then(() => {
    console.log("\n2. Guardar y leer");
    return pruebaGuardarYLeer();
  })
  .then(() => {
    console.log("\n3. Conservar datos al cerrar y reabrir");
    return pruebaCerrarYReabrir();
  })
  .then(() => {
    console.log("\n4. Leer todo y exportar");
    return pruebaLeerTodoYExportar();
  })
  .then(() => {
    console.log("\n5. Importar una copia");
    return pruebaImportarCopia();
  })
  .then(() => {
    console.log("\n6. Eliminar un viaje con todo lo suyo");
    return pruebaEliminarViaje();
  })
  .then(() => {
    console.log("\n7. Flujo completo de cuentas");
    return pruebaFlujoCompleto();
  })
  .then(() => {
    console.log("\n" + "=".repeat(50));
    console.log(`Pruebas: ${pruebas}   Fallos: ${fallos}`);
    console.log("=".repeat(50));
    console.log(fallos > 0 ? "RESULTADO: HAY FALLOS" : "RESULTADO: TODO CORRECTO");
  })
  .catch((err) => {
    fallos += 1;
    console.log("\nERROR NO CONTROLADO: " + (err && err.message ? err.message : err));
    console.log(`Pruebas: ${pruebas}   Fallos: ${fallos}`);
    console.log("RESULTADO: HAY FALLOS");
  });
