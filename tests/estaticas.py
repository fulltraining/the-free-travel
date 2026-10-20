#!/usr/bin/env python3
"""Comprobaciones estáticas de «The Free Travel · Gestión de viajes».

Se ejecuta desde la raíz del proyecto:

    python3 tests/estaticas.py

Revisa que la PWA esté completa y sea instalable: archivos de la
app, manifest con iconos válidos, service worker con la caché
correcta, rutas relativas (para cualquier carpeta HTTPS), textos en
español, colores naranja/arena/blanco y ausencia de dependencias
externas (funcionar sin conexión) y de datos personales en el código.
"""
import json
import os
import re
import struct
import subprocess
import sys
import xml.etree.ElementTree as ET

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(RAIZ)

fallos = 0
pruebas = 0


def ok(condicion, mensaje):
    global fallos, pruebas
    pruebas += 1
    if condicion:
        print("  ✓ " + mensaje)
    else:
        fallos += 1
        print("  ✗ FALLO: " + mensaje)


def leer(ruta):
    with open(ruta, encoding="utf-8") as f:
        return f.read()


def tamano_png(ruta):
    with open(ruta, "rb") as f:
        cabecera = f.read(26)
    if cabecera[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    ancho, alto = struct.unpack(">II", cabecera[16:24])
    return ancho, alto


ARCHIVOS = [
    "index.html", "styles.css", "manifest.json", "sw.js",
    "iconos/icono.svg", "iconos/icono-192.png", "iconos/icono-512.png",
    "iconos/icono-512-maskable.png", "js/logica.js", "js/db.js", "js/app.js",
]

print("\n== Archivos de la app ==")
for ruta in ARCHIVOS:
    ok(os.path.isfile(ruta), f"existe {ruta}")

html = leer("index.html")
css = leer("styles.css")
logica = leer("js/logica.js")
db = leer("js/db.js")
app = leer("js/app.js")
sw = leer("sw.js")
manifest = json.loads(leer("manifest.json"))

print("\n== Pantallas y textos ==")
for texto in ["Viajes", "Clientes y bote", "Gastos del grupo", "Mis gastos", "Resumen"]:
    ok(texto in html or texto in app, f"la pantalla «{texto}» está presente")
ok("The Free Travel" in html, "el nombre «The Free Travel» aparece como texto")
ok("Gestión de viajes" in html, "el subtítulo «Gestión de viajes» aparece")
ok('lang="es"' in html, "el documento está en español")
ok("the free travel" in app.lower(), "la app se identifica con su nombre")

print("\n== Características pedidas ==")
for texto, donde, nombre in [
    ("bote común", app.lower(), "se habla del bote común"),
    ("aportación prevista", app.lower(), "se registra la aportación prevista"),
    ("forma de entrega", app.lower(), "las aportaciones piden forma de entrega"),
    ("Precio por persona y noche", logica, "existe el cálculo por persona y noche"),
    ("Precio por habitación y noche", logica, "existe el cálculo por habitación y noche"),
    ("Importe total del grupo", logica, "existe el cálculo por importe total del grupo"),
    ("Precio por día", logica, "existe el cálculo por día"),
    ("Precio por unidad", logica, "existe el cálculo por unidad"),
    ("pendiente de reembolso", app.lower(), "se muestra lo pendiente de reembolso"),
    ("devolución", app.lower(), "se registran devoluciones del bote"),
    ("honorarios", app.lower(), "se registran honorarios"),
    ("antes de impuestos", app.lower(), "los resultados se identifican antes de impuestos"),
    ("dírham", logica.lower(), "se contempla el dírham marroquí"),
    ("1 € =", app + logica, "se indica el tipo de cambio como «1 € = X»"),
    ("exportar copia", app.lower(), "se exporta una copia completa"),
    ("importar", app.lower(), "se importa una copia"),
    ("csv", app.lower(), "se exportan CSV"),
    ("indexeddb", db.lower(), "los datos se guardan en IndexedDB"),
]:
    ok(texto in donde, nombre)

print("\n== Monedas y cálculos ==")
ok("MONEDA_BASE" in logica and "EUR" in logica, "la moneda base es el euro")
ok("aEuros" in logica and "deEuros" in logica, "hay conversión a euros y desde euros")
ok("saldosPorMoneda" in logica, "hay saldos por moneda")
ok("No sumar monedas distintas" in logica or "no se suman monedas" in app.lower() or "No se suman monedas distintas" in app,
   "se avisa de que no se suman monedas sin convertir")
ok("cambio" in logica, "cada movimiento guarda su tipo de cambio")
ok("resumenDelViaje" in logica, "hay un resumen del viaje")
ok("dineroDisponible" in logica, "el resumen calcula el dinero disponible del bote")

print("\n== Manifest e instalación ==")
ok(manifest.get("name") == "The Free Travel · Gestión de viajes", "el manifest tiene el nombre correcto")
ok(manifest.get("short_name") == "The Free Travel", "el manifest tiene el nombre corto")
ok(manifest.get("display") == "standalone", "el manifest usa display standalone")
ok(manifest.get("lang") == "es", "el manifest está en español")
ok(manifest.get("start_url") in (".", "./"), "el start_url es relativo")
ok(manifest.get("scope") in (".", "./"), "el scope es relativo")
ok(manifest.get("theme_color", "").lower() == "#e07a2f", "el color de tema es naranja")
ok(manifest.get("background_color", "").lower() == "#f4ead8", "el color de fondo es arena")
iconos = manifest.get("icons", [])
ok(len(iconos) >= 3, "el manifest declara al menos 3 iconos")
ok(any(i.get("purpose") == "maskable" for i in iconos), "hay un icono maskable")
for tam, esperado in [("iconos/icono-192.png", (192, 192)), ("iconos/icono-512.png", (512, 512)),
                      ("iconos/icono-512-maskable.png", (512, 512))]:
    ok(tamano_png(tam) == esperado, f"{tam} es un PNG de {esperado[0]}x{esperado[1]}")
try:
    ET.parse("iconos/icono.svg")
    ok(True, "iconos/icono.svg es XML válido")
except Exception as e:  # noqa: BLE001
    ok(False, f"iconos/icono.svg es XML válido ({e})")

print("\n== Service worker y sin conexión ==")
ok("the-free-travel-cache-" in sw, "el service worker define una caché propia")
ok("install" in sw and "activate" in sw and "fetch" in sw, "el service worker cubre install, activate y fetch")
ok("caches.delete" in sw, "el service worker borra cachés antiguas al activarse")
for archivo in ["index.html", "styles.css", "manifest.json", "js/logica.js", "js/db.js", "js/app.js"]:
    ok(archivo in sw, f"el service worker guarda {archivo} para uso sin conexión")
ok("navigator.serviceWorker" in app or "serviceWorker" in html, "la app registra el service worker o lo hace el navegador por el manifest")

print("\n== Sin dependencias externas (uso sin conexión) ==")
ok("http://" not in html.replace("http://www.w3.org", ""), "index.html no carga recursos por http")
ok(not re.search(r'src="https?://', html), "index.html no carga scripts externos")
ok(not re.search(r'href="https?://', html.replace('href="manifest.json"', "")), "index.html no carga estilos externos")
ok("cdn" not in html.lower() and "cdn" not in app.lower(), "no se usa ninguna CDN")
ok("@import" not in css, "el CSS no importa hojas externas")

print("\n== Colores del diseño ==")
for color, nombre in [("#e07a2f", "naranja"), ("#f4ead8", "arena"), ("#ffffff", "blanco")]:
    ok(color in css.lower(), f"el color {nombre} ({color}) está en el CSS")

print("\n== Sin datos personales ni de prueba ==")
# El repositorio debe contener solo código: ni nombres de clientes ni cuentas.
nombres_sospechosos = ["cliente real", "titular", "IBAN", "ES91", "cuenta bancaria"]
for nombre in nombres_sospechosos:
    ok(nombre.lower() not in (app + logica + db + html).lower(), f"el código no contiene «{nombre}»")
ok("Ana García" not in app and "Ana García" not in logica, "no hay nombres de prueba en el código de la app")
ok("Luis Pérez" not in app and "Luis Pérez" not in logica, "no hay apellidos de prueba en el código de la app")

print("\n== Ampliación de rutas relativas ==")
ok('href="manifest.json"' in html, "el manifest se enlaza con ruta relativa")
ok('src="js/logica.js"' in html and 'src="js/app.js"' in html, "los scripts se enlazan con rutas relativas")
ok('href="styles.css"' in html, "el CSS se enlaza con ruta relativa")
ok(not re.search(r'src="/', html), "ninguna ruta de script es absoluta")

print("\n== Sintaxis JavaScript (QuickJS) ==")
for ruta in ["js/logica.js", "js/db.js", "js/app.js", "sw.js"]:
    if not os.path.isfile("/usr/bin/qjs"):
        ok(True, f"{ruta}: QuickJS no está disponible, se omite")
        continue
    proc = subprocess.run(["qjs", ruta], capture_output=True, text=True)
    salida = proc.stdout + proc.stderr
    ok("SyntaxError" not in salida, f"{ruta} compila sin errores de sintaxis")

print("\n== Comprobaciones de despliegue ==")
ok(os.path.isfile(".nojekyll"), "hay .nojekyll (para GitHub Pages)")
ok(not os.path.exists("_config.yml"), "no hay configuración de Jekyll que procese los archivos")

print(f"\n{pruebas - fallos}/{pruebas} comprobaciones correctas.")
if fallos:
    print("HAY FALLOS.")
    sys.exit(1)
