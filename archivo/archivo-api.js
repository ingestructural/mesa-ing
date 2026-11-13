/* =========================================================================
   Archivo ING — acceso a los documentos emitidos en POWER (Supabase, tabla docs)
   Lo usan la app «Archivo ING» (archivo/index.html) y la Mesa de Cálculo
   (index.html, para archivar cada memoria emitida).

   Colecciones (columna col de la tabla docs, una fila por documento emitido):
     planos_pdf        PDF del comando PDF de AutoCAD (los sube ING_ARCHIVO.ps1)
     memorias_pdf      memorias de la Mesa de Cálculo (PDF y Word)
     informes_pdf      informes y documentos generales (los sube ING_ARCHIVO.ps1 desde
                       Documentos\Archivo ING\Bandeja, o a mano desde la app)
     cotizaciones_pdf  PDF del Cotizador (las archiva el propio Cotizador)
   Cada fila: data = {meta:{...}, b64:"<archivo en base64>"}; el listado lee solo meta.

   Sesión: la misma cuenta de POWER. Se guarda en localStorage («ing_archivo_sess»),
   que comparten la Mesa y el Archivo por estar en el mismo sitio.
   Cola: si no hay sesión o no hay internet, el documento queda en IndexedDB
   («ing_archivo», almacén «cola») y se sube al iniciar sesión o al abrir el Archivo.
   ========================================================================= */
