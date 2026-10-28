// Pruebas del motor «Muros y Separaciones de Transformadores — Verificación en Terreno».
// Uso (desde la raíz del repositorio):  node pruebas/murosTrafo/pruebas.js
// No requiere dependencias: carga el bloque del módulo desde index.html con el módulo vm de Node.
const assert = require('assert');
const M = require('./cargar');
const { calcMurosTrafo: calc, MT_OPC } = M;

let ok = 0, fallas = 0;
function t(nombre, fn) {
  try { fn(); ok++; console.log('  ✓ ' + nombre); }
  catch (e) { fallas++; console.log('  ✗ ' + nombre + '\n      ' + (e && e.message)); }
}
const fila = (r, pre) => r.filas.find(f => f.param.indexOf(pre) === 0);
const filas = (r, pre) => r.filas.filter(f => f.param.indexOf(pre) === 0);
const est = (r, pre) => { const f = fila(r, pre); assert(f, `no existe la fila «${pre}»`); return f.estado; };
const conErr = (r, re) => assert(r.errores && r.errores.some(e => re.test(e)), 'se esperaba error ' + re + '; obtenido: ' + JSON.stringify(r.errores || r.global));
const X = (base, extra) => Object.assign({}, base, extra);

// Entradas originales del ejemplo de la pantalla (Guía caso 4, primera fila de su tabla).
const EJEMPLO = { mt_caso:'4', mt_ambito:'RPTD', mt_P:'2500', mt_aislante:'mineral', mt_ficha:'si', mt_origen:'terreno', mt_consA:'si', mt_hDepA:'2,10', mt_hConsA:'2,80', mt_desA:'0', mt_dosEq:'no', mt_hMuro:'3,20', mt_ric96:'no', mt_cierreRIC:'no', mt_anexo:'no' };
// Caso 8 conforme bajo RIC 13 (13,2 kV), sin exigencia del fabricante adicional.
const C8 = { mt_caso:'8', mt_ambito:'RIC', mt_kV:'13,2', mt_P:'1000', mt_aislante:'mineral', mt_litros:'800', mt_ficha:'si', mt_manual:'si', mt_fabMin:'0', mt_refFab:'Manual M-1 rev. B',
  mt_d8a:'1,5', mt_d8b:'1,5', mt_d8c:'1,5', mt_d8d:'1,5', mt_h8:'2,5', mt_pub8:'no', mt_cuarto8:'si', mt_cf8:'no', mt_anchoEq:'2', mt_fondoEq:'1,5', mt_anchoInt:'5', mt_fondoInt:'4,5',
  mt_abierto8:'sin', mt_enfr8:'si', mt_refTerm:'Cálculo térmico CT-01', mt_base:'0,3', mt_grav:'0,1', mt_gravExt:'1', mt_dren:'si', mt_anexo:'no' };
// Caso 7 sala RIC con transformador seco, ventilación natural, todo conforme.
const C7 = { mt_caso:'7', mt_ambito:'RIC', mt_kV:'13,2', mt_P:'500', mt_aislante:'seco', mt_ficha:'si', mt_manual:'si', mt_fabMin:'0', mt_refFab:'Plano P-2', mt_reg7:'RIC',
  mt_F7m:'120', mt_F7t:'120', mt_F7p:'120', mt_acredF:'si', mt_refF:'Listado Oficial MINVU 2.3.4', mt_L7:'6', mt_B7:'4', mt_H7:'3,5', mt_p7a:'1,2', mt_p7h:'3,2', mt_enf7:'no', mt_bt7:'no',
  mt_puA:'0,9', mt_puH:'2,25', mt_acc7:'no', mt_apA:'2', mt_apH:'2,5', mt_trA:'1,6', mt_trH:'2,2', mt_vent:'natural', mt_sumKVA:'500', mt_Aadm:'0,6', mt_Aevac:'0,6',
  mt_Aterm:'1,0', mt_refTerm:'Cálculo térmico CT-02', mt_hRej:'0,3', mt_malla:'10', mt_pInc:'si', mt_edif7:'no', mt_anexo:'no' };

