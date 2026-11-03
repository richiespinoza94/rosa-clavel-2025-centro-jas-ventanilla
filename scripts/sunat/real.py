#!/usr/bin/env python3
"""
Consulta RUC en SUNAT sin Selenium — basado en el método del video.

La "falla": SUNAT reemplaza el reCAPTCHA real de Google por uno propio
(sunatrecaptcha3.js). Ese script define:

    window.grecaptcha.execute()  ->  devuelve generateKey(0x34)

y generateKey(n) solo construye una cadena ALEATORIA de largo n con
Math.random().toString(36). O sea, el "token de captcha" es basura random de
52 caracteres que el backend acepta sin validar contra Google. Por eso basta
con requests + un token aleatorio; no hace falta navegador ni resolver captcha.

Flujo:
  1. GET al formulario  -> cookies de sesión.
  2. POST consPorTipdoc  -> el servidor entrega el campo oculto `numRnd`.
  3. POST consPorRuc (RUC + numRnd + token random = generateKey(52)) -> ficha HTML.
  4. Parsear la ficha con BeautifulSoup.

Uso:
    pip install requests beautifulsoup4
    python real.py 20100130204
    python real.py 20100130204 20131312955        # varios
    python real.py 20100130204 --no-json           # salida legible
"""
import argparse
import json
import random
import re
import sys

import requests
from bs4 import BeautifulSoup

BASE = "https://e-consultaruc.sunat.gob.pe/cl-ti-itmrconsruc"
FORM_URL = f"{BASE}/FrameCriterioBusquedaWeb.jsp"
ALIAS_URL = f"{BASE}/jcrS00Alias"

HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-PE,es;q=0.9",
    "Origin": "https://e-consultaruc.sunat.gob.pe",
    "Referer": FORM_URL,
}


def generate_key(n: int = 0x34) -> str:
    """Replica generateKey(n) de sunatrecaptcha3.js: cadena random de largo n.

    En JS: while (s.length < n) s += Math.random().toString(36).substring(2);
    base36 usa [0-9a-z], así que generamos lo mismo y cortamos a n caracteres.
    """
    alfabeto = "0123456789abcdefghijklmnopqrstuvwxyz"
    s = ""
    while len(s) < n:
        s += "".join(random.choices(alfabeto, k=11))  # ~ un toString(36) típico
    return s[:n]


def ruc_valido(ruc: str) -> bool:
    """Valida longitud, prefijo y dígito verificador del RUC."""
    if not re.fullmatch(r"(10|15|16|17|20)\d{9}", ruc):
        return False
    pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    resto = 11 - sum(int(d) * p for d, p in zip(ruc[:10], pesos)) % 11
    return int(ruc[10]) == {10: 0, 11: 1}.get(resto, resto)


def nueva_sesion() -> tuple[requests.Session, str]:
    s = requests.Session()
    s.headers.update(HEADERS)
    s.get(FORM_URL, timeout=20).raise_for_status()

    # Búsqueda "dummy" por documento: la respuesta trae el oculto numRnd.
    r = s.post(ALIAS_URL, timeout=20, data={
        "accion": "consPorTipdoc", "razSoc": "", "nroRuc": "", "nrodoc": "12345678",
        "token": generate_key(), "contexto": "ti-it", "modo": "1", "search1": "",
        "rbtnTipo": "2", "tipdoc": "1", "search2": "12345678", "search3": "", "codigo": "",
    })
    r.raise_for_status()
    m = re.search(r'name="numRnd"\s+value="([^"]*)"', r.text)
    return s, (m.group(1) if m else "")


def _parsear_ficha(html: str) -> dict:
    """Extrae los pares etiqueta/valor de la ficha RUC."""
    soup = BeautifulSoup(html, "html.parser")
    campos = {}
    for item in soup.select("div.list-group-item"):
        cols = item.select("div[class*='col-sm']")
        for i in range(0, len(cols) - 1, 2):
            etiqueta = cols[i].get_text(" ", strip=True).rstrip(":").strip()
            celda = cols[i + 1]
            if celda.find("table"):
                valor = [td.get_text(" ", strip=True)
                         for td in celda.select("td") if td.get_text(strip=True)]
            else:
                # varias líneas (p / br) -> lista; una sola -> string
                lineas = [t.strip() for t in celda.stripped_strings]
                valor = lineas if len(lineas) > 1 else " ".join(" ".join(lineas).split())
            if etiqueta:
                campos[etiqueta] = valor
    return campos


def _snake(texto: str) -> str:
    texto = texto.lower()
    texto = (texto.replace("á", "a").replace("é", "e").replace("í", "i")
                  .replace("ó", "o").replace("ú", "u").replace("ñ", "n"))
    return re.sub(r"[^a-z0-9]+", "_", texto).strip("_")


def consultar_ruc(ruc: str, sesion=None) -> dict:
    if not ruc_valido(ruc):
        raise ValueError(f"RUC inválido: {ruc}")
    s, num_rnd = sesion or nueva_sesion()
    r = s.post(ALIAS_URL, timeout=20, data={
        "accion": "consPorRuc", "actReturn": "1", "nroRuc": ruc,
        "numRnd": num_rnd, "modo": "1", "token": generate_key(), "contexto": "ti-it",
    })
    r.raise_for_status()
    r.encoding = r.apparent_encoding or "utf-8"
    campos = _parsear_ficha(r.text)
    if not campos:
        raise RuntimeError("SUNAT no devolvió la ficha (bloqueo o cambio en la web). "
                           "Revisa el HTML de la respuesta para ajustar el parser.")
    # estructura como el video: campos_completos + claves snake_case
    registro = {"campos_completos": campos}
    for k, v in campos.items():
        registro[_snake(k)] = v
    return registro


def main():
    ap = argparse.ArgumentParser(description="Consulta RUC en SUNAT sin Selenium")
    ap.add_argument("rucs", nargs="+")
    ap.add_argument("--no-json", action="store_true", help="salida legible en vez de JSON")
    args = ap.parse_args()

    sesion = nueva_sesion()  # se reutiliza para todos los RUC
    salida = []
    for ruc in args.rucs:
        print(f"[*] Consultando {ruc}...", file=sys.stderr)
        try:
            contribuyente = consultar_ruc(ruc, sesion)
            salida.append({"documento": ruc, "contribuyentes": [contribuyente]})
        except Exception as e:  # noqa: BLE001
            salida.append({"documento": ruc, "error": str(e)})

    if args.no_json:
        for bloque in salida:
            print(f"\n=== {bloque['documento']} ===")
            if "error" in bloque:
                print("ERROR:", bloque["error"]); continue
            for k, v in bloque["contribuyentes"][0]["campos_completos"].items():
                print(f"{k}: {v if isinstance(v, str) else ', '.join(v)}")
    else:
        print(json.dumps(salida, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    sys.exit(main())
