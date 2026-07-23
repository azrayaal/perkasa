/**
 * Single source of truth untuk seluruh kontrak data Perkasa ERP.
 * Service, composable, store, dan komponen WAJIB import type dari sini.
 * Tidak boleh ada `any` di seluruh codebase.
 *
 * Bentuk data mengikuti satu prinsip: DOKUMEN adalah fakta, JURNAL adalah
 * turunannya. Tidak ada angka laporan yang diketik manual | semuanya mengalir
 * dari dokumen -> jurnal -> buku besar -> neraca & laporan keuangan.
 */

/* -------------------------------------------------------------------------- */
/* Primitive / id                                                              */
/* -------------------------------------------------------------------------- */

export type AccountCode = string
export type CustomerId = string
export type SupplierId = string
export type ProductId = string
export type WarehouseId = string
export type DocumentId = string

/** ISO date string, contoh: "2026-07-22". */
export type IsoDate = string

/** Periode akuntansi "YYYY-MM", contoh: "2026-07". */
export type PeriodKey = string

/* -------------------------------------------------------------------------- */
/* Auth & role                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * `direksi`     | akses penuh, termasuk seluruh laporan keuangan.
 * `akuntan`     | modul keuangan: beban, pajak, pembukuan, laporan.
 * `operasional` | modul transaksi harian: penjualan, pembelian, gudang.
 * `kasir`       | HANYA terminal POS dan shift miliknya sendiri. Sengaja
 *                 sesempit mungkin: kasir memegang uang tunai, jadi ia tidak
 *                 perlu melihat harga pokok, margin, atau laporan keuangan.
 */
export type UserRole = 'direksi' | 'akuntan' | 'operasional' | 'kasir'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  /** Jabatan yang ditampilkan di topbar. */
  title: string
}

/** Akun lengkap dengan password | hanya hidup di data layer, tidak pernah ke UI. */
export interface AuthAccount extends AuthUser {
  password: string
}

export interface LoginPayload {
  email: string
  password: string
}

/* -------------------------------------------------------------------------- */
/* Bagan akun (Chart of Accounts)                                              */
/* -------------------------------------------------------------------------- */

/**
 * Tipe akun menentukan laporan tujuannya:
 * asset/liability/equity -> Neraca, sisanya -> Laba Rugi.
 */
export type AccountType =
  | 'asset'
  | 'liability'
  | 'equity'
  | 'revenue'
  | 'cogs'
  | 'expense'
  | 'other-income'
  | 'other-expense'
  | 'tax-expense'

/** Kelompok penyajian di Neraca / Laba Rugi. Menentukan urutan & subtotal. */
export type AccountGroup =
  | 'kas-bank'
  | 'piutang'
  | 'persediaan'
  | 'aset-lancar-lain'
  | 'aset-tetap'
  | 'akumulasi-penyusutan'
  | 'utang-usaha'
  | 'utang-pajak'
  | 'utang-lancar-lain'
  | 'utang-jangka-panjang'
  | 'modal'
  | 'laba-ditahan'
  | 'pendapatan'
  | 'harga-pokok'
  | 'beban-operasional'
  | 'pendapatan-lain'
  | 'beban-lain'
  | 'pajak-penghasilan'

export type NormalBalance = 'debit' | 'credit'

/** Saldo awal tahun buku, dijurnal sebagai entri "Saldo Awal" per 1 Januari. */
export interface OpeningBalance {
  code: AccountCode
  debit: number
  credit: number
}

export interface Account {
  code: AccountCode
  name: string
  type: AccountType
  group: AccountGroup
  normalBalance: NormalBalance
  /** Akun kontra (mis. akumulasi penyusutan) disajikan sebagai pengurang. */
  contra?: boolean
  /** Akun kas/bank | dipakai laporan arus kas untuk mendeteksi mutasi kas. */
  cash?: boolean
  description?: string
}

/* -------------------------------------------------------------------------- */
/* Master data                                                                 */
/* -------------------------------------------------------------------------- */

export type PartnerStatus = 'active' | 'inactive'

export interface Customer {
  id: CustomerId
  code: string
  name: string
  npwp: string
  city: string
  contact: string
  phone: string
  /** Termin pembayaran dalam hari, mis. 30 = Net 30. */
  paymentTermDays: number
  creditLimit: number
  status: PartnerStatus
}