console.log('0. Regresión del ejemplo original');
t('Ejemplo del caso 4: mismas filas y estados que la versión 27-10-2026', () => {
  const r = calc(EJEMPLO);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(r.filas.map(f => [f.param, f.estado]))), [
    ['Placa y ficha del equipo (kVA, tensiones, aislante, litros, conservador)', 'CUMPLE'],
    ['Ubicación respecto de sitios de habitación', 'NO VERIFICADO'],
    ['Canales recolectores y foso de aceite', 'NO VERIFICADO'],
    ['Coronación del muro: sobrepaso sobre depósito y conservador', 'CUMPLE']]);
  assert.strictEqual(r.global, 'NO VERIFICADO');
  assert.strictEqual(fila(r, 'Coronación').exig, '≥ 3,10 m (2,80 + 0,30)');
});
t('Casos base de las pruebas: C8 y C7 cumplen con todos sus antecedentes', () => {
  assert.strictEqual(calc(C8).global, 'CUMPLE', JSON.stringify(calc(C8).filas.filter(f => f.estado !== 'CUMPLE' && f.estado !== 'NO APLICA')));
  assert.strictEqual(calc(C7).global, 'CUMPLE', JSON.stringify(calc(C7).filas.filter(f => f.estado !== 'CUMPLE' && f.estado !== 'NO APLICA')));
});

