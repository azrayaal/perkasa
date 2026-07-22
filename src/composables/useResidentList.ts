import { onMounted, ref, type Ref } from 'vue'
import { getResidentList } from '@/services/residentService'
import type { ResidentListItem } from '@/types'

export interface UseResidentListReturn {
  items: Ref<ResidentListItem[]>
  loading: Ref<boolean>
  error: Ref<Error | null>
  refresh: () => Promise<void>
}

/**
 * Daftar resident (sudah di-join dengan unit di service layer).
 * Dipakai `ResidentListView` dan dropdown pemilih di `FamilyPortalView`.
 */
export function useResidentList(): UseResidentListReturn {
  const items = ref<ResidentListItem[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)

  async function refresh(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      items.value = await getResidentList()
    } catch (caught) {
      items.value = []
      error.value = caught instanceof Error ? caught : new Error('Gagal memuat daftar resident.')
    } finally {
      loading.value = false
    }
  }

  onMounted(() => void refresh())

  return { items, loading, error, refresh }
}
