"use strict";
/* ============================================================
   The Free Travel · Gestión de viajes
   js/db.js — almacén local en IndexedDB.

   Las tablas son:
     viajes, clientes, aportaciones, conceptos, gastos,
     reembolsos, devoluciones, gastosPersonales, honorarios, meta

   Al actualizar la app solo se crean tablas nuevas: los datos que
   ya hay en el dispositivo se conservan. No hay borrados
   automáticos de datos del usuario.
   ============================================================ */

globalThis.TFTDB = (function () {
  const NOMBRE = "the-free-travel";
  const VERSION = 1;
  const TIENDAS = [
    "viajes",
    "clientes",
    "aportaciones",
    "conceptos",
    "gastos",
    "reembolsos",
    "devoluciones",
    "gastosPersonales",
    "honorarios",
    "meta",
  ];

  let promesaDb = null;

  function abrir() {
    if (promesaDb) return promesaDb;
    promesaDb = new Promise((resolver, rechazar) => {
      if (typeof indexedDB === "undefined") {
        rechazar(new Error("Este navegador no permite guardar datos sin conexión (IndexedDB)."));
        return;
      }
      const peticion = indexedDB.open(NOMBRE, VERSION);
      peticion.onupgradeneeded = (evento) => {
        const db = evento.target.result;
        TIENDAS.forEach((nombre) => {
          if (!db.objectStoreNames.contains(nombre)) {
            db.createObjectStore(nombre, { keyPath: nombre === "meta" ? "clave" : "id" });
          }
        });
      };
      peticion.onsuccess = () => {
        const db = peticion.result;
        db.onversionchange = () => {
          try { db.close(); } catch (e) { /* nada */ }
          promesaDb = null;
        };
        resolver(db);
      };
      peticion.onerror = () => {
        rechazar(peticion.error || new Error("No se pudo abrir el almacén de datos."));
      };
      peticion.onblocked = () => {
        rechazar(new Error("El almacén está bloqueado por otra pestaña de la app."));
      };
    }).catch((err) => {
      promesaDb = null;
      throw err;
    });
    return promesaDb;
  }

  /** Cierra la conexión (las pruebas lo usan para simular «cerrar y reabrir»). */
  function cerrar() {
    const pendiente = promesaDb;
    promesaDb = null;
    if (!pendiente) return Promise.resolve();
    return pendiente.then((db) => {
      try { db.close(); } catch (e) { /* nada */ }
    });
  }

  /** Escritura sobre una sola tienda. */
  function transaccion(tienda, modo, trabajador) {
    return abrir().then((db) => new Promise((resolver, rechazar) => {
      const tx = db.transaction([tienda], modo);
      let salida;
      tx.oncomplete = () => resolver(salida);
      tx.onerror = () => rechazar(tx.error || new Error("Error al acceder al almacén."));
      tx.onabort = () => rechazar(tx.error || new Error("Operación cancelada."));
      try {
        salida = trabajador(tx.objectStore(tienda));
      } catch (e) {
        try { tx.abort(); } catch (err) { /* nada */ }
        rechazar(e);
      }
    }));
  }

  /** Escritura sobre varias tiendas a la vez. */
  function transaccionVarias(tiendas, modo, trabajador) {
    return abrir().then((db) => new Promise((resolver, rechazar) => {
      const tx = db.transaction(tiendas, modo);
      let salida;
      tx.oncomplete = () => resolver(salida);
      tx.onerror = () => rechazar(tx.error || new Error("Error al acceder al almacén."));
      tx.onabort = () => rechazar(tx.error || new Error("Operación cancelada."));
      try {
        salida = trabajador((nombre) => tx.objectStore(nombre));
      } catch (e) {
        try { tx.abort(); } catch (err) { /* nada */ }
        rechazar(e);
      }
    }));
  }

  /** Lectura de una tienda completa o de una clave. */
  function leer(tienda, metodo, argumento) {
    return abrir().then((db) => new Promise((resolver, rechazar) => {
      const tx = db.transaction([tienda], "readonly");
      let datos;
      tx.oncomplete = () => resolver(datos);
      tx.onerror = () => rechazar(tx.error || new Error("Error al leer el almacén."));
      tx.onabort = () => rechazar(tx.error || new Error("Lectura cancelada."));
      const peticion = argumento === undefined
        ? tx.objectStore(tienda)[metodo]()
        : tx.objectStore(tienda)[metodo](argumento);
      peticion.onsuccess = () => { datos = peticion.result; };
      peticion.onerror = () => rechazar(peticion.error || new Error("Lectura fallida."));
    }));
  }

  /* ---------------- API genérica por tienda ---------------- */

  function listar(tienda) {
    return leer(tienda, "getAll").then((lista) => lista || []);
  }

  function guardar(tienda, objeto) {
    return transaccion(tienda, "readwrite", (t) => {
      t.put(objeto);
      return true;
    });
  }

  function eliminar(tienda, id) {
    return transaccion(tienda, "readwrite", (t) => {
      t.delete(id);
      return true;
    });
  }

  /** Guarda varios objetos en una tienda. */
  function guardarVarios(tienda, lista) {
    return transaccion(tienda, "readwrite", (t) => {
      (lista || []).forEach((x) => t.put(x));
      return true;
    });
  }

  /**
   * Elimina un viaje y todo lo que cuelga de él en una sola
   * transacción: clientes, aportaciones, conceptos, gastos,
   * reembolsos, devoluciones, gastos personales y honorarios.
   */
  function eliminarViajeCompleto(viajeId) {
    const dependientes = [
      "clientes", "aportaciones", "conceptos", "gastos",
      "reembolsos", "devoluciones", "gastosPersonales", "honorarios",
    ];
    return transaccionVarias(["viajes"].concat(dependientes), "readwrite", (tienda) => {
      tienda("viajes").delete(viajeId);
      dependientes.forEach((nombre) => {
        const store = tienda(nombre);
        const peticion = store.getAll();
        peticion.onsuccess = () => {
          (peticion.result || []).forEach((fila) => {
            if (fila && fila.viajeId === viajeId) store.delete(fila.id);
          });
        };
      });
      return true;
    });
  }

  /** Sustituye todo el contenido por lo importado de una copia. */
  function guardarTodo(datos) {
    const d = datos || {};
    return transaccionVarias(TIENDAS, "readwrite", (tienda) => {
      TIENDAS.forEach((nombre) => {
        if (nombre === "meta") return;
        const store = tienda(nombre);
        store.clear();
        ((d[nombre]) || []).forEach((x) => store.put(x));
      });
      return true;
    });
  }

  /** Lee todas las tablas de una vez (para exportar y para el resumen). */
  function leerTodo() {
    const d = {};
    return TIENDAS
      .filter((n) => n !== "meta")
      .reduce(
        (cadena, nombre) => cadena.then(() => listar(nombre).then((lista) => { d[nombre] = lista; })),
        Promise.resolve()
      )
      .then(() => d);
  }

  function guardarMeta(clave, valor) {
    return transaccion("meta", "readwrite", (tienda) => {
      tienda.put({ clave: clave, valor: valor });
      return true;
    });
  }

  function leerMeta(clave) {
    return leer("meta", "get", clave).then((fila) => (fila ? fila.valor : undefined));
  }

  return {
    NOMBRE: NOMBRE,
    VERSION: VERSION,
    TIENDAS: TIENDAS,
    abrir: abrir,
    cerrar: cerrar,
    listar: listar,
    guardar: guardar,
    eliminar: eliminar,
    guardarVarios: guardarVarios,
    eliminarViajeCompleto: eliminarViajeCompleto,
    guardarTodo: guardarTodo,
    leerTodo: leerTodo,
    guardarMeta: guardarMeta,
    leerMeta: leerMeta,
  };
})();
