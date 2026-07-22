/**
 * Modul Penjualan.
 *
 * Satu faktur penjualan menggerakkan empat modul sekaligus:
 *   Gudang     — barang keluar dari gudang yang dipilih
 *   Pembukuan  — jurnal Piutang/Penjualan/PPN + HPP/Persediaan
 *   Perpajakan — PPN keluaran & kebutuhan nomor faktur pajak
 *   Keuangan   — piutang, arus kas saat dilunasi, laba di laba rugi
 *
 * Karena itu semua validasinya (stok cukup, pelanggan aktif) ada di sini —
 * bukan di komponen.
 */
import { commit, db } from '@/data/db'
import { today } from '@/services/clock'
import { buildAging, overdueDays, resolveStatus } from '@/services/documentStatus'
import { NotFoundError, respond, ValidationError } from '@/services/http'
import { buildStockMoves, onHand } from '@/services/inventoryService'
import { journalForDocument } from '@/services/postingService'
import { addDays } from '@/utils/date'
import { calcTotals, lineAmount } from '@/utils/documentTotals'
import type {
  Aging,
  DocumentId,
  DocumentLineView,
  IsoDate,
  NewPaymentPayload,
  NewSalesInvoicePayload,
  Payment,
  SalesInvoice,
  SalesInvoiceDetail,
  SalesRow,
} from '@/types'

function toRow(invoice: SalesInvoice): SalesRow {
  const database = db()
  const todayIso = today()
  const status = resolveStatus(invoice.status, invoice.dueDate, todayIso)

  return {
    invoice,
    customerName: database.customers.find((row) => row.id === invoice.customerId)?.name ?? '—',
    warehouseName: database.warehouses.find((row) => row.id === invoice.warehouseId)?.name ?? '—',
    status,
    outstanding: invoice.status === 'draft' ? 0 : invoice.totals.total - invoice.paidAmount,
    overdueDays: overdueDays(status, invoice.dueDate, todayIso),
    margin: invoice.totals.dpp - invoice.cogs,
  }
}

/** Semua baris penjualan, sinkron — dipakai dashboard, performa, dan pajak. */
export function buildSalesRows(from?: IsoDate, to?: IsoDate): SalesRow[] {
  return db()
    .salesInvoices.filter((invoice) => (!from || invoice.date >= from) && (!to || invoice.date <= to))
    .map(toRow)
    .sort((a, b) => b.invoice.date.localeCompare(a.invoice.date) || b.invoice.number.localeCompare(a.invoice.number))
}

/** TODO: replace with real API call — GET /sales?from=&to= */
export function getSalesRows(from?: IsoDate, to?: IsoDate): Promise<SalesRow[]> {
  return respond(buildSalesRows(from, to))
}

/** TODO: replace with real API call — GET /sales/:id */
export function getSalesInvoiceDetail(id: DocumentId): Promise<SalesInvoiceDetail> {
  const database = db()
  const invoice = database.salesInvoices.find((row) => row.id === id)
  if (!invoice) throw new NotFoundError('Faktur penjualan', id)

  const productById = new Map(database.products.map((row) => [row.id, row]))

  const lines: DocumentLineView[] = invoice.lines.flatMap((line) => {
    const product = productById.get(line.productId)
    if (!product) return []
    return [{ line, product, amount: lineAmount(line), cost: line.qty * product.cost }]
  })

  const row = toRow(invoice)

  return respond({
    invoice,
    customer: database.customers.find((customer) => customer.id === invoice.customerId) ?? null,
    warehouse: database.warehouses.find((warehouse) => warehouse.id === invoice.warehouseId) ?? null,
    lines,
    journal: journalForDocument(invoice.id),
    payments: database.payments.filter((payment) => payment.invoiceId === invoice.id),
    stockMoves: buildStockMoves().filter((move) => move.refId === invoice.id),
    status: row.status,
    outstanding: row.outstanding,
    overdueDays: row.overdueDays,
    margin: row.margin,
  })
}

/** Umur piutang usaha per hari ini. */
export function buildReceivableAging(): Aging {
  return buildAging(
    buildSalesRows()
      .filter((row) => row.status !== 'draft' && row.outstanding > 0)
      .map((row) => ({ dueDate: row.invoice.dueDate, outstanding: row.outstanding })),
    today(),
  )
}

/** TODO: replace with real API call — GET /sales/aging */
export function getReceivableAging(): Promise<Aging> {
  return respond(buildReceivableAging())
}

/* -------------------------------------------------------------------------- */
/* Aksi                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Buat faktur penjualan baru sebagai DRAFT.
 * Draft belum menyentuh stok maupun buku besar; barang baru keluar dan jurnal
 * baru terbentuk setelah faktur di-posting.
 *
 * TODO: replace with real API call — POST /sales
 */
