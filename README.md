# Ginkgo Living ERP — Resident Journey (POC Frontend)

POC frontend-only yang membuktikan data resident dari modul terpisah (property, billing,
kesehatan, aktivitas, family portal) bisa disatukan dalam satu sistem terpadu — lengkap
dengan login berjenjang, sidebar ERP, dan aksi yang benar-benar mengubah data.

**Stack:** Vue 3 (`<script setup>`) · TypeScript strict · Tailwind CSS · vue-router · Pinia
**Data:** dummy, tanpa backend — tersimpan di `localStorage`, jadi perubahan bertahan setelah reload.

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm run build
```

## Akun demo

| Peran | Email | Kata sandi | Melihat apa |
|---|---|---|---|
| Staf Ginkgo | `admin@ginkgo.id` | `admin123` | Seluruh modul + semua aksi |
| Penghuni | `budi@ginkgo.id` | `resident123` | Hanya datanya sendiri, termasuk detail medis |
| Keluarga | `ani@keluarga.id` | `family123` | Ringkasan saja, **tanpa** detail medis |

Tombol "Isi" di halaman login mengisi kredensial secara otomatis.

## Apa yang dilihat tiap peran

**Staf** — Dashboard (KPI + linimasa lintas modul), Resident, Unit & Properti, Billing,
Kesehatan, Aktivitas, Akses Keluarga, Pengaturan.

**Penghuni** — "Portal Saya": unit, aktivitas (boleh booking sendiri), billing dan catatan
kesehatannya sendiri (read-only), serta daftar keluarga yang punya akses.

**Keluarga** — "Family Portal": unit, ringkasan tagihan (total & status saja, tanpa breakdown),
ringkasan kesehatan (*kondisi stabil* / *perlu perhatian* saja), dan aktivitas.

## Aksi yang berfungsi

| Aksi | Lokasi | Peran |
|---|---|---|
| Tambah resident (otomatis mengisi unit) | Resident | Staf |
| Aktifkan / nonaktifkan penghuni | Detail Resident | Staf |
| Buat invoice (total dihitung otomatis) | Detail Resident · Billing | Staf |
| Tandai invoice lunas | Detail Resident · Billing | Staf |
| Tambah catatan pemeriksaan (EHR) | Detail Resident | Staf |
| Booking aktivitas | Detail Resident · Portal Saya | Staf, Penghuni |
| Tandai hadir / batalkan booking | Detail Resident · Aktivitas | Staf |
| Undang keluarga & cabut akses portal | Detail Resident · Akses Keluarga | Staf |
| Ubah status okupansi unit | Detail Resident · Unit | Staf |
| Reset seluruh data demo | Pengaturan | Semua |

## Struktur

```
src/
  types/index.ts          Semua interface & union type — single source of truth, tanpa `any`
  data/mockData.ts        Data seed + akun demo (kondisi awal)
  data/db.ts              Database lokal (localStorage). Satu-satunya jalur tulis: commit()
  services/               http, auth, resident, billing, ehr, activity, family, unit,
                          dashboard, reports — semua async, semua bertanda TODO ganti API
  composables/            useResidentData (agregat 360°), useResidentList
  stores/                 authStore (sesi), residentStore (pilihan), toastStore (notifikasi)
  config/navigation.ts    Struktur sidebar + peta role → halaman awal
  components/ui/          BaseBadge, BaseButton, BaseCard, BaseInput, BaseModal, BaseSelect,
                          BaseTable, BaseAvatar, BaseIcon, StatCard, EmptyState, LoadingState, ToastHost
  components/layout/      AppSidebar, AppTopbar
  components/resident/    ResidentCard, ResidentDetailHeader, UnitSection, BillingSection,
                          EhrSection, ActivitySection, FamilyAccessSection,
                          BillingSummaryCard, HealthSummaryCard
  views/                  Login, Dashboard, ResidentList, ResidentDetail, Units, Billing,
                          Health, Activities, FamilyAccess, MyPortal, FamilyPortal, Settings
  router/                 index.ts (route + guard role), routeNames.ts (konstanta)
  utils/                  formatCurrency, formatDate, statusBadgeColor
```

## Design system

Palet lime + rail gelap, mengikuti referensi dashboard yang diberikan.

| Peran | Warna |
|---|---|
| Aksen sorotan (nav aktif, pill status, avatar) | Lime `#C4F33A` |
| Aksi utama (tombol primer, chip solid, sidebar) | Gelap `#17211C` |
| Latar halaman / kartu | Putih |
| Garis | `#E8EAE7` |

**Aturan kontras yang ditegakkan:** lime tidak pernah jadi warna teks di latar terang, dan
teks di atas lime selalu gelap (`--brand-ink`). Karena itu tombol primer memakai warna gelap,
bukan lime — lime disimpan untuk sorotan. Tautan di tabel memakai teks gelap dengan garis
bawah lime.

