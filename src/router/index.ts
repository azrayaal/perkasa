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
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: ROUTE.login,
    component: () => import('@/views/LoginView.vue'),
    meta: { title: 'Masuk' },
  },
  {
    path: '/',
    name: ROUTE.dashboard,
    component: () => import('@/views/DashboardView.vue'),
    meta: { roles: ['admin'], title: 'Dashboard' },
  },
  {
    path: '/residents',
    name: ROUTE.residentList,
    component: () => import('@/views/ResidentListView.vue'),
    meta: { roles: ['admin'], title: 'Resident' },
  },
  {
    path: '/residents/:id',
    name: ROUTE.residentDetail,
    component: () => import('@/views/ResidentDetailView.vue'),
    // `props: true` menjaga view tetap murni: id datang sebagai prop bertipe.
    props: true,
    meta: { roles: ['admin'], title: 'Detail Resident' },
  },
  {
    path: '/units',
    name: ROUTE.units,
    component: () => import('@/views/UnitsView.vue'),
    meta: { roles: ['admin'], title: 'Unit & Properti' },
  },
  {
    path: '/billing',
    name: ROUTE.billing,
    component: () => import('@/views/BillingView.vue'),
    meta: { roles: ['admin'], title: 'Billing' },
  },
  {
    path: '/health',
    name: ROUTE.health,
    component: () => import('@/views/HealthView.vue'),
    meta: { roles: ['admin'], title: 'Kesehatan' },
  },
  {
    path: '/activities',
    name: ROUTE.activities,
    component: () => import('@/views/ActivitiesView.vue'),
    meta: { roles: ['admin'], title: 'Aktivitas' },
  },
  {
    path: '/family-access',
    name: ROUTE.familyAccess,
    component: () => import('@/views/FamilyAccessView.vue'),
    meta: { roles: ['admin'], title: 'Akses Keluarga' },
  },
  {
    path: '/my-portal',
    name: ROUTE.myPortal,
    component: () => import('@/views/MyPortalView.vue'),
    meta: { roles: ['resident'], title: 'Portal Saya' },
  },
  {
    path: '/family-portal',
    name: ROUTE.familyPortal,
    component: () => import('@/views/FamilyPortalView.vue'),
    meta: { roles: ['family', 'admin'], title: 'Family Portal' },
  },
  {
    path: '/settings',
    name: ROUTE.settings,
    component: () => import('@/views/SettingsView.vue'),
    meta: { roles: ['admin', 'resident', 'family'], title: 'Pengaturan' },
  },
  // EXTENSION POINT: tambah modul baru di sini (mis. /care-plan, /staff, /reports).
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
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
  document.title = to.meta.title
    ? `${to.meta.title} · Ginkgo Living ERP`
    : 'Ginkgo Living ERP'
})

export default router