export interface Supplier {
  id: SupplierId
  code: string
  name: string
  npwp: string
  city: string
  contact: string
  phone: string
  paymentTermDays: number
  status: PartnerStatus
}

export type ProductCategory =
  | 'Besi & Baja'
  | 'Semen & Agregat'
  | 'Atap & Dinding'
  | 'Finishing'
  /** Barang bekas hasil tukar tambah | masuk gudang lalu dijual ke peleburan. */
  | 'Barang Bekas'

export interface Product {
  id: ProductId
  sku: string
  name: string
  category: ProductCategory
  /** Satuan jual: batang, sak, lembar, m³, … */
  unit: string
  /** Harga pokok satuan terkini | dipakai saat posting HPP penjualan. */
  cost: number
  price: number
  /** Ambang batas stok minimum lintas gudang. */
  minStock: number
  status: PartnerStatus
}

export interface Warehouse {
  id: WarehouseId
  code: string
  name: string
  city: string
  manager: string
  /** Kapasitas simpan dalam unit setara | dipakai indikator utilisasi. */
  capacity: number
}

/* -------------------------------------------------------------------------- */
/* Dokumen transaksi                                                           */
/* -------------------------------------------------------------------------- */

/**
 * `draft`   | belum berpengaruh ke buku (tidak ikut dijurnal).
 * `posted`  | sudah dijurnal, belum dibayar sama sekali.
 * `partial` | dibayar sebagian.
 * `paid`    | lunas.
 * `overdue` | turunan: posted/partial yang lewat jatuh tempo.
 */
export type DocumentStatus = 'draft' | 'posted' | 'partial' | 'paid' | 'overdue'

/** Status yang benar-benar disimpan di dokumen; `overdue` selalu dihitung. */
export type StoredDocumentStatus = Exclude<DocumentStatus, 'overdue'>

/** Baris barang pada faktur penjualan/pembelian. */
export interface DocumentLine {
  productId: ProductId
  qty: number
  /** Harga satuan sebelum diskon & PPN. */
  unitPrice: number
  /** Diskon baris dalam persen (0–100). */
  discountPercent: number
}

/** Nilai uang hasil hitung ulang baris | tidak pernah diketik manual. */
export interface DocumentTotals {
  /** Jumlah bruto seluruh baris. */
  gross: number
  discount: number
  /** Dasar Pengenaan Pajak = bruto - diskon. */
  dpp: number
  ppn: number
  total: number
}

/** Satu jenis barang bekas yang diterima dalam transaksi tukar tambah. */
export interface TradeInLine {
  productId: ProductId
  qty: number
  /** Nilai tukar tambah per unit yang disepakati dengan pelanggan. */
  unitValue: number
}

/**
 * Tukar tambah: pelanggan menyerahkan barang bekas sebagai potongan pembayaran.
 *
 * Secara akuntansi ini BUKAN diskon melainkan dua penyerahan yang dikompensasi |
 * perusahaan menjual barang baru sekaligus membeli barang bekas. Karena itu
 * PPN keluaran faktur tetap dihitung dari harga penuh, dan barang bekasnya masuk
 * persediaan dengan nilainya sendiri.
 */
export interface TradeIn {
  lines: TradeInLine[]
  /** Gudang yang menerima barang bekas. */
  warehouseId: WarehouseId
  /** Nilai barang bekas sebelum PPN. */
  dpp: number
  /** PPN masukan; 0 kalau pelanggan bukan PKP dan tidak menerbitkan faktur pajak. */
  ppn: number
  total: number
  /** Nomor faktur pajak dari pelanggan; `null` untuk pelanggan non-PKP. */
  taxInvoiceNumber: string | null
}

export interface SalesInvoice {
  id: DocumentId
  number: string
  date: IsoDate
  dueDate: IsoDate
  customerId: CustomerId
  warehouseId: WarehouseId
  lines: DocumentLine[]
  totals: DocumentTotals
  /** Harga pokok barang yang keluar | dikunci saat faktur dibuat. */
  cogs: number
  /** Barang bekas yang diterima sebagai potongan tagihan; `null` = tanpa tukar tambah. */
  tradeIn: TradeIn | null
  /** Akumulasi pembayaran yang sudah diterima. */
  paidAmount: number
  status: StoredDocumentStatus
  /** Faktur pajak keluaran; kosong berarti belum diterbitkan. */
  taxInvoiceNumber: string | null
  salesPerson: string
  notes?: string
}

