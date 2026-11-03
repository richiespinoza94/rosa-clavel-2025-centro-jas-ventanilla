# Consulta RUC SUNAT sin Selenium (prueba)

Dos versiones del mismo método (solo `requests` + `BeautifulSoup`, sin navegador):

- **`real.py`** — método del video. Replica `generateKey()` de `sunatrecaptcha3.js`.
- `consulta_ruc.py` — primera versión equivalente.

```bash
pip install requests beautifulsoup4
python real.py 20100130204
python real.py 20100130204 20131312955     # varios RUC
python real.py 20100130204 --no-json       # salida legible
```

## La "falla" (reCAPTCHA falso)

SUNAT reemplaza el reCAPTCHA de Google por uno propio. En `sunatrecaptcha3.js`:

```js
window.grecaptcha.execute()  ->  devuelve generateKey(0x34)

function generateKey(n) {        // 0x34 = 52
    let s = '';
    while (s.length < n) s += Math.random().toString(36).substring(2);
    return s.substring(0, n);
}
```

El "token de captcha" es **una cadena aleatoria de 52 caracteres**, no habla con
Google, y el backend la acepta sin validar. Por eso basta con `requests` + un
token random; no se necesita Selenium ni resolver captcha.

## Flujo

1. `GET` al formulario → cookies de sesión.
2. `POST consPorTipdoc` → el servidor entrega el oculto `numRnd`.
3. `POST consPorRuc` con RUC + `numRnd` + token random → ficha HTML.
4. Parsear la ficha con BeautifulSoup → JSON.

## Notas

- **No probado contra SUNAT real** desde aquí: este entorno bloquea
  `e-consultaruc.sunat.gob.pe`. Verifica `generate_key` y campos del POST al correrlo
  en tu PC. Si sale "SUNAT no devolvió la ficha", cambió el HTML: ajusta `_parsear_ficha`.
- Es un servicio **público** de consulta RUC. Úsalo con moderación (pocas consultas,
  reutilizando la sesión) para no saturar ni ser bloqueado.