console.log('1. Aplicabilidad normativa');
t('Caso 8 bajo RIC 13 con 66 kV: FUERA DE ALCANCE, nunca CUMPLE', () => {
  const r = calc(X(C8, { mt_kV: '66' }));
  assert.strictEqual(r.global, 'FUERA DE ALCANCE');
  assert(!r.filas.some(f => /^RIC 13/.test(f.ref) && f.estado === 'CUMPLE'));
});
t('Umbral de tensión RIC 13: 23 kV dentro, 23,1 kV fuera, sin dato NO VERIFICADO', () => {
  assert.strictEqual(calc(X(C8, { mt_kV: '23' })).global, 'CUMPLE');
  assert.strictEqual(calc(X(C8, { mt_kV: '23,1' })).global, 'FUERA DE ALCANCE');
  const r = calc(X(C8, { mt_kV: '' }));
  assert.strictEqual(r.global, 'NO VERIFICADO');
  assert.strictEqual(est(r, 'Tensión nominal dentro del alcance'), 'NO VERIFICADO');
});
t('Caso RPTD en instalación de consumo: remisión pendiente, declarada o negada', () => {
  const base = X(EJEMPLO, { mt_ambito: 'RIC', mt_kV: '13,2' });
  assert.strictEqual(est(calc(base), 'Coronación'), 'NO VERIFICADO');
  const rr = calc(X(base, { mt_remis: 'remision', mt_hab: 'no', mt_fosoR: 'si', mt_vFosoR: '2000', mt_litros: '1500' }));
  assert.strictEqual(est(rr, 'Coronación'), 'CUMPLE');
  assert.strictEqual(fila(rr, 'Coronación').tipo, 'R');
  assert.strictEqual(fila(calc(X(base, { mt_remis: 'criterio' })), 'Coronación').tipo, 'C');
  assert.strictEqual(est(calc(X(base, { mt_remis: 'no' })), 'Coronación'), 'FUERA DE ALCANCE');
});
t('RPTD 08 §5.4: consumo o no central → FUERA DE ALCANCE; central sin dato → NO VERIFICADO', () => {
  const b = { mt_caso:'11', mt_P:'500', mt_aislante:'mineral', mt_litros:'900', mt_ficha:'si', mt_dEdif:'10' };
  assert.strictEqual(est(calc(X(b, { mt_ambito: 'RIC', mt_kV: '13,2', mt_remis: 'remision' })), 'Separación libre'), 'FUERA DE ALCANCE');
  assert.strictEqual(est(calc(X(b, { mt_ambito: 'RPTD', mt_central: 'no' })), 'Separación libre'), 'FUERA DE ALCANCE');
  assert.strictEqual(est(calc(X(b, { mt_ambito: 'RPTD' })), 'Separación libre'), 'NO VERIFICADO');
  assert.strictEqual(est(calc(X(b, { mt_ambito: 'RPTD', mt_central: 'si' })), 'Separación libre'), 'CUMPLE');
});
t('Umbrales de potencia de la Tabla N°1: 75 → 3 m; 75,5 → 6 m (criterio conservador); 333 → 6 m; 334 → 9 m', () => {
  const b = { mt_caso:'11', mt_ambito:'RPTD', mt_central:'si', mt_aislante:'mineral', mt_litros:'900', mt_ficha:'si', mt_dEdif:'1' };
  const req = P => fila(calc(X(b, { mt_P: P })), 'Separación libre').exig;
  assert(/^≥ 3,00/.test(req('75'))); assert(/^≥ 6,00/.test(req('75,5'))); assert(/^≥ 6,00/.test(req('333'))); assert(/^≥ 9,00/.test(req('334')));
  assert.strictEqual(fila(calc(X(b, { mt_P: '75,5' })), 'Separación libre').tipo, 'C');
  assert.strictEqual(est(calc(X(b, { mt_P: '500', mt_litros: '7600' })), 'Separación libre'), 'FUERA DE ALCANCE');
});
t('Caso 1, §5.1: ≤ 10 MVA o no nueva → FUERA DE ALCANCE (no distancia cero)', () => {
  const b = { mt_caso:'1', mt_ambito:'RPTD', mt_nueva:'si', mt_central:'no', mt_aislante:'mineral', mt_ficha:'si', mt_hayEdif:'si', mt_dEdif:'20', mt_hayTrafo:'no' };
  assert.strictEqual(est(calc(X(b, { mt_P: '10000' })), 'Separación libre'), 'FUERA DE ALCANCE');
  assert.strictEqual(est(calc(X(b, { mt_P: '10001' })), 'Separación libre'), 'CUMPLE');
  assert.strictEqual(est(calc(X(b, { mt_P: '20000', mt_nueva: 'no' })), 'Separación libre'), 'FUERA DE ALCANCE');
  assert.strictEqual(est(calc(X(b, { mt_P: '20000', mt_nueva: '' })), 'Separación libre'), 'NO VERIFICADO');
});
t('Caso RIC (6) en régimen DS 109: FUERA DE ALCANCE', () => {
  assert.strictEqual(calc({ mt_caso:'6', mt_ambito:'RPTD', mt_P:'500', mt_aislante:'seco', mt_ficha:'si', mt_hMuro:'3' }).global, 'FUERA DE ALCANCE');
});

