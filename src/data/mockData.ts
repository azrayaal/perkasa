/**
 * Seed data PT Perkasa Baja Nusantara — distributor material konstruksi.
 *
 * Transaksi TIDAK ditulis satu per satu, melainkan disimulasikan hari demi hari
 * dari 1 Januari 2026 sampai 22 Juli 2026:
 *
 *   penjualan  -> mengurangi stok gudang
 *   stok tipis -> memicu pembelian ke pemasok
 *   pembelian  -> menambah stok & utang usaha
 *   pelunasan  -> menggerakkan kas dan menutup piutang/utang
 *
 * Konsekuensinya angka antar-modul konsisten dengan sendirinya: nilai kartu
 * stok sama dengan saldo akun Persediaan, total faktur belum lunas sama dengan
 * saldo Piutang Usaha, dan seterusnya. Generator memakai PRNG bersemai tetap,
 * jadi setiap orang yang membuka aplikasi ini melihat angka yang sama persis.
 *
 * TODO: hapus file ini saat backend siap — `services/` akan menarik data asli.
 */
import { ACC } from '@/data/chartOfAccounts'
import { addDays, isWeekend, periodOf } from '@/utils/date'
import { calcTotals } from '@/utils/documentTotals'
import type {
  AuthAccount,
  CompanyProfile,
  Customer,
  DocumentLine,
  Expense,
  IsoDate,
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
  WithholdingType,
} from '@/types'

/* -------------------------------------------------------------------------- */
/* Konstanta periode                                                           */
/* -------------------------------------------------------------------------- */

/** Tanggal "hari ini" untuk seluruh aplikasi demo. */
export const TODAY: IsoDate = '2026-07-22'
export const FISCAL_YEAR = 2026
export const YEAR_START: IsoDate = '2026-01-01'
/** Tanggal saldo awal — sehari sebelum tahun buku dimulai. */
export const OPENING_DATE: IsoDate = '2025-12-31'

const VAT_RATE = 11

/* -------------------------------------------------------------------------- */
/* Profil perusahaan & akun pengguna                                           */
/* -------------------------------------------------------------------------- */

export const company: CompanyProfile = {
  name: 'Perkasa ERP',
  legalName: 'PT Perkasa Baja Nusantara',
  npwp: '01.234.567.8-407.000',
  address: 'Kawasan Industri Jababeka II, Jl. Industri Selatan Blok GG No. 12',
  city: 'Bekasi, Jawa Barat',
  phone: '(021) 8983 4400',
  email: 'keuangan@perkasabaja.co.id',
  fiscalYear: FISCAL_YEAR,
  vatRate: VAT_RATE,
  corporateTaxRate: 22,
}

export const authAccounts: AuthAccount[] = [
  {
    id: 'USR-01',
    name: 'Hendra Wijaya',
    email: 'direksi@perkasabaja.co.id',
    password: 'perkasa123',
    role: 'direksi',
    title: 'Direktur Utama',
  },
  {
    id: 'USR-02',
    name: 'Ratna Kusuma',
    email: 'akuntan@perkasabaja.co.id',
    password: 'perkasa123',
    role: 'akuntan',
    title: 'Manajer Keuangan & Pajak',
  },
  {
    id: 'USR-03',
    name: 'Bayu Saputra',
    email: 'operasional@perkasabaja.co.id',
    password: 'perkasa123',
    role: 'operasional',
    title: 'Supervisor Penjualan & Gudang',
  },
]

/* -------------------------------------------------------------------------- */
/* Master data                                                                 */
/* -------------------------------------------------------------------------- */

export const warehouses: Warehouse[] = [
  { id: 'WH-01', code: 'GD-PST', name: 'Gudang Pusat Cikarang', city: 'Bekasi', manager: 'Agus Riyanto', capacity: 26_000 },
  { id: 'WH-02', code: 'GD-TMR', name: 'Gudang Timur Karawang', city: 'Karawang', manager: 'Slamet Widodo', capacity: 18_000 },
  { id: 'WH-03', code: 'GD-BRT', name: 'Gudang Barat Serpong', city: 'Tangerang Selatan', manager: 'Dewi Anggraini', capacity: 14_000 },
]

