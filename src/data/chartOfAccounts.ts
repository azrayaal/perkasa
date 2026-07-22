/**
 * Bagan Akun (Chart of Accounts) PT Perkasa Gemilang Distrindo.
 *
 * Ini adalah tulang punggung integrasi: setiap modul (penjualan, pembelian,
 * gudang, beban, pajak) hanya boleh menyentuh buku lewat kode akun di sini.
 * Menambah akun baru cukup di file ini | neraca, laba rugi, dan buku besar
 * ikut menyesuaikan sendiri karena keduanya membaca `group` & `type`.
 */
import type { Account, AccountCode, AccountGroup } from '@/types'

export const CHART_OF_ACCOUNTS: Account[] = [
  /* Aset lancar */
  { code: '1100', name: 'Kas Kecil', type: 'asset', group: 'kas-bank', normalBalance: 'debit', cash: true },
  { code: '1110', name: 'Bank BCA | Operasional', type: 'asset', group: 'kas-bank', normalBalance: 'debit', cash: true },
  { code: '1120', name: 'Bank Mandiri | Payroll', type: 'asset', group: 'kas-bank', normalBalance: 'debit', cash: true },
  { code: '1200', name: 'Piutang Usaha', type: 'asset', group: 'piutang', normalBalance: 'debit', description: 'Saldo mengikuti faktur penjualan yang belum lunas.' },
  { code: '1300', name: 'Persediaan Barang Dagang', type: 'asset', group: 'persediaan', normalBalance: 'debit', description: 'Saldo mengikuti nilai kartu stok gudang.' },
  { code: '1400', name: 'PPN Masukan', type: 'asset', group: 'aset-lancar-lain', normalBalance: 'debit' },
  { code: '1410', name: 'PPh 25 Dibayar di Muka', type: 'asset', group: 'aset-lancar-lain', normalBalance: 'debit' },
  { code: '1420', name: 'Sewa Dibayar di Muka', type: 'asset', group: 'aset-lancar-lain', normalBalance: 'debit' },

  /* Aset tetap */
  { code: '1500', name: 'Tanah & Bangunan', type: 'asset', group: 'aset-tetap', normalBalance: 'debit' },
  { code: '1510', name: 'Kendaraan Operasional', type: 'asset', group: 'aset-tetap', normalBalance: 'debit' },
  { code: '1520', name: 'Peralatan & Mesin Gudang', type: 'asset', group: 'aset-tetap', normalBalance: 'debit' },
  { code: '1590', name: 'Akumulasi Penyusutan', type: 'asset', group: 'akumulasi-penyusutan', normalBalance: 'credit', contra: true },

  /* Kewajiban lancar */
  { code: '2100', name: 'Utang Usaha', type: 'liability', group: 'utang-usaha', normalBalance: 'credit', description: 'Saldo mengikuti faktur pembelian yang belum lunas.' },
  { code: '2200', name: 'PPN Keluaran', type: 'liability', group: 'utang-pajak', normalBalance: 'credit' },
  { code: '2210', name: 'Utang PPh 21', type: 'liability', group: 'utang-pajak', normalBalance: 'credit' },
  { code: '2220', name: 'Utang PPh 23', type: 'liability', group: 'utang-pajak', normalBalance: 'credit' },
  { code: '2230', name: 'Utang PPh Final Pasal 4(2)', type: 'liability', group: 'utang-pajak', normalBalance: 'credit' },
  { code: '2240', name: 'Utang PPh Badan', type: 'liability', group: 'utang-pajak', normalBalance: 'credit' },
  { code: '2300', name: 'Beban Masih Harus Dibayar', type: 'liability', group: 'utang-lancar-lain', normalBalance: 'credit' },
  { code: '2400', name: 'Utang Bank Jangka Pendek', type: 'liability', group: 'utang-lancar-lain', normalBalance: 'credit' },

  /* Kewajiban jangka panjang */
  { code: '2500', name: 'Utang Bank Jangka Panjang', type: 'liability', group: 'utang-jangka-panjang', normalBalance: 'credit' },

  /* Ekuitas */
  { code: '3100', name: 'Modal Disetor', type: 'equity', group: 'modal', normalBalance: 'credit' },
  { code: '3200', name: 'Laba Ditahan', type: 'equity', group: 'laba-ditahan', normalBalance: 'credit' },

  /* Pendapatan */
  { code: '4100', name: 'Penjualan Barang Dagang', type: 'revenue', group: 'pendapatan', normalBalance: 'credit' },
  { code: '4200', name: 'Diskon Penjualan', type: 'revenue', group: 'pendapatan', normalBalance: 'debit', contra: true },
  { code: '4900', name: 'Pendapatan Lain-lain', type: 'other-income', group: 'pendapatan-lain', normalBalance: 'credit' },

  /* Harga pokok */
  { code: '5100', name: 'Harga Pokok Penjualan', type: 'cogs', group: 'harga-pokok', normalBalance: 'debit' },
  { code: '5200', name: 'Selisih Persediaan', type: 'cogs', group: 'harga-pokok', normalBalance: 'debit', description: 'Susut/lebih hasil stock opname gudang.' },
  { code: '5300', name: 'Selisih Penilaian Tukar Tambah', type: 'cogs', group: 'harga-pokok', normalBalance: 'debit', description: 'Selisih antara nilai tukar tambah yang disepakati dan harga pokok standar barang bekas.' },

  /* Beban operasional */
  { code: '6100', name: 'Beban Gaji & Tunjangan', type: 'expense', group: 'beban-operasional', normalBalance: 'debit' },
  { code: '6110', name: 'Beban Sewa Gudang & Kantor', type: 'expense', group: 'beban-operasional', normalBalance: 'debit' },
  { code: '6120', name: 'Beban Listrik, Air & Telekomunikasi', type: 'expense', group: 'beban-operasional', normalBalance: 'debit' },
  { code: '6130', name: 'Beban Transportasi & Distribusi', type: 'expense', group: 'beban-operasional', normalBalance: 'debit' },
  { code: '6140', name: 'Beban Pemasaran & Promosi', type: 'expense', group: 'beban-operasional', normalBalance: 'debit' },
  { code: '6150', name: 'Beban Perlengkapan Kantor', type: 'expense', group: 'beban-operasional', normalBalance: 'debit' },
  { code: '6160', name: 'Beban Pemeliharaan & Perbaikan', type: 'expense', group: 'beban-operasional', normalBalance: 'debit' },
  { code: '6170', name: 'Beban Jasa Profesional', type: 'expense', group: 'beban-operasional', normalBalance: 'debit' },
  { code: '6180', name: 'Beban Asuransi', type: 'expense', group: 'beban-operasional', normalBalance: 'debit' },
  { code: '6190', name: 'Beban Penyusutan', type: 'expense', group: 'beban-operasional', normalBalance: 'debit' },
  { code: '6200', name: 'Beban Administrasi Bank', type: 'expense', group: 'beban-operasional', normalBalance: 'debit' },
  { code: '6210', name: 'Beban Perjalanan Dinas', type: 'expense', group: 'beban-operasional', normalBalance: 'debit' },

  /* Non-operasional */
  { code: '7100', name: 'Beban Bunga Pinjaman', type: 'other-expense', group: 'beban-lain', normalBalance: 'debit' },
  { code: '8100', name: 'Beban Pajak Penghasilan', type: 'tax-expense', group: 'pajak-penghasilan', normalBalance: 'debit' },
]