console.log('2. Exigencias del fabricante');
t('Manual de 2,00 m y cuatro retiros de 1,50 m: NO CUMPLE en los cuatro lados y en ancho y fondo', () => {
  const r = calc(X(C8, { mt_fabMin: '2' }));
  assert.strictEqual(r.global, 'NO CUMPLE');
  assert.strictEqual(filas(r, 'Separación al').filter(f => f.estado === 'NO CUMPLE').length, 4);
  assert.strictEqual(fila(r, 'Ancho interior').exig, '≥ 6,00 m (2,00 + 2,00 + 2,00)');
  assert.strictEqual(fila(r, 'Fondo interior').exig, '≥ 5,50 m (1,50 + 2,00 + 2,00)');
  assert.strictEqual(fila(r, 'Separación al muro izquierdo').tipo, 'E');
});
t('Exigencia distinta por orientación: solo el lado izquierdo con 2,50 m', () => {
  const r = calc(X(C8, { mt_fab8a: '2,5' }));
  assert.strictEqual(est(r, 'Separación al muro izquierdo'), 'NO CUMPLE');
  assert.strictEqual(est(r, 'Separación al muro derecho'), 'CUMPLE');
  assert.strictEqual(fila(r, 'Ancho interior').exig, '≥ 6,00 m (2,00 + 2,50 + 1,50)');
  assert.strictEqual(est(r, 'Fondo interior'), 'CUMPLE');
});
t('Exigencia del fabricante sin documento identificado: NO VERIFICADO', () => {
  const r = calc(X(C8, { mt_refFab: '', mt_fabMin: '1' }));
  assert.strictEqual(est(r, 'Exigencias del fabricante'), 'NO VERIFICADO');
  assert.notStrictEqual(r.global, 'CUMPLE');
});
t('Coherencia: dimensión interior distinta de equipo + retiros → NO VERIFICADO', () => {
  const r = calc(X(C8, { mt_anchoInt: '5,4' }));
  assert.strictEqual(est(r, 'Coherencia: ancho'), 'NO VERIFICADO');
  assert.strictEqual(est(r, 'Ancho interior'), 'NO VERIFICADO');
  assert.strictEqual(est(calc(X(C8, { mt_anchoInt: '5,05' })), 'Coherencia: ancho'), 'CUMPLE');
});
t('Dimensión interior menor que el equipo: dato inválido', () => conErr(calc(X(C8, { mt_anchoInt: '1,9' })), /menor que el ancho del equipo/));

console.log('3. Validación física y ventilación');
t('2.500 kVA, suma de potencias 0: dato inválido', () => conErr(calc(X(C7, { mt_P: '2500', mt_sumKVA: '0' })), /mayor que 0/));
t('Suma de potencias menor que la del equipo: dato inválido', () => conErr(calc(X(C7, { mt_P: '2500', mt_sumKVA: '1000' })), /menor que la potencia del equipo/));
t('2.500 kVA con 0,10 m² de ventilación: NO CUMPLE (exige 5,00 m²)', () => {
  const r = calc(X(C7, { mt_P: '2500', mt_sumKVA: '2500', mt_Aadm: '0,05', mt_Aevac: '0,05' }));
  assert.strictEqual(est(r, 'Superficie libre de ventilación natural'), 'NO CUMPLE');
  assert(/5,00 m²/.test(fila(r, 'Superficie libre de ventilación natural').exig));
});
t('Umbral 20 cm²/kVA con mínimo 0,10 m²: 50 kVA → 0,10; 51 kVA → 0,102', () => {
  const ex = P => fila(calc(X(C7, { mt_P: P, mt_sumKVA: P })), 'Superficie libre de ventilación natural').exig;
  assert(/≥ 0,10 m²/.test(ex('50'))); assert(/0,102|0,10 m² = máx/.test(ex('51')));
  const r = calc(X(C7, { mt_P: '51', mt_sumKVA: '51', mt_Aadm: '0,05', mt_Aevac: '0,05', mt_Aterm: '0,1' }));
  assert.strictEqual(est(r, 'Superficie libre de ventilación natural'), 'NO CUMPLE');
});
t('Volumen 0 o caudal 0: inválido o NO CUMPLE, nunca conforme', () => {
  const f = X(C7, { mt_vent: 'forzada', mt_Aadm: '', mt_Aevac: '', mt_Aterm: '', mt_Qterm: '2000' });
  conErr(calc(X(f, { mt_vol: '0', mt_Q: '0' })), /mayor que 0/);
  const r = calc(X(f, { mt_vol: '84', mt_Q: '0' }));
  assert.strictEqual(est(r, 'Caudal de ventilación forzada'), 'NO CUMPLE');
  assert.strictEqual(est(calc(X(f, { mt_vol: '84', mt_Q: '1680' })), 'Caudal de ventilación forzada'), 'CUMPLE');
  assert.strictEqual(est(calc(X(f, { mt_vol: '84', mt_Q: '1679' })), 'Caudal de ventilación forzada'), 'NO CUMPLE');
});
t('Volumen incoherente con las dimensiones: NO VERIFICADO y caudal con el mayor volumen', () => {
  const r = calc(X(C7, { mt_vent: 'forzada', mt_vol: '50', mt_Q: '1700', mt_Qterm: '1000' }));
  assert.strictEqual(est(r, 'Coherencia del volumen'), 'NO VERIFICADO');
  assert(/1\.680 m³\/h/.test(fila(r, 'Caudal de ventilación forzada').exig));
});
t('Mínimo reglamentario y suficiencia térmica separados', () => {
  const sinT = calc(X(C7, { mt_Aterm: '' }));
  assert.strictEqual(est(sinT, 'Superficie libre de ventilación natural'), 'CUMPLE');
  assert.strictEqual(est(sinT, 'Superficie libre frente a la necesidad térmica'), 'NO VERIFICADO');
  assert.notStrictEqual(sinT.global, 'CUMPLE');
  const r = calc(X(C7, { mt_Aterm: '1,5' }));
  assert.strictEqual(est(r, 'Superficie libre de ventilación natural'), 'CUMPLE');
  assert.strictEqual(est(r, 'Superficie libre frente a la necesidad térmica'), 'NO CUMPLE');
});
t('Temperatura de ignición clase K: 300 °C no cumple, 300,1 °C cumple', () => {
  const b = X(C7, { mt_aislante: 'claseK', mt_litros: '600', mt_foso: 'si', mt_fosoTipo: 'comun', mt_vMax: '600', mt_vOtros: '0', mt_vFoso: '700' });
  assert.strictEqual(est(calc(X(b, { mt_tIgn: '300' })), 'Temperatura de ignición'), 'NO CUMPLE');
  assert.strictEqual(est(calc(X(b, { mt_tIgn: '300,1' })), 'Temperatura de ignición'), 'CUMPLE');
});
t('Dimensiones no físicas: altura 0, número con texto, alturas mayores que el recinto', () => {
  conErr(calc(X(EJEMPLO, { mt_hMuro: '0' })), /mayor que 0/);
  conErr(calc(X(EJEMPLO, { mt_hMuro: '3,2 m' })), /debe ser un número/);
  conErr(calc(X(C7, { mt_puH: '3,6' })), /mayor que la altura interior/);
});

