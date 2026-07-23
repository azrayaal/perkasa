# Perkasa ERP

Proof of concept ERP untuk **PT Perkasa Gemilang Distrindo**, distributor material
konstruksi. Sembilan modul | penjualan, pembelian, gudang, performa, beban,
perpajakan, pembukuan, neraca, dan laporan keuangan | berdiri di atas **satu
sumber data**, bukan sembilan aplikasi yang ditempel jadi satu.

Vue 3 + TypeScript (strict, tanpa `any`) + Tailwind + Pinia + Vue Router.
Belum ada backend: seluruh data hidup di `localStorage` lewat lapisan `services/`
yang kontraknya sudah menyerupai HTTP API.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build produksi
npm run typecheck
```

### Akun demo

| Peran | Email | Kata sandi | Akses |
|---|---|---|---|
| Direksi | `direksi@perkasagemilang.co.id` | `perkasa123` | Seluruh modul |
| Akuntan | `akuntan@perkasagemilang.co.id` | `perkasa123` | Keuangan, pajak, pembukuan, laporan |
| Operasional | `operasional@perkasagemilang.co.id` | `perkasa123` | Penjualan, pembelian, gudang, kasir |
| Kasir | `kasir@perkasagemilang.co.id` | `perkasa123` | Hanya terminal POS & riwayatnya |

---

## Gagasan inti: dokumen adalah fakta, sisanya turunan

Kesalahan paling umum pada ERP tempelan adalah menyimpan angka yang sama di
banyak tempat: stok di modul gudang, nilai persediaan di modul akuntansi, DPP di
modul pajak. Begitu salah satu diubah tanpa yang lain, laporannya berselisih dan
tidak ada yang tahu mana yang benar.

Di sini hanya **dokumen** yang disimpan | faktur penjualan, faktur pembelian,
beban, bukti kas, hasil stock opname, dan jurnal manual. Selebihnya **dihitung
ulang setiap kali dibaca**:

```
                    ┌──────────────────────────────────────────┐
  Faktur Penjualan ─┤                                          ├─ Kartu Stok
  Faktur Pembelian ─┤   postingService.buildJournal()          ├─ Buku Besar
  Beban            ─┤   (aturan debit–kredit tiap dokumen)     ├─ Neraca Saldo
  Bukti Kas        ─┤                                          ├─ Neraca
  Stock Opname     ─┤                                          ├─ Laba Rugi
  Jurnal Manual    ─┘                                          ├─ Arus Kas
                    └──────────────────────────────────────────┴─ SPT PPN & PPh