export const customers: Customer[] = [
  { id: 'CUS-01', code: 'PLG-001', name: 'PT Griya Karya Mandiri', npwp: '02.111.222.3-407.000', city: 'Bekasi', contact: 'Yusuf Maulana', phone: '0811-1900-221', paymentTermDays: 30, creditLimit: 900_000_000, status: 'active' },
  { id: 'CUS-02', code: 'PLG-002', name: 'CV Bangun Sejahtera Abadi', npwp: '02.333.444.5-407.000', city: 'Karawang', contact: 'Siti Rahmawati', phone: '0812-8877-110', paymentTermDays: 30, creditLimit: 650_000_000, status: 'active' },
  { id: 'CUS-03', code: 'PLG-003', name: 'PT Nusa Konstruksi Perkasa', npwp: '02.555.666.7-054.000', city: 'Jakarta Timur', contact: 'Bambang Hartono', phone: '0813-2211-908', paymentTermDays: 45, creditLimit: 1_200_000_000, status: 'active' },
  { id: 'CUS-04', code: 'PLG-004', name: 'Toko Material Jaya Abadi', npwp: '—', city: 'Bekasi', contact: 'Hendrik Tanujaya', phone: '0815-6677-441', paymentTermDays: 14, creditLimit: 250_000_000, status: 'active' },
  { id: 'CUS-05', code: 'PLG-005', name: 'PT Wijaya Property Group', npwp: '02.777.888.9-411.000', city: 'Tangerang', contact: 'Lina Kurniawati', phone: '0816-4433-227', paymentTermDays: 45, creditLimit: 1_000_000_000, status: 'active' },
  { id: 'CUS-06', code: 'PLG-006', name: 'CV Anugerah Beton Sentosa', npwp: '02.999.111.2-407.000', city: 'Cikarang', contact: 'Rizal Fahmi', phone: '0817-9090-334', paymentTermDays: 30, creditLimit: 500_000_000, status: 'active' },
  { id: 'CUS-07', code: 'PLG-007', name: 'Toko Bangunan Sinar Terang', npwp: '—', city: 'Depok', contact: 'Mega Puspita', phone: '0818-5544-102', paymentTermDays: 14, creditLimit: 180_000_000, status: 'active' },
  { id: 'CUS-08', code: 'PLG-008', name: 'PT Karya Bumi Selaras', npwp: '02.121.343.5-054.000', city: 'Jakarta Selatan', contact: 'Andre Firmansyah', phone: '0819-3322-778', paymentTermDays: 45, creditLimit: 800_000_000, status: 'inactive' },
]

export const suppliers: Supplier[] = [
  { id: 'SUP-01', code: 'PMS-001', name: 'PT Krakatau Baja Distribusi', npwp: '03.111.555.7-081.000', city: 'Cilegon', contact: 'Wahyu Nugroho', phone: '0254-380-114', paymentTermDays: 30, status: 'active' },
  { id: 'SUP-02', code: 'PMS-002', name: 'PT Semen Nusantara Niaga', npwp: '03.222.666.8-054.000', city: 'Jakarta Utara', contact: 'Fitri Handayani', phone: '021-4390-772', paymentTermDays: 30, status: 'active' },
  { id: 'SUP-03', code: 'PMS-003', name: 'PT Baja Ringan Indoprima', npwp: '03.333.777.9-407.000', city: 'Bekasi', contact: 'Doni Prasetyo', phone: '021-8871-559', paymentTermDays: 21, status: 'active' },
  { id: 'SUP-04', code: 'PMS-004', name: 'PT Cipta Kimia Warna', npwp: '03.444.888.1-411.000', city: 'Tangerang', contact: 'Ira Susanti', phone: '021-5590-338', paymentTermDays: 30, status: 'active' },
  { id: 'SUP-05', code: 'PMS-005', name: 'CV Sumber Panel & Pipa', npwp: '03.555.999.2-407.000', city: 'Bekasi', contact: 'Teguh Santoso', phone: '021-8842-107', paymentTermDays: 21, status: 'active' },
  { id: 'SUP-06', code: 'PMS-006', name: 'CV Agregat Mandiri Jaya', npwp: '—', city: 'Karawang', contact: 'Sukarno Adi', phone: '0267-441-909', paymentTermDays: 14, status: 'active' },
]

/**
 * Parameter simulasi tiap produk.
 * `demand` = perkiraan permintaan per bulan (unit); dipakai untuk menentukan
 * ukuran order penjualan, titik pemesanan ulang, dan stok awal.
 */
interface ProductSeed extends Product {
  supplierId: string
  demand: number
  /** Kelipatan pembulatan kuantitas transaksi. */
  lot: number
  /** Produk yang sengaja dibiarkan menipis, supaya alert stok punya isi. */
  slowRestock?: boolean
}

