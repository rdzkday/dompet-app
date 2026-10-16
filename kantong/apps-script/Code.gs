/**
 * Kantong — backend Google Apps Script (API untuk PWA).
 * Butuh file Core.gs (salinan app/core.js) di project yang sama.
 *
 * Deploy: Deploy > New deployment > Web app
 *   Execute as: Me   |   Who has access: Anyone
 * Keamanan: setiap request wajib membawa kode akses user (disimpan di Script Properties).
 */

var TZ = 'Asia/Jakarta';
var DATE_COLS = { tanggal: 1, per_tanggal: 1 };
var TEXT_COLS = { id: 1, bulan: 1, buku: 1, kategori: 1, kantong: 1, kantong_tujuan: 1, keterangan: 1, nama: 1,
  oleh: 1, sumber: 1, dibuat: 1, diubah: 1, dihapus: 1, pemilik: 1, warna: 1, jenis: 1, tipe: 1 };

// ---------------- HTTP ----------------
function doGet() {
  return json_({ ok: true, app: 'Kantong API', version: KantongCore.VERSION });
}

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (x) { return json_({ ok: false, error: 'Request tidak valid' }); }
  var user = auth_(body.token);
  if (!user) return json_({ ok: false, error: 'Kode akses salah', code: 'AUTH' });

  var isWrite = body.action !== 'bootstrap' && body.action !== 'month';
  var lock = LockService.getScriptLock();
  if (isWrite && !lock.tryLock(20000)) return json_({ ok: false, error: 'Server sibuk, coba lagi' });
  try {
    var store = sheetStore_();
    var data = KantongCore.handle(store, user, body.action, body.payload, nowIso_());
    store.flush();
    return json_({ ok: true, data: data });
  } catch (err) {
    if (!err.userFacing) console.error(err && err.stack);
    return json_({ ok: false, error: err.userFacing ? err.message : 'Kesalahan server: ' + err.message });
  } finally {
    if (isWrite) lock.releaseLock();
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function nowIso_() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ssXXX"); }

function auth_(token) {
  if (!token || typeof token !== 'string' || token.length < 20) return null;
  var props = PropertiesService.getScriptProperties().getProperties();
  var users = sheetStore_().all('Users');
  for (var i = 0; i < users.length; i++) {
    if (props['token_' + users[i].id] && props['token_' + users[i].id] === token) {
      return { id: users[i].id, nama: users[i].nama, buku: users[i].buku };
    }
  }
  return null;
}

// ---------------- Sheets adapter ----------------
function sheetStore_() {
  var ss = SpreadsheetApp.getActive() || SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
  var cache = {};

  function load(table) {
    if (cache[table]) return cache[table];
    var sh = ss.getSheetByName(table);
    if (!sh) throw new Error('Sheet "' + table + '" tidak ada. Jalankan menu Kantong > Setup.');
    var values = sh.getDataRange().getValues();
    var head = values[0].map(function (h) { return String(h).trim(); });
    var rows = [], index = {};
    for (var r = 1; r < values.length; r++) {
      var o = {};
      for (var c = 0; c < head.length; c++) if (head[c]) o[head[c]] = fromCell_(head[c], values[r][c]);
      if (!o.id) continue;
      index[o.id] = r + 1;               // nomor baris sheet (1-based)
      rows.push(o);
    }
    cache[table] = { sh: sh, head: head, rows: rows, index: index, pending: [] };
    return cache[table];
  }

  return {
    all: function (table) { return load(table).rows.map(function (r) { return JSON.parse(JSON.stringify(r)); }); },
    upsert: function (table, obj) {
      var t = load(table);
      var row = t.head.map(function (h) { return h ? toCell_(h, obj[h]) : ''; });
      var clean = {};
      KantongCore.SCHEMA[table].forEach(function (h) { clean[h] = obj[h] === undefined ? '' : obj[h]; });
      var at = t.index[obj.id];
      if (at > 0) {
        t.sh.getRange(at, 1, 1, row.length).setValues([row]);
      } else if (at < 0) {
        t.pending[-at - 1] = row;            // baris baru di request yang sama
      } else {
        t.pending.push(row);
        t.index[obj.id] = -t.pending.length;  // ditulis saat flush
        t.rows.push(clean);
        return clean;
      }
      for (var i = 0; i < t.rows.length; i++) if (t.rows[i].id === obj.id) t.rows[i] = clean;
      return clean;
    },
    flush: function () {
      Object.keys(cache).forEach(function (k) {
        var t = cache[k];
        if (!t.pending.length) return;
        var start = t.sh.getLastRow() + 1;
        t.sh.getRange(start, 1, t.pending.length, t.head.length).setValues(t.pending);
        t.pending = [];
      });
    }
  };
}

function fromCell_(h, v) {
  if (v instanceof Date) {
    if (h === 'bulan') return Utilities.formatDate(v, TZ, 'yyyy-MM');
    if (DATE_COLS[h]) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
    return Utilities.formatDate(v, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
  }
  if (h === 'hitung' || h === 'aktif' || h === 'reimburse') return v === true || String(v).toUpperCase() === 'TRUE';
  if (h === 'nominal' || h === 'saldo_awal' || h === 'limit' || h === 'urutan') return Number(v) || 0;
  return v === null || v === undefined ? '' : (typeof v === 'string' ? v : String(v));
}

function toCell_(h, v) {
  if (v === undefined || v === null) return '';
  if (DATE_COLS[h] && /^\d{4}-\d{2}-\d{2}$/.test(String(v))) {
    var p = String(v).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);   // timezone script = Asia/Jakarta
  }
  return v;
}

// ---------------- Setup & menu ----------------
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Kantong')
    .addItem('1. Setup / perbaiki struktur', 'setup')
    .addItem('2. Buat kode koneksi', 'buatKodeKoneksi')
    .addSeparator()
    .addItem('Ganti kode akses user…', 'resetKodeAkses')
    .addToUi();
}

