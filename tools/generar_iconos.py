#!/usr/bin/env python3
"""Genera los iconos PNG de «The Free Travel · Gestión de viajes».

Sin librerías externas: solo la biblioteca estándar de Python.
No es un logotipo: es un cuadrado naranja con las letras «TFT»,
el mínimo gráfico que Android exige para instalar una PWA.

Uso:  python3 tools/generar_iconos.py   (desde la raíz del proyecto)
"""
import os
import struct
import zlib

NARANJA = (0xE0, 0x7A, 0x2F, 255)
ARENA = (0xF4, 0xEA, 0xD8, 255)

# Fuente de bloques 5×7 para las letras que usamos.
LETRAS = {
    "T": [
        "11111",
        "00100",
        "00100",
        "00100",
        "00100",
        "00100",
        "00100",
    ],
    "F": [
        "11111",
        "10000",
        "10000",
        "11110",
        "10000",
        "10000",
        "10000",
    ],
}

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESTINO = os.path.join(RAIZ, "iconos")


def escribir_png(ruta, pixeles, tam):
    """Escribe un PNG RGBA (sin librerías externas)."""
    filas = b"".join(
        b"\x00" + bytes(pixeles[y * tam * 4:(y + 1) * tam * 4]) for y in range(tam)
    )

    def chunk(tipo, datos):
        return (
            struct.pack(">I", len(datos))
            + tipo
            + datos
            + struct.pack(">I", zlib.crc32(tipo + datos) & 0xFFFFFFFF)
        )

    with open(ruta, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", struct.pack(">IIBBBBB", tam, tam, 8, 6, 0, 0, 0)))
        f.write(chunk(b"IDAT", zlib.compress(filas, 9)))
        f.write(chunk(b"IEND", b""))


def pintar(tam, escala_letras):
    """Dibuja fondo naranja y las letras «TFT» en arena. Devuelve RGBA."""
    buf = bytearray(NARANJA * (tam * tam))

    def rect(x0, y0, x1, y1, color):
        ix0 = max(0, int(round(x0)))
        iy0 = max(0, int(round(y0)))
        ix1 = min(tam, int(round(x1)))
        iy1 = min(tam, int(round(y1)))
        for y in range(iy0, iy1):
            for x in range(ix0, ix1):
                i = (y * tam + x) * 4
                buf[i] = color[0]
                buf[i + 1] = color[1]
                buf[i + 2] = color[2]
                buf[i + 3] = color[3]

    texto = "TFT"
    celda = (tam * 0.26 * escala_letras) / 7.0
    ancho_letra = 5 * celda
    hueco = 1 * celda
    ancho_total = len(texto) * ancho_letra + (len(texto) - 1) * hueco
    x = (tam - ancho_total) / 2.0
    y = (tam - 7 * celda) / 2.0

    for letra in texto:
        filas = LETRAS[letra]
        for j, fila in enumerate(filas):
            for i, c in enumerate(fila):
                if c == "1":
                    px = x + i * celda
                    py = y + j * celda
                    # +0.6 para que las celdas vecinas no dejen costuras
                    rect(px, py, px + celda + 0.6, py + celda + 0.6, ARENA)
        x += ancho_letra + hueco

    return buf


def main():
    os.makedirs(DESTINO, exist_ok=True)
    salidas = [
        ("icono-512.png", 512, 1.0),
        ("icono-192.png", 192, 1.0),
        ("icono-512-maskable.png", 512, 0.86),  # zona segura del icono "maskable"
    ]
    for nombre, tam, escala in salidas:
        ruta = os.path.join(DESTINO, nombre)
        escribir_png(ruta, pintar(tam, escala), tam)
        print("✓", "iconos/" + nombre, f"{tam}x{tam}")


if __name__ == "__main__":
    main()