export interface PurchaseInvoice {
  id: DocumentId
  number: string
  date: IsoDate
  dueDate: IsoDate
  supplierId: SupplierId
  warehouseId: WarehouseId
  lines: DocumentLine[]
  totals: DocumentTotals
  paidAmount: number
  status: StoredDocumentStatus
  /** Nomor faktur pajak masukan dari pemasok. */
  taxInvoiceNumber: string | null
  notes?: string
}

/** Jenis potongan PPh atas beban. */
export type WithholdingType = 'none' | 'pph21' | 'pph23' | 'pph4-2'

export interface Expense {
  id: DocumentId
  number: string
  date: IsoDate
  /** Akun beban yang didebit | mengikat beban langsung ke bagan akun. */
  accountCode: AccountCode
  description: string
  /** Nilai beban sebelum PPN & sebelum potongan PPh. */
  amount: number
  /** PPN masukan yang bisa dikreditkan (0 kalau vendor non-PKP). */
  ppn: number
  withholding: WithholdingType
  /** Nilai PPh yang dipotong dari pembayaran ke rekanan. */
  withholdingAmount: number
  /** Akun kas/bank sumber pembayaran saat beban dicatat; `null` = diakui dulu sebagai utang. */
  paidFromAccount: AccountCode | null
  /**
   * Pelunasan menyusul untuk beban yang tadinya terutang.
   * Disimpan terpisah supaya jurnal pengakuan beban tetap utuh dan
   * pelunasannya muncul sebagai jurnal kas tersendiri.
   */
  settlement: { date: IsoDate; accountCode: AccountCode } | null
  vendor: string
  status: 'posted' | 'paid'
}

/* -------------------------------------------------------------------------- */
/* Point of Sale (POS)                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Cara bayar di kasir.
 * Non-tunai TIDAK langsung menjadi kas: dananya mengendap di penyelenggara
 * pembayaran dulu, jadi dibukukan sebagai piutang settlement.
 */
export type PosPaymentMethod = 'tunai' | 'qris' | 'debit'

/**
 * Jenis transaksi kasir.
 * `sale` | jual barang ke pembeli (boleh disertai tukar tambah).
 * `buy`  | beli barang bekas tunai dari pembawa scrap di konter.
 */
export type PosTransactionType = 'sale' | 'buy'

export interface PosTransaction {
  id: DocumentId
  number: string
  /** Shift kasir yang menaungi transaksi ini. */
  shiftId: DocumentId
  date: IsoDate
  /** Jam transaksi "HH:mm" | struk ritel tanpa jam tidak bisa ditelusuri. */
  time: string
  type: PosTransactionType
  warehouseId: WarehouseId
  /** Pembeli konter umumnya tidak terdaftar; cukup nama di struk. */
  customerName: string
  lines: DocumentLine[]
  totals: DocumentTotals
  /** Harga pokok barang yang keluar (0 untuk transaksi `buy`). */
  cogs: number
  tradeIn: TradeIn | null
  method: PosPaymentMethod
  /** Yang benar-benar harus dibayar: total dikurangi nilai tukar tambah. */
  netDue: number
  /** Uang tunai yang diserahkan pembeli; 0 untuk non-tunai. */
  cashTendered: number
  change: number
  /** Biaya jasa penyelenggara pembayaran (MDR); 0 untuk tunai. */
  mdrFee: number
  cashierId: string
  cashierName: string
}

export type PosShiftStatus = 'open' | 'closed'

/**
 * Shift kasir | penanggung jawab fisik uang di laci.
 *
 * Tanpa shift, selisih kas tidak pernah ketahuan siapa pemegangnya. Karena itu
 * setiap transaksi POS wajib menempel pada satu shift, dan penutupan shift
 * memaksa kasir menghitung uang fisik.
 */
export interface PosShift {
  id: DocumentId
  number: string
  cashierId: string
  cashierName: string
  warehouseId: WarehouseId
  date: IsoDate
  openedAt: string
  /** Modal kas awal yang diambil dari bank ke laci. */
  openingFloat: number
  closedAt: string | null
  /** Hasil hitung fisik uang saat tutup; `null` selama shift masih buka. */
  countedCash: number | null
  /** Uang yang disetor kembali ke bank saat tutup. */
  depositedAmount: number
  /**
   * Tanggal dana QRIS/debit shift ini cair ke rekening bank (biasanya H+1).
   * `null` = masih mengendap di penyelenggara pembayaran.
   */
  settledAt: IsoDate | null
  status: PosShiftStatus
  notes?: string
}

