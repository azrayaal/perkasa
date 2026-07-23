/**
 * Set ikon inline (stroke, viewBox 24) | sengaja tanpa dependency icon library
 * supaya bundle POC tetap ringan dan tidak ada request eksternal.
 * Tambah ikon baru cukup di sini; `IconName` otomatis ikut bertambah.
 */
export const ICON_PATHS = {
  dashboard: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  performance: 'M3 3v18h18M7 15l4-5 3 3 5-7',
  sales: 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0',
  purchase:
    'M1 4h13v12H1zM14 8h4l3 3v5h-7zM7 19.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0zM20 19.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0z',
  warehouse: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v9',
  expense: 'M20 12V8H6a2 2 0 0 1 0-4h12v4M4 6v12a2 2 0 0 0 2 2h14v-4M18 12h4v4h-4a2 2 0 0 1 0-4z',
  tax: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM15 9l-6 6M9.5 9.5h.01M14.5 14.5h.01',
  journal: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
  balance: 'M12 3v18M8 21h8M5 6.5l14-2M6 8l-3 6a3 3 0 0 0 6 0zM18 6l-3 6a3 3 0 0 0 6 0z',
  report: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
  master:
    'M12 6c4.4 0 8-1.1 8-2.5S16.4 1 12 1 4 2.1 4 3.5 7.6 6 12 6zM4 3.5v17C4 21.9 7.6 23 12 23s8-1.1 8-2.5v-17M4 12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5',
  pos: 'M3 3h18v5H3zM3 8v13h18V8M8 12h8M8 16h5M17 16h.01',
  receipt: 'M5 2v20l2.5-2 2.5 2 2-2 2 2 2.5-2 2.5 2V2l-2.5 2L14 2l-2 2-2-2-2.5 2z M9 8h6M9 12h6M9 16h3',
  drawer: 'M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM5 8V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M10 13h4',
  cash: 'M2 6h20v12H2zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM6 9h.01M18 15h.01',
  building: 'M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h.01M15 17h.01',
  users:
    'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M11 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0M22 19v-1a4 4 0 0 0-3-3.87M16 4.13a4 4 0 0 1 0 7.75',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 0 1-4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 0 1 0-4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 0 1 4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 0 1 0 4h-.2a1.7 1.7 0 0 0-1.4 1z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  menu: 'M3 6h18M3 12h18M3 18h18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M20 6L9 17l-5-5',
  close: 'M18 6L6 18M6 6l12 12',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  back: 'M19 12H5M12 19l-7-7 7-7',
  forward: 'M5 12h14M12 5l7 7-7 7',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L14.7 3.9a2 2 0 0 0-3.4 0z',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-5M12 8h.01',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15',
  trendUp: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
  trendDown: 'M23 18l-9.5-9.5-5 5L1 6M17 18h6v-6',
  filter: 'M22 3H2l8 9.5V19l4 2v-8.5z',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  calendar:
    'M7 3v4M17 3v4M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
  percent:
    'M19 5L5 19M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM17.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  collapse: 'M15 18l-6-6 6-6',
  expand: 'M9 18l6-6-6-6',
  chevronDown: 'M6 9l6 6 6-6',
} as const

export type IconName = keyof typeof ICON_PATHS
