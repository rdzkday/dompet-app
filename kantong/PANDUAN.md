# Kantong: panduan pasang

Total waktu sekitar 20 menit, cukup sekali. Isi paket:

| Folder/file | Fungsinya |
|---|---|
| `app/` | PWA. Folder ini yang di-upload ke hosting. Tidak berisi data keuangan. |
| `apps-script/` | Backend: `Code.gs`, `Core.gs`, `appsscript.json` |
| `Kantong-Database.xlsx` | Database awal: kategori, kantong, budget, dan 462 transaksi April–Oktober |

---

## 1. Siapkan Google Sheet (5 menit)

1. Buka sheets.new dan beri nama **Kantong Database**.
2. **File → Import → Upload** → pilih `Kantong-Database.xlsx` → pilih **Replace spreadsheet** → **Import data**.
3. Cek ada 6 tab: Transaksi, Kategori, Kantong, Budget, Buku, Users.
4. Di tab **Buku** dan **Users**, ganti kolom `nama` yang berisi "Istri" dengan nama istri lo. Kolom `id` jangan diubah.

## 2. Pasang backend (5 menit)

1. Di sheet tadi: **Extensions → Apps Script**.
2. Ganti isi `Code.gs` dengan isi `apps-script/Code.gs`.
3. Klik **+ → Script**, beri nama `Core`, lalu tempel isi `apps-script/Core.gs`.
4. **Project Settings (ikon ⚙)** → centang *Show "appsscript.json" manifest file* → kembali ke Editor → ganti isinya dengan `apps-script/appsscript.json`.
5. **Save**, lalu kembali ke tab sheet dan refresh. Menu **Kantong** akan muncul.
6. Pilih **Kantong → 1. Setup / perbaiki struktur** dan izinkan akses (Advanced → Go to project jika muncul peringatan).

## 3. Deploy jadi API (3 menit)

1. Di Apps Script: **Deploy → New deployment** → ikon ⚙ → **Web app**.
2. Isi **Execute as: Me** dan **Who has access: Anyone** → **Deploy**.
3. Salin **Web app URL** (berakhiran `/exec`).
4. Kembali ke sheet: **Kantong → 2. Buat kode koneksi** → tempel URL. Akan muncul 2 kode, satu untuk lo dan satu untuk istri.

> "Anyone" aman di sini, karena tiap request wajib membawa kode akses. Tanpa kode, server menolak.

## 4. Hosting PWA (3 menit)

Rekomendasi: **Netlify** (gratis, HTTPS otomatis, update cukup drag-and-drop).

1. Daftar di netlify.com (bisa login Google). Akun diperlukan supaya situsnya permanen.
2. **Add new site → Deploy manually** → drag folder `app/`.
3. Ganti nama situs di **Site configuration** supaya URL-nya mudah diingat, misal `kantong-riki.netlify.app`.

## 5. Pasang di HP

- **Android (Chrome)**: buka URL → menu ⋮ → **Install app**.
- **iPhone (Safari)**: buka URL → Share → **Add to Home Screen**.

Lalu buka app dari home screen, tempel **kode koneksi**, dan pilih **Hubungkan**.

> iPhone: tempel kode **setelah** app dipasang dan dibuka dari home screen. iOS memisahkan penyimpanan Safari dan app home screen.

## 6. Setelah terhubung

1. **Pengaturan → Kantong**: isi **saldo saat ini** tiap kantong sesuai aplikasi bank. Untuk kartu kredit, isi tagihan dan limit.
2. Istri: rename kantong "Rekening" sesuai bank-nya, isi saldo, lalu cek **Kas Rumah Tangga**.
3. **Pengaturan → Budget bulanan**: atur budget buku Istri dan Rumah Tangga. Budget Riki sudah terisi dari sheet lama.
4. Share Google Sheet ke istri sebagai **Viewer**, lalu kirim kodenya lewat chat pribadi.

---

## Aturan akses

| | Buku Riki | Buku Istri | Rumah Tangga |
|---|---|---|---|
| Riki | tulis + baca | baca | tulis + baca |
| Istri | baca | tulis + baca | tulis + baca |

Aturan ini dijalankan di server, bukan cuma di tampilan.

## Cara update nanti

- **Backend**: tempel kode baru → **Deploy → Manage deployments → ✎ Edit → Version: New version → Deploy**. URL tidak berubah. Jangan pakai "New deployment", karena itu membuat URL baru dan kode koneksi harus dibuat ulang.
- **PWA**: Netlify → Deploys → drag folder `app/` lagi. HP otomatis memuat versi baru saat online.

## Darurat

- **HP hilang**: Kantong → *Ganti kode akses user…* → isi `riki` atau `istri`. Kode lama langsung mati.
- **Salah input massal**: Google Sheets → File → Version history. Transaksi yang dihapus dari app juga tidak benar-benar hilang: barisnya tetap ada dengan kolom `dihapus` terisi.

## Catatan data lama (April–Oktober)

- Tanggal per transaksi **diperkirakan** dari penanda "last update" di sheet lama. Totalnya per bulan tetap tepat.
- "Debit" lama tidak menyebut bank, jadi masuk ke kantong arsip **Debit (data lama)** yang nonaktif. Saldo bank dihitung dari angka yang lo isi di langkah 6.
- Bayar kartu kredit dan tarik tunai sekarang tercatat sebagai **Transfer**, bukan pengeluaran, sehingga tidak dobel hitung.
- Total pengeluaran yang berbeda dari sheet lama: April +214.470 (typo "Cafe/hagout" dulu tidak terhitung), Juli −1.218.443 (bayar CC jadi transfer, plus typo), Agustus +338.550 ("Payment wifi rumah" tanpa tujuan jadi pengeluaran Lain-lain).
- Topup rumah tangga Oktober tercatat sebagai Transfer ke **Kas Rumah Tangga**. April–September tetap kategori "Topup bulanan (lama)".