/** Ringkasan satu shift | dasar laporan tutup kasir (Z-report). */
export interface PosShiftSummary {
  shift: PosShift
  warehouseName: string
  transactionCount: number
  /** Penjualan kotor (DPP + PPN) sebelum dipotong tukar tambah. */
  grossSales: number
  /** Nilai tukar tambah yang memotong pembayaran. */
  tradeInValue: number
  /** Uang tunai masuk dari penjualan. */
  cashSales: number
  /** Penerimaan non-tunai (QRIS + debit), bruto sebelum MDR. */
  nonCashSales: number
  /** Uang tunai keluar untuk membeli barang bekas di konter. */
  cashPurchases: number
  mdrFee: number
  /** Kas seharusnya = modal awal + tunai masuk | tunai keluar. */
  expectedCash: number
  /** Selisih hitung fisik terhadap `expectedCash`; positif = lebih. */
  cashDifference: number
  /** Kontribusi shift ini ke PPN keluaran. */
  outputVat: number
}

export interface NewPosShiftPayload {
  warehouseId: WarehouseId
  openingFloat: number
}

export interface ClosePosShiftPayload {
  shiftId: DocumentId
  countedCash: number
  /** Uang yang disetor ke bank; sisanya tetap jadi modal laci besok. */
  depositedAmount: number
  notes?: string
}

export interface NewPosTransactionPayload {
  shiftId: DocumentId
  type: PosTransactionType
  customerName: string
  lines: DocumentLine[]
  method: PosPaymentMethod
  /** Wajib untuk metode tunai; harus >= yang harus dibayar. */
  cashTendered: number
  tradeIn?: {
    lines: TradeInLine[]
    vatable: boolean
  }
}

export type PaymentDirection = 'in' | 'out'

/** Penerimaan dari pelanggan / pembayaran ke pemasok. */
export interface Payment {
  id: DocumentId
  number: string
  date: IsoDate
  direction: PaymentDirection
  /** Faktur yang dilunasi. */
  invoiceId: DocumentId
  amount: number
  /** Akun kas/bank yang bertambah (in) atau berkurang (out). */
  accountCode: AccountCode
  method: 'transfer' | 'tunai' | 'giro'
}

export type StockMoveType = 'in' | 'out' | 'adjustment'

/**
 * Kartu stok. Setiap baris punya jejak ke dokumen sumbernya (`refId`) supaya
 * gudang tidak pernah lepas dari penjualan/pembelian.
 */
export interface StockMove {
  id: string
  date: IsoDate
  productId: ProductId
  warehouseId: WarehouseId
  /** Positif = masuk, negatif = keluar. */
  qty: number
  type: StockMoveType
  unitCost: number
  refType: 'sales' | 'purchase' | 'opening' | 'adjustment' | 'pos'
  refId: DocumentId | null
  /** Nomor dokumen sumber, untuk ditampilkan di kartu stok. */
  refNumber: string | null
  note: string
}

/** Penyesuaian stok manual (stock opname) yang dicatat user. */
export interface StockAdjustment {
  id: DocumentId
  number: string
  date: IsoDate
  productId: ProductId
  warehouseId: WarehouseId
  /** Selisih terhadap stok sistem; negatif = susut. */
  qtyDiff: number
  reason: string
}

/* -------------------------------------------------------------------------- */
/* Jurnal & buku besar                                                         */
/* -------------------------------------------------------------------------- */

/** Modul asal jurnal | dipakai untuk filter & label sumber di Pembukuan. */
export type JournalSource =
  | 'opening'
  | 'pos'
  | 'sales'
  | 'purchase'
  | 'expense'
  | 'payment'
  | 'inventory'
  | 'manual'

export interface JournalLine {
  accountCode: AccountCode
  debit: number
  credit: number
  memo: string
}

export interface JournalEntry {
  id: string
  number: string
  date: IsoDate
  description: string
  source: JournalSource
  /** Dokumen sumber; `null` untuk jurnal manual & saldo awal. */
  refId: DocumentId | null
  /** Nomor dokumen sumber untuk ditampilkan di UI. */
  refNumber: string | null
  lines: JournalLine[]
}

/** Jurnal manual (penyusutan, koreksi, reklasifikasi) yang disimpan di database. */
export interface ManualJournal {
  id: string
  number: string
  date: IsoDate
  description: string
  lines: JournalLine[]
}

