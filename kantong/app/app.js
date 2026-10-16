/* Kantong PWA — vanilla JS, tanpa build step. */
(function () {
  'use strict';
  var C = KantongCore;

  // ================= util =================
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var NF = new Intl.NumberFormat('id-ID');
  var fmt = function (n) { return NF.format(Math.round(Math.abs(n || 0))); };
  var rp = function (n) { return (n < 0 ? '−' : '') + 'Rp ' + fmt(n); };
  var parseNum = function (s) { return Number(String(s || '').replace(/[^0-9]/g, '')) || 0; };
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage penuh/terblokir */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* abaikan */ } }
  };
  var pad = function (n) { return String(Math.floor(Math.abs(n))).padStart(2, '0'); };
  function todayISO() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function thisMonth() { return todayISO().slice(0, 7); }
  function nowIso() {
    var d = new Date(), off = -d.getTimezoneOffset();
    return todayISO() + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) +
      (off >= 0 ? '+' : '-') + pad(off / 60) + ':' + pad(off % 60);
  }
  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  var HARI_P = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  function monthName(b) { var p = b.split('-'); return BULAN[+p[1] - 1] + ' ' + p[0]; }
  function shiftMonth(b, n) { var p = b.split('-'); var d = new Date(+p[0], +p[1] - 1 + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function dateObj(iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function dayLabel(iso) {
    var t = todayISO();
    if (iso === t) return 'Hari ini';
    if (iso === C.addDays(t, -1)) return 'Kemarin';
    var d = dateObj(iso);
    return HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()].slice(0, 3);
  }
  function longToday() { var d = new Date(); return HARI_P[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()]; }

  var ICON = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/><rect x="3" y="3" width="18" height="18" rx="6"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h12l-3-3M17 17H5l3 3"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
  };

  // ================= state =================
  var S = {
    conn: LS.get('k_conn', null),          // {mode:'remote', api, token} | {mode:'demo'}
    boot: LS.get('k_boot', null),
    months: LS.get('k_months', {}),
    outbox: LS.get('k_outbox', []),
    prefs: LS.get('k_prefs', { lastKantong: {}, demoUser: 'riki' }),
    tab: 'home', sub: null, bukuView: null, bulan: thisMonth(),
    syncing: false, again: false, lastError: null, catTab: 'Pengeluaran'
  };
  function persist() {
    LS.set('k_conn', S.conn); LS.set('k_boot', S.boot); LS.set('k_outbox', S.outbox); LS.set('k_prefs', S.prefs);
    var keys = Object.keys(S.months).sort().reverse();
    var keep = {}; keys.slice(0, 8).forEach(function (k) { keep[k] = S.months[k]; });
    S.months = keep; LS.set('k_months', keep);
  }
  function db() {
    var b = S.boot || {};
    return { Buku: b.buku || [], Users: b.users || [], Kategori: b.kategori || [], Kantong: b.kantong || [], Budget: [], Transaksi: [] };
  }
  function me() { return S.boot ? S.boot.user : null; }
  function bukuById(id) { return C.byId(db().Buku)[id]; }
  function bukuColor(id) {
    var map = { riki: 'var(--b-riki)', istri: 'var(--b-istri)', rt: 'var(--b-rt)' };
    if (map[id]) return map[id];
    var i = db().Buku.findIndex(function (b) { return b.id === id; });
    return ['#8FA2FF', '#F28DB5', '#F2B544', '#5EEAD4', '#A78BFA'][Math.max(0, i) % 5];
  }
  function userName(id) { var u = db().Users.find(function (x) { return x.id === id; }); return u ? u.nama : id; }
  function canWrite(bukuId) { return C.canWrite(db(), me(), bukuId); }

  // ================= API =================
  function demoTables() {
    var saved = LS.get('k_demo', null);
    if (saved) return saved;
    var seed = window.KANTONG_DEMO_SEED || makeDemoSeed();
    return { Buku: seed.buku, Users: seed.users, Kategori: seed.kategori, Kantong: seed.kantong, Budget: seed.budget, Transaksi: seed.transaksi };
  }
  var demoStore = null;
  function demoRpc(action, payload) {
    if (!demoStore) demoStore = C.memoryStore(demoTables());
    var users = demoStore.all('Users');
    var u = users.find(function (x) { return x.id === S.prefs.demoUser; }) || users[0];
    return new Promise(function (res, rej) {
      setTimeout(function () {
        try {
          var out = C.handle(demoStore, { id: u.id, nama: u.nama, buku: u.buku }, action, payload, nowIso());
          LS.set('k_demo', demoStore.data);
          res(out);
        } catch (e) { rej(e); }
      }, 180);
    });
  }
  function rpc(action, payload, conn) {
    conn = conn || S.conn;
    if (!conn) return Promise.reject(new Error('Belum terhubung'));
    if (conn.mode === 'demo') return demoRpc(action, payload);
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 30000);
    return fetch(conn.api, {
      method: 'POST', redirect: 'follow', signal: ctrl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: conn.token, action: action, payload: payload || {} })
    }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error('Server membalas ' + r.status);
      return r.json();
    }, function () {
      clearTimeout(timer);
      var e = new Error('Tidak ada koneksi'); e.offline = true; throw e;
    }).then(function (j) {
      if (!j.ok) { var e = new Error(j.error || 'Gagal'); e.code = j.code; e.server = true; throw e; }
      return j.data;
    });
  }

  // ---------- outbox & sync ----------
  function enqueue(action, payload) {
    var op = { opId: uid(), action: action, payload: payload, at: nowIso() };
    S.outbox.push(op);
    applyLocal(op);
    persist();
    sync();
  }
  function removeTxLocal(id) {
    Object.keys(S.months).forEach(function (b) {
      var m = S.months[b]; if (!m) return;
      m.transaksi = m.transaksi.filter(function (t) { return t.id !== id; });
    });
  }
  function findTx(id) {
    var found = null;
    Object.keys(S.months).forEach(function (b) {
      (S.months[b].transaksi || []).forEach(function (t) { if (t.id === id) found = t; });
    });
    return found;
  }
  function applyLocal(op) {
    if (op.action === 'tx.save') {
      var t = op.payload, ex = findTx(t.id);
      removeTxLocal(t.id);
      var m = S.months[t.tanggal.slice(0, 7)];
      if (m) m.transaksi.push(Object.assign({}, t, { oleh: ex ? ex.oleh : me().id, _pending: true }));
    } else if (op.action === 'tx.delete') {
      removeTxLocal(op.payload.id);
    }
  }
  function sync(extraMonths) {
    if (!S.conn) return Promise.resolve();
    if (S.syncing) { S.again = true; (extraMonths || []).forEach(function (b) { S.wantMonths = (S.wantMonths || []).concat(b); }); return Promise.resolve(); }
    S.syncing = true; renderSync();
    var ops = S.outbox.slice();
    var want = {}; want[thisMonth()] = 1; want[S.bulan] = 1;
    (extraMonths || []).concat(S.wantMonths || []).forEach(function (b) { want[b] = 1; });
    S.wantMonths = [];
    var batch = ops.map(function (o) { return { opId: o.opId, action: o.action, payload: o.payload }; })
      .concat([{ opId: '_boot', action: 'bootstrap' }])
      .concat(Object.keys(want).map(function (b) { return { opId: '_m_' + b, action: 'month', payload: { bulan: b } }; }));
    return rpc('batch', { ops: batch }).then(function (d) {
      var sent = {}; ops.forEach(function (o) { sent[o.opId] = 1; });
      d.results.forEach(function (r) {
        if (r.opId === '_boot') { if (r.ok) S.boot = r.data; }
        else if (String(r.opId).indexOf('_m_') === 0) { if (r.ok) S.months[r.data.bulan] = r.data; }
        else if (!r.ok) toast('Tidak tersimpan: ' + r.error, true);
      });
      S.outbox = S.outbox.filter(function (o) { return !sent[o.opId]; });
      S.outbox.forEach(applyLocal);           // operasi yang masuk selama request
      S.lastError = null; S.lastSync = Date.now();
      persist();
    }).catch(function (e) {
      S.lastError = e.message;
      if (e.code === 'AUTH') { toast('Kode akses tidak berlaku. Hubungkan ulang.', true); }
    }).then(function () {
      S.syncing = false; renderSync(); refresh();
      if (S.again) { S.again = false; sync(); }
    });
  }

  // ================= UI primitives =================
  var toastTimer;
  function toast(msg, bad) {
    var el = $('#toast'); el.textContent = msg; el.className = 'toast show' + (bad ? ' bad' : '');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.className = 'toast' + (bad ? ' bad' : ''); }, bad ? 4200 : 2200);
  }
  function syncPill() {
    var n = S.outbox.length, cls = 'sync', label;
    if (S.syncing) { cls += ' busy'; label = 'Sinkron…'; }
    else if (n) { cls += S.lastError ? ' offline' : ' pending'; label = n + ' belum terkirim'; }
    else if (S.lastError) { cls += ' offline'; label = 'Offline'; }
    else label = S.conn && S.conn.mode === 'demo' ? 'Demo' : 'Tersinkron';
    return '<button class="' + cls + '" data-act="sync" aria-label="Sinkronkan sekarang"><i></i>' + label + '</button>';
  }
  function renderSync() { $$('.sync').forEach(function (el) { el.outerHTML = syncPill(); }); }

  var sheetStack = [];
  function openSheet(title, build) {
    var scrim = document.createElement('div'); scrim.className = 'scrim';
    var sh = document.createElement('div'); sh.className = 'sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
    sh.innerHTML = '<div class="grab"></div><div class="sheet-h"><h3>' + esc(title) + '</h3>' +
      '<button class="iconbtn" data-close aria-label="Tutup">✕</button></div><div class="sheet-b"></div>';
    document.body.appendChild(scrim); document.body.appendChild(sh);
    var api = {
      el: $('.sheet-b', sh),
      close: function (fromPop) {
        if (api.closed) return; api.closed = true;
        sh.classList.remove('show'); scrim.classList.remove('show');
        setTimeout(function () { sh.remove(); scrim.remove(); }, 260);
        sheetStack = sheetStack.filter(function (x) { return x !== api; });
        if (!fromPop && history.state && history.state.sheet) history.back();
      }
    };
    scrim.addEventListener('click', function () { api.close(); });
    $('[data-close]', sh).addEventListener('click', function () { api.close(); });
    sheetStack.push(api);
    history.pushState({ sheet: sheetStack.length }, '');
    build(api);
    requestAnimationFrame(function () { scrim.classList.add('show'); sh.classList.add('show'); });
    return api;
  }
  window.addEventListener('popstate', function () {
    if (sheetStack.length) { sheetStack[sheetStack.length - 1].close(true); return; }
    if (S.sub) { S.sub = null; renderView(); }
  });
  function goSub(sub) { S.sub = sub; history.pushState({ sub: 1 }, ''); renderView(); window.scrollTo(0, 0); }
  function backSub() { if (history.state && history.state.sub) history.back(); else { S.sub = null; renderView(); } }

  function bukuTabs(withAll) {
    var list = db().Buku.slice().sort(function (a, b) { return a.urutan - b.urutan; });
    var html = list.map(function (b) {
      return '<button data-buku="' + esc(b.id) + '" aria-pressed="' + (S.bukuView === b.id) + '" style="--c:' + bukuColor(b.id) + '"><i></i>' + esc(b.nama) + '</button>';
    }).join('');
    if (withAll) html += '<button data-buku="all" aria-pressed="' + (S.bukuView === 'all') + '">Semua</button>';
    return '<div class="buku-tabs" role="group" aria-label="Pilih buku">' + html + '</div>';
  }
  function monthBar() {
    var first = (S.boot && S.boot.bulan && S.boot.bulan.length) ? S.boot.bulan[S.boot.bulan.length - 1] : thisMonth();
    return '<div class="monthbar"><button class="iconbtn" data-month="-1" aria-label="Bulan sebelumnya"' + (S.bulan <= first ? ' disabled' : '') + '>' + ICON.left + '</button>' +
      '<strong>' + monthName(S.bulan) + '</strong>' +
      '<button class="iconbtn" data-month="1" aria-label="Bulan berikutnya"' + (S.bulan >= thisMonth() ? ' disabled' : '') + '>' + ICON.right + '</button></div>';
  }
  function monthData(b) { return S.months[b || S.bulan]; }
  function ensureMonth(b) { if (!monthData(b)) sync([b]); return monthData(b); }
  function skeleton(n) { var s = ''; for (var i = 0; i < (n || 4); i++) s += '<div class="skeleton"></div>'; return s; }

  function kantongLabel(id) { var k = C.byId(db().Kantong)[id]; return k ? k.nama : id; }
  function kategoriOf(id) { return C.byId(db().Kategori)[id]; }

  function txRow(t, ctxBuku) {
    var k = kategoriOf(t.kategori), color, letter, amtCls = '', sign = '−';
    if (t.tipe === 'Transfer') {
      color = 'var(--tf)'; letter = ICON.swap; amtCls = 'tf'; sign = '';
      if (ctxBuku && ctxBuku !== 'all') sign = t.buku === ctxBuku ? '−' : '+';
    } else {
      color = k ? k.warna : '#94A3B8'; letter = esc(((k ? k.nama : '?')[0] || '?').toUpperCase());
      if (t.tipe === 'Pemasukan') { amtCls = 'in'; sign = '+'; }
    }
    var title = t.keterangan || (t.tipe === 'Transfer' ? 'Transfer' : (k ? k.nama : 'Transaksi'));
    var meta = [];
    if (t.tipe === 'Transfer') meta.push(esc(kantongLabel(t.kantong) + ' ke ' + kantongLabel(t.kantong_tujuan)));
    else {
      if (t.keterangan && k) meta.push(esc(k.nama));
      meta.push(esc(kantongLabel(t.kantong)));
    }
    var tags = '';
    if (!ctxBuku || ctxBuku === 'all' || t.buku !== ctxBuku) {
      var b = bukuById(t.buku); if (b) tags += '<span class="tag" style="--c:' + bukuColor(b.id) + '"><i></i>' + esc(b.nama) + '</span>';
    }
    if (t.oleh && me() && t.oleh !== me().id) tags += '<span class="tag">oleh ' + esc(userName(t.oleh)) + '</span>';
    if (C.bool(t.reimburse)) tags += '<span class="tag">Reimburse</span>';
    if (t._pending) tags += '<span class="tag" style="color:var(--accent)">belum terkirim</span>';
    return '<button class="tx" data-tx="' + esc(t.id) + '"><span class="ic" style="--c:' + color + '">' + letter + '</span>' +
      '<span class="main"><span class="t1 sr">' + esc(title) + '</span><span class="t2">' + meta.join('<span class="faint">/</span>') + tags + '</span></span>' +
      '<span class="amt num ' + amtCls + '">' + sign + fmt(t.nominal) + '</span></button>';
  }
  function txGroups(list, ctxBuku) {
    if (!list.length) return '<div class="list"><div class="empty">Belum ada transaksi.</div></div>';
    var by = {};
    list.forEach(function (t) { (by[t.tanggal] = by[t.tanggal] || []).push(t); });
    return Object.keys(by).sort().reverse().map(function (d) {
      var items = by[d].sort(function (a, b) { return String(b.dibuat || b.id).localeCompare(String(a.dibuat || a.id)); });
      var out = items.reduce(function (s, t) { return s + (t.tipe === 'Pengeluaran' && !C.bool(t.reimburse) ? t.nominal : 0); }, 0);
      return '<div class="day"><div class="day-h"><span>' + dayLabel(d) + '</span><span class="num">' + (out ? '−' + fmt(out) : '') + '</span></div>' +
        '<div class="list">' + items.map(function (t) { return txRow(t, ctxBuku); }).join('') + '</div></div>';
    }).join('');
  }
  function bindTxRows(root) {
    $$('[data-tx]', root).forEach(function (el) {
      el.addEventListener('click', function () { openTxSheet(findTx(el.getAttribute('data-tx'))); });
    });
  }

  // ================= transaksi form =================
  function usageRank(buku) {
    var cnt = {};
    Object.keys(S.months).forEach(function (b) {
      (S.months[b].transaksi || []).forEach(function (t) {
        if (t.buku === buku) { cnt['k:' + t.kategori] = (cnt['k:' + t.kategori] || 0) + 1; cnt['w:' + t.kantong] = (cnt['w:' + t.kantong] || 0) + 1; }
      });
    });
    return cnt;
  }
  function defaultKantong(buku) {
    var last = S.prefs.lastKantong && S.prefs.lastKantong[buku];
    var ks = db().Kantong.filter(function (k) { return C.bool(k.aktif) && canWrite(k.buku); });
    if (last && ks.some(function (k) { return k.id === last; })) return last;
    var own = ks.filter(function (k) { return k.buku === buku; });
    return (own[0] || ks[0] || {}).id || '';
  }
  function txForm(root, init, opts) {
    opts = opts || {};
    var user = me();
    var f = Object.assign({
      id: '', tipe: 'Pengeluaran', nominal: 0, buku: user.buku, kategori: '', kantong: '', kantong_tujuan: '',
      tanggal: todayISO(), keterangan: '', reimburse: false
    }, init || {});
    if (!f.kantong) f.kantong = defaultKantong(f.buku);
    var existing = init && init.id ? findTx(init.id) : null;

    function draw() {
      var d = db(), rank = usageRank(f.buku);
      var writable = C.writableBuku(d, user);
      var cats = d.Kategori.filter(function (k) {
        return k.tipe === f.tipe && (C.bool(k.aktif) || k.id === f.kategori) && C.scopeOf(k).indexOf(f.buku) >= 0;
      }).sort(function (a, b) { return (rank['k:' + b.id] || 0) - (rank['k:' + a.id] || 0) || a.urutan - b.urutan; });
      var wallets = d.Kantong.filter(function (k) { return (C.bool(k.aktif) || k.id === f.kantong) && canWrite(k.buku); })
        .sort(function (a, b) { return (b.buku === f.buku) - (a.buku === f.buku) || (rank['w:' + b.id] || 0) - (rank['w:' + a.id] || 0) || a.urutan - b.urutan; });
      var dests = d.Kantong.filter(function (k) { return (C.bool(k.aktif) || k.id === f.kantong_tujuan) && k.id !== f.kantong; });
      var cls = f.tipe === 'Pemasukan' ? 'in' : f.tipe === 'Transfer' ? 'tf' : 'out';
      var walletChip = function (k, sel, attr) {
        return '<button type="button" class="chip" ' + attr + '="' + esc(k.id) + '" aria-pressed="' + (sel === k.id) + '" style="--c:' + bukuColor(k.buku) + '">' +
          '<span class="dot" style="background:' + bukuColor(k.buku) + '"></span>' + esc(k.nama) + (k.jenis === 'Kredit' ? ' <span class="faint">kredit</span>' : '') + '</button>';
      };
      root.innerHTML =
        '<div class="seg" role="group" aria-label="Tipe transaksi">' + C.TIPE_TX.map(function (t) {
          return '<button type="button" data-tipe="' + t + '" aria-pressed="' + (f.tipe === t) + '">' + t + '</button>';
        }).join('') + '</div>' +
        '<label class="amount ' + cls + '"><span>Rp</span><input id="f-amt" inputmode="numeric" autocomplete="off" placeholder="0" aria-label="Nominal" value="' + (f.nominal ? fmt(f.nominal) : '') + '"></label>' +
        (f.tipe !== 'Transfer' && writable.length > 1 ?
          '<div class="field"><span class="lbl">Buku</span><div class="chips" role="group">' + writable.map(function (b) {
            return '<button type="button" class="chip" data-fbuku="' + esc(b.id) + '" aria-pressed="' + (f.buku === b.id) + '" style="--c:' + bukuColor(b.id) + '"><span class="dot" style="background:' + bukuColor(b.id) + '"></span>' + (b.tipe === 'Bersama' ? esc(b.nama) : 'Pribadi') + '</button>';
          }).join('') + '</div></div>' : '') +
        (f.tipe !== 'Transfer' ?
          '<div class="field"><span class="lbl">Kategori</span><div class="chips" role="group">' + cats.map(function (k) {
            return '<button type="button" class="chip" data-kat="' + esc(k.id) + '" aria-pressed="' + (f.kategori === k.id) + '" style="--c:' + k.warna + '"><span class="dot" style="background:' + k.warna + '"></span>' + esc(k.nama) + '</button>';
          }).join('') + (opts.allowAdd ? '<button type="button" class="chip add" data-addkat>+ Kategori</button>' : '') + '</div></div>' : '') +
        '<div class="field"><span class="lbl">' + (f.tipe === 'Transfer' ? 'Dari kantong' : f.tipe === 'Pemasukan' ? 'Masuk ke kantong' : 'Bayar pakai') + '</span><div class="chips" role="group">' +
          wallets.map(function (k) { return walletChip(k, f.kantong, 'data-wal'); }).join('') + '</div></div>' +
        (f.tipe === 'Transfer' ? '<div class="field"><span class="lbl">Ke kantong</span><div class="chips" role="group">' +
          dests.map(function (k) { return walletChip(k, f.kantong_tujuan, 'data-dst'); }).join('') + '</div></div>' : '') +
        '<div class="field row2"><div><label for="f-tgl">Tanggal</label><input id="f-tgl" class="input" type="date" value="' + esc(f.tanggal) + '"></div>' +
        '<div><label for="f-ket">Keterangan</label><input id="f-ket" class="input" maxlength="200" placeholder="mis. indomaret" value="' + esc(f.keterangan) + '"></div></div>' +
        (f.tipe === 'Pengeluaran' ? '<button type="button" class="field toggle" role="switch" id="f-reim" aria-checked="' + !!f.reimburse + '"><span><span style="display:block;font-weight:500">Akan di-reimburse</span><span class="faint" style="font-size:12px">Tidak dihitung ke pengeluaran & budget</span></span><span class="sw"></span></button>' : '') +
        '<div class="err" id="f-err" role="alert"></div>' +
        '<button type="button" class="btn" id="f-save">' + (existing ? 'Simpan perubahan' : 'Simpan') + '</button>' +
        (existing ? '<button type="button" class="btn danger" id="f-del">Hapus transaksi</button>' : '');

      var amt = $('#f-amt', root);
      amt.addEventListener('input', function () {
        f.nominal = parseNum(amt.value);
        amt.value = f.nominal ? fmt(f.nominal) : '';
      });
      amt.addEventListener('keydown', function (e) { if (e.key === 'Enter') save(); });
      $('#f-tgl', root).addEventListener('change', function (e) { f.tanggal = e.target.value || todayISO(); });
      $('#f-ket', root).addEventListener('input', function (e) { f.keterangan = e.target.value; });
      $$('[data-tipe]', root).forEach(function (b) { b.addEventListener('click', function () {
        var t = b.getAttribute('data-tipe'); if (t === f.tipe) return;
        f.tipe = t; f.kategori = ''; if (t === 'Transfer') f.reimburse = false; draw();
      }); });
      $$('[data-fbuku]', root).forEach(function (b) { b.addEventListener('click', function () {
        f.buku = b.getAttribute('data-fbuku'); f.kategori = ''; f.kantong = defaultKantong(f.buku); draw();
      }); });
      $$('[data-kat]', root).forEach(function (b) { b.addEventListener('click', function () { f.kategori = b.getAttribute('data-kat'); mark(root, '[data-kat]', b); }); });
      $$('[data-wal]', root).forEach(function (b) { b.addEventListener('click', function () {
        f.kantong = b.getAttribute('data-wal'); if (f.kantong === f.kantong_tujuan) f.kantong_tujuan = '';
        if (f.tipe === 'Transfer') draw(); else mark(root, '[data-wal]', b);
      }); });
      $$('[data-dst]', root).forEach(function (b) { b.addEventListener('click', function () { f.kantong_tujuan = b.getAttribute('data-dst'); mark(root, '[data-dst]', b); }); });
      var reim = $('#f-reim', root);
      if (reim) reim.addEventListener('click', function () { f.reimburse = !f.reimburse; reim.setAttribute('aria-checked', String(f.reimburse)); });
      var add = $('[data-addkat]', root);
      if (add) add.addEventListener('click', function () { openKategoriSheet(null, f.tipe, f.buku, function (k) { f.kategori = k.id; draw(); }); });
      $('#f-save', root).addEventListener('click', save);
      var del = $('#f-del', root);
      if (del) del.addEventListener('click', function () {
        if (!confirm('Hapus transaksi ini?')) return;
        enqueue('tx.delete', { id: existing.id }); toast('Transaksi dihapus'); if (opts.onDone) opts.onDone();
      });
    }
    function mark(scope, sel, btn) { $$(sel, scope).forEach(function (x) { x.setAttribute('aria-pressed', String(x === btn)); }); }
    function save() {
      var errEl = $('#f-err', root);
      var payload = {
        id: f.id || uid(), tanggal: f.tanggal, tipe: f.tipe, nominal: f.nominal, buku: f.buku,
        kategori: f.kategori, kantong: f.kantong, kantong_tujuan: f.kantong_tujuan,
        keterangan: f.keterangan, reimburse: f.reimburse
      };
      if (f.tipe === 'Transfer') payload.buku = C.bukuOfKantong(db(), f.kantong);
      try { payload = C.cleanTx(payload, db(), me(), existing); }
      catch (e) { errEl.textContent = e.message; return; }
      errEl.textContent = '';
      S.prefs.lastKantong = S.prefs.lastKantong || {};
      if (f.tipe !== 'Transfer') S.prefs.lastKantong[f.buku] = f.kantong;
      enqueue('tx.save', payload);
      toast(existing ? 'Perubahan disimpan' : 'Tersimpan ' + rp(payload.nominal));
      if (opts.onDone) opts.onDone(payload);
      if (!existing) { f.id = ''; f.nominal = 0; f.keterangan = ''; f.kategori = ''; f.reimburse = false; draw(); }
    }
    draw();
  }

  function openTxSheet(t) {
    if (!t) return;
    var editable = canWrite(t.buku) && !t._pending;
    openSheet(editable ? 'Ubah transaksi' : 'Detail transaksi', function (sh) {
      if (editable) { txForm(sh.el, t, { onDone: function () { sh.close(); } }); return; }
      var k = kategoriOf(t.kategori), b = bukuById(t.buku);
      var rows = [['Tipe', t.tipe], ['Nominal', rp(t.nominal)], ['Tanggal', dayLabel(t.tanggal) + ' (' + t.tanggal + ')'],
        ['Buku', b ? b.nama : t.buku]];
      if (t.tipe === 'Transfer') rows.push(['Dari', kantongLabel(t.kantong)], ['Ke', kantongLabel(t.kantong_tujuan)]);
      else rows.push(['Kategori', k ? k.nama : '-'], ['Kantong', kantongLabel(t.kantong)]);
      rows.push(['Keterangan', t.keterangan || '-'], ['Dicatat oleh', userName(t.oleh)]);
      if (t.sumber === 'import') rows.push(['Catatan', 'Data lama, tanggal perkiraan']);
      sh.el.innerHTML = (t._pending ? '' : '<div class="readonly-note">' + ICON.lock + '<span>Hanya bisa dilihat. Transaksi ini ada di buku ' + esc(b ? b.nama : '') + '.</span></div>') +
        '<div class="list">' + rows.map(function (r) {
          return '<div class="wallet"><div class="main"><div class="t2">' + esc(r[0]) + '</div><div class="t1">' + esc(r[1]) + '</div></div></div>';
        }).join('') + '</div>';
    });
  }

  // ================= views =================
  var view = null;
  function renderShell() {
    var app = $('#app');
    if (!S.conn) { renderConnect(); return; }
    app.innerHTML = (S.conn.mode === 'demo' ? '<div class="demo-bar">Mode demo: data tersimpan di HP ini saja. <button data-act="leave-demo">Hubungkan Google Sheets</button></div>' : '') +
      '<main id="view" class="view"></main>' +
      '<footer class="tabbar"><nav>' + [['home', 'Catat', ICON.home], ['ringkasan', 'Ringkasan', ICON.chart], ['riwayat', 'Riwayat', ICON.list], ['pengaturan', 'Pengaturan', ICON.gear]].map(function (x) {
        return '<button data-tab="' + x[0] + '" aria-current="' + (S.tab === x[0] ? 'page' : 'false') + '">' + x[2] + x[1] + '</button>';
      }).join('') + '</nav></footer>';
    $$('[data-tab]', app).forEach(function (b) { b.addEventListener('click', function () {
      S.tab = b.getAttribute('data-tab'); S.sub = null;
      $$('[data-tab]', app).forEach(function (x) { x.setAttribute('aria-current', x === b ? 'page' : 'false'); });
      renderView(); window.scrollTo(0, 0);
    }); });
    renderView();
  }
  function renderView() {
    if (!S.boot) { $('#view').innerHTML = '<div class="topbar"><div><h1>Memuat data…</h1></div>' + syncPill() + '</div>' + skeleton(5); return; }
    if (!S.bukuView) S.bukuView = me().buku;
    var v = { home: HomeView, ringkasan: RingkasanView, riwayat: RiwayatView, pengaturan: SettingsView }[S.tab];
    view = v; v.render($('#view'));
  }
  function refresh() {
    if (!S.conn || !$('#view')) { if (!S.conn) renderConnect(); return; }
    if (!view || !S.boot) { renderView(); return; }
    if (view.update) view.update($('#view')); else view.render($('#view'));
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]'); if (!t) return;
    var a = t.getAttribute('data-act');
    if (a === 'sync') sync();
    if (a === 'leave-demo') { if (confirm('Keluar dari mode demo?')) disconnect(); }
  });

  // ---------- Catat (home) ----------
  var HomeView = {
    render: function (el) {
      el.innerHTML = '<div class="topbar"><div><div class="date">' + longToday() + '</div><h1>Halo, ' + esc(me().nama) + '</h1></div>' + syncPill() + '</div>' +
        '<div id="home-budget"></div>' +
        '<section class="section"><div class="entry" id="entry"></div></section>' +
        '<section class="section"><div class="section-h"><h2>Hari ini</h2><span class="aside" id="today-total"></span></div><div id="today"></div></section>';
      txForm($('#entry', el), null, { allowAdd: true });
      this.update(el);
    },
    update: function (el) {
      var m = ensureMonth(thisMonth());
      var budgetEl = $('#home-budget', el), todayEl = $('#today', el);
      if (!m) { budgetEl.innerHTML = '<div class="skeleton"></div>'; todayEl.innerHTML = skeleton(2); return; }
      var d = db(), user = me();
      var mine = C.writableBuku(d, user);
      budgetEl.innerHTML = '<div class="card"><div class="section-h" style="margin-bottom:12px"><h2>Sisa budget ' + BULAN[new Date().getMonth()] + '</h2></div>' +
        mine.map(function (b, i) {
          var s = C.summarize(d, m.transaksi, m.budget, b.id);
          var used = s.budgetTotal ? Math.min(1, s.pengeluaran / s.budgetTotal) : 0;
          return '<div style="' + (i ? 'margin-top:16px' : '') + '"><div class="budget-head"><span class="muted" style="display:flex;align-items:center;gap:8px"><span class="dot" style="width:8px;height:8px;border-radius:50%;background:' + bukuColor(b.id) + '"></span>' + (b.tipe === 'Bersama' ? esc(b.nama) : 'Pribadi') + '</span>' +
            '<span class="big num' + (s.sisaBudget < 0 ? ' over' : '') + '" style="font-size:18px">' + (s.budgetTotal ? rp(s.sisaBudget) : '<span class="faint" style="font-size:13px;font-weight:500">Budget belum diatur</span>') + '</span></div>' +
            (s.budgetTotal ? '<div class="meter' + (s.sisaBudget < 0 ? ' over' : '') + '" style="--c:' + bukuColor(b.id) + '"><i style="width:' + (used * 100).toFixed(1) + '%"></i></div>' +
            '<div class="budget-foot"><span>Terpakai ' + rp(s.pengeluaran) + '</span><span>dari ' + rp(s.budgetTotal) + '</span></div>' : '') + '</div>';
        }).join('') + '</div>';
      var t = todayISO();
      var list = m.transaksi.filter(function (x) { return x.tanggal === t && mine.some(function (b) { return C.txInBuku(d, x, b.id); }); });
      var out = list.reduce(function (s, x) { return s + (x.tipe === 'Pengeluaran' && !C.bool(x.reimburse) ? x.nominal : 0); }, 0);
      $('#today-total', el).textContent = out ? 'Keluar ' + rp(out) : '';
      todayEl.innerHTML = list.length ? '<div class="list">' + list.sort(function (a, b) { return String(b.dibuat || '9').localeCompare(String(a.dibuat || '9')); })
        .map(function (x) { return txRow(x, null); }).join('') + '</div>' : '<div class="list"><div class="empty">Belum ada catatan hari ini.</div></div>';
      bindTxRows(todayEl);
    }
  };

  // ---------- Ringkasan ----------
  function donut(items, total) {
    var r = 15.915, off = 0, segs = '';
    var top = items.filter(function (x) { return x.total > 0; });
    if (top.length > 7) { var rest = top.slice(6).reduce(function (s, x) { return s + x.total; }, 0); top = top.slice(0, 6).concat([{ total: rest, warna: '#6E7590' }]); }
    top.forEach(function (x) {
      var p = total ? x.total / total * 100 : 0;
      segs += '<circle cx="18" cy="18" r="' + r + '" fill="none" stroke="' + x.warna + '" stroke-width="3.6" stroke-dasharray="' + Math.max(0, p - 0.6).toFixed(2) + ' ' + (100 - Math.max(0, p - 0.6)).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"/>';
      off += p;
    });
    return '<div class="donut"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="' + r + '" fill="none" stroke="var(--surface-2)" stroke-width="3.6"/>' + segs + '</svg>' +
      '<div class="center"><small>Pengeluaran</small><b class="num">' + compact(total) + '</b></div></div>';
  }
  function compact(n) {
    var a = Math.abs(n);
    if (a >= 1e9) return (n / 1e9).toFixed(1).replace('.', ',') + ' M';
    if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace('.', ',') + ' jt';
    if (a >= 1e3) return Math.round(n / 1e3) + ' rb';
    return fmt(n);
  }
  function walletsHtml(bukuSel) {
    var d = db(), saldo = (S.boot && S.boot.saldo) || {};
    var ks = d.Kantong.filter(function (k) { return C.bool(k.aktif) && (bukuSel === 'all' || k.buku === bukuSel); });
    if (!ks.length) return '<div class="list"><div class="empty">Belum ada kantong.</div></div>';
    var total = 0;
    var rows = ks.map(function (k) {
      var v = saldo[k.id] || 0; total += v;
      var sub = k.jenis + (k.jenis === 'Kredit' && k.limit ? ', sisa limit ' + rp(k.limit + v) : '');
      if (bukuSel === 'all') sub = (bukuById(k.buku) || {}).nama + ', ' + sub;
      return '<button class="wallet" data-kantong="' + esc(k.id) + '"><span class="ic" style="width:10px;height:10px;border-radius:3px;background:' + bukuColor(k.buku) + '"></span><span class="main"><span class="t1" style="display:block">' + esc(k.nama) + '</span><span class="t2">' + esc(sub) + '</span></span><span class="amt num' + (v < 0 ? ' neg' : '') + '">' + rp(v) + '</span></button>';
    }).join('');
    return '<div class="list">' + rows + '</div><div class="total-row"><span>Total bersih</span><span class="num" style="color:var(--text);font-weight:700">' + rp(total) + '</span></div>';
  }
  function bindNav(el, render) {
    $$('[data-buku]', el).forEach(function (b) { b.addEventListener('click', function () { S.bukuView = b.getAttribute('data-buku'); render(); }); });
    $$('[data-month]', el).forEach(function (b) { b.addEventListener('click', function () { S.bulan = shiftMonth(S.bulan, +b.getAttribute('data-month')); render(); }); });
  }
  function readonlyNote() {
    if (S.bukuView === 'all' || canWrite(S.bukuView)) return '';
    var b = bukuById(S.bukuView);
    return '<div class="readonly-note">' + ICON.lock + '<span>Buku ' + esc(b ? b.nama : '') + ' hanya bisa kamu lihat.</span></div>';
  }
  var RingkasanView = {
    render: function (el) {
      if (S.sub && S.sub.type === 'cat') return CatDetail.render(el);
      var self = this;
      el.innerHTML = '<div class="topbar"><div><h1>Ringkasan</h1></div>' + syncPill() + '</div>' + bukuTabs(true) + monthBar() + '<div id="rk"></div>';
      bindNav(el, function () { self.render(el); });
      this.update(el);
    },
    update: function (el) {
      if (S.sub && S.sub.type === 'cat') return CatDetail.render(el);
      var box = $('#rk', el); if (!box) return this.render(el);
      var m = ensureMonth(S.bulan);
      if (!m) { box.innerHTML = skeleton(5); return; }
      var d = db(), s = C.summarize(d, m.transaksi, m.budget, S.bukuView);
      var used = s.budgetTotal ? Math.min(1, s.pengeluaran / s.budgetTotal) : 0;
      var extra = [];
      if (s.transferMasuk) extra.push(['Transfer masuk', '+' + fmt(s.transferMasuk)]);
      if (s.transferKeluar) extra.push(['Transfer keluar', '−' + fmt(s.transferKeluar)]);
      if (s.reimburse) extra.push(['Reimburse (tidak dihitung)', fmt(s.reimburse)]);
      box.innerHTML = readonlyNote() +
        '<div class="card overview">' + donut(s.perKategori, s.pengeluaran) +
        '<div class="stats"><div class="stat"><small>Pemasukan</small><b class="num in">' + rp(s.pemasukan) + '</b></div>' +
        '<div class="stat"><small>Pengeluaran</small><b class="num">' + rp(s.pengeluaran) + '</b></div>' +
        '<div class="stat"><small>Selisih</small><b class="num' + (s.selisih < 0 ? ' over' : '') + '">' + rp(s.selisih) + '</b></div></div></div>' +
        (extra.length ? '<div class="list" style="margin-top:12px">' + extra.map(function (x) { return '<div class="wallet" style="min-height:44px;padding:10px 0"><span class="main muted" style="font-size:13px">' + x[0] + '</span><span class="num" style="font-size:14px;font-weight:600">' + x[1] + '</span></div>'; }).join('') + '</div>' : '') +
        '<section class="section"><div class="card"><div class="budget-head"><span class="muted">Sisa budget</span><span class="big num' + (s.sisaBudget < 0 ? ' over' : '') + '">' + (s.budgetTotal ? rp(s.sisaBudget) : '-') + '</span></div>' +
        (s.budgetTotal ? '<div class="meter' + (s.sisaBudget < 0 ? ' over' : '') + '"><i style="width:' + (used * 100).toFixed(1) + '%"></i></div><div class="budget-foot"><span>Terpakai ' + Math.round(s.pengeluaran / s.budgetTotal * 100) + '%</span><span>Budget ' + rp(s.budgetTotal) + '</span></div>'
          : '<div class="faint" style="font-size:13px">Belum ada budget untuk bulan ini. Atur di Pengaturan, Budget bulanan.</div>') + '</div></section>' +
        '<section class="section"><div class="section-h"><h2>Per kategori</h2><span class="aside">ketuk untuk rincian</span></div><div class="list">' +
        (s.perKategori.length ? s.perKategori.map(function (k) {
          var ratio = k.budget ? Math.min(1, k.total / k.budget) : (s.pengeluaran ? k.total / s.pengeluaran : 0);
          var over = k.budget && k.total > k.budget;
          return '<button class="cat" data-cat="' + esc(k.id) + '" style="--c:' + k.warna + '"><span class="cat-top"><span class="dot"></span><span class="name">' + esc(k.nama) + '</span><span class="pct num">' + Math.round(k.pct * 100) + '%</span><span class="val num">' + rp(k.total) + '</span></span>' +
            '<span class="meter' + (over ? ' over' : '') + '" style="display:block"><i style="width:' + (ratio * 100).toFixed(1) + '%"></i></span>' +
            '<span class="cat-sub"><span>' + (k.budget ? 'Budget ' + rp(k.budget) : 'Tanpa budget') + '</span>' +
            (k.budget ? '<span class="' + (over ? 'over' : '') + '">' + (over ? 'Lewat ' + rp(-k.sisa) : 'Sisa ' + rp(k.sisa)) + '</span>' : '<span></span>') + '</span></button>';
        }).join('') : '<div class="empty">Belum ada pengeluaran.</div>') + '</div></section>' +
        (s.perMasuk.length ? '<section class="section"><div class="section-h"><h2>Pemasukan</h2></div><div class="list">' + s.perMasuk.map(function (k) {
          return '<button class="cat" data-cat="' + esc(k.id) + '" style="--c:' + k.warna + '"><span class="cat-top" style="margin:0"><span class="dot"></span><span class="name">' + esc(k.nama) + '</span><span class="val num" style="color:var(--in)">' + rp(k.total) + '</span></span></button>';
        }).join('') + '</div></section>' : '') +
        '<section class="section"><div class="section-h"><h2>Saldo kantong</h2><span class="aside">saat ini</span></div>' + walletsHtml(S.bukuView) + '</section>';
      $$('[data-cat]', box).forEach(function (b) { b.addEventListener('click', function () { goSub({ type: 'cat', id: b.getAttribute('data-cat') }); }); });
      $$('[data-kantong]', box).forEach(function (b) { b.addEventListener('click', function () { openKantongSheet(C.byId(db().Kantong)[b.getAttribute('data-kantong')]); }); });
    }
  };

  var CatDetail = {
    render: function (el) {
      var id = S.sub.id, k = kategoriOf(id) || { nama: 'Tanpa kategori', warna: '#94A3B8', tipe: 'Pengeluaran' };
      el.innerHTML = '<button class="back" data-back>' + ICON.left + 'Ringkasan</button>' +
        '<div class="topbar"><div><h1 style="display:flex;align-items:center;gap:10px"><span style="width:12px;height:12px;border-radius:4px;background:' + k.warna + '"></span>' + esc(k.nama) + '</h1>' +
        '<div class="date">' + monthName(S.bulan) + ', buku ' + esc(S.bukuView === 'all' ? 'semua' : (bukuById(S.bukuView) || {}).nama) + '</div></div>' + syncPill() + '</div><div id="cd"></div>';
      $('[data-back]', el).addEventListener('click', backSub);
      var m = ensureMonth(S.bulan), box = $('#cd', el);
      if (!m) { box.innerHTML = skeleton(4); return; }
      var d = db();
      var list = m.transaksi.filter(function (t) { return t.kategori === id && (S.bukuView === 'all' || t.buku === S.bukuView); });
      var counted = list.filter(function (t) { return !C.bool(t.reimburse); });
      var total = counted.reduce(function (s, t) { return s + t.nominal; }, 0);
      var bud = 0;
      Object.keys(m.budget || {}).forEach(function (b) { if (S.bukuView === 'all' || b === S.bukuView) bud += (m.budget[b].items || {})[id] || 0; });
      var over = bud && total > bud;
      box.innerHTML = '<div class="card"><div class="budget-head"><span class="muted">' + (k.tipe === 'Pemasukan' ? 'Total masuk' : 'Total keluar') + '</span><span class="big num">' + rp(total) + '</span></div>' +
        (bud ? '<div class="meter' + (over ? ' over' : '') + '" style="--c:' + k.warna + '"><i style="width:' + (Math.min(1, total / bud) * 100).toFixed(1) + '%"></i></div>' +
          '<div class="budget-foot"><span>Budget ' + rp(bud) + '</span><span style="' + (over ? 'color:var(--over)' : '') + '">' + (over ? 'Lewat ' + rp(total - bud) : 'Sisa ' + rp(bud - total)) + '</span></div>' : '') +
        '<div class="budget-foot"><span>' + list.length + ' transaksi</span><span></span></div></div>' + txGroups(list, S.bukuView);
      bindTxRows(box);
    }
  };

  // ---------- Riwayat ----------
  var RiwayatView = {
    q: '',
    render: function (el) {
      var self = this;
      el.innerHTML = '<div class="topbar"><div><h1>Riwayat</h1></div>' + syncPill() + '</div>' + bukuTabs(true) + monthBar() +
        '<input class="input" id="q" type="search" placeholder="Cari keterangan atau kategori" value="' + esc(this.q) + '" aria-label="Cari">' +
        '<div id="rw"></div>';
      bindNav(el, function () { self.render(el); });
      $('#q', el).addEventListener('input', function (e) { self.q = e.target.value; self.update(el); });
      this.update(el);
    },
    update: function (el) {
      var box = $('#rw', el); if (!box) return this.render(el);
      var m = ensureMonth(S.bulan);
      if (!m) { box.innerHTML = skeleton(6); return; }
      var d = db(), q = this.q.trim().toLowerCase();
      var list = m.transaksi.filter(function (t) {
        if (!C.txInBuku(d, t, S.bukuView)) return false;
        if (!q) return true;
        var k = kategoriOf(t.kategori);
        return (t.keterangan + ' ' + (k ? k.nama : '') + ' ' + kantongLabel(t.kantong)).toLowerCase().indexOf(q) >= 0;
      });
      box.innerHTML = readonlyNote().replace('class="readonly-note"', 'class="readonly-note" style="margin:16px 0 0"') + txGroups(list, S.bukuView);
      bindTxRows(box);
    }
  };

  // ---------- Pengaturan ----------
  var SettingsView = {
    render: function (el) {
      if (S.sub) return ({ kantong: KantongList, kategori: KategoriList, budget: BudgetEdit })[S.sub.type].render(el);
      var demo = S.conn.mode === 'demo';
      var host = demo ? 'Mode demo, tersimpan di HP ini' : 'Terhubung ke Google Sheets';
      el.innerHTML = '<div class="topbar"><div><h1>Pengaturan</h1></div>' + syncPill() + '</div>' +
        '<div class="menu"><div style="padding:16px;border-bottom:1px solid var(--surface-2)"><div style="font-weight:700;font-size:17px">' + esc(me().nama) + '</div><div class="faint" style="font-size:13px">' + host + '</div></div>' +
        '<button data-s="sync"><span class="main">Sinkron sekarang<div class="t2">' + (S.lastSync ? 'Terakhir ' + new Date(S.lastSync).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Belum sinkron di sesi ini') + (S.outbox.length ? ', ' + S.outbox.length + ' belum terkirim' : '') + '</div></span></button>' +
        (demo ? '<button data-s="switch"><span class="main">Masuk sebagai ' + esc(S.prefs.demoUser === 'riki' ? 'Istri' : 'Riki') + '<div class="t2">Coba aturan baca/tulis antar buku</div></span></button>' : '') +
        '</div>' +
        '<section class="section"><div class="menu">' +
        '<button data-s="budget"><span class="main">Budget bulanan<div class="t2">Atur budget per kategori</div></span>' + ICON.right + '</button>' +
        '<button data-s="kategori"><span class="main">Kategori<div class="t2">' + db().Kategori.filter(function (k) { return C.bool(k.aktif); }).length + ' kategori aktif</div></span>' + ICON.right + '</button>' +
        '<button data-s="kantong"><span class="main">Kantong<div class="t2">Cash, debit, e-wallet, kartu kredit</div></span>' + ICON.right + '</button>' +
        '</div></section>' +
        '<section class="section"><div class="menu"><button data-s="out"><span class="main" style="color:var(--over)">' + (demo ? 'Keluar dari mode demo' : 'Putuskan koneksi di HP ini') + '</span></button></div>' +
        '<p class="faint" style="font-size:12px;text-align:center;margin-top:20px">Kantong v' + (S.boot.version || C.VERSION) + '</p></section>';
      $$('[data-s]', el).forEach(function (b) { b.addEventListener('click', function () {
        var a = b.getAttribute('data-s');
        if (a === 'sync') sync();
        else if (a === 'switch') { S.prefs.demoUser = S.prefs.demoUser === 'riki' ? 'istri' : 'riki'; S.bukuView = null; persist(); S.boot = null; renderView(); sync(); }
        else if (a === 'out') { if (confirm(demo ? 'Keluar dari mode demo? Data demo dihapus.' : 'Putuskan koneksi? Transaksi yang belum terkirim akan hilang dari HP ini.')) disconnect(); }
        else goSub({ type: a });
      }); });
    },
    update: function (el) { if (!S.sub || S.sub.type !== 'budget') this.render(el); }
  };
  function subHeader(title, el) {
    return '<button class="back" data-back>' + ICON.left + 'Pengaturan</button><div class="topbar"><div><h1>' + esc(title) + '</h1></div>' + syncPill() + '</div>';
  }
  function bindBack(el) { $('[data-back]', el).addEventListener('click', backSub); }
  function settingCall(action, payload, okMsg) {
    return rpc(action, payload).then(function (d) { toast(okMsg); return sync().then(function () { return d; }); })
      .catch(function (e) { toast(e.offline ? 'Perlu koneksi internet untuk menyimpan pengaturan' : e.message, true); throw e; });
  }

  var KantongList = {
    render: function (el) {
      var d = db(), saldo = S.boot.saldo || {};
      el.innerHTML = subHeader('Kantong', el) + d.Buku.slice().sort(function (a, b) { return a.urutan - b.urutan; }).map(function (b) {
        var ks = d.Kantong.filter(function (k) { return k.buku === b.id; });
        return '<section class="section"><div class="section-h"><h2 style="display:flex;align-items:center;gap:8px"><span style="width:8px;height:8px;border-radius:50%;background:' + bukuColor(b.id) + '"></span>' + esc(b.nama) + '</h2>' +
          (canWrite(b.id) ? '<button class="btn small ghost" data-addk="' + esc(b.id) + '">+ Tambah</button>' : '<span class="aside">hanya lihat</span>') + '</div><div class="list">' +
          (ks.length ? ks.map(function (k) {
            var v = saldo[k.id] || 0;
            return '<button class="wallet" data-k="' + esc(k.id) + '"' + (C.bool(k.aktif) ? '' : ' style="opacity:.45"') + '><span class="main"><span class="t1" style="display:block">' + esc(k.nama) + '</span><span class="t2">' + k.jenis + (C.bool(k.aktif) ? '' : ', nonaktif') + '</span></span><span class="amt num' + (v < 0 ? ' neg' : '') + '">' + rp(v) + '</span></button>';
          }).join('') : '<div class="empty">Belum ada kantong.</div>') + '</div></section>';
      }).join('');
      bindBack(el);
      $$('[data-k]', el).forEach(function (b) { b.addEventListener('click', function () { openKantongSheet(C.byId(db().Kantong)[b.getAttribute('data-k')]); }); });
      $$('[data-addk]', el).forEach(function (b) { b.addEventListener('click', function () { openKantongSheet(null, b.getAttribute('data-addk')); }); });
    }
  };
  function toggleHtml(id, label, sub, on) {
    return '<button type="button" class="field toggle" role="switch" id="' + id + '" aria-checked="' + !!on + '"><span><span style="display:block;font-weight:500">' + label + '</span>' + (sub ? '<span class="faint" style="font-size:12px">' + sub + '</span>' : '') + '</span><span class="sw"></span></button>';
  }
  function bindToggle(el, id, obj, key) {
    var t = $('#' + id, el); if (!t) return;
    t.addEventListener('click', function () { obj[key] = !obj[key]; t.setAttribute('aria-checked', String(obj[key])); });
  }
  function openKantongSheet(k, bukuId) {
    var editable = canWrite(k ? k.buku : bukuId);
    var f = k ? { id: k.id, nama: k.nama, jenis: k.jenis, limit: k.limit, aktif: C.bool(k.aktif) } : { nama: '', jenis: 'Debit', limit: 0, aktif: true, buku: bukuId };
    var cur = k ? ((S.boot.saldo || {})[k.id] || 0) : 0;
    openSheet(k ? (editable ? 'Ubah kantong' : k.nama) : 'Kantong baru', function (sh) {
      function draw() {
        var kredit = f.jenis === 'Kredit';
        sh.el.innerHTML = (editable ? '' : '<div class="readonly-note">' + ICON.lock + '<span>Kantong ini hanya bisa kamu lihat.</span></div>') +
          '<div class="field"><label for="k-nama">Nama</label><input id="k-nama" class="input" maxlength="40" value="' + esc(f.nama) + '" placeholder="mis. BCA, GoPay, Cash"' + (editable ? '' : ' disabled') + '></div>' +
          '<div class="field"><span class="lbl">Jenis</span><div class="seg">' + C.JENIS_KANTONG.map(function (j) { return '<button type="button" data-j="' + j + '" aria-pressed="' + (f.jenis === j) + '"' + (editable ? '' : ' disabled') + '>' + j + '</button>'; }).join('') + '</div></div>' +
          '<div class="field"><label for="k-saldo">' + (kredit ? 'Tagihan saat ini' : 'Saldo saat ini') + '</label><input id="k-saldo" class="input num" inputmode="numeric" value="' + fmt(kredit ? Math.max(0, -cur) : cur) + '"' + (editable ? '' : ' disabled') + '>' +
          '<div class="faint" style="font-size:12px;margin-top:6px">' + (kredit ? 'Disimpan sebagai saldo minus. ' : '') + 'Isi sesuai angka di aplikasi bank. Transaksi berikutnya otomatis mengubah saldo.</div></div>' +
          (kredit ? '<div class="field"><label for="k-limit">Limit kartu</label><input id="k-limit" class="input num" inputmode="numeric" value="' + fmt(f.limit) + '"' + (editable ? '' : ' disabled') + '></div>' : '') +
          (k && editable ? toggleHtml('k-aktif', 'Aktif', 'Kantong nonaktif tidak muncul saat input', f.aktif) : '') +
          (editable ? '<div class="err" id="k-err"></div><button class="btn" id="k-save">Simpan kantong</button>' : '');
        if (!editable) return;
        $('#k-nama', sh.el).addEventListener('input', function (e) { f.nama = e.target.value; });
        ['k-saldo', 'k-limit'].forEach(function (id) { var i = $('#' + id, sh.el); if (i) i.addEventListener('input', function () { var n = parseNum(i.value); i.value = n ? fmt(n) : ''; }); });
        $$('[data-j]', sh.el).forEach(function (b) { b.addEventListener('click', function () { f.jenis = b.getAttribute('data-j'); draw(); }); });
        bindToggle(sh.el, 'k-aktif', f, 'aktif');
        $('#k-save', sh.el).addEventListener('click', function () {
          var saldo = parseNum($('#k-saldo', sh.el).value);
          var p = { id: f.id, nama: f.nama, jenis: f.jenis, buku: f.buku, aktif: f.aktif,
            limit: f.jenis === 'Kredit' ? parseNum(($('#k-limit', sh.el) || {}).value) : 0,
            saldo_sekarang: f.jenis === 'Kredit' ? -saldo : saldo };
          var btn = this; btn.disabled = true;
          settingCall('kantong.save', p, 'Kantong disimpan').then(function () { sh.close(); refresh(); }, function (e) { btn.disabled = false; $('#k-err', sh.el).textContent = e.message; });
        });
      }
      draw();
    });
  }

  var KategoriList = {
    render: function (el) {
      var d = db();
      el.innerHTML = subHeader('Kategori', el) +
        '<div class="seg" style="margin-bottom:16px">' + ['Pengeluaran', 'Pemasukan'].map(function (t) { return '<button data-ct="' + t + '" aria-pressed="' + (S.catTab === t) + '">' + t + '</button>'; }).join('') + '</div>' +
        '<div class="list">' + d.Kategori.filter(function (k) { return k.tipe === S.catTab; }).sort(function (a, b) { return C.bool(b.aktif) - C.bool(a.aktif) || a.urutan - b.urutan; }).map(function (k) {
          return '<button class="wallet" data-c="' + esc(k.id) + '"' + (C.bool(k.aktif) ? '' : ' style="opacity:.45"') + '><span style="width:12px;height:12px;border-radius:4px;background:' + k.warna + ';flex:none"></span><span class="main"><span class="t1" style="display:block">' + esc(k.nama) + '</span><span class="t2" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">' +
            C.scopeOf(k).map(function (b) { var bk = bukuById(b); return bk ? '<span class="tag" style="--c:' + bukuColor(b) + '"><i></i>' + esc(bk.nama) + '</span>' : ''; }).join('') +
            (C.bool(k.hitung) ? '' : '<span class="tag">tidak dihitung</span>') + (C.bool(k.aktif) ? '' : '<span class="tag">nonaktif</span>') + '</span></span>' + ICON.right.replace('<svg', '<svg width="18" height="18" style="color:var(--text-3)"') + '</button>';
        }).join('') + '</div>' +
        '<button class="btn ghost" id="add-cat">+ Tambah kategori ' + S.catTab.toLowerCase() + '</button>';
      bindBack(el);
      var self = this;
      $$('[data-ct]', el).forEach(function (b) { b.addEventListener('click', function () { S.catTab = b.getAttribute('data-ct'); self.render(el); }); });
      $$('[data-c]', el).forEach(function (b) { b.addEventListener('click', function () { openKategoriSheet(kategoriOf(b.getAttribute('data-c'))); }); });
      $('#add-cat', el).addEventListener('click', function () { openKategoriSheet(null, S.catTab, me().buku); });
    }
  };
  var PALETTE = ['#7C9CFF', '#5EEAD4', '#FBBF24', '#F472B6', '#A78BFA', '#34D399', '#FB923C', '#60A5FA', '#F87171', '#A3E635', '#22D3EE', '#E879F9', '#FCD34D', '#94A3B8', '#FDA4AF', '#86EFAC'];
  function openKategoriSheet(k, tipe, bukuId, onSaved) {
    var d = db();
    var f = k ? { id: k.id, nama: k.nama, tipe: k.tipe, buku: C.scopeOf(k), warna: k.warna, hitung: C.bool(k.hitung), aktif: C.bool(k.aktif) }
      : { nama: '', tipe: tipe || 'Pengeluaran', buku: [bukuId || me().buku], warna: PALETTE[d.Kategori.length % PALETTE.length], hitung: true, aktif: true };
    var editable = !k || f.buku.some(function (b) { return canWrite(b); });
    openSheet(k ? (editable ? 'Ubah kategori' : k.nama) : 'Kategori ' + f.tipe.toLowerCase(), function (sh) {
      function draw() {
        sh.el.innerHTML = (editable ? '' : '<div class="readonly-note">' + ICON.lock + '<span>Kategori ini milik buku lain.</span></div>') +
          '<div class="field"><label for="c-nama">Nama</label><input id="c-nama" class="input" maxlength="40" value="' + esc(f.nama) + '"' + (editable ? '' : ' disabled') + '></div>' +
          '<div class="field"><span class="lbl">Dipakai di buku</span><div class="chips wrap">' + d.Buku.map(function (b) {
            var on = f.buku.indexOf(b.id) >= 0, can = canWrite(b.id) && editable;
            return '<button type="button" class="chip" data-cb="' + esc(b.id) + '" aria-pressed="' + on + '" style="--c:' + bukuColor(b.id) + '"' + (can ? '' : ' disabled') + '><span class="dot" style="background:' + bukuColor(b.id) + '"></span>' + esc(b.nama) + '</button>';
          }).join('') + '</div></div>' +
          '<div class="field"><span class="lbl">Warna</span><div class="swatches">' + PALETTE.map(function (c) { return '<button type="button" data-cw="' + c + '" aria-label="Warna ' + c + '" aria-pressed="' + (f.warna.toUpperCase() === c) + '" style="--c:' + c + '"' + (editable ? '' : ' disabled') + '></button>'; }).join('') + '</div></div>' +
          (editable ? toggleHtml('c-hitung', f.tipe === 'Pemasukan' ? 'Hitung sebagai pemasukan' : 'Hitung ke pengeluaran & budget', f.tipe === 'Pemasukan' ? 'Matikan untuk uang titipan atau reimburse' : 'Matikan untuk pos yang tidak ingin dianalisis', f.hitung) : '') +
          (k && editable ? toggleHtml('c-aktif', 'Aktif', 'Kategori nonaktif tetap muncul di riwayat', f.aktif) : '') +
          (editable ? '<div class="err" id="c-err"></div><button class="btn" id="c-save">Simpan kategori</button>' : '');
        if (!editable) return;
        $('#c-nama', sh.el).addEventListener('input', function (e) { f.nama = e.target.value; });
        $$('[data-cb]', sh.el).forEach(function (b) { b.addEventListener('click', function () {
          var id = b.getAttribute('data-cb'), i = f.buku.indexOf(id);
          if (i >= 0) f.buku.splice(i, 1); else f.buku.push(id);
          b.setAttribute('aria-pressed', String(i < 0));
        }); });
        $$('[data-cw]', sh.el).forEach(function (b) { b.addEventListener('click', function () { f.warna = b.getAttribute('data-cw'); $$('[data-cw]', sh.el).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); }); });
        bindToggle(sh.el, 'c-hitung', f, 'hitung'); bindToggle(sh.el, 'c-aktif', f, 'aktif');
        $('#c-save', sh.el).addEventListener('click', function () {
          var btn = this; btn.disabled = true;
          settingCall('kategori.save', { id: f.id, nama: f.nama, tipe: f.tipe, buku: f.buku.join(','), warna: f.warna, hitung: f.hitung, aktif: f.aktif }, 'Kategori disimpan')
            .then(function (res) { sh.close(); refresh(); if (onSaved) onSaved(res.kategori); }, function (e) { btn.disabled = false; $('#c-err', sh.el).textContent = e.message; });
        });
      }
      draw();
    });
  }

  var BudgetEdit = {
    buku: null, vals: {},
    render: function (el) {
      var d = db(), self = this;
      var writable = C.writableBuku(d, me());
      if (!this.buku || !writable.some(function (b) { return b.id === self.buku; })) this.buku = me().buku;
      el.innerHTML = subHeader('Budget bulanan', el) +
        '<div class="buku-tabs">' + writable.map(function (b) { return '<button data-bb="' + esc(b.id) + '" aria-pressed="' + (self.buku === b.id) + '" style="--c:' + bukuColor(b.id) + '"><i></i>' + esc(b.nama) + '</button>'; }).join('') + '</div>' +
        monthBar() + '<div id="be"></div>';
      bindBack(el);
      $$('[data-bb]', el).forEach(function (b) { b.addEventListener('click', function () { self.buku = b.getAttribute('data-bb'); self.render(el); }); });
      $$('[data-month]', el).forEach(function (b) { b.addEventListener('click', function () { S.bulan = shiftMonth(S.bulan, +b.getAttribute('data-month')); self.render(el); }); });
      var m = ensureMonth(S.bulan), box = $('#be', el);
      if (!m) { box.innerHTML = skeleton(6); this.waiting = true; return; }
      this.waiting = false;
      var eff = (m.budget || {})[this.buku] || { sumber: null, items: {} };
      var cats = d.Kategori.filter(function (k) { return k.tipe === 'Pengeluaran' && (C.bool(k.aktif) || eff.items[k.id]) && C.scopeOf(k).indexOf(self.buku) >= 0; })
        .sort(function (a, b) { return a.urutan - b.urutan; });
      this.vals = {}; cats.forEach(function (k) { self.vals[k.id] = eff.items[k.id] || 0; });
      var note = !eff.sumber ? 'Belum ada budget. Isi lalu simpan, bulan berikutnya otomatis ikut.' :
        eff.sumber !== S.bulan ? 'Bulan ini mengikuti budget ' + monthName(eff.sumber) + '. Simpan untuk mengubah mulai ' + monthName(S.bulan) + '.' : 'Budget khusus ' + monthName(S.bulan) + '. Bulan berikutnya ikut angka ini.';
      box.innerHTML = '<p class="faint" style="font-size:13px;margin:0 0 12px">' + note + '</p><div class="list">' + cats.map(function (k) {
        return '<div class="budget-row" style="--c:' + k.warna + '"><span class="name"><span class="dot"></span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(k.nama) + '</span></span><input class="input num" inputmode="numeric" data-bv="' + esc(k.id) + '" value="' + (self.vals[k.id] ? fmt(self.vals[k.id]) : '') + '" placeholder="0" aria-label="Budget ' + esc(k.nama) + '"></div>';
      }).join('') + '</div><div class="total-row"><span>Total budget</span><span class="num" id="bt" style="color:var(--text);font-weight:700"></span></div>' +
        '<div class="sticky-save"><button class="btn" id="b-save" style="margin:0">Simpan budget ' + BULAN[+S.bulan.slice(5) - 1] + '</button></div>';
      var total = function () { $('#bt', box).textContent = rp(Object.keys(self.vals).reduce(function (s, k) { return s + self.vals[k]; }, 0)); };
      total();
      $$('[data-bv]', box).forEach(function (i) { i.addEventListener('input', function () {
        var n = parseNum(i.value); self.vals[i.getAttribute('data-bv')] = n; i.value = n ? fmt(n) : ''; total();
      }); });
      $('#b-save', box).addEventListener('click', function () {
        var btn = this; btn.disabled = true;
        settingCall('budget.save', { bulan: S.bulan, buku: self.buku, items: self.vals }, 'Budget disimpan').then(function () { btn.disabled = false; }, function () { btn.disabled = false; });
      });
    },
    update: function (el) { if (this.waiting) this.render(el); }
  };
  // Pengaturan memakai sub-view; update hanya untuk sub-view yang menunggu data
  var _sr = SettingsView.update;
  SettingsView.update = function (el) {
    if (S.sub && S.sub.type === 'budget') return BudgetEdit.update(el);
    if (S.sub) return ({ kantong: KantongList, kategori: KategoriList })[S.sub.type].render(el);
    return _sr.call(SettingsView, el);
  };

  // ================= connect =================
  function renderConnect() {
    var app = $('#app');
    app.innerHTML = '<div class="connect"><img class="logo" src="icons/icon-192.png" alt=""><h1>Kantong</h1>' +
      '<p>Catatan keuangan pribadi dan rumah tangga. Tempel kode koneksi dari Google Sheets untuk mulai.</p>' +
      '<div class="field"><label for="code">Kode koneksi</label><textarea id="code" class="input" placeholder="Tempel kode dari menu Kantong di Google Sheets" autocomplete="off" spellcheck="false"></textarea></div>' +
      '<div class="err" id="c-err"></div><button class="btn" id="connect">Hubungkan</button>' +
      '<button class="btn ghost" id="demo" style="margin-top:12px">Coba mode demo</button></div>';
    $('#connect').addEventListener('click', function () {
      var raw = $('#code').value.trim(), conn, btn = this;
      try {
        var b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        var o = JSON.parse(atob(b64));
        if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(o.api) || !o.token) throw new Error();
        conn = { mode: 'remote', api: o.api, token: o.token };
      } catch (e) { $('#c-err').textContent = 'Kode tidak dikenali. Salin ulang dari menu Kantong, Buat kode koneksi.'; return; }
      btn.disabled = true; btn.textContent = 'Menghubungkan…';
      rpc('bootstrap', {}, conn).then(function (boot) {
        S.conn = conn; S.boot = boot; S.months = {}; S.outbox = []; S.bukuView = null; persist(); renderShell(); sync();
      }, function (e) {
        btn.disabled = false; btn.textContent = 'Hubungkan';
        $('#c-err').textContent = e.code === 'AUTH' ? 'Kode akses ditolak server.' : e.message;
      });
    });
    $('#demo').addEventListener('click', function () {
      S.conn = { mode: 'demo' }; S.boot = null; S.months = {}; S.outbox = []; S.bukuView = null; persist(); renderShell(); sync();
    });
  }
  function disconnect() {
    ['k_conn', 'k_boot', 'k_months', 'k_outbox', 'k_demo'].forEach(LS.del);
    demoStore = null;
    S.conn = null; S.boot = null; S.months = {}; S.outbox = []; S.sub = null; S.tab = 'home'; S.bukuView = null;
    renderConnect();
  }

  // ================= demo seed (data contoh, bukan data asli) =================
  function makeDemoSeed() {
    var P = 'riki,istri', ALL = 'riki,istri,rt';
    var kat = [['makan-jajan', 'Makan/jajan', P], ['ojol-taxi', 'Ojol/taxi', P], ['kendaraan-pribadi', 'Kendaraan pribadi', P], ['paket-data', 'Paket data', P],
      ['subscription', 'Subscription', P], ['kesehatan', 'Kesehatan', P], ['personal-care', 'Personal care', P], ['work', 'Work', 'riki'],
      ['belanja-dapur', 'Belanja dapur', 'rt'], ['listrik-air', 'Listrik & air', 'rt'], ['kebutuhan-rumah', 'Kebutuhan rumah', 'rt'], ['lain-lain', 'Lain-lain', ALL]]
      .map(function (k, i) { return { id: k[0], nama: k[1], tipe: 'Pengeluaran', buku: k[2], warna: PALETTE[i], hitung: true, aktif: true, urutan: i + 1 }; })
      .concat([{ id: 'gaji', nama: 'Gaji', tipe: 'Pemasukan', buku: ALL, warna: '#34D399', hitung: true, aktif: true, urutan: 20 },
        { id: 'pendapatan-lain', nama: 'Pendapatan lain', tipe: 'Pemasukan', buku: ALL, warna: '#5EEAD4', hitung: true, aktif: true, urutan: 21 }]);
    var per = C.addDays(thisMonth() + '-01', -1);
    var kan = [['cash-riki', 'Cash', 'Cash', 'riki', 350000, 0], ['bca', 'BCA', 'Debit', 'riki', 4200000, 0], ['kk-bca', 'Kartu Kredit BCA', 'Kredit', 'riki', -850000, 10000000],
      ['cash-istri', 'Cash', 'Cash', 'istri', 200000, 0], ['rek-istri', 'Rekening', 'Debit', 'istri', 2500000, 0], ['kas-rt', 'Kas Rumah Tangga', 'Debit', 'rt', 600000, 0]]
      .map(function (k, i) { return { id: k[0], nama: k[1], jenis: k[2], buku: k[3], saldo_awal: k[4], per_tanggal: per, limit: k[5], aktif: true, urutan: i + 1 }; });
    var bm = thisMonth(), bud = [];
    [['riki', { 'makan-jajan': 600000, 'ojol-taxi': 300000, 'kendaraan-pribadi': 200000, 'paket-data': 150000, 'subscription': 250000, 'work': 400000 }],
      ['istri', { 'makan-jajan': 500000, 'personal-care': 300000, 'kesehatan': 200000 }],
      ['rt', { 'belanja-dapur': 3000000, 'listrik-air': 800000, 'kebutuhan-rumah': 700000 }]].forEach(function (x) {
      Object.keys(x[1]).forEach(function (k) { bud.push({ id: bm + '|' + x[0] + '|' + k, bulan: bm, buku: x[0], kategori: k, nominal: x[1][k] }); });
    });
    var seedN = 7, rnd = function () { seedN = (seedN * 16807) % 2147483647; return seedN / 2147483647; };
    var tx = [], today = new Date().getDate();
    var add = function (day, tipe, n, buku, kat, kantong, ket, oleh, tujuan) {
      tx.push({ id: 'demo-' + tx.length, tanggal: bm + '-' + pad(day), tipe: tipe, nominal: n, buku: buku, kategori: kat || '', kantong: kantong, kantong_tujuan: tujuan || '',
        keterangan: ket, reimburse: false, oleh: oleh, sumber: 'demo', dibuat: bm + '-' + pad(day) + 'T0' + (tx.length % 9) + ':00:00+07:00', diubah: '', dihapus: '' });
    };
    add(1, 'Transfer', 5300000, 'riki', '', 'bca', 'Topup rumah tangga', 'riki', 'kas-rt');
    add(1, 'Pengeluaran', 50000, 'riki', 'subscription', 'bca', 'Netflix', 'riki');
    for (var dday = 1; dday <= today; dday++) {
      if (rnd() < 0.8) add(dday, 'Pengeluaran', Math.round((15 + rnd() * 45)) * 1000, 'riki', 'makan-jajan', rnd() < .3 ? 'cash-riki' : 'bca', ['indomaret', 'bakso', 'kopi', 'nasi padang'][Math.floor(rnd() * 4)], 'riki');
      if (rnd() < 0.35) add(dday, 'Pengeluaran', Math.round((20 + rnd() * 40)) * 1000, 'riki', ['ojol-taxi', 'work', 'kendaraan-pribadi'][Math.floor(rnd() * 3)], 'bca', ['gojek', 'fore', 'bensin'][Math.floor(rnd() * 3)], 'riki');
      if (rnd() < 0.5) add(dday, 'Pengeluaran', Math.round((40 + rnd() * 160)) * 1000, 'rt', 'belanja-dapur', 'kas-rt', ['pasar', 'sayur', 'superindo'][Math.floor(rnd() * 3)], rnd() < .7 ? 'istri' : 'riki');
      if (rnd() < 0.4) add(dday, 'Pengeluaran', Math.round((10 + rnd() * 50)) * 1000, 'istri', ['makan-jajan', 'personal-care'][Math.floor(rnd() * 2)], 'rek-istri', ['jajan', 'skincare'][Math.floor(rnd() * 2)], 'istri');
    }
    add(Math.min(today, 5), 'Pengeluaran', 420000, 'rt', 'listrik-air', 'kas-rt', 'token listrik', 'istri');
    return {
      buku: [{ id: 'riki', nama: 'Riki', tipe: 'Pribadi', pemilik: 'riki', urutan: 1 }, { id: 'istri', nama: 'Istri', tipe: 'Pribadi', pemilik: 'istri', urutan: 2 }, { id: 'rt', nama: 'Rumah Tangga', tipe: 'Bersama', pemilik: '', urutan: 3 }],
      users: [{ id: 'riki', nama: 'Riki', buku: 'riki' }, { id: 'istri', nama: 'Istri', buku: 'istri' }],
      kategori: kat, kantong: kan, budget: bud, transaksi: tx
    };
  }

  // ================= start =================
  window.addEventListener('online', function () { sync(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') sync(); });
  setInterval(function () { if (document.visibilityState === 'visible' && (S.outbox.length || !S.lastSync || Date.now() - S.lastSync > 120000)) sync(); }, 30000);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () {});
  if (!S.conn && window.KANTONG_PREVIEW) S.conn = { mode: 'demo' };   // file preview
  renderShell();
  if (S.conn) sync();
  window.__kantong = S;   // untuk debugging
})();
