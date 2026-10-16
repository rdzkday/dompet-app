/*
 * Kantong — core logic (dipakai bersama oleh PWA, mode demo, dan Google Apps Script).
 * File ini HARUS identik dengan apps-script/Core.gs.
 * Tanpa optional chaining / nullish agar aman di runtime Apps Script V8.
 */
var KantongCore = (function () {
  'use strict';

  var SCHEMA = {
    Buku: ['id', 'nama', 'tipe', 'pemilik', 'urutan'],
    Users: ['id', 'nama', 'buku'],
    Kategori: ['id', 'nama', 'tipe', 'buku', 'warna', 'hitung', 'aktif', 'urutan'],
    Kantong: ['id', 'nama', 'jenis', 'buku', 'saldo_awal', 'per_tanggal', 'limit', 'aktif', 'urutan'],
    Budget: ['id', 'bulan', 'buku', 'kategori', 'nominal'],
    Transaksi: ['id', 'tanggal', 'tipe', 'nominal', 'buku', 'kategori', 'kantong', 'kantong_tujuan',
      'keterangan', 'reimburse', 'oleh', 'sumber', 'dibuat', 'diubah', 'dihapus']
  };
  var TIPE_TX = ['Pengeluaran', 'Pemasukan', 'Transfer'];
  var JENIS_KANTONG = ['Cash', 'Debit', 'E-wallet', 'Kredit'];
  var VERSION = '1.0.0';

  // ---------- util ----------
  function err(msg) { var e = new Error(msg); e.userFacing = true; return e; }
  function isDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function isMonth(s) { return typeof s === 'string' && /^\d{4}-\d{2}$/.test(s); }
  function bool(v) { return v === true || v === 'TRUE' || v === 'true' || v === 1; }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function byId(list) { var m = {}; for (var i = 0; i < list.length; i++) m[list[i].id] = list[i]; return m; }
  function scopeOf(k) { return String(k.buku || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean); }
  function slug(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'item';
  }
  function addDays(iso, n) {
    var p = iso.split('-'); var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
    return d.toISOString().slice(0, 10);
  }
  function sortBy(list, key) {
    return list.slice().sort(function (a, b) { return num(a[key]) - num(b[key]); });
  }

  // ---------- izin ----------
  function canWrite(db, user, bukuId) {
    var b = byId(db.Buku)[bukuId];
    if (!b || !user) return false;
    return b.tipe === 'Bersama' || b.pemilik === user.id;
  }
  function writableBuku(db, user) {
    return sortBy(db.Buku, 'urutan').filter(function (b) { return canWrite(db, user, b.id); });
  }

  // ---------- perhitungan ----------
  function liveTx(db) { return db.Transaksi.filter(function (t) { return !t.dihapus; }); }

  function txEffects(t) {
    // [ [kantongId, delta], ... ]
    var n = num(t.nominal);
    if (t.tipe === 'Pengeluaran') return [[t.kantong, -n]];
    if (t.tipe === 'Pemasukan') return [[t.kantong, n]];
    if (t.tipe === 'Transfer') return [[t.kantong, -n], [t.kantong_tujuan, n]];
    return [];
  }

  function computeSaldo(db) {
    var kmap = byId(db.Kantong), out = {}, delta = {};
    db.Kantong.forEach(function (k) { out[k.id] = num(k.saldo_awal); delta[k.id] = 0; });
    liveTx(db).forEach(function (t) {
      txEffects(t).forEach(function (e) {
        var k = kmap[e[0]];
        if (k && String(t.tanggal) > String(k.per_tanggal || '')) { out[k.id] += e[1]; delta[k.id] += e[1]; }
      });
    });
    return { saldo: out, delta: delta };
  }

  function effectiveBudget(db, bulan) {
    // { bukuId: { sumber: 'YYYY-MM' | null, items: { kategoriId: nominal } } }
    var res = {};
    db.Buku.forEach(function (b) {
      var best = null;
      db.Budget.forEach(function (r) {
        if (r.buku === b.id && String(r.bulan) <= bulan && (!best || String(r.bulan) > best)) best = String(r.bulan);
      });
      var items = {};
      if (best) db.Budget.forEach(function (r) {
        if (r.buku === b.id && String(r.bulan) === best) items[r.kategori] = num(r.nominal);
      });
      res[b.id] = { sumber: best, items: items };
    });
    return res;
  }

  function bukuOfKantong(db, kantongId) { var k = byId(db.Kantong)[kantongId]; return k ? k.buku : ''; }

  // apakah transaksi relevan untuk tampilan buku tertentu ('all' = semua)
  function txInBuku(db, t, bukuSel) {
    if (bukuSel === 'all') return true;
    if (t.buku === bukuSel) return true;
    return t.tipe === 'Transfer' && bukuOfKantong(db, t.kantong_tujuan) === bukuSel;
  }

  function summarize(db, monthTx, budgets, bukuSel) {
    var inSet = function (b) { return bukuSel === 'all' || b === bukuSel; };
    var kmap = byId(db.Kategori);
    var s = { pemasukan: 0, pengeluaran: 0, reimburse: 0, transferMasuk: 0, transferKeluar: 0,
      budgetTotal: 0, perKategori: [], perMasuk: [] };
    var spend = {}, inc = {};
    monthTx.forEach(function (t) {
      if (t.dihapus) return;
      var n = num(t.nominal), k = kmap[t.kategori];
      if (t.tipe === 'Pengeluaran' && inSet(t.buku)) {
        if (bool(t.reimburse)) { s.reimburse += n; return; }
        if (k && !bool(k.hitung)) return;
        s.pengeluaran += n; spend[t.kategori] = (spend[t.kategori] || 0) + n;
      } else if (t.tipe === 'Pemasukan' && inSet(t.buku)) {
        if (k && !bool(k.hitung)) return;
        s.pemasukan += n; inc[t.kategori] = (inc[t.kategori] || 0) + n;
      } else if (t.tipe === 'Transfer') {
        var src = inSet(t.buku), dst = inSet(bukuOfKantong(db, t.kantong_tujuan));
        if (src && !dst) s.transferKeluar += n;
        if (dst && !src) s.transferMasuk += n;
      }
    });
    var bud = {};
    Object.keys(budgets || {}).forEach(function (b) {
      if (!inSet(b)) return;
      var items = budgets[b].items || {};
      Object.keys(items).forEach(function (kid) { bud[kid] = (bud[kid] || 0) + num(items[kid]); });
    });
    var ids = {};
    Object.keys(spend).forEach(function (k) { ids[k] = 1; });
    Object.keys(bud).forEach(function (k) { if (bud[k] > 0) ids[k] = 1; });
    s.perKategori = Object.keys(ids).map(function (kid) {
      var k = kmap[kid] || { id: kid, nama: kid || 'Tanpa kategori', warna: '#94A3B8' };
      var total = spend[kid] || 0, b = bud[kid] || 0;
      s.budgetTotal += b;
      return { id: kid, nama: k.nama, warna: k.warna, total: total, budget: b, sisa: b - total,
        pct: s.pengeluaran > 0 ? total / s.pengeluaran : 0 };
    }).sort(function (a, b) { return b.total - a.total || b.budget - a.budget; });
    s.perMasuk = Object.keys(inc).map(function (kid) {
      var k = kmap[kid] || { nama: kid, warna: '#94A3B8' };
      return { id: kid, nama: k.nama, warna: k.warna, total: inc[kid] };
    }).sort(function (a, b) { return b.total - a.total; });
    s.selisih = s.pemasukan - s.pengeluaran;
    s.sisaBudget = s.budgetTotal - s.pengeluaran;
    return s;
  }

  // ---------- validasi ----------
  function cleanTx(input, db, user, existing) {
    var t = {
      id: String(input.id || ''), tanggal: String(input.tanggal || ''), tipe: String(input.tipe || ''),
      nominal: Math.round(num(input.nominal)), buku: String(input.buku || ''),
      kategori: String(input.kategori || ''), kantong: String(input.kantong || ''),
      kantong_tujuan: String(input.kantong_tujuan || ''),
      keterangan: String(input.keterangan || '').trim().slice(0, 200),
      reimburse: bool(input.reimburse)
    };
    if (!t.id || t.id.length > 64) throw err('ID transaksi tidak valid');
    if (TIPE_TX.indexOf(t.tipe) < 0) throw err('Tipe transaksi tidak valid');
    if (!(t.nominal > 0) || t.nominal > 1e12) throw err('Nominal harus lebih dari 0');
    if (!isDate(t.tanggal)) throw err('Tanggal tidak valid');
    var kan = byId(db.Kantong), kat = byId(db.Kategori);
    var src = kan[t.kantong];
    if (!src) throw err('Pilih kantong');
    var keep = function (field) { return existing && existing[field] === t[field]; };
    if (!bool(src.aktif) && !keep('kantong')) throw err('Kantong "' + src.nama + '" nonaktif');
    if (!canWrite(db, user, src.buku)) throw err('Kamu tidak bisa memakai kantong "' + src.nama + '"');
    if (t.tipe === 'Transfer') {
      var dst = kan[t.kantong_tujuan];
      if (!dst) throw err('Pilih kantong tujuan');
      if (dst.id === src.id) throw err('Kantong asal dan tujuan sama');
      if (!bool(dst.aktif) && !keep('kantong_tujuan')) throw err('Kantong tujuan nonaktif');
      t.buku = src.buku; t.kategori = ''; t.reimburse = false;
    } else {
      t.kantong_tujuan = '';
      if (!byId(db.Buku)[t.buku]) throw err('Buku tidak valid');
      var k = kat[t.kategori];
      if (!k) throw err('Pilih kategori');
      if (k.tipe !== t.tipe) throw err('Kategori tidak cocok dengan tipe transaksi');
      if (!bool(k.aktif) && !keep('kategori')) throw err('Kategori "' + k.nama + '" nonaktif');
      if (scopeOf(k).indexOf(t.buku) < 0 && !keep('kategori')) throw err('Kategori "' + k.nama + '" tidak tersedia di buku ini');
      if (t.tipe === 'Pemasukan') t.reimburse = false;
    }
    if (!canWrite(db, user, t.buku)) throw err('Kamu hanya bisa melihat buku ini');
    return t;
  }

  // ---------- API handler (dipakai server & mode demo) ----------
  // store: { all(table) -> array, upsert(table, obj) -> obj }
  function handle(store, user, action, payload, nowIso) {
    payload = payload || {};
    var db = {};
    Object.keys(SCHEMA).forEach(function (t) { db[t] = store.all(t); });
    var today = nowIso.slice(0, 10);

    switch (action) {
      case 'bootstrap': {
        var months = {};
        liveTx(db).forEach(function (t) { months[String(t.tanggal).slice(0, 7)] = 1; });
        months[today.slice(0, 7)] = 1;
        return {
          version: VERSION, user: user, today: today,
          buku: sortBy(db.Buku, 'urutan'), users: db.Users,
          kategori: sortBy(db.Kategori, 'urutan'), kantong: sortBy(db.Kantong, 'urutan'),
          saldo: computeSaldo(db).saldo, bulan: Object.keys(months).sort().reverse()
        };
      }
      case 'month': {
        var bulan = String(payload.bulan || '');
        if (!isMonth(bulan)) throw err('Bulan tidak valid');
        return {
          bulan: bulan,
          transaksi: liveTx(db).filter(function (t) { return String(t.tanggal).slice(0, 7) === bulan; }),
          budget: effectiveBudget(db, bulan)
        };
      }
      case 'tx.save': {
        var ex = byId(db.Transaksi)[payload.id];
        if (ex && ex.dihapus) throw err('Transaksi sudah dihapus');
        if (ex && !canWrite(db, user, ex.buku)) throw err('Kamu hanya bisa melihat transaksi ini');
        var t = cleanTx(payload, db, user, ex);
        t.oleh = ex ? ex.oleh : user.id;
        t.sumber = ex ? (ex.sumber || 'app') : 'app';
        t.dibuat = ex ? ex.dibuat : nowIso;
        t.diubah = nowIso; t.dihapus = '';
        store.upsert('Transaksi', t);
        return { tx: t };
      }
      case 'tx.delete': {
        var d = byId(db.Transaksi)[payload.id];
        if (!d || d.dihapus) return { id: payload.id };        // idempoten
        if (!canWrite(db, user, d.buku)) throw err('Kamu hanya bisa melihat transaksi ini');
        var del = {}; Object.keys(d).forEach(function (k) { del[k] = d[k]; });
        del.dihapus = nowIso; del.diubah = nowIso;
        store.upsert('Transaksi', del);
        return { id: d.id };
      }
      case 'kategori.save': {
        var kin = payload, kex = byId(db.Kategori)[kin.id];
        var nama = String(kin.nama || '').trim().slice(0, 40);
        if (!nama) throw err('Nama kategori wajib diisi');
        var tipe = String(kin.tipe || (kex && kex.tipe) || '');
        if (tipe !== 'Pengeluaran' && tipe !== 'Pemasukan') throw err('Tipe kategori tidak valid');
        var scope = String(kin.buku || '').split(',').map(function (s) { return s.trim(); })
          .filter(function (b) { return byId(db.Buku)[b]; });
        if (!scope.length) throw err('Pilih minimal satu buku');
        // boleh ubah hanya jika semua buku lama & baru yang disentuh bisa ditulis user,
        // atau buku yang tidak bisa ditulis tidak berubah
        var old = kex ? scopeOf(kex) : [];
        var touched = scope.filter(function (b) { return old.indexOf(b) < 0; })
          .concat(old.filter(function (b) { return scope.indexOf(b) < 0; }));
        touched.forEach(function (b) { if (!canWrite(db, user, b)) throw err('Tidak bisa mengubah kategori buku orang lain'); });
        if (kex && !scope.concat(old).some(function (b) { return canWrite(db, user, b); })) throw err('Tidak bisa mengubah kategori ini');
        var id = kex ? kex.id : (String(kin.id || '') || slug(nama));
        if (!kex && byId(db.Kategori)[id]) id = id + '-' + Math.random().toString(36).slice(2, 6);
        var kat = { id: id, nama: nama, tipe: tipe, buku: scope.join(','),
          warna: /^#[0-9a-fA-F]{6}$/.test(kin.warna || '') ? kin.warna : (kex ? kex.warna : '#7C9CFF'),
          hitung: kin.hitung === undefined ? (kex ? bool(kex.hitung) : true) : bool(kin.hitung),
          aktif: kin.aktif === undefined ? (kex ? bool(kex.aktif) : true) : bool(kin.aktif),
          urutan: kin.urutan !== undefined ? num(kin.urutan) : (kex ? num(kex.urutan) : db.Kategori.length + 1) };
        store.upsert('Kategori', kat);
        return { kategori: kat };
      }
      case 'kantong.save': {
        var kin2 = payload, kx = byId(db.Kantong)[kin2.id];
        var buku = kx ? kx.buku : String(kin2.buku || '');
        if (!canWrite(db, user, buku)) throw err('Kamu hanya bisa melihat kantong ini');
        var nm = String(kin2.nama || '').trim().slice(0, 40);
        if (!nm) throw err('Nama kantong wajib diisi');
        var jenis = String(kin2.jenis || (kx && kx.jenis) || '');
        if (JENIS_KANTONG.indexOf(jenis) < 0) throw err('Jenis kantong tidak valid');
        var kid = kx ? kx.id : (String(kin2.id || '') || slug(nm + '-' + buku));
        if (!kx && byId(db.Kantong)[kid]) kid = kid + '-' + Math.random().toString(36).slice(2, 6);
        var k2 = { id: kid, nama: nm, jenis: jenis, buku: buku,
          saldo_awal: kx ? num(kx.saldo_awal) : 0,
          per_tanggal: kx ? String(kx.per_tanggal || addDays(today, -1)) : addDays(today, -1),
          limit: Math.max(0, num(kin2.limit !== undefined ? kin2.limit : (kx ? kx.limit : 0))),
          aktif: kin2.aktif === undefined ? (kx ? bool(kx.aktif) : true) : bool(kin2.aktif),
          urutan: kin2.urutan !== undefined ? num(kin2.urutan) : (kx ? num(kx.urutan) : db.Kantong.length + 1) };
        if (kin2.saldo_sekarang !== undefined && kin2.saldo_sekarang !== null && kin2.saldo_sekarang !== '') {
          var delta = kx ? (computeSaldo(db).delta[kx.id] || 0) : 0;
          k2.saldo_awal = Math.round(num(kin2.saldo_sekarang) - delta);
        }
        store.upsert('Kantong', k2);
        db.Kantong = store.all('Kantong');
        return { kantong: k2, saldo: computeSaldo(db).saldo[k2.id] };
      }
      case 'budget.save': {
        var bl = String(payload.bulan || ''), bk = String(payload.buku || '');
        if (!isMonth(bl)) throw err('Bulan tidak valid');
        if (!canWrite(db, user, bk)) throw err('Kamu hanya bisa melihat budget buku ini');
        var items = payload.items || {}, kmap = byId(db.Kategori), saved = 0;
        // simpan semua item termasuk 0 agar bulan ini punya snapshot sendiri
        var eff = effectiveBudget(db, bl)[bk].items;
        var all = {};
        Object.keys(eff).forEach(function (k) { all[k] = eff[k]; });
        Object.keys(items).forEach(function (k) { if (kmap[k]) all[k] = Math.max(0, Math.round(num(items[k]))); });
        Object.keys(all).forEach(function (k) {
          store.upsert('Budget', { id: bl + '|' + bk + '|' + k, bulan: bl, buku: bk, kategori: k, nominal: all[k] });
          saved++;
        });
        if (!saved) store.upsert('Budget', { id: bl + '|' + bk + '|_', bulan: bl, buku: bk, kategori: '_', nominal: 0 });
        db.Budget = store.all('Budget');
        return { bulan: bl, buku: bk, budget: effectiveBudget(db, bl)[bk] };
      }
      case 'batch': {
        var ops = payload.ops || [];
        if (ops.length > 200) throw err('Terlalu banyak operasi');
        return { results: ops.map(function (op) {
          if (op.action === 'batch') return { ok: false, error: 'Nested batch' };
          try { return { ok: true, opId: op.opId, data: handle(store, user, op.action, op.payload, nowIso) }; }
          catch (e) { return { ok: false, opId: op.opId, error: e.userFacing ? e.message : 'Kesalahan server: ' + e.message }; }
        }) };
      }
      default:
        throw err('Aksi tidak dikenal: ' + action);
    }
  }

  // ---------- memory store (mode demo & test) ----------
  function memoryStore(seed) {
    var data = {};
    Object.keys(SCHEMA).forEach(function (t) { data[t] = (seed && seed[t] ? seed[t] : []).map(function (r) { return JSON.parse(JSON.stringify(r)); }); });
    return {
      data: data,
      all: function (t) { return data[t].map(function (r) { return JSON.parse(JSON.stringify(r)); }); },
      upsert: function (t, obj) {
        var row = {}; SCHEMA[t].forEach(function (h) { row[h] = obj[h] === undefined ? '' : obj[h]; });
        for (var i = 0; i < data[t].length; i++) if (data[t][i].id === row.id) { data[t][i] = row; return row; }
        data[t].push(row); return row;
      }
    };
  }

  return {
    VERSION: VERSION, SCHEMA: SCHEMA, TIPE_TX: TIPE_TX, JENIS_KANTONG: JENIS_KANTONG,
    canWrite: canWrite, writableBuku: writableBuku, computeSaldo: computeSaldo,
    effectiveBudget: effectiveBudget, summarize: summarize, txInBuku: txInBuku,
    bukuOfKantong: bukuOfKantong, scopeOf: scopeOf, bool: bool, num: num, byId: byId,
    addDays: addDays, slug: slug, handle: handle, memoryStore: memoryStore, cleanTx: cleanTx
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = KantongCore;