/** Satu baris mutasi pada buku besar satu akun. */
export interface LedgerRow {
  entryId: string
  number: string
  date: IsoDate
  description: string
  source: JournalSource
  debit: number
  credit: number
  /** Saldo berjalan sesuai saldo normal akun. */
  balance: number
}

export interface LedgerAccount {
  account: Account
  openingBalance: number
  rows: LedgerRow[]
  totalDebit: number
  totalCredit: number
  closingBalance: number
}

/** Baris neraca saldo / neraca lajur. */
export interface TrialBalanceRow {
  account: Account
  openingDebit: number
  openingCredit: number
  mutationDebit: number
  mutationCredit: number
  endingDebit: number
  endingCredit: number
}

export interface TrialBalance {
  rows: TrialBalanceRow[]
  totalDebit: number
  totalCredit: number
  /** Selisih debit-kredit; harus 0 kalau posting engine benar. */
  difference: number
}

/* -------------------------------------------------------------------------- */
/* Laporan keuangan                                                            */
/* -------------------------------------------------------------------------- */

export interface ReportLine {
  code: AccountCode
  label: string
  amount: number
}

export interface ReportSection {
  key: string
  title: string
  lines: ReportLine[]
  total: number
}

export interface BalanceSheet {
  asOf: IsoDate
  currentAssets: ReportSection
  fixedAssets: ReportSection
  totalAssets: number
  currentLiabilities: ReportSection
  longTermLiabilities: ReportSection
  totalLiabilities: number
  equity: ReportSection
  /** Laba berjalan tahun ini | ikut menambah ekuitas. */
  currentEarnings: number
  totalEquity: number
  totalLiabilitiesAndEquity: number
  /** Total aset - (kewajiban + ekuitas). Nol berarti neraca seimbang. */
  imbalance: number
}

export interface IncomeStatement {
  from: IsoDate
  to: IsoDate
  revenue: ReportSection
  cogs: ReportSection
  grossProfit: number
  operatingExpenses: ReportSection
  operatingProfit: number
  otherIncome: ReportSection
  otherExpenses: ReportSection
  profitBeforeTax: number
  taxExpense: number
  netProfit: number
  /** Marjin dalam persen (1 desimal). */
  grossMargin: number
  netMargin: number
}

export type CashFlowCategory = 'operasi' | 'investasi' | 'pendanaan'

export interface CashFlowSection {
  category: CashFlowCategory
  title: string
  lines: ReportLine[]
  total: number
}

export interface CashFlowStatement {
  from: IsoDate
  to: IsoDate
  openingCash: number
  sections: CashFlowSection[]
  netChange: number
  closingCash: number
}

export interface EquityStatement {
  from: IsoDate
  to: IsoDate
  openingCapital: number
  openingRetained: number
  additionalCapital: number
  netProfit: number
  closingEquity: number
}

/* -------------------------------------------------------------------------- */
/* Perpajakan                                                                  */
/* -------------------------------------------------------------------------- */

export type TaxFilingStatus = 'kurang-bayar' | 'lebih-bayar' | 'nihil'

/** Rekap SPT Masa PPN satu periode. */
export interface VatPeriodSummary {
  period: PeriodKey
  label: string
  /** DPP penyerahan (penjualan). */
  outputBase: number
  outputVat: number
  /** DPP perolehan (pembelian + beban ber-PPN). */
  inputBase: number
  inputVat: number
  /** Positif = kurang bayar, negatif = lebih bayar. */
  payable: number
  status: TaxFilingStatus
  /** Faktur keluaran yang belum bernomor | risiko sanksi. */
  unnumberedInvoices: number
}

/** Rekap PPh yang dipotong perusahaan atas beban. */
export interface WithholdingSummary {
  type: Exclude<WithholdingType, 'none'>
  label: string
  rateLabel: string
  base: number
  amount: number
  count: number
}

export interface CorporateTaxEstimate {
  profitBeforeTax: number
  /** Tarif efektif yang dipakai (persen). */
  rate: number
  estimatedTax: number
  /** Angsuran PPh 25 yang sudah disetor. */
  prepaid: number
  /** Positif = kurang bayar akhir tahun (PPh 29). */
  payable: number
}

