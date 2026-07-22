/**
 * Data seed (kondisi awal aplikasi).
 * Dibaca sekali oleh `data/db.ts`, lalu seluruh operasi baca/tulis berjalan di
 * atas database lokal tersebut. Komponen & composable tidak boleh menyentuh
 * file ini secara langsung.
 *
 * TODO: hapus file ini saat backend siap — service layer akan fetch dari API.
 */
import type { Activity, AuthAccount, Billing, Ehr, FamilyMember, Resident, Unit } from '@/types'

export const residents: Resident[] = [
  {
    id: 'R001',
    name: 'Budi Santoso',
    unitId: 'U-101',
    membershipTier: 'Premium',
    status: 'active',
    joinDate: '2024-01-15',
  },
  {
    id: 'R002',
    name: 'Siti Aminah',
    unitId: 'U-203',
    membershipTier: 'Standard',
    status: 'active',
    joinDate: '2023-11-02',
  },
  {
    id: 'R003',
    name: 'Hendra Wijaya',
    unitId: 'U-105',
    membershipTier: 'Premium',
    status: 'active',
    joinDate: '2024-03-20',
  },
]

export const units: Unit[] = [
  { id: 'U-101', unitCode: 'A-101', type: '1BR', floor: 1, status: 'occupied' },
  { id: 'U-203', unitCode: 'B-203', type: 'Studio', floor: 2, status: 'occupied' },
  { id: 'U-105', unitCode: 'A-105', type: '2BR', floor: 1, status: 'occupied' },
]

export const familyMembers: FamilyMember[] = [
  { id: 'F001', residentId: 'R001', name: 'Ani Santoso', relation: 'anak', portalAccess: true },
  { id: 'F002', residentId: 'R002', name: 'Rudi Aminah', relation: 'anak', portalAccess: true },
]

export const billing: Billing[] = [
  {
    id: 'INV-0725-01',
    residentId: 'R001',
    period: 'Jul 2026',
    rent: 8_500_000,
    careFee: 1_200_000,
    total: 9_700_000,
    status: 'paid',
  },
  {
    id: 'INV-0725-02',
    residentId: 'R002',
    period: 'Jul 2026',
    rent: 6_000_000,
    careFee: 800_000,
    total: 6_800_000,
    status: 'unpaid',
  },
]

export const ehr: Ehr[] = [
  {
    id: 'EHR-001',
    residentId: 'R001',
    date: '2026-07-20',
    bloodPressure: '130/85',
    heartRate: 78,
    notes: 'Kontrol rutin, kondisi stabil',
    caregiver: 'Ns. Dewi',
  },
  {
    id: 'EHR-002',
    residentId: 'R002',
    date: '2026-07-19',
    bloodPressure: '120/80',
    heartRate: 72,
    notes: 'Tidak ada keluhan',
    caregiver: 'Ns. Dewi',
  },
]

export const activities: Activity[] = [
  { id: 'ACT-01', residentId: 'R001', activity: 'Senam pagi', date: '2026-07-21', status: 'attended' },
  { id: 'ACT-02', residentId: 'R003', activity: 'Kelas melukis', date: '2026-07-22', status: 'booked' },
]

/**
 * Akun demo. Password plaintext HANYA untuk POC —
 * TODO: replace with real API call (POST /auth/login) + token, jangan pernah
 * mengirim daftar akun ke client di produksi.
 */
export const accounts: AuthAccount[] = [
  {
    id: 'USR-001',
    name: 'Sari Wulandari',
    email: 'admin@ginkgo.id',
    password: 'admin123',
    role: 'admin',
    title: 'Community Manager',
    residentId: null,
  },
  {
    id: 'USR-002',
    name: 'Budi Santoso',
    email: 'budi@ginkgo.id',
    password: 'resident123',
    role: 'resident',
    title: 'Penghuni · Unit A-101',
    residentId: 'R001',
  },
  {
    id: 'USR-003',
    name: 'Ani Santoso',
    email: 'ani@keluarga.id',
    password: 'family123',
    role: 'family',
    title: 'Anak dari Budi Santoso',
    residentId: 'R001',
  },
]

/** Pilihan aktivitas yang bisa di-booking — config, bukan hardcode di komponen. */
export const activityCatalog: string[] = [
  'Senam pagi',
  'Kelas melukis',
  'Terapi musik',
  'Kelas memasak',
  'Jalan sehat',
  'Pemeriksaan rutin',
]
