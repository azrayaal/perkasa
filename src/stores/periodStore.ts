import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { today } from '@/services/clock'
import {
  endOfMonth,
  periodLabelLong,
  periodOf,
  periodRange,
  startOfMonth,
} from '@/utils/date'
import type { IsoDate, PeriodKey } from '@/types'

export type PeriodMode = 'month' | 'ytd'

const STORAGE_KEY = 'perkasa-erp.period.v1'

interface StoredPeriod {
  mode: PeriodMode
  period: PeriodKey
}

function readStored(): StoredPeriod {
  const fallback: StoredPeriod = { mode: 'ytd', period: periodOf(today()) }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredPeriod) : fallback
  } catch {
    return fallback
  }
}

/**
 * Periode akuntansi aktif — SATU pilihan untuk seluruh aplikasi.
 *
 * Dashboard, performa, beban, pajak, pembukuan, neraca, dan laporan keuangan
 * semuanya membaca rentang tanggal dari sini. Mengganti bulan di topbar
 * mengubah semua halaman sekaligus, sehingga mustahil membandingkan dua
 * halaman yang diam-diam memakai periode berbeda.
 */
export const usePeriodStore = defineStore('period', () => {
  const stored = readStored()

  const mode = ref<PeriodMode>(stored.mode)
  const period = ref<PeriodKey>(stored.period)

  const fiscalYear = computed(() => Number(periodOf(today()).slice(0, 4)))

  /** Tanggal awal periode aktif. */
  const from = computed<IsoDate>(() =>
    mode.value === 'ytd' ? `${fiscalYear.value}-01-01` : startOfMonth(period.value),
  )

  /** Tanggal akhir; bulan berjalan berhenti di hari ini, bukan akhir bulan. */
  const to = computed<IsoDate>(() => {
    const limit = today()
    if (mode.value === 'ytd') return limit
    const monthEnd = endOfMonth(period.value)
    return monthEnd > limit ? limit : monthEnd
  })

  const label = computed(() =>
    mode.value === 'ytd'
      ? `Tahun Berjalan ${fiscalYear.value}`
      : periodLabelLong(period.value),
  )

  /** Pilihan bulan yang tersedia: Januari sampai bulan berjalan. */
  const availablePeriods = computed<PeriodKey[]>(() =>
    periodRange(`${fiscalYear.value}-01`, periodOf(today())).reverse(),
  )

  function persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: mode.value, period: period.value }))
    } catch {
      // Pilihan tetap berlaku untuk sesi ini walau tidak bisa disimpan.
    }
  }

  function selectMonth(next: PeriodKey): void {
    mode.value = 'month'
    period.value = next
    persist()
  }

  function selectYearToDate(): void {
    mode.value = 'ytd'
    persist()
  }

  return { mode, period, from, to, label, fiscalYear, availablePeriods, selectMonth, selectYearToDate }
})