**Sidebar** adalah rail ikon 76px yang selalu gelap, dengan item aktif berupa kotak lime
membulat. Label tetap tersedia sebagai tooltip saat hover — rail tanpa nama memaksa user
menebak. Di bawah breakpoint desktop, sidebar melebar jadi drawer 256px berlabel lengkap
dan dikelompokkan per section.

**Light mode adalah default.** Aplikasi tidak mengikuti `prefers-color-scheme` supaya tampilan
awal selalu sama saat demo; dark mode hanya aktif kalau user menekan tombol tema di topbar.

**Light & dark mode lewat token.** Semua warna dirujuk lewat CSS variable di `src/assets/main.css`
(`--brand`, `--page`, `--surface`, `--line`, dst), lalu dipetakan ke Tailwind di
`tailwind.config.js`. Konsekuensinya: **tidak ada satu pun `dark:` di komponen** — ganti tema
hanya menukar nilai variabel di blok `.dark`. Tema diterapkan sebelum paint pertama (skrip
inline di `index.html`) supaya tidak ada kedipan warna.

Sidebar punya set token sendiri (`--sidebar`, `--sidebar-ink`, dst) karena selalu gelap; kalau
ia memakai token halaman, ikonnya akan ikut menghitam dan hilang di light mode.

Detail lain:

- Radius: 8px tombol/input, 12px kotak ikon rail, 14px kartu & modal, penuh untuk pill/avatar
- Elevasi tipis: `shadow-raised` (kartu) → `shadow-overlay` (tooltip/dropdown) → `shadow-modal`
- Skala tipografi jadi token Tailwind (`text-h1`, `text-metric`, `text-body`, `text-small`,
  `text-code`); judul halaman dipusatkan di `PageHeader.vue`
- Hanya SATU kartu statistik per baris yang diberi blok lime penuh — sorotan kehilangan makna
  kalau semuanya berwarna

## Aturan arsitektur

1. **Komponen tidak pernah menyentuh data mentah.** Semua baca/tulis lewat `services/`.
   Ganti ke backend = ganti isi `services/`, komponen tidak disentuh.
2. **Semua service async** dan memakai `respond()` di `services/http.ts` (latency + clone).
   Setiap fungsi ditandai `// TODO: replace with real API call` beserta endpoint yang dituju.
3. **Tidak ada logika bisnis di template.** Join data, agregasi billing, penilaian kondisi
   kesehatan, dan efek samping (menempatkan penghuni → unit jadi `occupied`) semuanya di service.
4. **Kontrol akses deklaratif.** Hak akses hidup di `meta.roles` tiap route dan `roles` tiap
   item sidebar — bukan if-else yang tersebar di view.
5. **Warna & label status config-driven.** `utils/statusBadgeColor.ts` memakai
   `Record<BadgeStatus, BadgeTone>` yang exhaustive: menambah status baru di `types/index.ts`
   akan gagal compile sampai warnanya didefinisikan.
6. **Satu composable untuk tiga view.** Detail Resident, Portal Saya, dan Family Portal memakai
   `useResidentData()` yang sama; bedanya hanya flag `isFamilyView`.

## Privasi data medis

`getResidentDetail(id, { isFamilyView: true })` mengembalikan `ehr: null` dan hanya menyertakan
`healthSummary`. Pemangkasan terjadi **di service layer**, bukan disembunyikan di template —
jadi saat `services/` diganti API sungguhan, aturan yang sama tinggal dipindah ke server.

Terverifikasi lewat tes end-to-end: pada sesi keluarga, string `mmHg` dan catatan medis tidak
pernah muncul di DOM.

## Extension point

Ditandai `// EXTENSION POINT:` di `router/index.ts`, `config/navigation.ts`, `DashboardView.vue`,
`ResidentDetailView.vue`, `MyPortalView.vue`, dan `FamilyPortalView.vue`.

Menambah modul baru = tambah route (dengan `meta.roles`) + satu entri di `NAV_SECTIONS`.
Menunya otomatis muncul untuk role yang berhak.

## Catatan

- Resident **R003 (Hendra Wijaya)** sengaja tidak punya billing, EHR, maupun keluarga —
  halamannya menampilkan `EmptyState` yang rapi, bukan crash.
- Perubahan tersimpan di `localStorage` browser. Kembalikan ke awal lewat **Pengaturan →
  Reset Data Demo**.
- Watcher Vite memakai polling (lihat komentar di `vite.config.ts`) karena kuota inotify mesin
  dev sering habis. Setelah menaikkan limit kernel, jalankan `VITE_USE_POLLING=false npm run dev`.
# gingko