console.log('4. Contención de aceite (RIC 13 §§8.8–8.9)');
const C7A = X(C7, { mt_aislante: 'claseK', mt_tIgn: '330', mt_litros: '1500', mt_vMax: '1500', mt_vOtros: '0' });
t('Umbral de 0,10 m sin litros ni superficie: no acredita contención', () => {
  const r = calc(X(C7A, { mt_foso: 'no', mt_fosoImp: 'si', mt_umbral: '0,10', mt_vMax: '', mt_disp: 'si' }));
  assert.strictEqual(est(r, 'Altura del umbral'), 'CUMPLE');
  assert.strictEqual(est(r, 'Aceite retenido por el umbral'), 'NO VERIFICADO');
  assert.notStrictEqual(r.global, 'CUMPLE');
});
t('Umbral de 0,10 m sobre 10 m² retiene 1.000 L < 1.500 L: NO CUMPLE; alternativa 0,15 m', () => {
  const r = calc(X(C7A, { mt_foso: 'no', mt_fosoImp: 'si', mt_umbral: '0,10', mt_Apiso: '10', mt_disp: 'si' }));
  assert.strictEqual(est(r, 'Aceite retenido por el umbral'), 'NO CUMPLE');
  const a = r.alternativas.find(x => /umbral/.test(x.param));
  assert(a && a.cambios.mt_umbral === 0.15, JSON.stringify(a));
  assert.notStrictEqual(a.resultado, 'CUMPLE');
  assert.strictEqual(est(calc(X(C7A, { mt_foso: 'no', mt_fosoImp: 'si', mt_umbral: '0,15', mt_Apiso: '10', mt_disp: 'si' })), 'Aceite retenido'), 'CUMPLE');
});
t('Umbral sin imposibilidad documentada de fosos, o sin disposición del aceite', () => {
  const b = X(C7A, { mt_foso: 'no', mt_umbral: '0,2', mt_Apiso: '10', mt_disp: 'si' });
  assert.strictEqual(est(calc(X(b, { mt_fosoImp: 'no' })), 'Condición para usar el umbral'), 'NO CUMPLE');
  assert.strictEqual(est(calc(X(b, { mt_fosoImp: '' })), 'Condición para usar el umbral'), 'NO VERIFICADO');
  assert.strictEqual(est(calc(X(b, { mt_fosoImp: 'si', mt_disp: '' })), 'Evacuación del aceite'), 'NO VERIFICADO');
});
t('Foso común: V ≥ mayor + 30 % de los demás (1.000 + 0,3 × 500 = 1.150 L)', () => {
  const b = X(C7A, { mt_foso: 'si', mt_fosoTipo: 'comun', mt_litros: '1000', mt_vMax: '1000', mt_vOtros: '500' });
  assert.strictEqual(est(calc(X(b, { mt_vFoso: '1149' })), 'Capacidad útil neta'), 'NO CUMPLE');
  assert.strictEqual(est(calc(X(b, { mt_vFoso: '1150' })), 'Capacidad útil neta'), 'CUMPLE');
  assert.strictEqual(est(calc(X(b, { mt_vFoso: '1150', mt_fosoTipo: '' })), 'Capacidad útil neta'), 'NO VERIFICADO');
});
t('Aceite total menor que el del equipo verificado: dato inválido', () => conErr(calc(X(C7A, { mt_foso: 'si', mt_fosoTipo: 'comun', mt_vMax: '1000', mt_vOtros: '0', mt_vFoso: '2000' })), /menor que el aceite del equipo/));
t('Aceite 0 L con aislante líquido: dato inválido', () => conErr(calc(X(C7A, { mt_litros: '0' })), /incompatible/));

