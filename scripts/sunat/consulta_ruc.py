#!/usr/bin/env python3
"""
Script de prueba: consulta RUC en SUNAT sin Selenium (solo requests + BeautifulSoup).

Método: replica las peticiones HTTP que hace el navegador en
https://e-consultaruc.sunat.gob.pe/cl-ti-itmrconsruc/FrameCriterioBusquedaWeb.jsp
  1. GET a la página del formulario para obtener cookies de sesión.
  2. POST "consPorTipdoc" (búsqueda por DNI) para que el servidor entregue
     el valor oculto `numRnd`.
  3. POST "consPorRuc" con el RUC + numRnd + token aleatorio -> HTML con la ficha.
  4. Parsear el HTML con BeautifulSoup.

Uso:
    pip install requests beautifulsoup4
    python consulta_ruc.py 20131312955 [20100047218 ...]
    python consulta_ruc.py 20131312955 --json
"""
import argparse
import json
import random
import re
import string
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


def _token(n: int = 52) -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


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

    # Búsqueda "dummy" por DNI: la respuesta trae <input name="numRnd" value="...">
    r = s.post(ALIAS_URL, timeout=20, data={
        "accion": "consPorTipdoc", "razSoc": "", "nroRuc": "", "nrodoc": "12345678",
        "token": _token(), "contexto": "ti-it", "modo": "1", "search1": "",
        "rbtnTipo": "2", "tipdoc": "1", "search2": "12345678", "search3": "", "codigo": "",
    })
    r.raise_for_status()
    m = re.search(r'name="numRnd"\s+value="([^"]*)"', r.text)
    return s, (m.group(1) if m else "")


def parsear_ficha(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    datos = {}
    for item in soup.select("div.list-group-item"):
        cols = item.select("div[class*='col-sm']")
        # Cada fila tiene pares (etiqueta, valor) en columnas consecutivas
        for i in range(0, len(cols) - 1, 2):
            etiqueta = cols[i].get_text(" ", strip=True).rstrip(":").strip()
            if cols[i + 1].find("table"):
                valor = [td.get_text(" ", strip=True)
                         for td in cols[i + 1].select("td") if td.get_text(strip=True)]
            else:
                valor = " ".join(cols[i + 1].get_text(" ", strip=True).split())
            if etiqueta:
                datos[etiqueta] = valor
    return datos


def consultar_ruc(ruc: str, sesion=None) -> dict:
    if not ruc_valido(ruc):
        raise ValueError(f"RUC inválido: {ruc}")
    s, num_rnd = sesion or nueva_sesion()
    r = s.post(ALIAS_URL, timeout=20, data={
        "accion": "consPorRuc", "actReturn": "1", "nroRuc": ruc,
        "numRnd": num_rnd, "modo": "1", "token": _token(), "contexto": "ti-it",
    })
    r.raise_for_status()
    r.encoding = r.apparent_encoding or "utf-8"
    datos = parsear_ficha(r.text)
    if not datos:
        raise RuntimeError("SUNAT no devolvió la ficha (posible bloqueo o cambio en la web). "
                           "Guarda r.text para revisar el HTML.")
    return datos


def main():
    ap = argparse.ArgumentParser(description="Consulta RUC en SUNAT sin Selenium")
    ap.add_argument("rucs", nargs="+")
    ap.add_argument("--json", action="store_true", help="salida en JSON")
    args = ap.parse_args()

    sesion = nueva_sesion()  # se reutiliza para varias consultas
    resultados = {}
    for ruc in args.rucs:
        try:
            resultados[ruc] = consultar_ruc(ruc, sesion)
        except Exception as e:  # noqa: BLE001
            resultados[ruc] = {"error": str(e)}

    if args.json:
        print(json.dumps(resultados, ensure_ascii=False, indent=2))
        return
    for ruc, datos in resultados.items():
        print(f"\n=== {ruc} ===")
        for k, v in datos.items():
            print(f"{k}: {', '.join(v) if isinstance(v, list) else v}")


if __name__ == "__main__":
    sys.exit(main())
