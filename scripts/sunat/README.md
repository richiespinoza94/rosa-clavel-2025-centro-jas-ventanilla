# Consulta RUC SUNAT sin Selenium (prueba)

```bash
pip install requests beautifulsoup4
python consulta_ruc.py 20131312955
python consulta_ruc.py 20131312955 20100047218 --json
```

Replica las peticiones HTTP del formulario de "Consulta RUC" (cookies → `numRnd` → `consPorRuc`)
y parsea el HTML con BeautifulSoup. No necesita navegador ni captcha.
Si SUNAT cambia su web, el parser (`parsear_ficha`) es lo primero que hay que ajustar.
