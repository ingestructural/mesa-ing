# Pruebas — Muros y Separaciones de Transformadores

Pruebas reproducibles de la calculadora «Muros y Separaciones de Transformadores — Verificación en Terreno» (`index.html`, función `calcMurosTrafo`).

| Archivo | Qué prueba | Cómo se ejecuta |
|---|---|---|
| `pruebas.js` | Motor de cálculo: 43 pruebas agrupadas según los 8 puntos de la revisión del 28-10-2026 (alcance normativo, fabricante, validación física y ventilación, aceite, datos ausentes, alcance estructural, alternativas, robustez) más la regresión del ejemplo original y la coincidencia hoja impresa / memoria / JSON. | `node pruebas/murosTrafo/pruebas.js` (Node 16 o superior, sin dependencias) |
| `pantalla.js` | La planilla abierta en Chromium: pantalla, hoja impresa y JSON de revisión con las mismas filas y estados; dato fuera de catálogo bloquea exportaciones; botón Rediseño. | `node pruebas/murosTrafo/pantalla.js` (requiere Playwright) |
| `cargar.js` | Carga el bloque del módulo desde `index.html` para usarlo en Node. | — |

Las pruebas leen el `index.html` del repositorio: cualquier cambio al módulo se prueba sin copiar código.
