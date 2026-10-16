// Test end-to-end: Core.gs + Code.gs dijalankan di Node dengan mock Google Apps Script.
process.env.TZ = 'Asia/Jakarta';
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const ROOT = path.join(__dirname, '..');
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/seed.json')));

// ---------- mock Sheets ----------
const sheets = {};
function mkSheet(name, head, rows) {
  const values = [head.slice()].concat(rows.map(r => head.map(h => {
    let v = r[h];
    if ((h === 'tanggal' || h === 'per_tanggal') && /^\d{4}-\d{2}-\d{2}$/.test(v)) { const p = v.split('-'); v = new CtxDate(+p[0], +p[1] - 1, +p[2]); }
    return v === undefined ? '' : v;
  })));
  sheets[name] = {
    values,
    getDataRange: () => ({ getValues: () => values.map(r => r.slice()) }),
    getLastRow: () => values.length,
    getLastColumn: () => values[0].length,
    getMaxRows: () => values.length + 100,
    getRange: (r, c, nr, nc) => ({
      setValues: (v) => { assert.strictEqual(v.length, nr || 1); for (let i = 0; i < v.length; i++) { values[r - 1 + i] = values[r - 1 + i] || []; for (let j = 0; j < v[i].length; j++) values[r - 1 + i][c - 1 + j] = v[i][j]; } },
      getValues: () => values.slice(r - 1, r - 1 + (nr || 1)).map(x => x.slice(c - 1, c - 1 + (nc || 1))),
      setNumberFormat() { return this; }, setFontWeight() { return this; }, setBackground() { return this; }, setFontColor() { return this; }
    }),
    setFrozenRows() {}
  };
}
const ctx = {
  console,
  SpreadsheetApp: { getActive: () => ({ getSheetByName: n => sheets[n], getId: () => 'SHEET', setSpreadsheetTimeZone() {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperties: () => ({ ...props }), getProperty: k => props[k], setProperty: (k, v) => { props[k] = v; } }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ s, setMimeType() { return this; } }) },
  Utilities: {
    formatDate(d, tz, f) {
      const p = n => String(n).padStart(2, '0');
      const ymd = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      if (f === 'yyyy-MM') return ymd.slice(0, 7);
      if (f === 'yyyy-MM-dd') return ymd;
      return `${ymd}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}+07:00`;
    },
    getUuid: () => require('crypto').randomUUID()
  }
};
const props = { token_riki: 'r'.repeat(40), token_istri: 'i'.repeat(40) };
vm.createContext(ctx);
const CtxDate = vm.runInContext('Date', ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script/Core.gs'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script/Code.gs'), 'utf8'), ctx);
const S = ctx.KantongCore.SCHEMA;
mkSheet('Buku', S.Buku, seed.buku); mkSheet('Users', S.Users, seed.users);
mkSheet('Kategori', S.Kategori, seed.kategori); mkSheet('Kantong', S.Kantong, seed.kantong);
mkSheet('Budget', S.Budget, seed.budget); mkSheet('Transaksi', S.Transaksi, seed.transaksi);

const R = props.token_riki, I = props.token_istri;
function call(token, action, payload) {
  const out = ctx.doPost({ postData: { contents: JSON.stringify({ token, action, payload }) } });
  return JSON.parse(out.s);
}
function ok(res) { if (!res.ok) throw new Error('Expected ok: ' + res.error); return res.data; }
function fail(res, re) { assert.ok(!res.ok, 'expected failure'); if (re) assert.match(res.error, re); }
let n = 0; const t = (name, fn) => { fn(); n++; console.log('✓', name); };

