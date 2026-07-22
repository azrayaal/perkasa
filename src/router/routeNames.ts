/**
 * Konstanta nama route — dipakai router, sidebar, dan navigasi programatik
 * supaya tidak ada magic string yang tersebar.
 */
export const ROUTE = {
  login: 'login',
  dashboard: 'dashboard',
  performance: 'performance',
  sales: 'sales',
  salesDetail: 'sales-detail',
  purchases: 'purchases',
  purchaseDetail: 'purchase-detail',
  inventory: 'inventory',
  expenses: 'expenses',
  tax: 'tax',
  journal: 'journal',
  balanceSheet: 'balance-sheet',
  financialReports: 'financial-reports',
  master: 'master',
  settings: 'settings',
} as const

export type RouteName = (typeof ROUTE)[keyof typeof ROUTE]
