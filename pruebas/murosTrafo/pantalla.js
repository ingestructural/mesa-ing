// Prueba en navegador: la pantalla, la hoja impresa y el JSON de revisión muestran las mismas entradas y resultados.
// Uso (desde la raíz del repositorio, con Playwright instalado):  node pruebas/murosTrafo/pantalla.js
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  await page.goto('file://' + path.join(__dirname, '..', '..', 'index.html') + '#muros-transformadores');
  await page.waitForSelector('#mt_caso', { timeout: 30000 });
  let fallas = 0;
  const check = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

  // Lee la tabla de pantalla, la hoja impresa completa y el objeto de resultados.
  const leer = () => page.evaluate(() => {
    const pant = [...document.querySelectorAll('#mt_tabla table.results tr')].filter(tr => tr.querySelector('.chip'))
      .map(tr => [tr.cells[0].firstChild.textContent.trim(), tr.querySelector('.chip').textContent.trim()]);
    const hoja = [...document.querySelectorAll('#printSheetCompleto tr.xlsx-estado')].filter(tr => tr.cells.length >= 6 && !tr.classList.contains('xlsx-estado-global'))
      .map(tr => [tr.cells[0].textContent.trim(), tr.cells[5].textContent.trim()]);
    const r = window.REV_RESULTADOS.murosTrafo();
    return { pant, hoja, json: r.filas.map(f => [f.param, f.estado]), global: r.global,
      globalPant: (document.querySelector('#mt_global .global-verdict .label:last-child') || {}).textContent,
      alt: document.querySelectorAll('#mt_alt .panel').length, nAlt: (r.alternativas || []).length,
      esquema: document.getElementById('mt_esquema').innerHTML.length };
  });
  const fijar = vals => page.evaluate(v => {
    Object.entries(v).forEach(([id, x]) => { const el = document.getElementById(id); if (el) { el.value = x; el.dispatchEvent(new Event('change', { bubbles: true })); } });
  }, vals);

  console.log('Ejemplo original al abrir la planilla');
  let d = await leer();
  check(d.global === 'NO VERIFICADO' && d.globalPant === d.global, `estado global ${d.global} en pantalla y en el resultado`);
  check(JSON.stringify(d.pant) === JSON.stringify(d.json), 'pantalla = resultado');
  check(JSON.stringify(d.hoja) === JSON.stringify(d.json), 'hoja impresa = resultado');

  console.log('Caso 8, 66 kV bajo RIC 13, fabricante 2,00 m y retiros de 1,50 m');
  await fijar({ mt_caso: '8' });
  await fijar({ mt_ambito: 'RIC', mt_kV: '66', mt_P: '1000', mt_aislante: 'mineral', mt_litros: '800', mt_ficha: 'si', mt_manual: 'si', mt_fabMin: '2', mt_refFab: 'Manual M-1',
    mt_d8a: '1,5', mt_d8b: '1,5', mt_d8c: '1,5', mt_d8d: '1,5', mt_h8: '2,5', mt_pub8: 'no', mt_cuarto8: 'si', mt_cf8: 'no', mt_anchoEq: '2', mt_fondoEq: '1,5', mt_anchoInt: '5', mt_fondoInt: '4,5',
    mt_abierto8: 'sin', mt_enfr8: 'si', mt_refTerm: 'CT-1', mt_base: '0,3', mt_grav: '0,1', mt_gravExt: '1', mt_dren: 'si' });
  d = await leer();
  check(d.global === 'FUERA DE ALCANCE' && d.globalPant === d.global, `66 kV: ${d.global}`);
  check(JSON.stringify(d.pant) === JSON.stringify(d.json) && JSON.stringify(d.hoja) === JSON.stringify(d.json), 'pantalla = hoja = resultado');
  await fijar({ mt_kV: '13,2' });
  d = await leer();
  check(d.global === 'NO CUMPLE', `13,2 kV con fabricante 2,00 m: ${d.global}`);
  check(d.alt === d.nAlt && d.nAlt >= 4, `alternativas en pantalla: ${d.alt} de ${d.nAlt}`);
  check(d.esquema > 1000, 'esquema dibujado');
  check(JSON.stringify(d.pant) === JSON.stringify(d.json) && JSON.stringify(d.hoja) === JSON.stringify(d.json), 'pantalla = hoja = resultado');

  console.log('Dato inválido en catálogo');
  await page.evaluate(() => { const el = document.getElementById('mt_pub8'); const o = document.createElement('option'); o.value = 'zz'; el.appendChild(o); el.value = 'zz'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  const bloq = await page.evaluate(() => ({ err: document.getElementById('mt_errores').textContent, b: !!document.querySelector('#printSheetCompleto [data-calc-bloqueo]') }));
  check(/no reconocido/.test(bloq.err) && bloq.b, 'valor fuera de catálogo: datos inválidos y exportación bloqueada');

  console.log('Botón Rediseño');
  await fijar({ mt_pub8: 'no' });
  const btn = await page.$('#solBtn');
  if (btn) { await btn.click(); await page.waitForTimeout(300); check(!(await page.$('#solOv')), 'Rediseño lleva al panel de alternativas del módulo (no varía datos de terreno)'); }
  check(!errores.length, 'sin errores de JavaScript' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await page.screenshot({ path: path.join(require('os').tmpdir(), 'pantalla-caso8.png'), fullPage: false });
  await browser.close();
  console.log(fallas ? `\n${fallas} comprobación(es) con falla.` : '\nTodas las comprobaciones de pantalla correctas.');
  process.exit(fallas ? 1 : 0);
})();
