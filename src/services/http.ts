/**
 * Pembungkus transport bersama untuk seluruh service.
 *
 * Semua service memanggil `respond()` alih-alih mengembalikan data langsung,
 * supaya kontraknya (async + latency + clone) identik dengan HTTP call.
 *
 * TODO: replace with real API call | ganti isi `respond()` dengan `fetch()`
 * ke API gateway; signature service di atasnya tidak perlu berubah.
 */

/** Latensi buatan supaya loading state benar-benar teruji di UI. */
const MOCK_LATENCY_MS = 220

export function respond<T>(payload: T): Promise<T> {
  // structuredClone mencegah komponen tidak sengaja memutasi data global |
  // meniru perilaku response HTTP yang selalu objek baru.
  const snapshot = structuredClone(payload)

  return new Promise((resolve) => {
    setTimeout(() => resolve(snapshot), MOCK_LATENCY_MS)
  })
}

/** Error domain standar; komponen cukup menangani satu bentuk error. */
export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} dengan id "${id}" tidak ditemukan.`)
    this.name = 'NotFoundError'
  }
}

/** Aturan bisnis yang dilanggar (stok kurang, jurnal tidak seimbang, dll). */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
