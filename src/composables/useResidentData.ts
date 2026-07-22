import { computed, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import { getResidentDetail } from '@/services/residentService'
import type {
  Activity,
  Billing,
  BillingSummary,
  Ehr,
  FamilyMember,
  HealthSummary,
  Resident,
  ResidentDataOptions,
  ResidentId,
  Unit,
} from '@/types'

export interface UseResidentDataReturn {
  resident: Ref<Resident | null>
  unit: Ref<Unit | null>
  billing: Ref<Billing[]>
  billingSummary: Ref<BillingSummary | null>
  /** `null` pada family view — detail medis dipangkas di service layer. */
  ehr: Ref<Ehr[] | null>
  healthSummary: Ref<HealthSummary | null>
  activities: Ref<Activity[]>
  familyMembers: Ref<FamilyMember[]>
  loading: Ref<boolean>
  error: Ref<Error | null>
  /** Muat ulang data resident yang sedang aktif (dipakai tombol retry). */
  refresh: () => Promise<void>
}

/**
 * Composable utama pengambilan data resident.
 *
 * Dipakai bersama oleh `ResidentDetailView` dan `FamilyPortalView`; perbedaan
 * keduanya hanya flag `isFamilyView`, sehingga logika join tidak terduplikasi.
 *
 * @param residentId - ref/getter id resident; `null` = belum ada yang dipilih.
 */
export function useResidentData(
  residentId: MaybeRefOrGetter<ResidentId | null>,
  options: ResidentDataOptions = {},
): UseResidentDataReturn {
  const resident = ref<Resident | null>(null)
  const unit = ref<Unit | null>(null)
  const billing = ref<Billing[]>([])
  const billingSummary = ref<BillingSummary | null>(null)
  const ehr = ref<Ehr[] | null>(null)
  const healthSummary = ref<HealthSummary | null>(null)
  const activities = ref<Activity[]>([])
  const familyMembers = ref<FamilyMember[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)

  /** Token request terakhir — response yang sudah basi diabaikan. */
  let latestRequest = 0

  function reset(): void {
    resident.value = null
    unit.value = null
    billing.value = []
    billingSummary.value = null
    ehr.value = null
    healthSummary.value = null
    activities.value = []
    familyMembers.value = []
  }

  async function load(id: ResidentId | null): Promise<void> {
    error.value = null

    if (!id) {
      reset()
      loading.value = false
      return
    }

    const requestId = ++latestRequest
    loading.value = true

    try {
      const data = await getResidentDetail(id, options)
      if (requestId !== latestRequest) return

      resident.value = data.resident
      unit.value = data.unit
      billing.value = data.billing
      billingSummary.value = data.billingSummary
      ehr.value = data.ehr
      healthSummary.value = data.healthSummary
      activities.value = data.activities
      familyMembers.value = data.familyMembers
    } catch (caught) {
      if (requestId !== latestRequest) return
      reset()
      error.value = caught instanceof Error ? caught : new Error('Gagal memuat data resident.')
    } finally {
      if (requestId === latestRequest) loading.value = false
    }
  }

  const currentId = computed(() => toValue(residentId))

  watch(currentId, (id) => void load(id), { immediate: true })

  return {
    resident,
    unit,
    billing,
    billingSummary,
    ehr,
    healthSummary,
    activities,
    familyMembers,
    loading,
    error,
    refresh: () => load(currentId.value),
  }
}
