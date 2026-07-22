/**
 * Database lokal untuk POC.
 *
 * Menggantikan array mock read-only supaya aksi (bayar invoice, tambah catatan
 * EHR, booking aktivitas, dll) benar-benar mengubah data dan bertahan setelah
 * halaman di-reload.
 *
 * HANYA boleh diimport oleh folder `services/`.
 *
 * TODO: hapus file ini saat backend siap — `services/` akan memanggil API dan
 * seluruh operasi tulis pindah ke server.
 */
import {
  activities as seedActivities,
  billing as seedBilling,
  ehr as seedEhr,
  familyMembers as seedFamilyMembers,
  residents as seedResidents,
  units as seedUnits,
} from '@/data/mockData'
import type { Activity, Billing, Ehr, FamilyMember, Resident, Unit } from '@/types'

export interface Database {
  residents: Resident[]
  units: Unit[]
  familyMembers: FamilyMember[]
  billing: Billing[]
  ehr: Ehr[]
  activities: Activity[]
}

/** Versi ikut dinaikkan kalau bentuk data berubah, supaya seed lama dibuang. */
const STORAGE_KEY = 'ginkgo-living.db.v1'

function seed(): Database {
  return structuredClone({
    residents: seedResidents,
    units: seedUnits,
    familyMembers: seedFamilyMembers,
    billing: seedBilling,
    ehr: seedEhr,
    activities: seedActivities,
  })
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
    // Data korup — jatuh kembali ke seed di bawah.
  }

  const fresh = seed()
  persist(fresh)
  return fresh
}

/** Akses baca. Jangan memutasi hasilnya langsung — pakai `commit()`. */
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
 * Generator id berurutan, mis. `nextId('INV', 4)` -> "INV-0004".
 * Deterministik supaya hasilnya enak dibaca di demo.
 */
export function nextId(prefix: string, existingCount: number, pad = 3): string {
  return `${prefix}-${String(existingCount + 1).padStart(pad, '0')}`
}
