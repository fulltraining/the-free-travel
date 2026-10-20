/* ============================================================
   The Free Travel · Gestión de viajes — service worker
   Guarda la app para que funcione sin conexión después de la
   primera carga completa. Estrategia: caché primero y red en
   segundo plano (se actualiza sola cuando hay versión nueva).
   Los datos del usuario NO viven aquí: viven en IndexedDB, en
   el propio dispositivo.
   ============================================================ */
"use strict";

const CACHE = "the-free-travel-cache-v2";

const APP_SHELL = [
  "./",
  "index.html",
  "styles.css",
  "manifest.json",
  "iconos/icono.svg",
  "iconos/icono-192.png",
  "iconos/icono-512.png",
  "iconos/icono-512-maskable.png",
  "js/logica.js",
  "js/db.js",
  "js/app.js",
];

self.addEventListener("install", (ev) => {
  ev.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(
        claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (ev) => {
  const peticion = ev.request;
  if (peticion.method !== "GET") return;

  const url = new URL(peticion.url);
  if (url.origin !== self.location.origin) return;

  // Navegaciones (abrir la app): caché primero, con la red como respaldo.
  if (peticion.mode === "navigate") {
    ev.respondWith(
      caches.match("./").then((enCache) =>
        enCache ||
        fetch(peticion).then((respuesta) => {
          if (respuesta && respuesta.ok) {
            const copia = respuesta.clone();
            caches.open(CACHE).then((c) => c.put("./", copia));
          }
          return respuesta;
        }).catch(() => caches.match("index.html"))
      )
    );
    return;
  }

  // Archivos de la app: caché primero, red en segundo plano.
  ev.respondWith(
    caches.match(peticion).then((enCache) => {
      const red = fetch(peticion)
        .then((respuesta) => {
          if (respuesta && respuesta.ok) {
            const copia = respuesta.clone();
            caches.open(CACHE).then((c) => c.put(peticion, copia));
          }
          return respuesta;
        })
        .catch(() => enCache);
      return enCache || red;
    })
  );
});
