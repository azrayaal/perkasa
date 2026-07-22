<script setup lang="ts">
import { computed } from 'vue'
import ActivitySection from '@/components/resident/ActivitySection.vue'
import BillingSection from '@/components/resident/BillingSection.vue'
import EhrSection from '@/components/resident/EhrSection.vue'
import FamilyAccessSection from '@/components/resident/FamilyAccessSection.vue'
import ResidentDetailHeader from '@/components/resident/ResidentDetailHeader.vue'
import UnitSection from '@/components/resident/UnitSection.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import { useResidentData } from '@/composables/useResidentData'
import { useAuthStore } from '@/stores/authStore'

const auth = useAuthStore()

/** Penghuni hanya boleh melihat dirinya sendiri — id diambil dari sesi, bukan URL. */
const residentId = computed(() => auth.scopedResidentId)

// Penghuni BOLEH melihat detail medisnya sendiri, jadi `isFamilyView` tidak dipakai.
const { resident, unit, billing, ehr, activities, familyMembers, loading, refresh } =
  useResidentData(residentId)
</script>

<template>
  <div class="flex flex-col gap-6">
    <LoadingState v-if="loading" :rows="5" />

    <EmptyState
      v-else-if="!resident"
      title="Data penghuni tidak ditemukan"
      description="Akun Anda belum terhubung ke data penghuni mana pun."
    />

    <template v-else>
      <ResidentDetailHeader :resident="resident" :unit="unit" />

      <div class="flex flex-col gap-4">
        <UnitSection :unit="unit" />
        <!-- Penghuni bisa booking aktivitas sendiri, tapi tidak mengubah tagihan
             atau catatan medisnya — karena itu `can-manage` hanya di aktivitas. -->
        <ActivitySection
          :activities="activities"
          :resident-id="resident.id"
          can-manage
          @changed="refresh"
        />
        <BillingSection :invoices="billing" :resident-id="resident.id" />
        <EhrSection :records="ehr ?? []" :resident-id="resident.id" />
        <FamilyAccessSection :members="familyMembers" :resident-id="resident.id" />
        <!-- EXTENSION POINT: tambah widget portal penghuni di sini (permintaan layanan, dokumen). -->
      </div>
    </template>
  </div>
</template>
