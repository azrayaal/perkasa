<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import ActivitySection from '@/components/resident/ActivitySection.vue'
import BillingSection from '@/components/resident/BillingSection.vue'
import EhrSection from '@/components/resident/EhrSection.vue'
import FamilyAccessSection from '@/components/resident/FamilyAccessSection.vue'
import ResidentDetailHeader from '@/components/resident/ResidentDetailHeader.vue'
import UnitSection from '@/components/resident/UnitSection.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import { useResidentData } from '@/composables/useResidentData'
import { updateResidentStatus } from '@/services/residentService'
import { ROUTE } from '@/router/routeNames'
import { useResidentStore } from '@/stores/residentStore'
import { useToastStore } from '@/stores/toastStore'
import type { ResidentId } from '@/types'

const props = defineProps<{
  /** Diisi otomatis dari route param `/residents/:id`. */
  id: ResidentId
}>()

const router = useRouter()
const residentStore = useResidentStore()
const toast = useToastStore()

const residentId = computed(() => props.id)

// Composable yang sama dipakai Portal Saya & Family Portal — bedanya hanya flag.
const { resident, unit, billing, ehr, activities, familyMembers, loading, error, refresh } =
  useResidentData(residentId)

watch(residentId, (id) => residentStore.selectResident(id), { immediate: true })

function goBack(): void {
  void router.push({ name: ROUTE.residentList })
}

async function toggleResidentStatus(): Promise<void> {
  if (!resident.value) return

  const next = resident.value.status === 'active' ? 'inactive' : 'active'
  try {
    await updateResidentStatus(resident.value.id, next)
    toast.push(next === 'active' ? 'Penghuni diaktifkan.' : 'Penghuni dinonaktifkan.')
    await refresh()
  } catch {
    toast.push('Gagal memperbarui status penghuni.', 'error')
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <BaseButton variant="ghost" size="sm" icon="back" class="self-start" @click="goBack">
      Kembali ke daftar resident
    </BaseButton>

    <LoadingState v-if="loading" :rows="5" />

    <EmptyState
      v-else-if="error || !resident"
      title="Resident tidak ditemukan"
      :description="error?.message ?? 'Data penghuni ini tidak tersedia.'"
    >
      <BaseButton @click="goBack">Kembali ke daftar</BaseButton>
    </EmptyState>

    <template v-else>
      <ResidentDetailHeader :resident="resident" :unit="unit">
        <template #actions>
          <BaseButton
            size="sm"
            :variant="resident.status === 'active' ? 'danger' : 'secondary'"
            @click="toggleResidentStatus"
          >
            {{ resident.status === 'active' ? 'Nonaktifkan' : 'Aktifkan' }}
          </BaseButton>
        </template>
      </ResidentDetailHeader>

      <div class="flex flex-col gap-4">
        <UnitSection :unit="unit" can-manage @changed="refresh" />
        <BillingSection :invoices="billing" :resident-id="resident.id" can-manage @changed="refresh" />
        <EhrSection :records="ehr ?? []" :resident-id="resident.id" can-manage @changed="refresh" />
        <ActivitySection
          :activities="activities"
          :resident-id="resident.id"
          can-manage
          @changed="refresh"
        />
        <FamilyAccessSection
          :members="familyMembers"
          :resident-id="resident.id"
          can-manage
          @changed="refresh"
        />
        <!-- EXTENSION POINT: tambah section modul baru di sini (care plan, dokumen, dll). -->
      </div>
    </template>
  </div>
</template>
