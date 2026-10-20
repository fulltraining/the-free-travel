# The Free Travel · Gestión de viajes

Aplicación web instalable (PWA) para organizar viajes en grupo. Funciona
**sin conexión** después de la primera carga y guarda los datos **solo en tu
dispositivo**, en IndexedDB. No hay cuentas, no hay servidores y no se sube
ningún dato personal a ninguna parte.

Es un proyecto **independiente** de Fulltraining y de Omniterra.

## App publicada

**https://fulltraining.github.io/the-free-travel/**

Repositorio: https://github.com/fulltraining/the-free-travel (contiene
**únicamente el código**; ningún dato de viajes, clientes ni movimientos).

## Qué hace

- **Viajes**: crear, editar y eliminar viajes con nombre, destino, fechas,
  moneda principal y observaciones. Cada viaje guarda sus propios clientes,
  presupuesto, gastos y aportaciones.
- **Clientes y bote común**: alta de clientes con nombre y apellidos; el número
  de clientes se calcula solo. Aportación prevista (individual o común a todos),
  aportaciones entregadas en varios ingresos, fecha automática y editable, forma
  de entrega (metálico o transferencia), y saldo pendiente o exceso aportado.
- **Gastos del grupo**, con dos pestañas bien visibles:
  - **Presupuesto previsto**: conceptos por categoría (desplazamientos,
    alojamientos, comidas, actividades y otros) con seis formas de cálculo:
    importe total, precio por persona, por persona y noche, por habitación y
    noche, por día o por unidad. Se muestra el cálculo antes de guardar, se
    pueden indicar las personas que cubre cada gasto y se pueden editar o
    eliminar conceptos. Bajo cada concepto se ve su **importe previsto**, el
    **gasto real acumulado** y la **diferencia** (real − previsto: positiva es
    sobrecoste). Si todavía no hay conceptos, aparece «Sin presupuesto
    definido». El presupuesto y los gastos reales se llevan **aparte** para no
    sumarlos dos veces.
  - **Gastos reales**: categoría, descripción, fecha, importe, moneda, forma de
    pago, quién lo paga (bote, yo o un cliente) y el campo **Concepto del
    presupuesto**, que carga los conceptos del viaje activo mostrando
    descripción, categoría e importe previsto (por ejemplo
    «Minibús con conductor · Desplazamientos · Previsto: 1.200 €»). Al elegir
    uno se ve su previsión, lo ya gastado y lo que queda o el sobrecoste, y se
    pueden enlazar **varios pagos al mismo concepto** (una reserva y el pago
    final). Se conserva la opción «Gasto no previsto» y, si aún no hay
    conceptos, se avisa y se ofrece «+ Añadir concepto» sin perder lo escrito.
    Si alguien adelanta dinero, se muestra el pendiente de reembolso y se
    registra el reembolso **sin contarlo otra vez como gasto**.
- **Mis gastos de viaje**: vuelos, alojamientos, comidas, desplazamientos,
  actividades y otros. Por defecto son personales y **no** se descuentan del
  bote; si marcas «cubierto por el grupo» se contabilizan una sola vez como
  gasto del grupo.
- **Mis honorarios**: previstos, cobrados, fecha y forma de cobro, y pendiente
  de cobro. No forman parte del bote. Se muestran los honorarios previstos y
  cobrados, mis gastos personales, el **resultado previsto** (honorarios
  previstos − mis gastos previstos) y el **resultado real** (cobrados − gastos
  realizados), identificados como cálculos de gestión **antes de impuestos**.
- **Resumen del viaje**: número de clientes, presupuesto, gasto real por
  categoría, sobrecoste, la tabla **previsto / real / diferencia por concepto**,
  bote previsto, aportaciones recibidas y pendientes, dinero disponible del
  bote, adelantos pendientes de reembolso, devoluciones, honorarios y gastos
  personales.