export function createSalesInvoice(payload: NewSalesInvoicePayload): Promise<SalesInvoice> {
  const database = db()

  const customer = database.customers.find((row) => row.id === payload.customerId)
  if (!customer) throw new NotFoundError('Pelanggan', payload.customerId)
  if (payload.lines.length === 0) throw new ValidationError('Faktur harus punya minimal satu baris barang.')

  const productById = new Map(database.products.map((row) => [row.id, row]))

  for (const line of payload.lines) {
    const product = productById.get(line.productId)
    if (!product) throw new NotFoundError('Produk', line.productId)
    if (line.qty <= 0) throw new ValidationError(`Kuantitas ${product.name} harus lebih dari nol.`)

    const available = onHand(line.productId, payload.warehouseId)
    if (line.qty > available) {
      throw new ValidationError(
        `Stok ${product.name} di gudang tersebut hanya ${available} ${product.unit}.`,
      )
    }
  }

  const cogs = payload.lines.reduce(
    (sum, line) => sum + line.qty * (productById.get(line.productId)?.cost ?? 0),
    0,
  )

  const created = commit((database) => {
    const sequence = database.salesInvoices.length + 1
    const invoice: SalesInvoice = {
      id: `SLS-${String(sequence).padStart(4, '0')}`,
      number: `INV-${database.company.fiscalYear}-${String(sequence).padStart(4, '0')}`,
      date: payload.date,
      dueDate: addDays(payload.date, customer.paymentTermDays),
      customerId: payload.customerId,
      warehouseId: payload.warehouseId,
      lines: payload.lines,
      totals: calcTotals(payload.lines, database.company.vatRate),
      cogs,
      paidAmount: 0,
      status: 'draft',
      taxInvoiceNumber: null,
      salesPerson: payload.salesPerson,
      notes: payload.notes,
    }
    database.salesInvoices.push(invoice)
    return invoice
  })

  return respond(created)
}

/**
 * Posting faktur: draft menjadi transaksi resmi.
 * Sejak detik ini stok berkurang, jurnal terbentuk, PPN keluaran terutang, dan
 * piutang muncul di neraca — semuanya dari satu aksi.
 *
 * TODO: replace with real API call — POST /sales/:id/post
 */
export function postSalesInvoice(id: DocumentId): Promise<SalesInvoice> {
  const database = db()
  const invoice = database.salesInvoices.find((row) => row.id === id)
  if (!invoice) throw new NotFoundError('Faktur penjualan', id)
  if (invoice.status !== 'draft') throw new ValidationError('Faktur ini sudah pernah diposting.')

  const productById = new Map(database.products.map((row) => [row.id, row]))

  for (const line of invoice.lines) {
    const available = onHand(line.productId, invoice.warehouseId)
    if (line.qty > available) {
      const product = productById.get(line.productId)
      throw new ValidationError(
        `Stok ${product?.name ?? line.productId} tinggal ${available} ${product?.unit ?? 'unit'} — faktur tidak bisa diposting.`,
      )
    }
  }

  const updated = commit((database) => {
    const target = database.salesInvoices.find((row) => row.id === id)!
    target.status = 'posted'
    return target
  })

  return respond(updated)
}

/** Terbitkan nomor seri faktur pajak keluaran. */
export function issueTaxInvoiceNumber(id: DocumentId): Promise<SalesInvoice> {
  const database = db()
  const invoice = database.salesInvoices.find((row) => row.id === id)
  if (!invoice) throw new NotFoundError('Faktur penjualan', id)
  if (invoice.status === 'draft') throw new ValidationError('Posting faktur terlebih dahulu.')
  if (invoice.taxInvoiceNumber) throw new ValidationError('Faktur pajak sudah bernomor.')

  const updated = commit((database) => {
    const issued = database.salesInvoices.filter((row) => row.taxInvoiceNumber !== null).length
    const target = database.salesInvoices.find((row) => row.id === id)!
    target.taxInvoiceNumber = `010.005-26.${String(20_000_000 + issued * 137).padStart(8, '0')}`
    return target
  })

  return respond(updated)
}

/**
 * Catat penerimaan pembayaran dari pelanggan.
 * Kas bertambah, piutang berkurang, dan status faktur menyesuaikan sendiri.
 *
 * TODO: replace with real API call — POST /payments
 */
export function recordSalesPayment(payload: NewPaymentPayload): Promise<Payment> {
  const database = db()
  const invoice = database.salesInvoices.find((row) => row.id === payload.invoiceId)
  if (!invoice) throw new NotFoundError('Faktur penjualan', payload.invoiceId)
  if (invoice.status === 'draft') throw new ValidationError('Faktur draft belum bisa menerima pembayaran.')

  const outstanding = invoice.totals.total - invoice.paidAmount
  if (payload.amount <= 0) throw new ValidationError('Nilai pembayaran harus lebih dari nol.')
  if (payload.amount > outstanding) {
    throw new ValidationError('Nilai pembayaran melebihi sisa tagihan faktur ini.')
  }

  const created = commit((database) => {
    const sequence = database.payments.filter((row) => row.direction === 'in').length + 1
    const payment: Payment = {
      id: `BKM-${String(sequence).padStart(4, '0')}`,
      number: `BKM-${database.company.fiscalYear}-${String(sequence).padStart(4, '0')}`,
      ...payload,
    }
    database.payments.push(payment)

    const target = database.salesInvoices.find((row) => row.id === payload.invoiceId)!
    target.paidAmount += payload.amount
    target.status = target.paidAmount >= target.totals.total ? 'paid' : 'partial'

    return payment
  })

  return respond(created)
}