const PRODUCT_SEEDS: ProductSeed[] = [
  { id: 'PRD-01', sku: 'BSI-P10', name: 'Besi Beton Polos Ø10mm', category: 'Besi & Baja', unit: 'batang', cost: 60_000, price: 78_000, minStock: 900, status: 'active', supplierId: 'SUP-01', demand: 1_800, lot: 25 },
  { id: 'PRD-02', sku: 'BSU-U13', name: 'Besi Beton Ulir Ø13mm', category: 'Besi & Baja', unit: 'batang', cost: 102_000, price: 132_000, minStock: 600, status: 'active', supplierId: 'SUP-01', demand: 1_200, lot: 25 },
  { id: 'PRD-03', sku: 'BSU-U16', name: 'Besi Beton Ulir Ø16mm', category: 'Besi & Baja', unit: 'batang', cost: 152_000, price: 196_000, minStock: 350, status: 'active', supplierId: 'SUP-01', demand: 700, lot: 25 },
  { id: 'PRD-04', sku: 'SMN-P50', name: 'Semen Portland 50kg', category: 'Semen & Agregat', unit: 'sak', cost: 55_000, price: 71_000, minStock: 1_500, status: 'active', supplierId: 'SUP-02', demand: 3_000, lot: 50 },
  { id: 'PRD-05', sku: 'SMN-I40', name: 'Semen Instan 40kg', category: 'Semen & Agregat', unit: 'sak', cost: 50_000, price: 65_000, minStock: 450, status: 'active', supplierId: 'SUP-02', demand: 900, lot: 25 },
  { id: 'PRD-06', sku: 'BJR-C75', name: 'Baja Ringan Kanal C75 0,75mm', category: 'Besi & Baja', unit: 'batang', cost: 75_000, price: 97_000, minStock: 550, status: 'active', supplierId: 'SUP-03', demand: 1_100, lot: 25 },
  { id: 'PRD-07', sku: 'HLW-4040', name: 'Besi Hollow 40×40 Galvanis', category: 'Besi & Baja', unit: 'batang', cost: 80_000, price: 103_000, minStock: 400, status: 'active', supplierId: 'SUP-03', demand: 800, lot: 25 },
  { id: 'PRD-08', sku: 'ATP-SPD', name: 'Atap Spandek 0,35mm', category: 'Atap & Dinding', unit: 'lembar', cost: 90_000, price: 116_000, minStock: 450, status: 'active', supplierId: 'SUP-03', demand: 900, lot: 25 },
  { id: 'PRD-09', sku: 'PSR-COR', name: 'Pasir Cor Kualitas A', category: 'Semen & Agregat', unit: 'm³', cost: 252_000, price: 325_000, minStock: 160, status: 'active', supplierId: 'SUP-06', demand: 320, lot: 5 },
  { id: 'PRD-10', sku: 'BTR-R10', name: 'Bata Ringan AAC 10cm', category: 'Atap & Dinding', unit: 'm³', cost: 585_000, price: 755_000, minStock: 90, status: 'active', supplierId: 'SUP-06', demand: 180, lot: 5 },
  { id: 'PRD-11', sku: 'TRP-9MM', name: 'Triplek Meranti 9mm', category: 'Atap & Dinding', unit: 'lembar', cost: 113_000, price: 146_000, minStock: 250, status: 'active', supplierId: 'SUP-05', demand: 500, lot: 10 },
  { id: 'PRD-12', sku: 'PVC-4IN', name: 'Pipa PVC 4" AW', category: 'Finishing', unit: 'batang', cost: 92_000, price: 119_000, minStock: 220, status: 'active', supplierId: 'SUP-05', demand: 450, lot: 10 },
  { id: 'PRD-13', sku: 'CAT-T25', name: 'Cat Tembok Interior 25kg', category: 'Finishing', unit: 'pail', cost: 363_000, price: 468_000, minStock: 80, status: 'active', supplierId: 'SUP-04', demand: 160, lot: 5, slowRestock: true },
  { id: 'PRD-14', sku: 'KRM-4040', name: 'Keramik Lantai 40×40', category: 'Finishing', unit: 'dus', cost: 66_000, price: 85_000, minStock: 450, status: 'active', supplierId: 'SUP-04', demand: 900, lot: 25, slowRestock: true },
]

/** Master produk yang dilihat aplikasi — parameter simulasi tidak ikut bocor. */
export const products: Product[] = PRODUCT_SEEDS.map(
  ({ supplierId: _supplierId, demand: _demand, lot: _lot, slowRestock: _slow, ...product }) => product,
)

/* -------------------------------------------------------------------------- */
/* Utilitas simulasi                                                           */
/* -------------------------------------------------------------------------- */

/** PRNG deterministik (mulberry32) — semai tetap = data selalu identik. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const random = createRandom(20260722)

function between(min: number, max: number): number {
  return min + random() * (max - min)
}

function pick<T>(items: T[]): T {
  return items[Math.floor(random() * items.length)]
}

function roundTo(value: number, step: number): number {
  return Math.max(step, Math.round(value / step) * step)
}

function docNumber(prefix: string, sequence: number): string {
  return `${prefix}-${FISCAL_YEAR}-${String(sequence).padStart(4, '0')}`
}

/** Nomor seri faktur pajak, format DJP: 010.xxx-yy.nnnnnnnn */
function taxInvoiceNumber(sequence: number): string {
  return `010.005-26.${String(10_000_000 + sequence * 137).padStart(8, '0')}`
}

/** Pelanggan besar muncul lebih sering — distribusi penjualan jadi realistis. */
const CUSTOMER_WEIGHTS: Array<[string, number]> = [
  ['CUS-03', 22],
  ['CUS-01', 19],
  ['CUS-05', 17],
  ['CUS-02', 14],
  ['CUS-06', 12],
  ['CUS-04', 9],
  ['CUS-07', 7],
]

function pickCustomerId(): string {
  const total = CUSTOMER_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0)
  let ticket = random() * total
  for (const [id, weight] of CUSTOMER_WEIGHTS) {
    ticket -= weight
    if (ticket <= 0) return id
  }
  return CUSTOMER_WEIGHTS[0][0]
}

const SALES_PEOPLE = ['Bayu Saputra', 'Rina Oktaviani', 'Fajar Nugraha', 'Tia Handayani']

/* -------------------------------------------------------------------------- */
/* Hasil generator                                                             */
/* -------------------------------------------------------------------------- */

