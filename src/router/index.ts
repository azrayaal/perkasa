import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { ROLE_HOME } from '@/config/navigation'
import { ROUTE } from '@/router/routeNames'
import { useAuthStore } from '@/stores/authStore'
import type { UserRole } from '@/types'

declare module 'vue-router' {
  interface RouteMeta {
    /** Role yang boleh mengakses; kosong = halaman publik. */
    roles?: UserRole[]
    title?: string
    /** Deskripsi singkat di bawah judul halaman. */
    subtitle?: string
  }
}

/** Tiga peran yang dipakai berulang; ditulis sekali supaya konsisten. */
const ALL: UserRole[] = ['direksi', 'akuntan', 'operasional']
const FINANCE: UserRole[] = ['direksi', 'akuntan']
const OPERATIONS: UserRole[] = ['direksi', 'akuntan', 'operasional']

const routes: RouteRecordRaw[] = [
  {
    path: '/masuk',
    name: ROUTE.login,
    component: () => import('@/views/LoginView.vue'),
    meta: { title: 'Masuk' },
  },
  {
    path: '/',
    name: ROUTE.dashboard,
    component: () => import('@/views/DashboardView.vue'),
    meta: { roles: ALL, title: 'Dashboard' },
  },
  {
    path: '/performa',
    name: ROUTE.performance,
    component: () => import('@/views/PerformanceView.vue'),
    meta: { roles: FINANCE, title: 'Performa' },
  },
  {
    path: '/penjualan',
    name: ROUTE.sales,
    component: () => import('@/views/SalesView.vue'),
    meta: { roles: OPERATIONS, title: 'Penjualan' },
  },
  {
    path: '/penjualan/:id',
    name: ROUTE.salesDetail,
    component: () => import('@/views/SalesDetailView.vue'),
    // `props: true` menjaga view tetap murni: id datang sebagai prop bertipe.
    props: true,
    meta: { roles: OPERATIONS, title: 'Detail Faktur Penjualan' },
  },
  {
    path: '/pembelian',
    name: ROUTE.purchases,
    component: () => import('@/views/PurchaseView.vue'),
    meta: { roles: OPERATIONS, title: 'Pembelian' },
  },
  {
    path: '/pembelian/:id',
    name: ROUTE.purchaseDetail,
    component: () => import('@/views/PurchaseDetailView.vue'),
    props: true,
    meta: { roles: OPERATIONS, title: 'Detail Faktur Pembelian' },
  },
  {
    path: '/gudang',
    name: ROUTE.inventory,
    component: () => import('@/views/InventoryView.vue'),
    meta: { roles: OPERATIONS, title: 'Gudang & Persediaan' },
  },
  {
    path: '/beban',
    name: ROUTE.expenses,
    component: () => import('@/views/ExpenseView.vue'),
    meta: { roles: FINANCE, title: 'Beban Operasional' },
  },
  {
    path: '/perpajakan',
    name: ROUTE.tax,
    component: () => import('@/views/TaxView.vue'),
    meta: { roles: FINANCE, title: 'Perpajakan' },
  },
  {
    path: '/pembukuan',
    name: ROUTE.journal,
    component: () => import('@/views/JournalView.vue'),
    meta: { roles: FINANCE, title: 'Pembukuan' },
  },
  {
    path: '/neraca',
    name: ROUTE.balanceSheet,
    component: () => import('@/views/BalanceSheetView.vue'),
    meta: { roles: FINANCE, title: 'Neraca' },
  },
  {
    path: '/laporan-keuangan',
    name: ROUTE.financialReports,
    component: () => import('@/views/FinancialReportsView.vue'),
    meta: { roles: FINANCE, title: 'Laporan Keuangan' },
  },
  {
    path: '/master-data',
    name: ROUTE.master,
    component: () => import('@/views/MasterDataView.vue'),
    meta: { roles: ALL, title: 'Master Data' },
  },
  {
    path: '/pengaturan',
    name: ROUTE.settings,
    component: () => import('@/views/SettingsView.vue'),
    meta: { roles: ALL, title: 'Pengaturan' },
  },
  // EXTENSION POINT: tambah modul baru di sini (mis. /produksi, /aset-tetap).
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

/**
 * Guard tunggal: cek sesi, lalu cek role.
 * Aturan akses hidup di `meta.roles` tiap route — bukan if-else tersebar di view.
 */
router.beforeEach((to) => {
  const auth = useAuthStore()
  const allowedRoles = to.meta.roles

  if (!allowedRoles) {
    // Halaman publik (login): user yang sudah masuk dilempar ke home role-nya.
    if (to.name === ROUTE.login && auth.user) return { name: ROLE_HOME[auth.user.role] }
    return true
  }

  if (!auth.user) return { name: ROUTE.login, query: { redirect: to.fullPath } }

  if (!allowedRoles.includes(auth.user.role)) return { name: ROLE_HOME[auth.user.role] }

  return true
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Perkasa ERP` : 'Perkasa ERP'
})

export default router
