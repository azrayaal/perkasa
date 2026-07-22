/**
 * Master data: pelanggan, pemasok, produk, gudang, dan bagan akun.
 *
 * Master inilah yang membuat modul saling mengunci — satu `productId` yang sama
 * dipakai faktur penjualan, faktur pembelian, dan kartu stok, sehingga laporan
 * per produk tidak perlu pencocokan nama.
 */
import { CHART_OF_ACCOUNTS } from '@/data/chartOfAccounts'
import { db } from '@/data/db'
import { today } from '@/services/clock'
import { respond } from '@/services/http'
import { buildPositions } from '@/services/inventoryService'
import { buildPurchaseRows } from '@/services/purchaseService'
import { buildSalesRows } from '@/services/salesService'
import type { Account, CompanyProfile, Customer, Product, Supplier, Warehouse } from '@/types'

/** TODO: replace with real API call — GET /master/customers */
export function getCustomers(): Promise<Customer[]> {
  return respond(db().customers)
}

/** TODO: replace with real API call — GET /master/suppliers */
export function getSuppliers(): Promise<Supplier[]> {
  return respond(db().suppliers)
}

/** TODO: replace with real API call — GET /master/products */
export function getProducts(): Promise<Product[]> {
  return respond(db().products)
}

/** TODO: replace with real API call — GET /master/warehouses */
export function getWarehouses(): Promise<Warehouse[]> {
  return respond(db().warehouses)
}

/** TODO: replace with real API call — GET /master/accounts */
export function getChartOfAccounts(): Promise<Account[]> {
  return respond(CHART_OF_ACCOUNTS)
}

export function getCompanyProfile(): Promise<CompanyProfile> {
  return respond(db().company)
}

/** Pelanggan beserta rekam jejak transaksinya — kolom tambahan di tabel master. */
export interface CustomerRow {
  customer: Customer
  invoiceCount: number
  revenue: number
  outstanding: number
  /** Pemakaian plafon kredit dalam persen. */
  creditUsage: number
}

/** TODO: replace with real API call — GET /master/customers?withStats=1 */
export function getCustomerRows(): Promise<CustomerRow[]> {
  const rows = buildSalesRows()

  return respond(
    db().customers.map((customer) => {
      const owned = rows.filter((row) => row.invoice.customerId === customer.id && row.status !== 'draft')
      const outstanding = owned.reduce((sum, row) => sum + row.outstanding, 0)

      return {
        customer,
        invoiceCount: owned.length,
        revenue: owned.reduce((sum, row) => sum + row.invoice.totals.dpp, 0),
        outstanding,
        creditUsage:
          customer.creditLimit === 0 ? 0 : Math.round((outstanding / customer.creditLimit) * 100),
      }
    }),
  )
}

export interface SupplierRow {
  supplier: Supplier
  invoiceCount: number
  purchaseValue: number
  outstanding: number
}

/** TODO: replace with real API call — GET /master/suppliers?withStats=1 */
export function getSupplierRows(): Promise<SupplierRow[]> {
  const rows = buildPurchaseRows()

  return respond(
    db().suppliers.map((supplier) => {
      const owned = rows.filter((row) => row.invoice.supplierId === supplier.id)
      return {
        supplier,
        invoiceCount: owned.length,
        purchaseValue: owned.reduce((sum, row) => sum + row.invoice.totals.dpp, 0),
        outstanding: owned.reduce((sum, row) => sum + row.outstanding, 0),
      }
    }),
  )
}

export interface ProductRow {
  product: Product
  onHand: number
  value: number
  /** Marjin kotor per unit dalam persen. */
  marginPercent: number
}

/** TODO: replace with real API call — GET /master/products?withStock=1 */
export function getProductRows(): Promise<ProductRow[]> {
  return respond(
    buildPositions(today()).map((position) => ({
      product: position.product,
      onHand: position.onHand,
      value: position.value,
      marginPercent:
        position.product.price === 0
          ? 0
          : Number(
              (((position.product.price - position.product.cost) / position.product.price) * 100).toFixed(1),
            ),
    })),
  )
}
