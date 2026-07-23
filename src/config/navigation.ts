import { ROUTE, type RouteName } from '@/router/routeNames'
import type { IconName } from '@/components/ui/icons'
import type { UserRole } from '@/types'

export interface NavItem {
  name: RouteName
  label: string
  icon: IconName
  /** Role yang boleh melihat menu ini. */
  roles: UserRole[]
}

export interface NavSection {
  title: string
  items: NavItem[]
}

const ALL: UserRole[] = ['direksi', 'akuntan', 'operasional']
const FINANCE: UserRole[] = ['direksi', 'akuntan']
/** Yang boleh berdiri di konter. Kasir TIDAK punya akses ke menu lain. */
const COUNTER: UserRole[] = ['direksi', 'operasional', 'kasir']
/** Pengawasan kasir: yang menagih pertanggungjawaban uang laci. */
const SUPERVISOR: UserRole[] = ['direksi', 'akuntan', 'operasional']

/**
 * Sumber tunggal struktur sidebar.
 *
 * Urutannya sengaja mengikuti alur uang di perusahaan dagang:
 * transaksi harian (penjualan → pembelian → gudang) menghasilkan catatan
 * keuangan (beban → pajak → pembukuan), yang bermuara pada laporan
 * (neraca → laporan keuangan).
 *
 * EXTENSION POINT: tambah modul baru di sini | daftarkan route-nya di
 * `router/index.ts` dengan `meta.roles` yang sama, lalu menunya otomatis muncul
 * untuk role yang berhak.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Ikhtisar',
    items: [
      { name: ROUTE.dashboard, label: 'Dashboard', icon: 'dashboard', roles: ALL },
      { name: ROUTE.performance, label: 'Performa', icon: 'performance', roles: FINANCE },
    ],
  },
  {
    title: 'Kasir',
    items: [
      { name: ROUTE.pos, label: 'Terminal POS', icon: 'pos', roles: COUNTER },
      { name: ROUTE.posHistory, label: 'Riwayat Transaksi', icon: 'receipt', roles: COUNTER },
      { name: ROUTE.posShifts, label: 'Shift & Setoran', icon: 'drawer', roles: SUPERVISOR },
    ],
  },
  {
    title: 'Operasional',
    items: [
      { name: ROUTE.sales, label: 'Penjualan', icon: 'sales', roles: ALL },
      { name: ROUTE.purchases, label: 'Pembelian', icon: 'purchase', roles: ALL },
      { name: ROUTE.inventory, label: 'Gudang', icon: 'warehouse', roles: ALL },
    ],
  },
  {
    title: 'Keuangan',
    items: [
      { name: ROUTE.expenses, label: 'Beban', icon: 'expense', roles: FINANCE },
      { name: ROUTE.tax, label: 'Perpajakan', icon: 'tax', roles: FINANCE },
      { name: ROUTE.journal, label: 'Pembukuan', icon: 'journal', roles: FINANCE },
    ],
  },
  {
    title: 'Laporan',
    items: [
      { name: ROUTE.balanceSheet, label: 'Neraca', icon: 'balance', roles: FINANCE },
      { name: ROUTE.financialReports, label: 'Laporan Keuangan', icon: 'report', roles: FINANCE },
    ],
  },
  {
    title: 'Sistem',
    items: [
      { name: ROUTE.master, label: 'Master Data', icon: 'master', roles: ALL },
      { name: ROUTE.settings, label: 'Pengaturan', icon: 'settings', roles: [...ALL, 'kasir'] },
    ],
  },
]

/** Halaman awal tiap role setelah login. */
export const ROLE_HOME: Record<UserRole, RouteName> = {
  direksi: ROUTE.dashboard,
  akuntan: ROUTE.dashboard,
  operasional: ROUTE.sales,
  kasir: ROUTE.pos,
}

/** Label role untuk ditampilkan di UI. */
export const ROLE_LABEL: Record<UserRole, string> = {
  direksi: 'Direksi',
  akuntan: 'Akuntan',
  operasional: 'Operasional',
  kasir: 'Kasir',
}

/** Sidebar hanya menampilkan section yang punya minimal satu menu untuk role ini. */
export function navSectionsForRole(role: UserRole): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(role)),
  })).filter((section) => section.items.length > 0)
}
