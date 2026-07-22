/**
 * Database lokal untuk POC.
 *
 * Menyimpan HANYA fakta yang dicatat manusia: master data dan dokumen
 * transaksi. Jurnal, buku besar, neraca, dan laporan keuangan TIDAK disimpan |
 * semuanya dihitung ulang dari dokumen di `services/postingService.ts`. Itulah
 * yang membuat modul-modulnya mustahil "berbeda angka".
 *
 * HANYA boleh diimport oleh folder `services/`.
 *
 * TODO: hapus file ini saat backend siap | `services/` akan memanggil API dan
 * seluruh operasi tulis pindah ke server.
 */
import {
  company as seedCompany,
  customers as seedCustomers,
  generateSeed,
  products as seedProducts,
  suppliers as seedSuppliers,
  warehouses as seedWarehouses,
} from '@/data/mockData'
import type {
  CompanyProfile,
  Customer,
  Expense,
  ManualJournal,
  OpeningBalance,
  Payment,
  Product,
  PurchaseInvoice,
  SalesInvoice,
  StockAdjustment,
  StockMove,
  Supplier,
  Warehouse,
} from '@/types'

export interface Database {
  company: CompanyProfile
  customers: Customer[]
  suppliers: Supplier[]
  products: Product[]
  warehouses: Warehouse[]
  openingBalances: OpeningBalance[]
  openingStockMoves: StockMove[]
  salesInvoices: SalesInvoice[]
  purchaseInvoices: PurchaseInvoice[]
  expenses: Expense[]
  payments: Payment[]
  stockAdjustments: StockAdjustment[]
  manualJournals: ManualJournal[]
}

/** Versi dinaikkan setiap bentuk data berubah, supaya seed lama dibuang. */
const STORAGE_KEY = 'perkasa-erp.db.v3'

function seed(): Database {
  const generated = generateSeed()

  return {
    company: structuredClone(seedCompany),
    customers: structuredClone(seedCustomers),
    suppliers: structuredClone(seedSuppliers),
    products: structuredClone(seedProducts),
    warehouses: structuredClone(seedWarehouses),
    ...generated,
  }
}

let cache: Database | null = null

function persist(value: Database): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Mode privat / storage penuh: aplikasi tetap jalan dengan data in-memory.
  }
}

function load(): Database {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Database
  } catch {
    // Data korup | jatuh kembali ke seed di bawah.
  }

  const fresh = seed()
  persist(fresh)
  return fresh
}

/** Akses baca. Jangan memutasi hasilnya langsung | pakai `commit()`. */
export function db(): Database {
  cache ??= load()
  return cache
}

/** Satu-satunya jalur tulis; otomatis menyimpan hasilnya. */
export function commit<T>(mutate: (database: Database) => T): T {
  const current = db()
  const result = mutate(current)
  persist(current)
  return result
}

/** Kembalikan seluruh data ke kondisi awal (tombol "Reset data demo"). */
export function resetDatabase(): void {
  cache = seed()
  persist(cache)
}

/**
 * Nomor dokumen berikutnya, mis. `nextNumber('INV', 128)` -> "INV-2026-0129".
 * Deterministik supaya hasilnya enak dibaca saat demo.
 */
export function nextNumber(prefix: string, existingCount: number): string {
  return `${prefix}-${db().company.fiscalYear}-${String(existingCount + 1).padStart(4, '0')}`
}