console.log('5. Datos ausentes y respaldos');
t('Caso 7: clasificación del acceso vacía no equivale a «no»', () => {
  const b = X(C7, { mt_acc7: '' });
  const r = calc(X(b, { mt_puH: '2,15' }));
  assert.strictEqual(est(r, 'Puerta de acceso: alto'), 'NO VERIFICADO');
  assert.strictEqual(est(r, 'Clasificación del acceso'), 'NO VERIFICADO');
  assert.notStrictEqual(r.global, 'CUMPLE');
  assert.strictEqual(est(calc(X(b, { mt_puH: '2,05' })), 'Puerta de acceso: alto'), 'NO CUMPLE');
  assert.strictEqual(est(calc(X(b, { mt_puH: '2,25' })), 'Puerta de acceso: alto'), 'CUMPLE');
  assert.strictEqual(est(calc(X(C7, { mt_acc7: 'si', mt_puH: '2,15' })), 'Puerta de acceso: alto'), 'NO CUMPLE');
  assert.strictEqual(fila(calc(X(C7, { mt_acc7: 'si', mt_puH: '2,25' })), 'Puerta de acceso: alto').ref, 'RIC 02 §5.4.4');
});
t('Selectores vacíos que antes se tomaban como «no»: segundo equipo, RIC 13 §9.6, NFPA 850', () => {
  assert.strictEqual(est(calc(X(EJEMPLO, { mt_dosEq: '' })), 'Coronación'), 'NO VERIFICADO');
  assert.strictEqual(est(calc(X(EJEMPLO, { mt_ambito: 'RIC', mt_kV: '13,2', mt_remis: 'remision', mt_ric96: '' })), 'Muro entre transformadores'), 'NO VERIFICADO');
  const c3 = { mt_caso:'3', mt_ambito:'RPTD', mt_P:'2500', mt_aislante:'mineral', mt_ficha:'si', mt_cfg3:'alineados', mt_w3:'3', mt_e1:'0,7', mt_e2:'0,7' };
  assert.strictEqual(est(calc(c3), 'Método para la longitud'), 'NO VERIFICADO');
});
t('Exigencias del estudio sin documento identificado: NO VERIFICADO', () => {
  const r = calc(X(EJEMPLO, { mt_hEstudio: '3' }));
  assert.strictEqual(est(r, 'Coronación exigida por el estudio'), 'NO VERIFICADO');
  assert.strictEqual(est(calc(X(EJEMPLO, { mt_hEstudio: '3', mt_refEst: 'Estudio EI-07' })), 'Coronación exigida por el estudio'), 'CUMPLE');
});
t('Desnivel no informado: no se supone cero', () => assert.strictEqual(est(calc(X(EJEMPLO, { mt_desA: '' })), 'Coronación'), 'NO VERIFICADO'));