- **Distintas monedas**: euros, dírhams marroquíes y muchas más. El tipo de
  cambio se escribe siempre como «1 € = X unidades de la moneda» y **se guarda
  en cada movimiento**, así los gastos antiguos no cambian al modificar el
  cambio. Se muestran los saldos por moneda y su equivalencia en euros; nunca se
  suman monedas distintas sin convertir.
- **Datos y copias**: exportar e importar una copia completa en JSON, exportar
  clientes, aportaciones y gastos a CSV, y pedir confirmación antes de eliminar
  un viaje.

### Cómo se calcula el bote

El saldo del bote usa **movimientos reales**:

> dinero disponible = aportaciones recibidas − pagos hechos con el bote
> − reembolsos − devoluciones a clientes

Los gastos que alguien ha adelantado y **aún no se han reembolsado no se
descuentan** del dinero disponible: se muestran **aparte** como obligaciones
pendientes.

## Instalarla en Android

1. Abre **https://fulltraining.github.io/the-free-travel/** con **Chrome** en el móvil.
2. Espera a que cargue del todo (la primera vez necesita conexión).
3. Toca el menú **⋮** y elige **«Instalar aplicación»** o
   **«Añadir a pantalla de inicio»**.
4. Confirma. Aparecerá un icono como el de cualquier aplicación.

A partir de ahí, abre la app desde su icono: funciona **sin conexión** y no
necesitas mantener Termux abierto.

## Copias de seguridad

- En cualquier pantalla, baja hasta **«Datos y copias de seguridad»**.
- **Exportar copia completa (JSON)**: guarda todo (viajes, clientes,
  aportaciones, presupuesto, gastos, mis gastos, honorarios y movimientos del
  bote). Guárdala donde quieras.
- **Importar una copia (JSON)**: permite **reemplazar** todos los datos o
  **mezclarlos** con los que ya hay.
- **CSV clientes / aportaciones / gastos**: para abrirlos en una hoja de
  cálculo.

Los datos se conservan al actualizar la app: las tablas de IndexedDB solo se
crean, nunca se borran solas.

## Publicar por HTTPS

Ya está publicada en GitHub Pages (ver arriba). El repositorio contiene
**únicamente el código**. No incluyas nunca aquí copias con nombres de clientes
ni movimientos personales.

Si la sirves en otro sitio (tu propio hosting), los archivos que hay que subir
son:

```
index.html
styles.css
manifest.json
sw.js
.nojekyll
iconos/          (icono.svg, icono-192.png, icono-512.png, icono-512-maskable.png)
js/              (logica.js, db.js, app.js)
```

Todas las rutas son relativas, así que la app funciona igual en la raíz del
dominio o dentro de una subcarpeta. Al publicar una versión nueva, sube el
número de la caché en `sw.js` (`the-free-travel-cache-vN`) para que los móviles
se actualicen. Tras publicar, en el móvil suele hacer falta **cerrar y abrir la
app** (o recargar dos veces) para que entre la versión nueva.

## Pruebas

Sin necesidad de navegador, con QuickJS y Python:

```sh
qjs tests/logica.test.mjs      # cálculos y reglas de negocio (194)
qjs tests/db.test.mjs          # IndexedDB falso: guardar, cerrar/reabrir, importar (51)
qjs tests/ui.test.mjs          # pantallas, pestañas y flujo por acciones (184)
python3 tests/estaticas.py     # PWA: archivos, manifest, service worker, colores (94)
```

Total: **523 comprobaciones**. Las pruebas usan datos temporales propios que no
se guardan en la aplicación.

## Estructura

```
index.html          Estructura y pantallas
styles.css          Diseño naranja, arena y blanco
manifest.json       Datos de instalación (PWA)
sw.js               Service worker (uso sin conexión)
js/logica.js        Reglas de negocio y cálculos (sin DOM ni IndexedDB)
js/db.js            Almacén local en IndexedDB
js/app.js           Interfaz y conexión con el almacén
iconos/             Iconos de la app
tools/generar_iconos.py   Vuelve a generar los iconos PNG
tests/              Pruebas
```