```

Konsekuensi yang bisa diuji langsung di aplikasi:

- Nilai kartu stok gudang **selalu sama** dengan saldo akun `1300 Persediaan` di
  Neraca | dashboard menampilkannya berdampingan pada kartu "Uji Konsistensi Data".
- Sisa uang laci menurut rekap shift kasir = saldo akun `1130 Kas Kasir`.
- Total faktur penjualan belum lunas = saldo `1200 Piutang Usaha`.
- Total faktur pembelian belum lunas = saldo `2100 Utang Usaha`.
- Laba bersih di Laba Rugi = penambah ekuitas di Neraca (selisih neraca nol).
- Saldo kas akhir di Arus Kas = saldo Kas & Bank di Neraca.
- Angka SPT Masa PPN ditarik dari faktur, bukan diinput ulang.

Buka satu faktur draft di menu **Penjualan**, tekan *Posting Faktur*, lalu lihat
Gudang, Pembukuan, Perpajakan, dan Neraca | semuanya bergerak dari satu aksi.

### Aturan posting

| Dokumen | Jurnal yang terbentuk |
|---|---|
| Faktur penjualan (posted) | D `1200` Piutang · D `4200` Diskon · K `4100` Penjualan · K `2200` PPN Keluaran<br>D `5100` HPP · K `1300` Persediaan |
| Faktur pembelian | D `1300` Persediaan · D `1400` PPN Masukan · K `2100` Utang Usaha |
| Beban | D akun beban · D `1400` PPN Masukan · K `2210/2220/2230` PPh dipotong · K kas atau `2300` |
| Bukti kas masuk | D kas/bank · K `1200` Piutang |
| Bukti kas keluar | D `2100` Utang · K kas/bank |
| Selisih stock opname | D/K `5200` Selisih Persediaan lawan `1300` Persediaan |
| Penjualan kasir (tunai) | D `1130` Kas Kasir · K `4100` Penjualan · K `2200` PPN Keluaran<br>D `5100` HPP · K `1300` Persediaan |
| Penjualan kasir (QRIS/debit) | D `1250` Piutang Penyelenggara · D `6220` Beban MDR · K `4100` · K `2200` |
| Beli barang bekas di konter | D `1300` Persediaan (harga pokok standar) · D/K `5300` Selisih Penilaian · K `1130` Kas Kasir |
| Buka shift | D `1130` Kas Kasir · K `1110` Bank BCA |
| Tutup shift | D `1110` Bank (setoran) · D/K `7200` Selisih Kas · K `1130` Kas Kasir |
| Pencairan QRIS/debit (H+1) | D `1110` Bank · K `1250` Piutang Penyelenggara |
| Tukar tambah (menempel pada faktur penjualannya) | D `1300` Persediaan (harga pokok standar) · D/K `5300` Selisih Penilaian · D `1400` PPN Masukan · K `1200` Piutang Usaha |

Faktur berstatus **draft** sengaja tidak dijurnal dan tidak mengurangi stok |
itulah gunanya tombol posting.

### Kasir (POS)

Konter gudang pusat melayani pembeli eceran lewat terminal POS. Ia bukan form
penjualan cepat, melainkan modul dengan tiga kaidah kasnya sendiri:

- **Shift.** Uang fisik di laci selalu ada penanggung jawabnya. Kasir membuka
  shift dengan modal kembalian (dipindahkan dari bank ke akun `1130`), dan
  menutupnya dengan menghitung uang fisik.
- **Selisih kas.** Hitung fisik yang meleset tidak dibulatkan diam-diam | ia
  dijurnal ke `7200 Selisih Kas` dan langsung terlihat di Laba Rugi.
- **Settlement.** QRIS dan debit **bukan kas**. Dananya mengendap di
  penyelenggara (`1250`), dipotong MDR (`6220`), dan baru menjadi saldo bank
  setelah cair H+1. Tanpa pemisahan ini, saldo bank di Neraca akan lebih besar
  daripada rekening koran yang sesungguhnya.

Konter juga membeli besi bekas tunai dari pembawa scrap perorangan. Karena
mereka bukan PKP, pembelian itu tidak ber-PPN masukan.

### Tukar tambah besi bekas

Kontraktor lazim menyerahkan besi bekas sisa proyek sebagai potongan pembayaran.
Di sini itu **bukan diskon**, melainkan dua penyerahan yang saling dikompensasi:
perusahaan menjual barang baru sekaligus membeli barang bekas. Konsekuensinya
dijalankan penuh oleh sistem:

- Harga jual dan PPN keluaran tetap dihitung dari **harga penuh**.
- Barang bekas masuk gudang sebagai SKU kategori `Barang Bekas`, lalu dijual
  lagi ke peleburan | siklusnya tertutup.
- Bila pelanggan PKP, PPN atas penyerahan barang bekasnya menjadi **PPN Masukan**
  yang mengurangi PPN kurang bayar pada SPT masa itu.
- Yang berkurang adalah **piutang**, bukan pendapatan.

Tukar tambah juga tersedia di terminal kasir, dengan aturan posting yang sama.

Nilai tebus hasil negosiasi boleh berbeda dari harga pokok standar SKU bekas.
Persediaan tetap didebit sebesar harga pokok standar | supaya nilai kartu stok
terus sama persis dengan saldo akun `1300` | dan selisih tawar-menawarnya diakui
sebagai untung/rugi di akun `5300 Selisih Penilaian Barang Bekas` | berlaku sama
untuk pembelian scrap di konter.

---

## Struktur

```
src/
├── data/
│   ├── chartOfAccounts.ts   Bagan akun + alias `ACC` yang dipakai posting engine
│   ├── mockData.ts          Simulasi transaksi harian Jan–Jul 2026 (PRNG bersemai tetap)
│   └── db.ts                Penyimpanan localStorage; HANYA services yang boleh mengimpor
├── services/
│   ├── postingService.ts    Mesin posting: dokumen -> jurnal
│   ├── ledgerService.ts     Buku besar, neraca saldo, saldo akun
│   ├── reportService.ts     Neraca, laba rugi, arus kas, perubahan ekuitas
│   ├── salesService.ts      purchaseService · inventoryService · expenseService
│   ├── taxService.ts        journalService · performanceService · dashboardService
│   └── clock.ts             Tanggal "hari ini" aplikasi (demo berjalan di 22 Jul 2026)
├── stores/                  auth (sesi & peran) · period (periode global) · toast
├── components/
│   ├── ui/                  Primitif design system (Base*)
│   ├── erp/                 Komponen khas ERP: jurnal, blok laporan, editor baris faktur
│   ├── charts/              Grafik SVG; palet lolos uji buta warna & kontras
│   └── layout/              Sidebar, topbar, logo
└── views/                   Satu file per halaman modul
```

Aturan yang dijaga di seluruh kode:

- **Tidak ada `any`.** Seluruh kontrak tinggal di `src/types/index.ts`.
- **Tidak ada logika akuntansi di komponen.** View hanya merender hasil service.
- **Periode adalah konteks global.** Pemilih periode ada di topbar dan dibaca
  semua halaman lewat `periodStore`, sehingga mustahil membandingkan dua halaman
  yang diam-diam memakai rentang tanggal berbeda.
- **Status `overdue` tidak pernah disimpan**, selalu dihitung dari tanggal jatuh
  tempo | tidak ada dokumen yang statusnya basi.

## Data demo

Transaksi tidak ditulis satu per satu, melainkan **disimulasikan hari demi hari**
dari 1 Januari sampai 22 Juli 2026: penjualan menggerus stok, stok tipis memicu
pembelian ke pemasok, pelunasan menggerakkan kas, dan pajak masa disetor bulan
berikutnya. Karena PRNG-nya bersemai tetap, semua orang melihat angka yang sama.

Hasilnya: 125 faktur penjualan bertermin (17 disertai tukar tambah, 3 penjualan
besi bekas ke peleburan), 113 faktur pembelian, 75 beban, 145 shift kasir dengan
1.024 struk POS, dan 1.952 entri jurnal — dengan pendapatan Rp 9,66 M (Rp 1,3 M
di antaranya dari konter), marjin kotor 22,5%, laba bersih 6,3%, dan neraca yang
seimbang sempurna.

Semua perubahan tersimpan di browser. **Pengaturan → Reset Data Demo**
mengembalikannya ke kondisi awal.

## Menuju produksi

Setiap fungsi service sudah ditandai `TODO: replace with real API call` beserta
endpoint yang dimaksud. Yang perlu diganti hanya isi fungsinya | `services/http.ts`
menjadi `fetch()`, dan `data/db.ts` dihapus. Komponen tidak perlu berubah karena
semuanya sudah `async` dan bertipe.
