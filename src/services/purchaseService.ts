/**
 * Modul Pembelian.
 *
 * Kebalikan penjualan: barang masuk gudang, utang usaha bertambah, PPN masukan
 * tercatat sebagai kredit pajak. Nilai persediaan yang bertambah di sini adalah
 * angka yang sama dengan yang nanti keluar sebagai HPP saat barangnya terjual.
 */
import { commit, db } from '@/data/db'
import { today } from '@/services/clock'
import { buildAging, overdueDays, resolveStatus } from '@/services/documentStatus'
import { NotFoundError, respond, ValidationError } from '@/services/http'
import { buildStockMoves } from '@/services/inventoryService'
import { journalForDocument } from '@/services/postingService'
import { addDays } from '@/utils/date'
import { calcTotals, lineAmount } from '@/utils/documentTotals'
import type {
  Aging,
  DocumentId,
  DocumentLineView,
  IsoDate,
  NewPaymentPayload,
  NewPurchaseInvoicePayload,
  Payment,
  PurchaseInvoice,
  PurchaseInvoiceDetail,
  PurchaseRow,
} from '@/types'

function toRow(invoice: PurchaseInvoice): PurchaseRow {
  const database = db()
  const todayIso = today()
  const status = resolveStatus(invoice.status, invoice.dueDate, todayIso)

  return {
    invoice,
    supplierName: database.suppliers.find((row) => row.id === invoice.supplierId)?.name ?? '|',
    warehouseName: database.warehouses.find((row) => row.id === invoice.warehouseId)?.name ?? '|',
    status,
    outstanding: invoice.status === 'draft' ? 0 : invoice.totals.total - invoice.paidAmount,
    overdueDays: overdueDays(status, invoice.dueDate, todayIso),
  }
}

export function buildPurchaseRows(from?: IsoDate, to?: IsoDate): PurchaseRow[] {
  return db()
    .purchaseInvoices.filter((invoice) => (!from || invoice.date >= from) && (!to || invoice.date <= to))
    .map(toRow)
    .sort((a, b) => b.invoice.date.localeCompare(a.invoice.date) || b.invoice.number.localeCompare(a.invoice.number))
}

/** TODO: replace with real API call | GET /purchases?from=&to= */
export function getPurchaseRows(from?: IsoDate, to?: IsoDate): Promise<PurchaseRow[]> {
  return respond(buildPurchaseRows(from, to))
}

/** TODO: replace with real API call | GET /purchases/:id */
export function getPurchaseInvoiceDetail(id: DocumentId): Promise<PurchaseInvoiceDetail> {
  const database = db()
  const invoice = database.purchaseInvoices.find((row) => row.id === id)
  if (!invoice) throw new NotFoundError('Faktur pembelian', id)

  const productById = new Map(database.products.map((row) => [row.id, row]))

  const lines: DocumentLineView[] = invoice.lines.flatMap((line) => {
    const product = productById.get(line.productId)
    if (!product) return []
    return [{ line, product, amount: lineAmount(line), cost: line.qty * line.unitPrice }]
  })

  const row = toRow(invoice)

  return respond({
    invoice,
    supplier: database.suppliers.find((supplier) => supplier.id === invoice.supplierId) ?? null,
    warehouse: database.warehouses.find((warehouse) => warehouse.id === invoice.warehouseId) ?? null,
    lines,
    journal: journalForDocument(invoice.id),
    payments: database.payments.filter((payment) => payment.invoiceId === invoice.id),
    stockMoves: buildStockMoves().filter((move) => move.refId === invoice.id),
    status: row.status,
    outstanding: row.outstanding,
    overdueDays: row.overdueDays,
  })
}

/** Umur utang usaha per hari ini. */
export function buildPayableAging(): Aging {
  return buildAging(
    buildPurchaseRows()
      .filter((row) => row.outstanding > 0)
      .map((row) => ({ dueDate: row.invoice.dueDate, outstanding: row.outstanding })),
    today(),
  )
}

/** TODO: replace with real API call | GET /purchases/aging */
export function getPayableAging(): Promise<Aging> {
  return respond(buildPayableAging())
}

/* -------------------------------------------------------------------------- */
/* Aksi                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Catat faktur pembelian. Berbeda dari penjualan, faktur pembelian langsung
 * berstatus `posted`: barangnya sudah diterima gudang saat dokumen dibuat.
 *
 * TODO: replace with real API call | POST /purchases
 */
export function createPurchaseInvoice(payload: NewPurchaseInvoicePayload): Promise<PurchaseInvoice> {
  const database = db()

  const supplier = database.suppliers.find((row) => row.id === payload.supplierId)
  if (!supplier) throw new NotFoundError('Pemasok', payload.supplierId)
  if (payload.lines.length === 0) throw new ValidationError('Faktur harus punya minimal satu baris barang.')

  for (const line of payload.lines) {
    if (line.qty <= 0) throw new ValidationError('Kuantitas pembelian harus lebih dari nol.')
    if (line.unitPrice <= 0) throw new ValidationError('Harga beli harus lebih dari nol.')
  }

  const created = commit((database) => {
    const sequence = database.purchaseInvoices.length + 1
    const invoice: PurchaseInvoice = {
      id: `PUR-${String(sequence).padStart(4, '0')}`,
      number: `PUR-${database.company.fiscalYear}-${String(sequence).padStart(4, '0')}`,
      date: payload.date,
      dueDate: addDays(payload.date, supplier.paymentTermDays),
      supplierId: payload.supplierId,
      warehouseId: payload.warehouseId,
      // Objek polos: payload dari form Vue berupa proxy reaktif yang tidak
      // bisa di-`structuredClone()` oleh lapisan transport.
      lines: payload.lines.map((line) => ({
        productId: line.productId,
        qty: line.qty,
        unitPrice: line.unitPrice,
        discountPercent: line.discountPercent,
      })),
      totals: calcTotals(payload.lines, database.company.vatRate),
      paidAmount: 0,
      status: 'posted',
      taxInvoiceNumber: null,
      notes: payload.notes,
    }
    database.purchaseInvoices.push(invoice)
    return invoice
  })

  return respond(created)
}

/**
 * Catat pembayaran ke pemasok: utang berkurang, kas keluar.
 *
 * TODO: replace with real API call | POST /payments
 */
export function recordPurchasePayment(payload: NewPaymentPayload): Promise<Payment> {
  const database = db()
  const invoice = database.purchaseInvoices.find((row) => row.id === payload.invoiceId)
  if (!invoice) throw new NotFoundError('Faktur pembelian', payload.invoiceId)

  const outstanding = invoice.totals.total - invoice.paidAmount
  if (payload.amount <= 0) throw new ValidationError('Nilai pembayaran harus lebih dari nol.')
  if (payload.amount > outstanding) {
    throw new ValidationError('Nilai pembayaran melebihi sisa utang faktur ini.')
  }

  const created = commit((database) => {
    const sequence = database.payments.filter((row) => row.direction === 'out').length + 1
    const payment: Payment = {
      id: `BKK-${String(sequence).padStart(4, '0')}`,
      number: `BKK-${database.company.fiscalYear}-${String(sequence).padStart(4, '0')}`,
      ...payload,
    }
    database.payments.push(payment)

    const target = database.purchaseInvoices.find((row) => row.id === payload.invoiceId)!
    target.paidAmount += payload.amount
    target.status = target.paidAmount >= target.totals.total ? 'paid' : 'partial'

    return payment
  })

  return respond(created)
}
