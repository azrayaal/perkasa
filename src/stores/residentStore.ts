import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ResidentId } from '@/types'

/**
 * State lintas-view yang kecil tapi dibutuhkan di banyak tempat.
 * Dipakai supaya `selectedResidentId` tidak perlu di-drill lewat props
 * berlapis dari App.vue -> view -> section.
 */
export const useResidentStore = defineStore('resident', () => {
  const selectedResidentId = ref<ResidentId | null>(null)

  function selectResident(id: ResidentId | null): void {
    selectedResidentId.value = id
  }

  return { selectedResidentId, selectResident }
})