console.log('6. Alcance estructural (caso 10)');
const C10 = { mt_caso:'10', mt_ambito:'RIC', mt_kV:'13,2', mt_P:'500', mt_aislante:'mineral', mt_ficha:'si', mt_fun10:'aceite94', mt_mat10:'hormigon', mt_esp10:'0,2', mt_espF10:'0,15', mt_refF:'Informe IF-3', mt_espE10:'0,18', mt_refEstr:'Memoria ME-9' };
t('Espesores requeridos iguales a cero: datos inválidos', () => {
  conErr(calc(X(C10, { mt_espE10: '0' })), /mayor que 0/);
  conErr(calc(X(C10, { mt_espF10: '0' })), /mayor que 0/);
});
t('Comparación de espesores declarada como tal y verificación estructural fuera de alcance', () => {
  const r = calc(C10);
  assert.strictEqual(r.global, 'CUMPLE');
  assert(/no se verifican en este módulo/.test(fila(r, 'Espesor frente al requerido').obs));
  assert(r.fueraAlcance.some(x => /flexión, corte, estabilidad/.test(x) && /fundación/.test(x)));
  assert.strictEqual(est(calc(X(C10, { mt_refEstr: '' })), 'Espesor frente al requerido'), 'NO VERIFICADO');
});

console.log('7. Alternativas y esquemas');
t('Altura insuficiente: alternativa recalculada, condicionada a estabilidad, nunca «cumple»', () => {
  const r = calc(X(EJEMPLO, { mt_hMuro: '2,9' }));
  const a = r.alternativas.find(x => /Coronación/.test(x.param));
  assert(a && a.cambios.mt_hMuro === 3.1, JSON.stringify(a && a.cambios));
  assert(a.mod && a.obj && a.fundamento && a.cond.length);
  assert(a.cond.some(c => /estabilidad, flexión, corte/.test(c)));
  assert.strictEqual(a.resultado, 'CONDICIONADA');
  r.alternativas.forEach(x => assert(!/^CUMPLE/.test(x.resultado)));
});
t('Alternativa de retiro: desplaza el muro, recalcula el ancho interior y mantiene la coherencia', () => {
  const r = calc(X(C8, { mt_d8a: '1,2', mt_anchoInt: '4,7' }));
  const a = r.alternativas.find(x => /izquierdo/.test(x.param));
  assert.strictEqual(JSON.stringify(a.cambios), JSON.stringify({ mt_d8a: 1.5, mt_anchoInt: 5 }));
  assert.strictEqual(a.globalTras, 'CUMPLE');
  assert.strictEqual(a.resultado, 'CONDICIONADA');
});
t('Esquema del caso 8 con medidas, exigencias y estado de coherencia', () => {
  const r = calc(X(C8, { mt_fabMin: '2' }));
  const s = M.mtEsquemas(X(C8, { mt_fabMin: '2' }), r).map(x => x.svg).join('');
  assert(/1,50 m/.test(s) && /≥ 2,00 m \(fabricante\)/.test(s) && /a escala/.test(s) && /coherencia ancho/.test(s));
});