export interface TaxOverview {
  vat: VatPeriodSummary
  vatTrend: VatPeriodSummary[]
  withholdings: WithholdingSummary[]
  corporate: CorporateTaxEstimate
  /** Saldo utang pajak di neraca per akhir periode. */
  taxLiability: number
  /** Faktur pajak keluaran yang belum diberi nomor seri. */
  pendingTaxInvoices: Array<{ id: DocumentId; number: string; date: IsoDate; customerName: string; ppn: number }>
}

/* -------------------------------------------------------------------------- */
/* View-model lintas modul                                                     */
/* -------------------------------------------------------------------------- */

/** Baris tabel penjualan: faktur + nama pelanggan + status jatuh tempo. */
export interface SalesRow {
  invoice: SalesInvoice
  customerName: string
  warehouseName: string
  status: DocumentStatus
  /** Nilai barang bekas yang memotong tagihan; 0 kalau tanpa tukar tambah. */
  tradeInValue: number
  outstanding: number
  /** Hari lewat jatuh tempo; 0 kalau belum jatuh tempo atau lunas. */
  overdueDays: number
  margin: number
}

export interface PurchaseRow {
  invoice: PurchaseInvoice
  supplierName: string
  warehouseName: string
  status: DocumentStatus
  outstanding: number
  overdueDays: number
}

/** Baris barang yang sudah digabung dengan master produknya. */
export interface DocumentLineView {
  line: DocumentLine
  product: Product
  /** Nilai baris setelah diskon, sebelum PPN. */
  amount: number
  /** Harga pokok baris (qty × cost). */
  cost: number
}

/** Isi halaman detail faktur penjualan | satu dokumen dilihat dari segala sisi. */
export interface SalesInvoiceDetail {
  invoice: SalesInvoice
  customer: Customer | null
  warehouse: Warehouse | null
  lines: DocumentLineView[]
  /** Barang bekas yang diterima; kosong kalau faktur tanpa tukar tambah. */
  tradeInLines: DocumentLineView[]
  /** Jurnal yang lahir dari faktur ini. */
  journal: JournalEntry[]
  payments: Payment[]
  /** Pergerakan stok akibat faktur ini | keluar, dan masuk bila ada tukar tambah. */
  stockMoves: StockMove[]
  status: DocumentStatus
  tradeInValue: number
  outstanding: number
  overdueDays: number
  margin: number
}

export interface PurchaseInvoiceDetail {
  invoice: PurchaseInvoice
  supplier: Supplier | null
  warehouse: Warehouse | null
  lines: DocumentLineView[]
  journal: JournalEntry[]
  payments: Payment[]
  stockMoves: StockMove[]
  status: DocumentStatus
  outstanding: number
  overdueDays: number
}

export interface ExpenseRow {
  expense: Expense
  accountName: string
  /** Nilai yang benar-benar keluar dari kas (amount + ppn - pph). */
  cashOut: number
}

export type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock'

/** Posisi stok satu produk (agregat lintas gudang). */
export interface StockPosition {
  product: Product
  onHand: number
  /** Rincian per gudang, urut sesuai master gudang. */
  byWarehouse: Array<{ warehouse: Warehouse; qty: number }>
  /** Nilai persediaan = onHand × harga pokok. */
  value: number
  status: StockStatus
  /** Rata-rata keluar per bulan pada tahun berjalan. */
  avgMonthlyOut: number
  /** Perkiraan hari sampai stok habis; `null` kalau tidak ada pergerakan. */
  daysOfCover: number | null
}

/** Satu baris kartu stok, lengkap dengan saldo berjalan. */
export interface StockCardRow {
  move: StockMove
  warehouseName: string
  balance: number
}

/** Ringkasan satu gudang untuk kartu di halaman Gudang. */
export interface WarehouseSummary {
  warehouse: Warehouse
  units: number
  value: number
  skuCount: number
  /** Utilisasi kapasitas dalam persen. */
  utilization: number
}

/** Umur piutang / utang. */
export interface AgingBucket {
  label: string
  amount: number
  count: number
}

export interface Aging {
  buckets: AgingBucket[]
  total: number
}

/* -------------------------------------------------------------------------- */
/* Dashboard & performa                                                        */
/* -------------------------------------------------------------------------- */

