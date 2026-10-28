// Carga el motor de «Muros y Separaciones de Transformadores» desde index.html, sin navegador.
// Uso: const M = require('./cargar'); M.calcMurosTrafo({ ... })
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const ini = html.indexOf('// ===================== MUROS Y SEPARACIONES DE TRANSFORMADORES');
const fin = html.indexOf('function renderMurosTrafo(');
if (ini < 0 || fin < 0) throw new Error('No se encontró el bloque del módulo en index.html');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ctx = { console, esc, fmt2: x => Number(x).toFixed(2).replace('.', ','), PROYECTO_META: {},
  ESQ: { svg: (f) => '<svg>' + f({}) + '</svg>', text: () => '', dim: () => '' },
  xlsxSetPrintSheets: (a, b, c) => { ctx.__hojas = [a, b, c]; },
  MEM_N: 0, MEM_CSS: '', MEM_T: t => `<h3>${t}</h3>`, MEM_F: t => `<p>${t}</p>`, memPortada: () => '', memFirmas: () => '', memFinalizar: h => h, memBarras: () => '' };
vm.createContext(ctx);
vm.runInContext(html.slice(ini, fin) + '\nthis.__exp = { calcMurosTrafo, mtCalcBase, mtEsquemas, mtMemoriaHtml, buildPrintSheetsMurosTrafo, mtCalculoHtml, mtDatosHtml, MT_ST, MT_OPC, MT_LBL };', ctx, { filename: 'murosTrafo.js' });
module.exports = Object.assign({ ctx }, ctx.__exp);
