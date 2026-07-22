/**
 * Single source of truth untuk seluruh kontrak data aplikasi.
 * Service, composable, store, dan komponen WAJIB import type dari sini.
 * Tidak boleh ada `any` di seluruh codebase.
 */

/* -------------------------------------------------------------------------- */
/* Primitive / union types                                                     */
/* -------------------------------------------------------------------------- */

export type ResidentId = string
export type UnitId = string

export type MembershipTier = 'Premium' | 'Standard'
export type ResidentStatus = 'active' | 'inactive' | 'pending'
export type UnitType = 'Studio' | '1BR' | '2BR'
export type UnitStatus = 'occupied' | 'vacant' | 'booked' | 'maintenance'
export type BillingStatus = 'paid' | 'unpaid' | 'overdue'
export type ActivityStatus = 'attended' | 'booked' | 'cancelled'

/**
 * Semua nilai status yang bisa dirender sebagai badge.
 * Dipakai `statusBadgeColor.ts` sebagai key map — menambah status baru
 * di sini akan memunculkan type error di map warna sampai warnanya diisi.
 */
export type BadgeStatus =
  | ResidentStatus
  | UnitStatus
  | BillingStatus
  | ActivityStatus
  | MembershipTier
  | HealthSummaryLevel

/* -------------------------------------------------------------------------- */
/* Auth & role                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * `admin`    — staf Ginkgo Living, akses penuh seluruh modul ERP.
 * `resident` — penghuni, hanya melihat datanya sendiri (termasuk detail medis).
 * `family`   — keluarga penghuni, read-only & tanpa detail medis.
 */
export type UserRole = 'admin' | 'resident' | 'family'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  /** Jabatan (admin) atau relasi ke penghuni (family). */
  title: string
  /**
   * Resident yang "dimiliki" user ini.
   * `admin` bernilai `null`; `resident`/`family` selalu terisi.
   */
  residentId: ResidentId | null
}

/** Akun lengkap dengan password — hanya hidup di data layer, tidak pernah ke UI. */
export interface AuthAccount extends AuthUser {
  password: string
}

export interface LoginPayload {
  email: string
  password: string
}

/* -------------------------------------------------------------------------- */
/* Entity types (bentuknya sama dengan response API nanti)                     */
/* -------------------------------------------------------------------------- */

export interface Resident {
  id: ResidentId
  name: string
  unitId: UnitId
  membershipTier: MembershipTier
  status: ResidentStatus
  /** ISO date string, contoh: "2024-01-15" */
  joinDate: string
}

export interface Unit {
  id: UnitId
  unitCode: string
  type: UnitType
  floor: number
  status: UnitStatus
}

export interface FamilyMember {
  id: string
  residentId: ResidentId
  name: string
  relation: string
  portalAccess: boolean
}

export interface Billing {
  id: string
  residentId: ResidentId
  /** Label periode tagihan, contoh: "Jul 2026" */
  period: string
  rent: number
  careFee: number
  total: number
  status: BillingStatus
}

export interface Ehr {
  id: string
  residentId: ResidentId
  /** ISO date string */
  date: string
  bloodPressure: string
  heartRate: number
  notes: string
  caregiver: string
}

export interface Activity {
  id: string
  residentId: ResidentId
  activity: string
  /** ISO date string */
  date: string
  status: ActivityStatus
}

/* -------------------------------------------------------------------------- */
/* Derived / view-model types                                                  */
/* -------------------------------------------------------------------------- */

/** Baris pada daftar resident — hasil join Resident + Unit di service layer. */
export interface ResidentListItem {
  resident: Resident
  unit: Unit | null
}

/** Ringkasan billing untuk Family Portal — tanpa breakdown rent/careFee. */
export interface BillingSummary {
  outstandingTotal: number
  latestPeriod: string | null
  status: BillingStatus | null
  invoiceCount: number
}

export type HealthSummaryLevel = 'stable' | 'needs-attention'

/**
 * Ringkasan kesehatan untuk Family Portal.
 * Sengaja TIDAK memuat tekanan darah, detak jantung, atau catatan medis.
 */
export interface HealthSummary {
  level: HealthSummaryLevel
  /** ISO date string dari pemeriksaan terakhir */
  lastCheckDate: string | null
  caregiver: string | null
}

/**
 * Agregat lengkap satu resident — kontrak balikan `getResidentDetail()`.
 * Field sensitif bernilai `null` saat diakses lewat family view.
 */
export interface ResidentFullData {
  resident: Resident
  unit: Unit | null
  billing: Billing[]
  billingSummary: BillingSummary
  /** `null` pada family view — detail medis tidak boleh bocor ke portal keluarga. */
  ehr: Ehr[] | null
  healthSummary: HealthSummary
  activities: Activity[]
  familyMembers: FamilyMember[]
}

/** Opsi query yang diteruskan dari composable ke service layer. */
export interface ResidentDataOptions {
  /** `true` = mode Family Portal: data medis detail dipangkas. */
  isFamilyView?: boolean
}

/* -------------------------------------------------------------------------- */
/* Payload aksi (write operations)                                             */
/* -------------------------------------------------------------------------- */

/** Field yang diisi user; `id` dibuat oleh service layer. */
export type NewResidentPayload = Omit<Resident, 'id'>
export type NewInvoicePayload = Omit<Billing, 'id' | 'total' | 'status'>
export type NewEhrPayload = Omit<Ehr, 'id'>
export type NewActivityPayload = Omit<Activity, 'id' | 'status'>
export type NewFamilyMemberPayload = Omit<FamilyMember, 'id'>

/* -------------------------------------------------------------------------- */
/* Baris tabel lintas-resident (halaman modul)                                 */
/* -------------------------------------------------------------------------- */

/** Entity apa pun yang sudah di-join dengan nama penghuninya di service layer. */
export type WithResident<T> = T & { residentName: string }

/** Baris tabel unit beserta penghuni yang menempatinya. */
export interface UnitRow {
  unit: Unit
  occupantName: string | null
  occupantId: ResidentId | null
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                   */
/* -------------------------------------------------------------------------- */

export interface DashboardStats {
  totalResidents: number
  activeResidents: number
  occupiedUnits: number
  totalUnits: number
  outstandingAmount: number
  unpaidInvoiceCount: number
  activitiesThisPeriod: number
  residentsNeedingAttention: number
}

/** Baris feed aktivitas terbaru di dashboard. */
export interface TimelineEntry {
  id: string
  residentId: ResidentId
  residentName: string
  /** Modul asal peristiwa — dipakai untuk warna/label. */
  source: 'billing' | 'ehr' | 'activity'
  description: string
  date: string
}