export interface DashboardStats {
  revenue: number
  /** Pertumbuhan pendapatan vs periode sebelumnya (persen); `null` kalau tidak ada pembanding. */
  revenueGrowth: number | null
  grossProfit: number
  netProfit: number
  netMargin: number
  cashBalance: number
  receivable: number
  payable: number
  inventoryValue: number
  overdueReceivable: number
  vatPayable: number
  lowStockCount: number
  draftCount: number
  /** Omzet kasir pada periode berjalan. */
  posRevenue: number
  /** Jumlah shift kasir yang belum ditutup | uang masih di laci. */
  openShiftCount: number
}

/** Titik pada grafik tren bulanan. */
export interface MonthlyPoint {
  period: PeriodKey
  label: string
  revenue: number
  cogs: number
  expense: number
  grossProfit: number
  netProfit: number
  purchase: number
  cashIn: number
  cashOut: number
}

/** Peristiwa lintas modul untuk linimasa dashboard. */
export interface TimelineEntry {
  id: string
  source: JournalSource
  title: string
  subtitle: string
  amount: number
  date: IsoDate
  /** Nama route tujuan saat baris diklik; `null` = tidak bisa diklik. */
  routeName: string | null
  routeParams: Record<string, string> | null
}

export interface RankedItem {
  id: string
  label: string
  sublabel: string
  value: number
  /** Porsi terhadap total, 0–100. */
  share: number
}

/** Rasio keuangan pada halaman Performa. */
export interface FinancialRatio {
  key: string
  label: string
  value: number
  /** Format tampilan nilai. */
  format: 'percent' | 'ratio' | 'days' | 'times'
  /** Ambang sehat; dipakai menentukan warna. */
  benchmark: number
  /** `higher` = makin besar makin baik. */
  direction: 'higher' | 'lower'
  hint: string
}

export interface PerformanceReport {
  monthly: MonthlyPoint[]
  topProducts: RankedItem[]
  topCustomers: RankedItem[]
  expenseBreakdown: RankedItem[]
  ratios: FinancialRatio[]
  receivableAging: Aging
  payableAging: Aging
  /** Perputaran persediaan (kali per tahun). */
  inventoryTurnover: number
}

/* -------------------------------------------------------------------------- */
/* Badge                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Semua nilai status yang bisa dirender sebagai badge.
 * `statusBadgeColor.ts` memetakannya secara exhaustive | menambah status baru
 * di sini akan gagal compile sampai warna & labelnya diisi.
 */
export type BadgeStatus =
  | DocumentStatus
  | PosShiftStatus
  | PosPaymentMethod
  | StockStatus
  | PartnerStatus
  | TaxFilingStatus
  | JournalSource
  | 'balanced'
  | 'unbalanced'

/* -------------------------------------------------------------------------- */
/* Payload aksi (write operations)                                             */
/* -------------------------------------------------------------------------- */

export interface NewSalesInvoicePayload {
  date: IsoDate
  customerId: CustomerId
  warehouseId: WarehouseId
  lines: DocumentLine[]
  salesPerson: string
  notes?: string
  /** Tukar tambah opsional; PPN masukan hanya diakui bila `vatable`. */
  tradeIn?: {
    lines: TradeInLine[]
    warehouseId: WarehouseId
    vatable: boolean
  }
}

export interface NewPurchaseInvoicePayload {
  date: IsoDate
  supplierId: SupplierId
  warehouseId: WarehouseId
  lines: DocumentLine[]
  notes?: string
}

export interface NewExpensePayload {
  date: IsoDate
  accountCode: AccountCode
  description: string
  amount: number
  ppn: number
  withholding: WithholdingType
  paidFromAccount: AccountCode | null
  vendor: string
}

export interface NewPaymentPayload {
  invoiceId: DocumentId
  direction: PaymentDirection
  date: IsoDate
  amount: number
  accountCode: AccountCode
  method: Payment['method']
}

export interface NewStockAdjustmentPayload {
  date: IsoDate
  productId: ProductId
  warehouseId: WarehouseId
  qtyDiff: number
  reason: string
}

export interface NewManualJournalPayload {
  date: IsoDate
  description: string
  lines: JournalLine[]
}

/* -------------------------------------------------------------------------- */
/* Pengaturan perusahaan                                                       */
/* -------------------------------------------------------------------------- */

export interface CompanyProfile {
  name: string
  legalName: string
  npwp: string
  address: string
  city: string
  phone: string
  email: string
  /** Tahun buku berjalan. */
  fiscalYear: number
  /** Tarif PPN dalam persen. */
  vatRate: number
  /** Tarif PPh badan efektif dalam persen. */
  corporateTaxRate: number
}
