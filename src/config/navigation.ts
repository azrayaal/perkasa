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

/**
 * Sumber tunggal struktur sidebar.
 * EXTENSION POINT: tambah modul baru di sini — daftarkan route-nya di
 * `router/index.ts` dengan `meta.roles` yang sama, lalu menunya otomatis muncul
 * untuk role yang berhak.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Operasional',
    items: [
      { name: ROUTE.dashboard, label: 'Dashboard', icon: 'dashboard', roles: ['admin'] },
      { name: ROUTE.residentList, label: 'Resident', icon: 'residents', roles: ['admin'] },
      { name: ROUTE.units, label: 'Unit & Properti', icon: 'unit', roles: ['admin'] },
    ],
  },
  {
    title: 'Layanan',
    items: [
      { name: ROUTE.billing, label: 'Billing', icon: 'billing', roles: ['admin'] },
      { name: ROUTE.health, label: 'Kesehatan', icon: 'health', roles: ['admin'] },
      { name: ROUTE.activities, label: 'Aktivitas', icon: 'activity', roles: ['admin'] },
      { name: ROUTE.familyAccess, label: 'Akses Keluarga', icon: 'family', roles: ['admin'] },
    ],
  },
  {
    title: 'Portal',
    items: [
      { name: ROUTE.myPortal, label: 'Portal Saya', icon: 'user', roles: ['resident'] },
      // Ikon sengaja dibedakan dari "Akses Keluarga": di rail ikon, dua menu
      // admin dengan gambar orang yang mirip mustahil dibedakan sekilas.
      { name: ROUTE.familyPortal, label: 'Family Portal', icon: 'user', roles: ['family', 'admin'] },
    ],
  },
  {
    title: 'Sistem',
    items: [{ name: ROUTE.settings, label: 'Pengaturan', icon: 'settings', roles: ['admin', 'resident', 'family'] }],
  },
]

/** Halaman awal tiap role setelah login. */
export const ROLE_HOME: Record<UserRole, RouteName> = {
  admin: ROUTE.dashboard,
  resident: ROUTE.myPortal,
  family: ROUTE.familyPortal,
}

/** Label role untuk ditampilkan di UI. */
export const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Staf Ginkgo',
  resident: 'Penghuni',
  family: 'Keluarga',
}

/** Sidebar hanya menampilkan section yang punya minimal satu menu untuk role ini. */
export function navSectionsForRole(role: UserRole): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(role)),
  })).filter((section) => section.items.length > 0)
}
