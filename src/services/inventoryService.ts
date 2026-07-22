/**
 * Gudang & persediaan.
 *
 * Kartu stok TIDAK disimpan. Ia dirakit ulang dari saldo awal + faktur
 * pembelian (barang masuk) + faktur penjualan non-draft (barang keluar) +
 * hasil stock opname. Karena itu, nilai persediaan di halaman Gudang selalu
 * sama dengan saldo akun 1300 Persediaan di Neraca — keduanya bersumber dari
 * dokumen yang sama.
 */
import { db, commit } from '@/data/db'
import { respond, ValidationError } from '@/services/http'
import { today } from '@/services/clock'
import { daysBetween } from '@/utils/date'
import type {
  IsoDate,
  NewStockAdjustmentPayload,
  ProductId,
  StockAdjustment,
  StockCardRow,
  StockMove,
  StockPosition,
  StockStatus,
  WarehouseId,
  WarehouseSummary,
} from '@/types'

/** Seluruh mutasi stok, urut tanggal. Sinkron supaya bisa dipakai service lain. */
export function buildStockMoves(): StockMove[] {
  const database = db()
  const productById = new Map(database.products.map((row) => [row.id, row]))

  const moves: StockMove[] = [...database.openingStockMoves]

  for (const invoice of database.purchaseInvoices) {
    for (const line of invoice.lines) {
      moves.push({
        id: `SM-${invoice.id}-${line.productId}`,
        date: invoice.date,
        productId: line.productId,
        warehouseId: invoice.warehouseId,
        qty: line.qty,
        type: 'in',
        unitCost: productById.get(line.productId)?.cost ?? line.unitPrice,
        refType: 'purchase',
        refId: invoice.id,
        refNumber: invoice.number,
        note: 'Penerimaan barang dari pemasok',
      })
    }
  }

  for (const invoice of database.salesInvoices) {
    // Draft belum mengeluarkan barang — sama seperti ia belum dijurnal.
    if (invoice.status === 'draft') continue

    for (const line of invoice.lines) {
      moves.push({
        id: `SM-${invoice.id}-${line.productId}`,
        date: invoice.date,
        productId: line.productId,
        warehouseId: invoice.warehouseId,
        qty: -line.qty,
        type: 'out',
        unitCost: productById.get(line.productId)?.cost ?? 0,
        refType: 'sales',
        refId: invoice.id,
        refNumber: invoice.number,
        note: 'Pengiriman barang ke pelanggan',
      })
    }
  }

  for (const adjustment of database.stockAdjustments) {
    moves.push({
      id: `SM-${adjustment.id}`,
      date: adjustment.date,
      productId: adjustment.productId,
      warehouseId: adjustment.warehouseId,
      qty: adjustment.qtyDiff,
      type: 'adjustment',
      unitCost: productById.get(adjustment.productId)?.cost ?? 0,
      refType: 'adjustment',
      refId: adjustment.id,
      refNumber: adjustment.number,
      note: adjustment.reason,
    })
  }

  return moves.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
}

/** Stok tersedia satu produk di satu gudang. */
export function onHand(productId: ProductId, warehouseId: WarehouseId): number {
  return buildStockMoves()
    .filter((move) => move.productId === productId && move.warehouseId === warehouseId)
    .reduce((sum, move) => sum + move.qty, 0)
}

function statusOf(quantity: number, minStock: number): StockStatus {
  if (quantity <= 0) return 'out-of-stock'
  return quantity < minStock ? 'low-stock' : 'in-stock'
}

