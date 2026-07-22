import { commit, db, nextId } from '@/data/db'
import { NotFoundError, respond } from '@/services/http'
import type { Billing, BillingSummary, NewInvoicePayload, ResidentId } from '@/types'

/** TODO: replace with real API call — GET /billing */
export function getAllBilling(): Promise<Billing[]> {
  return respond(db().billing)
}

/** TODO: replace with real API call — GET /billing?residentId= */
export function getBillingByResident(id: ResidentId): Promise<Billing[]> {
  return respond(db().billing.filter((invoice) => invoice.residentId === id))
}

/**
 * Ringkasan billing untuk Family Portal: total & status saja, tanpa breakdown.
 * Agregasi sengaja dihitung di service layer, bukan di template komponen.
 */
export function summarizeBilling(invoices: Billing[]): BillingSummary {
  const outstanding = invoices.filter((invoice) => invoice.status !== 'paid')
  const latest = invoices.at(-1) ?? null

  return {
    outstandingTotal: outstanding.reduce((sum, invoice) => sum + invoice.total, 0),
    latestPeriod: latest?.period ?? null,
    status: latest?.status ?? null,
    invoiceCount: invoices.length,
  }
}

/** TODO: replace with real API call — GET /billing/summary?residentId= */
export async function getBillingSummaryByResident(id: ResidentId): Promise<BillingSummary> {
  return summarizeBilling(await getBillingByResident(id))
}

/* -------------------------------------------------------------------------- */
/* Aksi                                                                        */
/* -------------------------------------------------------------------------- */

/** TODO: replace with real API call — POST /billing/:id/payments */
export function markInvoiceAsPaid(invoiceId: string): Promise<Billing> {
  const updated = commit((database) => {
    const invoice = database.billing.find((row) => row.id === invoiceId)
    if (!invoice) return null
    invoice.status = 'paid'
    return invoice
  })

  if (!updated) throw new NotFoundError('Invoice', invoiceId)
  return respond(updated)
}

/** TODO: replace with real API call — POST /billing */
export function createInvoice(payload: NewInvoicePayload): Promise<Billing> {
  const created = commit((database) => {
    const invoice: Billing = {
      ...payload,
      // Total selalu diturunkan dari komponennya — bukan diketik ulang user.
      total: payload.rent + payload.careFee,
      id: nextId('INV', database.billing.length, 4),
      status: 'unpaid',
    }
    database.billing.push(invoice)
    return invoice
  })

  return respond(created)
}