/**
 * Alias akun yang dipakai posting engine.
 * Semua kode akun di service layer WAJIB lewat konstanta ini | tidak boleh ada
 * string '1200' yang ditulis langsung, supaya pemetaan bisa diubah di satu tempat.
 */
export const ACC = {
  cash: '1100',
  bankOps: '1110',
  bankPayroll: '1120',
  receivable: '1200',
  inventory: '1300',
  vatIn: '1400',
  prepaidCorporateTax: '1410',
  prepaidRent: '1420',
  accumulatedDepreciation: '1590',
  payable: '2100',
  vatOut: '2200',
  pph21: '2210',
  pph23: '2220',
  pph4Final: '2230',
  corporateTaxPayable: '2240',
  accrued: '2300',
  capital: '3100',
  retainedEarnings: '3200',
  sales: '4100',
  salesDiscount: '4200',
  otherIncome: '4900',
  cogs: '5100',
  inventoryVariance: '5200',
  tradeInVariance: '5300',
  interest: '7100',
  corporateTaxExpense: '8100',
} as const satisfies Record<string, AccountCode>

const BY_CODE = new Map(CHART_OF_ACCOUNTS.map((account) => [account.code, account]))

/** Akun berdasarkan kode. Kode tak dikenal jatuh ke akun placeholder, bukan crash. */
export function accountByCode(code: AccountCode): Account {
  return (
    BY_CODE.get(code) ?? {
      code,
      name: `Akun ${code}`,
      type: 'expense',
      group: 'beban-operasional',
      normalBalance: 'debit',
    }
  )
}

export function accountName(code: AccountCode): string {
  return accountByCode(code).name
}

/** Akun kas & bank | dipakai laporan arus kas dan pemilih rekening pembayaran. */
export const CASH_ACCOUNTS: Account[] = CHART_OF_ACCOUNTS.filter((account) => account.cash === true)

/** Akun beban yang boleh dipilih user saat mencatat beban operasional. */
export const EXPENSE_ACCOUNTS: Account[] = CHART_OF_ACCOUNTS.filter(
  (account) => account.group === 'beban-operasional',
)

/** Label kelompok akun untuk judul section di laporan. */
export const GROUP_LABEL: Record<AccountGroup, string> = {
  'kas-bank': 'Kas & Setara Kas',
  piutang: 'Piutang Usaha',
  persediaan: 'Persediaan',
  'aset-lancar-lain': 'Aset Lancar Lainnya',
  'aset-tetap': 'Aset Tetap',
  'akumulasi-penyusutan': 'Akumulasi Penyusutan',
  'utang-usaha': 'Utang Usaha',
  'utang-pajak': 'Utang Pajak',
  'utang-lancar-lain': 'Kewajiban Lancar Lainnya',
  'utang-jangka-panjang': 'Kewajiban Jangka Panjang',
  modal: 'Modal Disetor',
  'laba-ditahan': 'Laba Ditahan',
  pendapatan: 'Pendapatan Usaha',
  'harga-pokok': 'Harga Pokok Penjualan',
  'beban-operasional': 'Beban Operasional',
  'pendapatan-lain': 'Pendapatan Lain-lain',
  'beban-lain': 'Beban Lain-lain',
  'pajak-penghasilan': 'Pajak Penghasilan',
}

/** Kelompok yang membentuk Aset Lancar di neraca, sesuai urutan penyajian. */
export const CURRENT_ASSET_GROUPS: AccountGroup[] = [
  'kas-bank',
  'piutang',
  'persediaan',
  'aset-lancar-lain',
]

export const FIXED_ASSET_GROUPS: AccountGroup[] = ['aset-tetap', 'akumulasi-penyusutan']

export const CURRENT_LIABILITY_GROUPS: AccountGroup[] = [
  'utang-usaha',
  'utang-pajak',
  'utang-lancar-lain',
]

export const LONG_TERM_LIABILITY_GROUPS: AccountGroup[] = ['utang-jangka-panjang']

export const EQUITY_GROUPS: AccountGroup[] = ['modal', 'laba-ditahan']