(function (g) {
  'use strict';
  var CFG = {url: 'https://tayuwtdfeworgvnzmwkz.supabase.co', key: 'sb_publishable_bjPqOTlpvh2GdhlZyH9PjQ_CI8G-71h'};
  var K_S = 'ing_archivo_sess';
  var COLS = {planos_pdf: 'Plano (AutoCAD)', memorias_pdf: 'Memoria de cálculo', informes_pdf: 'Informe', cotizaciones_pdf: 'Cotización'};

  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var sess = lsGet(K_S);

  function err(msg, code) { var e = new Error(msg); if (code) e.code = code; return e; }
  function hdr(auth) { var h = {apikey: CFG.key, 'Content-Type': 'application/json'}; if (auth && sess) h.Authorization = 'Bearer ' + sess.access_token; return h; }

  async function auth(grant, body) {
    var r = await fetch(CFG.url + '/auth/v1/token?grant_type=' + grant, {method: 'POST', headers: hdr(false), body: JSON.stringify(body)});
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw err(j.error_description || j.msg || j.message || ('Error ' + r.status), 'auth');
    sess = {access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || (Date.now() / 1000 + (j.expires_in || 3600)),
      email: j.user && j.user.email, uid: j.user && j.user.id};
    lsSet(K_S, sess); return sess;
  }
  async function ensure() {
    sess = lsGet(K_S) || sess;   // otra pestaña pudo renovarla
    if (!sess) throw err('Sin sesión', 'auth');
    if (sess.expires_at - Date.now() / 1000 < 90) {
      try { await auth('refresh_token', {refresh_token: sess.refresh_token}); }
      catch (e) { sess = null; lsSet(K_S, null); throw err('La sesión expiró: vuelva a iniciar sesión', 'auth'); }
    }
  }
  async function req(path, opt) {
    await ensure();
    opt = opt || {}; opt.headers = Object.assign(hdr(true), opt.headers || {});
    var r = await fetch(CFG.url + '/rest/v1/' + path, opt);
    if (r.status === 401) { sess = null; lsSet(K_S, null); throw err('La sesión expiró: vuelva a iniciar sesión', 'auth'); }
    if (!r.ok) { var t = await r.text().catch(function () { return ''; }); throw err(t || ('Error ' + r.status)); }
    return r;
  }

  /* ---------- archivos ---------- */
  function blobB64(b) { return new Promise(function (ok, ko) { var r = new FileReader(); r.onload = function () { ok(String(r.result).split(',')[1] || ''); }; r.onerror = function () { ko(r.error); }; r.readAsDataURL(b); }); }
  function b64Blob(t, mime) { var bin = atob(t), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], {type: mime || 'application/pdf'}); }
  function mimeDe(nombre) {
    var n = String(nombre || '').toLowerCase();
    if (/\.pdf$/.test(n)) return 'application/pdf';
    if (/\.docx$/.test(n)) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (/\.xlsx$/.test(n)) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    return 'application/octet-stream';
  }
  function nuevoId(nombre) {
    var ts = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 17);
    var s = String(nombre || 'doc').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60);
    return ts + '_' + Math.random().toString(36).slice(2, 6) + '_' + s;
  }

  async function subir(col, meta, blob) {
    // cotizaciones: las del Cotizador las archiva el propio Cotizador; aquí solo las subidas a mano (origen manual)
    if (!COLS[col] || (col === 'cotizaciones_pdf' && (meta || {}).origen !== 'manual')) throw err('Colección no válida: ' + col);
    await ensure();
    if (!sess.uid) throw err('Vuelva a iniciar sesión', 'auth');
    var m = Object.assign({}, meta || {});
    m.guardado = m.guardado || new Date().toISOString();
    m.archivo = m.archivo || 'documento.pdf';
    m.mime = m.mime || blob.type || mimeDe(m.archivo);
    m.kb = Math.round(blob.size / 1024);
    var id = m.idArchivo || nuevoId(m.archivo); delete m.idArchivo;
    await req('docs?on_conflict=owner,col,id', {method: 'POST', headers: {Prefer: 'resolution=merge-duplicates,return=minimal'},
      body: JSON.stringify([{owner: sess.uid, col: col, id: id, data: {meta: m, b64: await blobB64(blob)}, updated_at: new Date().toISOString()}])});
    return id;
  }

  async function listar(cols) {
    cols = cols || Object.keys(COLS);
    var out = [], step = 1000;
    for (var from = 0; ; from += step) {
      var r = await req('docs?select=id,col,meta:data->meta&col=in.(' + cols.join(',') + ')&order=id.desc&offset=' + from + '&limit=' + step);
      var b = await r.json(); out.push.apply(out, b.map(function (x) { return Object.assign({id: x.id, col: x.col}, x.meta || {}); }));
      if (b.length < step) break;
    }
    return out;
  }
  async function obtener(col, id, mime) {
    var r = await req('docs?select=b64:data->>b64,meta:data->meta&col=eq.' + encodeURIComponent(col) + '&id=eq.' + encodeURIComponent(id));
    var j = await r.json(); if (!j[0] || !j[0].b64) throw err('Documento no encontrado');
    return b64Blob(j[0].b64, mime || (j[0].meta && j[0].meta.mime) || 'application/pdf');
  }
  // borra el documento archivado (en cotizaciones_pdf solo el PDF del registro; la cotización sigue en el Cotizador)
  async function borrar(col, id) {
    if (!COLS[col]) throw err('Colección no válida: ' + col);
    await req('docs?col=eq.' + encodeURIComponent(col) + '&id=eq.' + encodeURIComponent(id), {method: 'DELETE'});
  }
  async function editarMeta(col, id, cambios) {
    var r = await req('docs?select=data&col=eq.' + encodeURIComponent(col) + '&id=eq.' + encodeURIComponent(id));
    var j = await r.json(); if (!j[0]) throw err('Documento no encontrado');
    if (col === 'cotizaciones_pdf' && (j[0].data.meta || {}).origen !== 'manual') throw err('Las cotizaciones se administran en el Cotizador');
    var d = j[0].data; d.meta = Object.assign({}, d.meta, cambios);
    await req('docs?col=eq.' + encodeURIComponent(col) + '&id=eq.' + encodeURIComponent(id), {method: 'PATCH', headers: {Prefer: 'return=minimal'},
      body: JSON.stringify({data: d, updated_at: new Date().toISOString()})});
    return d.meta;
  }
  // reemplaza el archivo de un documento ya archivado (p. ej. la versión firmada desde la app), mismo registro
  async function reemplazarArchivo(col, id, blob, cambios) {
    var r = await req('docs?select=data&col=eq.' + encodeURIComponent(col) + '&id=eq.' + encodeURIComponent(id));
    var j = await r.json(); if (!j[0]) throw err('Documento no encontrado');
    if (col === 'cotizaciones_pdf' && (j[0].data.meta || {}).origen !== 'manual') throw err('Las cotizaciones se administran en el Cotizador');
    var d = j[0].data; d.meta = Object.assign({}, d.meta, cambios || {}, {kb: Math.round(blob.size / 1024)}); d.b64 = await blobB64(blob);
    await req('docs?col=eq.' + encodeURIComponent(col) + '&id=eq.' + encodeURIComponent(id), {method: 'PATCH', headers: {Prefer: 'return=minimal'},
      body: JSON.stringify({data: d, updated_at: new Date().toISOString()})});
    return d.meta;
  }
  // cambia el tipo de un documento (p. ej. subido como plano y era informe): solo cambia la columna col de la fila
  async function mover(col, id, nueva) {
    if (col === 'cotizaciones_pdf' || nueva === 'cotizaciones_pdf' || !COLS[nueva]) throw err('No se puede cambiar a ese tipo');
    if (col === nueva) return;
    await req('docs?col=eq.' + encodeURIComponent(col) + '&id=eq.' + encodeURIComponent(id), {method: 'PATCH', headers: {Prefer: 'return=minimal'},
      body: JSON.stringify({col: nueva, updated_at: new Date().toISOString()})});
  }
  async function proyectos() {
    var r = await req('docs?select=id,data&col=eq.proyectos&limit=5000');
    return (await r.json()).map(function (x) { return Object.assign({id: x.id}, x.data || {}); });
  }

  /* ---------- configuración compartida con el Cotizador (colección cotizador_config) ----------
     Hoy se usa para la firma escaneada (documento «firma»: {png, w, h, ubic}), la misma en la Mesa y el Cotizador. */
  async function configLeer(id) {
    var r = await req('docs?select=data&col=eq.cotizador_config&id=eq.' + encodeURIComponent(id));
    var j = await r.json(); return j[0] ? j[0].data : null;
  }
  async function configGuardar(id, data) {
    await ensure();
    if (!sess.uid) throw err('Vuelva a iniciar sesión', 'auth');
    await req('docs?on_conflict=owner,col,id', {method: 'POST', headers: {Prefer: 'resolution=merge-duplicates,return=minimal'},
      body: JSON.stringify([{owner: sess.uid, col: 'cotizador_config', id: id, data: data, updated_at: new Date().toISOString()}])});
  }

  /* ---------- cola local (IndexedDB) ---------- */
  function idb() {
    return new Promise(function (ok, ko) {
      if (!g.indexedDB) return ko(err('Este navegador no guarda la cola'));
      var o = g.indexedDB.open('ing_archivo', 1);
      o.onupgradeneeded = function () { o.result.createObjectStore('cola', {keyPath: 'k', autoIncrement: true}); };
      o.onsuccess = function () { ok(o.result); }; o.onerror = function () { ko(o.error); };
    });
  }
  async function tx(modo, fn) {
    var db = await idb();
    return new Promise(function (ok, ko) { var t = db.transaction('cola', modo), s = t.objectStore('cola'), r = fn(s);
      t.oncomplete = function () { db.close(); ok(r && r.result); }; t.onerror = function () { db.close(); ko(t.error); }; });
  }
  function encolar(col, meta, blob) { return tx('readwrite', function (s) { return s.add({col: col, meta: meta, blob: blob, t: Date.now()}); }); }
  function cola() { return tx('readonly', function (s) { return s.getAll(); }); }
  function quitarCola(k) { return tx('readwrite', function (s) { return s.delete(k); }); }
  var vaciando = null;
  function vaciarCola() {
    if (vaciando) return vaciando;
    vaciando = (async function () {
      var n = 0, L = [];
      try { L = await cola(); } catch (e) { return 0; }
      for (var i = 0; i < L.length; i++) {
        try { await subir(L[i].col, L[i].meta, L[i].blob); await quitarCola(L[i].k); n++; }
        catch (e) { if (e.code === 'auth') break; }
      }
      return n;
    })().finally(function () { vaciando = null; });
    return vaciando;
  }
  /* Archiva o, si no se puede ahora, deja en la cola. Devuelve 'subido' | 'cola'. */
  async function archivar(col, meta, blob) {
    meta = Object.assign({guardado: new Date().toISOString()}, meta || {});
    try { await subir(col, meta, blob); vaciarCola(); return 'subido'; }
    catch (e) {
      try { await encolar(col, meta, blob); } catch (e2) { throw e; }
      return 'cola';
    }
  }

  g.INGArchivo = {
    COLS: COLS, mimeDe: mimeDe,
    get conectado() { sess = lsGet(K_S) || sess; return !!sess; },
    get email() { return sess && sess.email; },
    login: function (email, password) { return auth('password', {email: email, password: password}); },
    logout: function () { sess = null; lsSet(K_S, null); },
    configLeer: configLeer, configGuardar: configGuardar,
    subir: subir, listar: listar, obtener: obtener, borrar: borrar, editarMeta: editarMeta, reemplazarArchivo: reemplazarArchivo, mover: mover, proyectos: proyectos,
    archivar: archivar, cola: cola, quitarCola: quitarCola, vaciarCola: vaciarCola,
    _cfg: CFG
  };
})(window);