console.log('8. Robustez, catálogos y exportaciones');
t('Valor desconocido en mt_fun10: dato inválido, sin excepción', () => conErr(calc(X(C10, { mt_fun10: 'xyz' })), /no reconocido/));
t('Todos los selectores rechazan valores fuera de catálogo', () => {
  Object.keys(MT_OPC).filter(k => k !== 'mt_caso').forEach(k => conErr(calc(X(C8, { [k]: '__x__' })), /no reconocido/));
  conErr(calc(X(C8, { mt_pub8: 'quizas' })), /no reconocido/);
});
t('Caso 7: espacio de trabajo BT no desaparece con el anexo desactivado', () => {
  const r = calc(X(C7, { mt_bt7: 'si', mt_bt7T: 'bt2', mt_bt7a: '1,0', mt_anexo: 'no' }));
  assert.strictEqual(est(r, 'Espacio de trabajo BT'), 'NO CUMPLE');
  assert.strictEqual(est(calc(X(C7, { mt_bt7: '' })), 'Tableros con partes energizadas'), 'NO VERIFICADO');
});
t('Barrido de 3.000 entradas aleatorias en los 11 casos: sin excepciones', () => {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ids = Object.keys(M.MT_LBL);
  for (let i = 0; i < 3000; i++) {
    const inp = { mt_caso: String(1 + (i % 11)) };
    ids.forEach(id => { if (id === 'mt_caso' || rnd() < 0.4) return;
      const cat = MT_OPC[id]; const r = rnd();
      inp[id] = cat ? (r < 0.9 ? Object.keys(cat)[Math.floor(rnd() * Object.keys(cat).length)] : 'zz') : (r < 0.5 ? (rnd() * 10).toFixed(2).replace('.', ',') : (r < 0.8 ? ['si', 'no', ''][Math.floor(rnd() * 3)] : ['-1', '0', 'abc', '1e9'][Math.floor(rnd() * 4)])); });
    const r = calc(inp);
    assert(r.errores || ['CUMPLE', 'NO CUMPLE', 'NO VERIFICADO', 'FUERA DE ALCANCE'].indexOf(r.global) >= 0);
    if (!r.errores) M.mtEsquemas(inp, r);
  }
});
t('Hoja impresa, memoria y JSON reflejan las mismas entradas y resultados', () => {
  [EJEMPLO, X(C8, { mt_fabMin: '2' }), X(C8, { mt_kV: '66' }), X(C7, { mt_acc7: '' }), C10].forEach(inp => {
    const r = calc(inp);
    M.buildPrintSheetsMurosTrafo(inp, r);
    const [datos, completo] = M.ctx.__hojas;
    const mem = M.mtMemoriaHtml(inp, r, {});
    const plano = h => h.replace(/<[^>]+>/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    r.filas.forEach(f => {
      [completo, mem].forEach((h, k) => assert(plano(h).indexOf(f.param) >= 0 && plano(h).indexOf(f.exig) >= 0, `${k ? 'memoria' : 'hoja'}: falta «${f.param}»`));
    });
    assert(plano(completo).indexOf(r.global) >= 0 && plano(mem).indexOf(r.global) >= 0);
    (r.alternativas || []).forEach(a => assert(plano(completo).indexOf(a.obj) >= 0 && plano(mem).indexOf(a.obj) >= 0, 'falta alternativa ' + a.param));
    Object.keys(inp).filter(k => k !== 'mt_caso' && String(inp[k]).trim()).forEach(k => {
      if (r.usados.indexOf(k) >= 0) assert(plano(datos).indexOf(M.MT_LBL[k]) >= 0, 'hoja de datos sin ' + k);
    });
    const j = JSON.parse(JSON.stringify(r));
    assert.strictEqual(j.global, r.global); assert.strictEqual(j.filas.length, r.filas.length);
  });
});

console.log(`\n${ok} pruebas correctas, ${fallas} con falla.`);
process.exit(fallas ? 1 : 0);
