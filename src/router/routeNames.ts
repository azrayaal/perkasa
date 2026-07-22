/**
 * Konstanta nama route — dipakai router, sidebar, dan navigasi programatik
 * supaya tidak ada magic string yang tersebar.
 */
export const ROUTE = {
  login: 'login',
  dashboard: 'dashboard',
  residentList: 'resident-list',
  residentDetail: 'resident-detail',
  billing: 'billing',
  health: 'health',
  activities: 'activities',
  units: 'units',
  familyAccess: 'family-access',
  myPortal: 'my-portal',
  familyPortal: 'family-portal',
  settings: 'settings',
} as const

export type RouteName = (typeof ROUTE)[keyof typeof ROUTE]