function buildPositions(asOf: IsoDate): StockPosition[] {
  const database = db()
  const moves = buildStockMoves().filter((move) => move.date <= asOf)

  // Rata-rata pengeluaran dihitung dari tahun buku berjalan sampai `asOf`.
  const yearStart = `${database.company.fiscalYear}-01-01`
  const monthsElapsed = Math.max(1, daysBetween(yearStart, asOf) / 30.44)

  return database.products.map((product) => {
    const productMoves = moves.filter((move) => move.productId === product.id)

    const byWarehouse = database.warehouses.map((warehouse) => ({
      warehouse,
      qty: productMoves
        .filter((move) => move.warehouseId === warehouse.id)
        .reduce((sum, move) => sum + move.qty, 0),
    }))

    const totalOnHand = byWarehouse.reduce((sum, row) => sum + row.qty, 0)

    const outThisYear = productMoves
      .filter((move) => move.type === 'out' && move.date >= yearStart)
      .reduce((sum, move) => sum + Math.abs(move.qty), 0)

    const avgMonthlyOut = Math.round(outThisYear / monthsElapsed)

    return {
      product,
      onHand: totalOnHand,
      byWarehouse,
      value: totalOnHand * product.cost,
      status: statusOf(totalOnHand, product.minStock),
      avgMonthlyOut,
      daysOfCover: avgMonthlyOut > 0 ? Math.round((totalOnHand / avgMonthlyOut) * 30.44) : null,
    }
  })
}

/** TODO: replace with real API call — GET /inventory/positions */
export function getStockPositions(asOf: IsoDate = today()): Promise<StockPosition[]> {
  return respond(buildPositions(asOf))
}

/** Versi sinkron untuk service lain (dashboard, performa, neraca pembanding). */
export { buildPositions }

/** Nilai persediaan menurut kartu stok — pembanding saldo akun 1300. */
export function inventoryValueAsOf(asOf: IsoDate): number {
  return buildPositions(asOf).reduce((sum, position) => sum + position.value, 0)
}

/** TODO: replace with real API call — GET /inventory/warehouses */
export function getWarehouseSummaries(asOf: IsoDate = today()): Promise<WarehouseSummary[]> {
  const database = db()
  const positions = buildPositions(asOf)

  const summaries: WarehouseSummary[] = database.warehouses.map((warehouse) => {
    let units = 0
    let value = 0
    let skuCount = 0

    for (const position of positions) {
      const qty = position.byWarehouse.find((row) => row.warehouse.id === warehouse.id)?.qty ?? 0
      if (qty <= 0) continue
      units += qty
      value += qty * position.product.cost
      skuCount += 1
    }

    return {
      warehouse,
      units,
      value,
      skuCount,
      utilization: Math.round((units / warehouse.capacity) * 100),
    }
  })

  return respond(summaries)
}

/** TODO: replace with real API call — GET /inventory/card?productId= */
export function getStockCard(productId: ProductId, warehouseId: WarehouseId | null = null): Promise<StockCardRow[]> {
  const warehouseName = new Map(db().warehouses.map((row) => [row.id, row.name]))

  const moves = buildStockMoves().filter(
    (move) => move.productId === productId && (warehouseId === null || move.warehouseId === warehouseId),
  )

  let balance = 0
  const rows: StockCardRow[] = moves.map((move) => {
    balance += move.qty
    return { move, warehouseName: warehouseName.get(move.warehouseId) ?? '—', balance }
  })

  // Mutasi terbaru di atas; saldo berjalan tetap dihitung dari yang paling lama.
  return respond([...rows].reverse())
}

/* -------------------------------------------------------------------------- */
/* Aksi                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Catat hasil stock opname.
 * Penyesuaian ini langsung menjurnal Selisih Persediaan lawan Persediaan —
 * tidak ada koreksi stok yang lolos tanpa jejak akuntansi.
 *
 * TODO: replace with real API call — POST /inventory/adjustments
 */
export function createStockAdjustment(payload: NewStockAdjustmentPayload): Promise<StockAdjustment> {
  if (payload.qtyDiff === 0) {
    throw new ValidationError('Selisih stok tidak boleh nol.')
  }

  const available = onHand(payload.productId, payload.warehouseId)
  if (available + payload.qtyDiff < 0) {
    throw new ValidationError(
      `Stok tidak mencukupi: tersedia ${available} unit di gudang tersebut.`,
    )
  }

  const created = commit((database) => {
    const sequence = database.stockAdjustments.length + 1
    const adjustment: StockAdjustment = {
      id: `ADJ-${String(sequence).padStart(4, '0')}`,
      number: `ADJ-${database.company.fiscalYear}-${String(sequence).padStart(4, '0')}`,
      ...payload,
    }
    database.stockAdjustments.push(adjustment)
    return adjustment
  })

  return respond(created)
}