/** Membuat sheet & header yang belum ada, format kolom, dan kode akses per user. Aman dijalankan berulang. */
function setup() {
  var ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(TZ);
  Object.keys(KantongCore.SCHEMA).forEach(function (name) {
    var cols = KantongCore.SCHEMA[name];
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var head = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String) : [];
    cols.forEach(function (c) { if (head.indexOf(c) < 0) { head.push(c); } });
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#1B1F26').setFontColor('#E8EAED');
    sh.setFrozenRows(1);
    var maxR = Math.max(sh.getMaxRows() - 1, 1);
    head.forEach(function (h, i) {
      var rng = sh.getRange(2, i + 1, maxR, 1);
      if (DATE_COLS[h]) rng.setNumberFormat('yyyy-mm-dd');
      else if (h === 'nominal' || h === 'saldo_awal' || h === 'limit') rng.setNumberFormat('#,##0');
      else if (h === 'bulan' || h === 'id') rng.setNumberFormat('@');
    });
  });
  var buku = ss.getSheetByName('Buku');
  if (buku.getLastRow() < 2) {
    buku.getRange(2, 1, 3, 5).setValues([
      ['riki', 'Riki', 'Pribadi', 'riki', 1], ['istri', 'Istri', 'Pribadi', 'istri', 2], ['rt', 'Rumah Tangga', 'Bersama', '', 3]]);
  }
  var users = ss.getSheetByName('Users');
  if (users.getLastRow() < 2) users.getRange(2, 1, 2, 3).setValues([['riki', 'Riki', 'riki'], ['istri', 'Istri', 'istri']]);

  var props = PropertiesService.getScriptProperties();
  props.setProperty('SHEET_ID', ss.getId());
  var made = [];
  sheetStore_().all('Users').forEach(function (u) {
    if (!props.getProperty('token_' + u.id)) { props.setProperty('token_' + u.id, newToken_()); made.push(u.nama); }
  });
  SpreadsheetApp.getUi().alert('Setup selesai.' + (made.length ? '\nKode akses baru dibuat untuk: ' + made.join(', ') : '') +
    '\n\nLangkah berikut: Deploy sebagai Web app, lalu menu Kantong > Buat kode koneksi.');
}

function newToken_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
}

/** Tampilkan kode koneksi (URL API + kode akses) untuk tiap user. */
function buatKodeKoneksi() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('Kode koneksi', 'Tempel URL Web app (berakhiran /exec):', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var url = res.getResponseText().trim();
  if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)) { ui.alert('URL harus berakhiran /exec'); return; }
  var props = PropertiesService.getScriptProperties();
  var html = '<div style="font:14px system-ui;line-height:1.5">' +
    '<p>Buka PWA Kantong → <b>Hubungkan</b> → tempel kode milik masing-masing. Jangan dibagikan ke orang lain.</p>';
  sheetStore_().all('Users').forEach(function (u) {
    var code = Utilities.base64EncodeWebSafe(JSON.stringify({ api: url, token: props.getProperty('token_' + u.id) }));
    html += '<p><b>' + u.nama + '</b><br><textarea style="width:100%;height:70px" readonly onclick="this.select()">' +
      code + '</textarea></p>';
  });
  ui.showModalDialog(HtmlService.createHtmlOutput(html + '</div>').setWidth(520).setHeight(360), 'Kode koneksi Kantong');
}

/** Ganti kode akses satu user (misal HP hilang). Kode lama langsung tidak berlaku. */
function resetKodeAkses() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('Ganti kode akses', 'Ketik id user (mis. riki atau istri):', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var id = res.getResponseText().trim();
  if (!sheetStore_().all('Users').some(function (u) { return u.id === id; })) { ui.alert('User tidak ditemukan'); return; }
  PropertiesService.getScriptProperties().setProperty('token_' + id, newToken_());
  ui.alert('Kode akses ' + id + ' sudah diganti. Buat kode koneksi baru lewat menu.');
}