t('token salah ditolak', () => fail(call('x'.repeat(40), 'bootstrap'), /Kode akses/));
t('bootstrap', () => {
  const d = ok(call(R, 'bootstrap'));
  assert.strictEqual(d.user.id, 'riki'); assert.strictEqual(d.kantong.length, 10);
  assert.ok(d.bulan.includes('2026-04'));
});
t('bulan September cocok dengan sheet lama', () => {
  const d = ok(call(R, 'month', { bulan: '2026-09' }));
  assert.strictEqual(d.transaksi.length, 70);
  const db = { Kategori: seed.kategori, Kantong: seed.kantong };
  const s = ctx.KantongCore.summarize(db, d.transaksi, d.budget, 'riki');
  assert.strictEqual(s.pengeluaran, 15905171);
  assert.strictEqual(s.pemasukan, 13297245);
  assert.strictEqual(d.budget.riki.sumber, '2026-09');
});
t('tanggal round-trip tetap string yang sama', () => {
  const d = ok(call(R, 'month', { bulan: '2026-04' }));
  const tx = d.transaksi.find(x => x.id === 'imp-202604-001');
  assert.strictEqual(tx.tanggal, seed.transaksi.find(x => x.id === 'imp-202604-001').tanggal);
});
const tx1 = { id: 'tx-1', tanggal: '2026-10-14', tipe: 'Pengeluaran', nominal: 25000, buku: 'riki', kategori: 'makan-jajan', kantong: 'bca', keterangan: 'kopi' };
t('Riki input di buku sendiri', () => { const d = ok(call(R, 'tx.save', tx1)); assert.strictEqual(d.tx.oleh, 'riki'); });
t('Istri tidak bisa input di buku Riki', () => fail(call(I, 'tx.save', { ...tx1, id: 'tx-x' }), /hanya bisa melihat|tidak bisa memakai/));
t('Istri tidak bisa edit transaksi Riki', () => fail(call(I, 'tx.save', { ...tx1, nominal: 1 }), /hanya bisa melihat/));
t('Istri tidak bisa pakai kantong Riki di buku RT', () => fail(call(I, 'tx.save', { ...tx1, id: 'tx-2', buku: 'rt', kategori: 'belanja-dapur' }), /tidak bisa memakai/));
t('Istri input RT pakai kas RT', () => ok(call(I, 'tx.save', { id: 'tx-3', tanggal: '2026-10-14', tipe: 'Pengeluaran', nominal: 150000, buku: 'rt', kategori: 'belanja-dapur', kantong: 'kas-rt' })));
t('Riki bisa edit transaksi RT', () => ok(call(R, 'tx.save', { id: 'tx-3', tanggal: '2026-10-14', tipe: 'Pengeluaran', nominal: 160000, buku: 'rt', kategori: 'belanja-dapur', kantong: 'kas-rt' })));
t('kategori harus sesuai buku & tipe', () => {
  fail(call(R, 'tx.save', { ...tx1, id: 'tx-4', kategori: 'belanja-dapur' }), /tidak tersedia/);
  fail(call(R, 'tx.save', { ...tx1, id: 'tx-4', kategori: 'gaji' }), /tidak cocok/);
  fail(call(R, 'tx.save', { ...tx1, id: 'tx-4', nominal: 0 }), /Nominal/);
});
t('kategori nonaktif ditolak untuk input baru', () => fail(call(R, 'tx.save', { ...tx1, id: 'tx-5', kategori: 'topup-bulanan' }), /nonaktif/));
t('transfer BCA -> Kas RT dan saldo', () => {
  ok(call(R, 'kantong.save', { id: 'bca', nama: 'BCA', jenis: 'Debit', saldo_sekarang: 2000000 }));
  ok(call(I, 'kantong.save', { id: 'kas-rt', nama: 'Kas Rumah Tangga', jenis: 'Debit', saldo_sekarang: 500000 }));
  ok(call(R, 'tx.save', { id: 'tf-1', tanggal: '2026-10-14', tipe: 'Transfer', nominal: 300000, kantong: 'bca', kantong_tujuan: 'kas-rt' }));
  const b = ok(call(R, 'bootstrap'));
  assert.strictEqual(b.saldo.bca, 1700000);
  assert.strictEqual(b.saldo['kas-rt'], 800000);
  const m = ok(call(R, 'month', { bulan: '2026-10' }));
  const db = { Kategori: seed.kategori, Kantong: seed.kantong };
  const sr = ctx.KantongCore.summarize(db, m.transaksi, m.budget, 'rt');
  assert.strictEqual(sr.transferMasuk, 300000 + 5300000);
  assert.strictEqual(sr.pengeluaran, 160000);
  const sa = ctx.KantongCore.summarize(db, m.transaksi, m.budget, 'all');
  assert.strictEqual(sa.transferMasuk, 0);
});
t('sesuaikan saldo kartu kredit (minus)', () => {
  const d = ok(call(R, 'kantong.save', { id: 'kk-bca', nama: 'Kartu Kredit BCA', jenis: 'Kredit', limit: 10000000, saldo_sekarang: -1250000 }));
  assert.strictEqual(d.saldo, -1250000);
  ok(call(R, 'tx.save', { id: 'tx-cc', tanggal: '2026-10-14', tipe: 'Pengeluaran', nominal: 50000, buku: 'riki', kategori: 'subscription', kantong: 'kk-bca' }));
  assert.strictEqual(ok(call(R, 'bootstrap')).saldo['kk-bca'], -1300000);
});
t('hapus transaksi (soft) & idempoten', () => {
  ok(call(R, 'tx.delete', { id: 'tx-cc' })); ok(call(R, 'tx.delete', { id: 'tx-cc' }));
  assert.strictEqual(ok(call(R, 'bootstrap')).saldo['kk-bca'], -1250000);
  assert.ok(!ok(call(R, 'month', { bulan: '2026-10' })).transaksi.some(x => x.id === 'tx-cc'));
  fail(call(I, 'tx.delete', { id: 'tx-1' }), /hanya bisa melihat/);
});
t('budget: warisi bulan lalu, simpan, dan bulan depan ikut', () => {
  let m = ok(call(R, 'month', { bulan: '2026-11' }));
  assert.strictEqual(m.budget.riki.sumber, '2026-10');
  const d = ok(call(R, 'budget.save', { bulan: '2026-11', buku: 'riki', items: { 'makan-jajan': 750000 } }));
  assert.strictEqual(d.budget.items['makan-jajan'], 750000);
  assert.strictEqual(d.budget.items['cicilan'], 3350000);   // warisan Oktober
  m = ok(call(R, 'month', { bulan: '2026-12' }));
  assert.strictEqual(m.budget.riki.items['makan-jajan'], 750000);
  fail(call(I, 'budget.save', { bulan: '2026-11', buku: 'riki', items: {} }), /hanya bisa melihat/);
  ok(call(I, 'budget.save', { bulan: '2026-11', buku: 'istri', items: {} }));
});
t('batch: sebagian gagal, ID baru ganda di request sama jadi 1 baris', () => {
  const before = sheets.Transaksi.values.length;
  const d = ok(call(R, 'batch', { ops: [
    { opId: 'a', action: 'tx.save', payload: { ...tx1, id: 'tx-b', nominal: 1000 } },
    { opId: 'b', action: 'tx.save', payload: { ...tx1, id: 'tx-b', nominal: 2000 } },
    { opId: 'c', action: 'tx.save', payload: { ...tx1, id: 'tx-c', buku: 'istri' } },
    { opId: 'd', action: 'month', payload: { bulan: '2026-10' } }
  ] }));
  assert.deepStrictEqual(d.results.map(r => r.ok), [true, true, false, true]);
  assert.strictEqual(sheets.Transaksi.values.length, before + 1);
  assert.strictEqual(d.results[3].data.transaksi.find(x => x.id === 'tx-b').nominal, 2000);
});
t('kategori: tambah & batas izin', () => {
  const d = ok(call(I, 'kategori.save', { nama: 'Skincare', tipe: 'Pengeluaran', buku: 'istri' }));
  assert.strictEqual(d.kategori.id, 'skincare');
  fail(call(R, 'kategori.save', { id: 'skincare', nama: 'X', tipe: 'Pengeluaran', buku: 'istri' }), /Tidak bisa/);
  fail(call(I, 'kategori.save', { nama: 'Y', tipe: 'Pengeluaran', buku: 'riki' }), /buku orang lain/);
});
t('data persist setelah request baru (baca ulang dari sheet)', () => {
  const m = ok(call(I, 'month', { bulan: '2026-10' }));
  assert.ok(m.transaksi.find(x => x.id === 'tx-3').oleh === 'istri');
});
console.log(`\n${n} test lulus`);