export interface SeedData {
  openingBalances: OpeningBalance[]
  openingStockMoves: StockMove[]
  salesInvoices: SalesInvoice[]
  purchaseInvoices: PurchaseInvoice[]
  expenses: Expense[]
  payments: Payment[]
  stockAdjustments: StockAdjustment[]
  manualJournals: ManualJournal[]
}

/** Kunci stok: produk per gudang. */
function stockKey(productId: string, warehouseId: string): string {
  return `${productId}|${warehouseId}`
}

/** Porsi stok tiap gudang — pusat menyimpan paling banyak. */
const WAREHOUSE_SHARE: Record<string, number> = { 'WH-01': 0.45, 'WH-02': 0.32, 'WH-03': 0.23 }

export function generateSeed(): SeedData {
  const stock = new Map<string, number>()
  const openingStockMoves: StockMove[] = []

  // Stok awal ≈ 2,2 bulan permintaan, dipecah sesuai porsi gudang.
  for (const seed of PRODUCT_SEEDS) {
    for (const warehouse of warehouses) {
      const qty = roundTo(seed.demand * 2.2 * WAREHOUSE_SHARE[warehouse.id], seed.lot)
      stock.set(stockKey(seed.id, warehouse.id), qty)
      openingStockMoves.push({
        id: `SM-OPN-${seed.id}-${warehouse.id}`,
        date: OPENING_DATE,
        productId: seed.id,
        warehouseId: warehouse.id,
        qty,
        type: 'in',
        unitCost: seed.cost,
        refType: 'opening',
        refId: null,
        refNumber: null,
        note: 'Saldo awal persediaan per 31 Des 2025',
      })
    }
  }

  const salesInvoices: SalesInvoice[] = []
  const purchaseInvoices: PurchaseInvoice[] = []
  const expenses: Expense[] = []
  const payments: Payment[] = []
  const stockAdjustments: StockAdjustment[] = []
  const manualJournals: ManualJournal[] = []

  let salesSeq = 0
  let purchaseSeq = 0
  let expenseSeq = 0
  let adjustmentSeq = 0
  let journalSeq = 0

  /* ---------------------------------------------------------------------- */
  /* Penjualan                                                               */
  /* ---------------------------------------------------------------------- */

  function createSalesInvoice(date: IsoDate): void {
    const customerId = pickCustomerId()
    const customer = customers.find((row) => row.id === customerId)!
    const warehouse = pick(warehouses)

    const lineCount = 2 + Math.floor(random() * 3)
    const chosen = new Set<string>()
    const lines: DocumentLine[] = []
    let cogs = 0

    for (let index = 0; index < lineCount; index += 1) {
      const seed = pick(PRODUCT_SEEDS)
      if (chosen.has(seed.id)) continue
      chosen.add(seed.id)

      const available = stock.get(stockKey(seed.id, warehouse.id)) ?? 0
      // Rata-rata satu produk terjual 3× per bulan, jadi tiap faktur mengambil
      // sekitar sepertiga permintaan bulanan.
      const wanted = roundTo((seed.demand / 3) * between(0.6, 1.4), seed.lot)
      const qty = Math.min(wanted, roundTo(available * 0.8, seed.lot))
      if (qty < seed.lot || qty > available) continue

      // Diskon hanya untuk order besar — pelanggan termin panjang menawar lebih.
      const discountPercent =
        qty > seed.demand / 2 && random() < 0.45 ? Number(between(1, 5).toFixed(1)) : 0

      lines.push({ productId: seed.id, qty, unitPrice: seed.price, discountPercent })
      cogs += qty * seed.cost
      stock.set(stockKey(seed.id, warehouse.id), available - qty)
    }

    if (lines.length === 0) return

    salesSeq += 1
    const totals = calcTotals(lines, VAT_RATE)
    // Faktur beberapa hari terakhir wajar masih berstatus draft.
    const isDraft = date > addDays(TODAY, -9) && random() < 0.35

    if (isDraft) {
      // Draft belum menggerakkan buku — kembalikan stok yang tadi dipotong.
      for (const line of lines) {
        const key = stockKey(line.productId, warehouse.id)
        stock.set(key, (stock.get(key) ?? 0) + line.qty)
      }
    }

    salesInvoices.push({
      id: `SLS-${String(salesSeq).padStart(4, '0')}`,
      number: docNumber('INV', salesSeq),
      date,
      dueDate: addDays(date, customer.paymentTermDays),
      customerId,
      warehouseId: warehouse.id,
      lines,
      totals,
      cogs,
      paidAmount: 0,
      status: isDraft ? 'draft' : 'posted',
      // Faktur pajak biasanya terbit belakangan; yang terbaru sengaja kosong.
      taxInvoiceNumber: isDraft || date > addDays(TODAY, -12) ? null : taxInvoiceNumber(salesSeq),
      salesPerson: pick(SALES_PEOPLE),
    })
  }

  /* ---------------------------------------------------------------------- */
  /* Pembelian — dipicu stok yang menipis                                    */
  /* ---------------------------------------------------------------------- */

  function replenish(date: IsoDate): void {
    // Gudang dengan stok paling menipis yang diisi lebih dulu.
    const target = [...warehouses].sort((a, b) => {
      const totalA = PRODUCT_SEEDS.reduce((sum, seed) => sum + (stock.get(stockKey(seed.id, a.id)) ?? 0) / seed.demand, 0)
      const totalB = PRODUCT_SEEDS.reduce((sum, seed) => sum + (stock.get(stockKey(seed.id, b.id)) ?? 0) / seed.demand, 0)
      return totalA - totalB
    })[0]

    const needed = PRODUCT_SEEDS.filter((seed) => {
      const onHand = warehouses.reduce((sum, wh) => sum + (stock.get(stockKey(seed.id, wh.id)) ?? 0), 0)
      // Dua produk sengaja lambat di-restock pada kuartal III supaya modul
      // gudang punya peringatan stok menipis yang nyata.
      const threshold = seed.slowRestock && date > '2026-06-05' ? seed.demand * 0.35 : seed.demand * 1.05
      return onHand < threshold
    })

    if (needed.length === 0) return

    const bySupplier = new Map<string, ProductSeed[]>()
    for (const seed of needed) {
      const list = bySupplier.get(seed.supplierId) ?? []
      list.push(seed)
      bySupplier.set(seed.supplierId, list)
    }

    for (const [supplierId, seeds] of bySupplier) {
      const supplier = suppliers.find((row) => row.id === supplierId)!
      const lines: DocumentLine[] = seeds.map((seed) => ({
        productId: seed.id,
        qty: roundTo(seed.demand * between(1.25, 1.75), seed.lot),
        unitPrice: seed.cost,
        discountPercent: 0,
      }))

      for (const line of lines) {
        const key = stockKey(line.productId, target.id)
        stock.set(key, (stock.get(key) ?? 0) + line.qty)
      }

      purchaseSeq += 1
      purchaseInvoices.push({
        id: `PUR-${String(purchaseSeq).padStart(4, '0')}`,
        number: docNumber('PUR', purchaseSeq),
        date,
        dueDate: addDays(date, supplier.paymentTermDays),
        supplierId,
        warehouseId: target.id,
        lines,
        totals: calcTotals(lines, VAT_RATE),
        paidAmount: 0,
        status: 'posted',
        taxInvoiceNumber: supplier.npwp === '—' ? null : taxInvoiceNumber(500 + purchaseSeq),
        notes: `Pengisian stok ${target.name}`,
      })
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Beban operasional                                                       */
  /* ---------------------------------------------------------------------- */

  interface ExpenseTemplate {
    day: number
    accountCode: string
    description: string
    vendor: string
    amount: () => number
    withholding: WithholdingType
    /** PPN masukan yang bisa dikreditkan. */
    vatable: boolean
    payFrom: string
  }

  const EXPENSE_TEMPLATES: ExpenseTemplate[] = [
    { day: 25, accountCode: '6100', description: 'Gaji, tunjangan & BPJS karyawan', vendor: 'Payroll internal', amount: () => 118_000_000, withholding: 'pph21', vatable: false, payFrom: ACC.bankPayroll },
    { day: 5, accountCode: '6110', description: 'Sewa gudang & kantor bulanan', vendor: 'PT Jababeka Properti', amount: () => 25_000_000, withholding: 'pph4-2', vatable: false, payFrom: ACC.bankOps },
    { day: 12, accountCode: '6120', description: 'Listrik, air & internet', vendor: 'PLN, PDAM & Telkom', amount: () => roundTo(between(16_500_000, 20_000_000), 50_000), withholding: 'none', vatable: false, payFrom: ACC.bankOps },
    { day: 18, accountCode: '6130', description: 'Sewa armada & ongkos kirim', vendor: 'CV Trans Logistik Utama', amount: () => roundTo(between(19_000_000, 26_000_000), 100_000), withholding: 'pph23', vatable: false, payFrom: ACC.bankOps },
    { day: 20, accountCode: '6140', description: 'Promosi & pameran material', vendor: 'Kreasi Media Nusantara', amount: () => roundTo(between(4_500_000, 9_000_000), 100_000), withholding: 'pph23', vatable: true, payFrom: ACC.bankOps },
    { day: 8, accountCode: '6150', description: 'Perlengkapan & ATK kantor', vendor: 'Toko Sinar Kantor', amount: () => roundTo(between(2_500_000, 4_500_000), 50_000), withholding: 'none', vatable: true, payFrom: ACC.cash },
    { day: 15, accountCode: '6160', description: 'Servis forklift & perbaikan gudang', vendor: 'CV Teknik Andalan', amount: () => roundTo(between(3_500_000, 7_500_000), 100_000), withholding: 'pph23', vatable: true, payFrom: ACC.bankOps },
    { day: 10, accountCode: '6170', description: 'Jasa konsultan pajak & audit', vendor: 'KAP Suryana & Rekan', amount: () => 7_500_000, withholding: 'pph23', vatable: true, payFrom: ACC.bankOps },
    { day: 3, accountCode: '6180', description: 'Premi asuransi gudang & kendaraan', vendor: 'PT Asuransi Wahana', amount: () => 4_000_000, withholding: 'none', vatable: false, payFrom: ACC.bankOps },
    { day: 28, accountCode: '6200', description: 'Biaya administrasi & transfer bank', vendor: 'Bank BCA', amount: () => roundTo(between(600_000, 950_000), 25_000), withholding: 'none', vatable: false, payFrom: ACC.bankOps },
    { day: 22, accountCode: '6210', description: 'Perjalanan dinas tim penjualan', vendor: 'Reimburse karyawan', amount: () => roundTo(between(2_000_000, 4_500_000), 50_000), withholding: 'none', vatable: false, payFrom: ACC.cash },
  ]

  /** Tarif potongan PPh yang dipakai perusahaan. */
  const WITHHOLDING_RATE: Record<WithholdingType, number> = {
    none: 0,
    pph21: 3.5,
    pph23: 2,
    'pph4-2': 10,
  }

  function createExpense(template: ExpenseTemplate, date: IsoDate): void {
    const amount = Math.round(template.amount())
    const ppn = template.vatable ? Math.round((amount * VAT_RATE) / 100) : 0
    const withholdingAmount = Math.round((amount * WITHHOLDING_RATE[template.withholding]) / 100)
    // Beban paling akhir belum sempat dibayar — muncul sebagai utang di neraca.
    const unpaid = date > addDays(TODAY, -8)

    expenseSeq += 1
    expenses.push({
      id: `EXP-${String(expenseSeq).padStart(4, '0')}`,
      number: docNumber('EXP', expenseSeq),
      date,
      accountCode: template.accountCode,
      description: template.description,
      amount,
      ppn,
      withholding: template.withholding,
      withholdingAmount,
      paidFromAccount: unpaid ? null : template.payFrom,
      settlement: null,
      vendor: template.vendor,
      status: unpaid ? 'posted' : 'paid',
    })
  }

  /* ---------------------------------------------------------------------- */
  /* Jalankan simulasi harian                                                */
  /* ---------------------------------------------------------------------- */

  for (let date = YEAR_START; date <= TODAY; date = addDays(date, 1)) {
    const dayOfMonth = Number(date.slice(8, 10))

    // Senin: cek titik pemesanan ulang stok.
    if (new Date(`${date}T00:00:00Z`).getUTCDay() === 1) replenish(date)

    if (!isWeekend(date)) {
      if (random() < 0.62) createSalesInvoice(date)
      if (random() < 0.18) createSalesInvoice(date)
    }

    for (const template of EXPENSE_TEMPLATES) {
      if (template.day === dayOfMonth) createExpense(template, date)
    }

    // Stock opname triwulanan pada produk yang paling sering bergerak.
    if (dayOfMonth === 27 && [3, 6].includes(Number(date.slice(5, 7)))) {
      const seed = PRODUCT_SEEDS[Number(date.slice(5, 7)) === 3 ? 3 : 0]
      const warehouse = warehouses[0]
      const qtyDiff = -roundTo(seed.demand * 0.02, seed.lot)
      adjustmentSeq += 1
      stockAdjustments.push({
        id: `ADJ-${String(adjustmentSeq).padStart(4, '0')}`,
        number: docNumber('ADJ', adjustmentSeq),
        date,
        productId: seed.id,
        warehouseId: warehouse.id,
        qtyDiff,
        reason: 'Selisih stock opname triwulanan — susut & barang rusak',
      })
      const key = stockKey(seed.id, warehouse.id)
      stock.set(key, (stock.get(key) ?? 0) + qtyDiff)
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Pelunasan piutang & utang                                               */
  /* ---------------------------------------------------------------------- */

  interface DraftPayment {
    date: IsoDate
    direction: 'in' | 'out'
    invoiceId: string
    amount: number
    accountCode: string
    method: Payment['method']
  }

  const draftPayments: DraftPayment[] = []

  for (const invoice of salesInvoices) {
    if (invoice.status === 'draft') continue

    const dice = random()
    const dueSoon = invoice.dueDate > TODAY

    if (dueSoon) {
      // Belum jatuh tempo: sebagian pelanggan sudah menyetor uang muka.
      if (dice < 0.3) {
        const paidDate = addDays(invoice.date, Math.round(between(3, 12)))
        if (paidDate <= TODAY) {
          draftPayments.push({ date: paidDate, direction: 'in', invoiceId: invoice.id, amount: invoice.totals.total, accountCode: ACC.bankOps, method: 'transfer' })
        }
      } else if (dice < 0.45) {
        const paidDate = addDays(invoice.date, Math.round(between(5, 15)))
        if (paidDate <= TODAY) {
          draftPayments.push({ date: paidDate, direction: 'in', invoiceId: invoice.id, amount: roundTo(invoice.totals.total * 0.5, 100_000), accountCode: ACC.bankOps, method: 'transfer' })
        }
      }
      continue
    }

    // Sudah jatuh tempo.
    if (dice < 0.78) {
      const paidDate = addDays(invoice.dueDate, Math.round(between(-6, 4)))
      draftPayments.push({
        date: paidDate > TODAY ? TODAY : paidDate,
        direction: 'in',
        invoiceId: invoice.id,
        amount: invoice.totals.total,
        accountCode: random() < 0.85 ? ACC.bankOps : ACC.cash,
        method: random() < 0.85 ? 'transfer' : 'tunai',
      })
    } else if (dice < 0.9) {
      const paidDate = addDays(invoice.dueDate, Math.round(between(-3, 6)))
      draftPayments.push({
        date: paidDate > TODAY ? TODAY : paidDate,
        direction: 'in',
        invoiceId: invoice.id,
        amount: roundTo(invoice.totals.total * between(0.35, 0.7), 100_000),
        accountCode: ACC.bankOps,
        method: 'giro',
      })
    }
    // Sisanya menunggak — sengaja dibiarkan untuk mengisi umur piutang.
  }

  for (const invoice of purchaseInvoices) {
    const dice = random()
    if (invoice.dueDate > TODAY) {
      if (dice < 0.25) {
        const paidDate = addDays(invoice.date, Math.round(between(4, 14)))
        if (paidDate <= TODAY) {
          draftPayments.push({ date: paidDate, direction: 'out', invoiceId: invoice.id, amount: invoice.totals.total, accountCode: ACC.bankOps, method: 'transfer' })
        }
      }
      continue
    }

    // Kewajiban ke pemasok hampir selalu dibayar tepat waktu — menjaga termin.
    if (dice < 0.9) {
      const paidDate = addDays(invoice.dueDate, Math.round(between(-4, 2)))
      draftPayments.push({
        date: paidDate > TODAY ? TODAY : paidDate,
        direction: 'out',
        invoiceId: invoice.id,
        amount: invoice.totals.total,
        accountCode: ACC.bankOps,
        method: 'transfer',
      })
    } else {
      const paidDate = addDays(invoice.dueDate, Math.round(between(-2, 3)))
      draftPayments.push({
        date: paidDate > TODAY ? TODAY : paidDate,
        direction: 'out',
        invoiceId: invoice.id,
        amount: roundTo(invoice.totals.total * 0.6, 100_000),
        accountCode: ACC.bankOps,
        method: 'transfer',
      })
    }
  }

  // Nomor bukti kas mengikuti urutan tanggal, bukan urutan pembuatan.
  draftPayments.sort((a, b) => a.date.localeCompare(b.date))

  let receiptSeq = 0
  let disbursementSeq = 0

  for (const draft of draftPayments) {
    const prefix = draft.direction === 'in' ? 'BKM' : 'BKK'
    const sequence = draft.direction === 'in' ? (receiptSeq += 1) : (disbursementSeq += 1)
    payments.push({
      id: `${prefix}-${String(sequence).padStart(4, '0')}`,
      number: docNumber(prefix, sequence),
      date: draft.date,
      direction: draft.direction,
      invoiceId: draft.invoiceId,
      amount: draft.amount,
      accountCode: draft.accountCode,
      method: draft.method,
    })
  }

  // Sinkronkan status & nilai terbayar faktur dengan bukti kas yang terbentuk.
  const paidByInvoice = new Map<string, number>()
  for (const payment of payments) {
    paidByInvoice.set(payment.invoiceId, (paidByInvoice.get(payment.invoiceId) ?? 0) + payment.amount)
  }

  for (const invoice of [...salesInvoices, ...purchaseInvoices]) {
    if (invoice.status === 'draft') continue
    const paid = paidByInvoice.get(invoice.id) ?? 0
    invoice.paidAmount = paid
    invoice.status = paid >= invoice.totals.total ? 'paid' : paid > 0 ? 'partial' : 'posted'
  }

  /* ---------------------------------------------------------------------- */
  /* Jurnal manual berkala                                                   */
  /* ---------------------------------------------------------------------- */

  function addManualJournal(date: IsoDate, description: string, lines: ManualJournal['lines']): void {
    journalSeq += 1
    manualJournals.push({
      id: `MJU-${String(journalSeq).padStart(4, '0')}`,
      number: docNumber('JU', journalSeq),
      date,
      description,
      lines,
    })
  }

  const monthEnds: IsoDate[] = [
    '2026-01-31',
    '2026-02-28',
    '2026-03-31',
    '2026-04-30',
    '2026-05-31',
    '2026-06-30',
  ]

  const DEPRECIATION_PER_MONTH = 21_000_000
  const INTEREST_PER_MONTH = 15_000_000
  const CORPORATE_TAX_ACCRUAL = 19_000_000
  const PPH25_INSTALMENT = 16_000_000

  for (const monthEnd of monthEnds) {
    addManualJournal(monthEnd, `Penyusutan aset tetap ${periodOf(monthEnd)}`, [
      { accountCode: '6190', debit: DEPRECIATION_PER_MONTH, credit: 0, memo: 'Beban penyusutan bulanan' },
      { accountCode: ACC.accumulatedDepreciation, debit: 0, credit: DEPRECIATION_PER_MONTH, memo: 'Akumulasi penyusutan' },
    ])

    addManualJournal(monthEnd, `Bunga pinjaman bank ${periodOf(monthEnd)}`, [
      { accountCode: ACC.interest, debit: INTEREST_PER_MONTH, credit: 0, memo: 'Bunga kredit modal kerja' },
      { accountCode: ACC.bankOps, debit: 0, credit: INTEREST_PER_MONTH, memo: 'Autodebet bunga' },
    ])

    addManualJournal(monthEnd, `Taksiran PPh badan ${periodOf(monthEnd)}`, [
      { accountCode: ACC.corporateTaxExpense, debit: CORPORATE_TAX_ACCRUAL, credit: 0, memo: 'Taksiran pajak penghasilan' },
      { accountCode: ACC.corporateTaxPayable, debit: 0, credit: CORPORATE_TAX_ACCRUAL, memo: 'Utang PPh badan' },
    ])
  }

  // Setoran pajak masa berikutnya: PPh potongan tanggal 10, PPN tanggal 15.
  for (const monthEnd of monthEnds) {
    const period = periodOf(monthEnd)
    const nextMonth = addDays(monthEnd, 1)

    const withheld = expenses
      .filter((expense) => periodOf(expense.date) === period)
      .reduce<Record<string, number>>((acc, expense) => {
        if (expense.withholding === 'none') return acc
        const account =
          expense.withholding === 'pph21' ? ACC.pph21 : expense.withholding === 'pph23' ? ACC.pph23 : ACC.pph4Final
        acc[account] = (acc[account] ?? 0) + expense.withholdingAmount
        return acc
      }, {})

    const withheldTotal = Object.values(withheld).reduce((sum, value) => sum + value, 0)
    if (withheldTotal > 0) {
      addManualJournal(addDays(nextMonth, 9), `Setoran PPh potong-pungut masa ${period}`, [
        ...Object.entries(withheld).map(([accountCode, amount]) => ({
          accountCode,
          debit: amount,
          credit: 0,
          memo: 'Penyetoran ke kas negara',
        })),
        { accountCode: ACC.bankOps, debit: 0, credit: withheldTotal, memo: 'Setoran pajak via bank persepsi' },
      ])
    }

    const outputVat = salesInvoices
      .filter((invoice) => invoice.status !== 'draft' && periodOf(invoice.date) === period)
      .reduce((sum, invoice) => sum + invoice.totals.ppn, 0)

    const inputVat =
      purchaseInvoices
        .filter((invoice) => periodOf(invoice.date) === period)
        .reduce((sum, invoice) => sum + invoice.totals.ppn, 0) +
      expenses.filter((expense) => periodOf(expense.date) === period).reduce((sum, expense) => sum + expense.ppn, 0)

    const payable = outputVat - inputVat
    if (payable > 0) {
      addManualJournal(addDays(nextMonth, 14), `Setoran PPN kurang bayar masa ${period}`, [
        { accountCode: ACC.vatOut, debit: outputVat, credit: 0, memo: 'Kompensasi PPN keluaran masa berjalan' },
        { accountCode: ACC.vatIn, debit: 0, credit: inputVat, memo: 'Pengkreditan PPN masukan' },
        { accountCode: ACC.bankOps, debit: 0, credit: payable, memo: 'Setoran SPT Masa PPN' },
      ])
    }

    // Angsuran PPh 25 dibayar tanggal 15 bulan berikutnya.
    addManualJournal(addDays(nextMonth, 14), `Angsuran PPh 25 masa ${period}`, [
      { accountCode: ACC.prepaidCorporateTax, debit: PPH25_INSTALMENT, credit: 0, memo: 'Angsuran PPh pasal 25' },
      { accountCode: ACC.bankOps, debit: 0, credit: PPH25_INSTALMENT, memo: 'Setoran angsuran pajak' },
    ])
  }

  manualJournals.sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number))

  /* ---------------------------------------------------------------------- */
  /* Saldo awal — persediaan mengikuti nilai kartu stok                      */
  /* ---------------------------------------------------------------------- */

  const openingInventoryValue = openingStockMoves.reduce(
    (sum, move) => sum + move.qty * move.unitCost,
    0,
  )

  const openingDebits: Array<[string, number]> = [
    [ACC.cash, 48_000_000],
    [ACC.bankOps, 1_950_000_000],
    [ACC.bankPayroll, 420_000_000],
    [ACC.inventory, openingInventoryValue],
    [ACC.prepaidRent, 90_000_000],
    ['1500', 3_200_000_000],
    ['1510', 850_000_000],
    ['1520', 320_000_000],
  ]

  const openingCredits: Array<[string, number]> = [
    [ACC.accumulatedDepreciation, 640_000_000],
    ['2400', 500_000_000],
    ['2500', 1_200_000_000],
    [ACC.capital, 4_000_000_000],
  ]

  const totalDebit = openingDebits.reduce((sum, [, value]) => sum + value, 0)
  const totalCredit = openingCredits.reduce((sum, [, value]) => sum + value, 0)

  // Laba ditahan menjadi angka penyeimbang — persis cara neraca awal disusun.
  const openingBalances: OpeningBalance[] = [
    ...openingDebits.map(([code, debit]) => ({ code, debit, credit: 0 })),
    ...openingCredits.map(([code, credit]) => ({ code, debit: 0, credit })),
    { code: ACC.retainedEarnings, debit: 0, credit: totalDebit - totalCredit },
  ]

  return {
    openingBalances,
    openingStockMoves,
    salesInvoices,
    purchaseInvoices,
    expenses,
    payments,
    stockAdjustments,
    manualJournals,
  }
}
