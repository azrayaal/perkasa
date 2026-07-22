<script setup lang="ts">
import { computed, ref } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseTable from '@/components/ui/BaseTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import type { TableColumn } from '@/components/ui/BaseTable.types'
import { createEhrRecord } from '@/services/ehrService'
import { useToastStore } from '@/stores/toastStore'
import { formatDate } from '@/utils/formatDate'
import type { Ehr, ResidentId } from '@/types'

const props = withDefaults(
  defineProps<{
    records: Ehr[]
    residentId: ResidentId
    /** Hanya staf care yang boleh menambah catatan pemeriksaan. */
    canManage?: boolean
  }>(),
  { canManage: false },
)

const emit = defineEmits<{
  changed: []
}>()

const toast = useToastStore()

const columns: TableColumn<Ehr>[] = [
  { key: 'date', label: 'Tanggal', value: (row) => formatDate(row.date) },
  { key: 'bloodPressure', label: 'Tekanan Darah', value: (row) => `${row.bloodPressure} mmHg` },
  { key: 'heartRate', label: 'Detak Jantung', value: (row) => `${row.heartRate} bpm` },
  { key: 'notes', label: 'Catatan', value: (row) => row.notes },
  { key: 'caregiver', label: 'Caregiver', align: 'right', value: (row) => row.caregiver },
]

const modalOpen = ref(false)
const saving = ref(false)

const form = ref({
  date: '2026-07-22',
  bloodPressure: '120/80',
  heartRate: 75,
  notes: '',
  caregiver: 'Ns. Dewi',
})

const canSubmit = computed(
  () => /^\d{2,3}\/\d{2,3}$/.test(form.value.bloodPressure.trim()) && Number(form.value.heartRate) > 0,
)

function openModal(): void {
  form.value = {
    date: '2026-07-22',
    bloodPressure: '120/80',
    heartRate: 75,
    notes: '',
    caregiver: 'Ns. Dewi',
  }
  modalOpen.value = true
}

async function submitRecord(): Promise<void> {
  if (!canSubmit.value) return

  saving.value = true
  try {
    await createEhrRecord({
      residentId: props.residentId,
      date: form.value.date,
      bloodPressure: form.value.bloodPressure.trim(),
      heartRate: Number(form.value.heartRate),
      notes: form.value.notes.trim() || 'Tidak ada keluhan',
      caregiver: form.value.caregiver.trim(),
    })
    modalOpen.value = false
    toast.push('Catatan pemeriksaan tersimpan.')
    emit('changed')
  } catch {
    toast.push('Gagal menyimpan catatan.', 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseCard title="Kesehatan (EHR)" subtitle="Ringkasan pemeriksaan rutin" flush>
    <template v-if="canManage" #actions>
      <BaseButton size="sm" variant="secondary" icon="plus" @click="openModal">
        Tambah Catatan
      </BaseButton>
    </template>

    <BaseTable :columns="columns" :rows="records" :row-key="(row) => row.id">
      <template #empty>
        <div class="px-4">
          <EmptyState
            title="Belum ada catatan kesehatan"
            description="Catatan pemeriksaan akan tampil setelah caregiver melakukan input pertama."
          >
            <BaseButton v-if="canManage" size="sm" icon="plus" @click="openModal">
              Tambah Catatan
            </BaseButton>
          </EmptyState>
        </div>
      </template>
    </BaseTable>

    <BaseModal
      :open="modalOpen"
      title="Tambah Catatan Pemeriksaan"
      description="Data ini tidak pernah ditampilkan di Family Portal."
      @close="modalOpen = false"
    >
      <form class="flex flex-col gap-4" @submit.prevent="submitRecord">
        <BaseInput v-model="form.date" label="Tanggal" type="date" required />
        <BaseInput
          v-model="form.bloodPressure"
          label="Tekanan darah"
          placeholder="120/80"
          hint="Format sistolik/diastolik, mis. 130/85"
          required
        />
        <BaseInput v-model="form.heartRate" label="Detak jantung (bpm)" type="number" :min="0" required />
        <BaseInput v-model="form.notes" label="Catatan" placeholder="Kontrol rutin, kondisi stabil" />
        <BaseInput v-model="form.caregiver" label="Caregiver" required />
      </form>

      <template #footer>
        <BaseButton variant="secondary" @click="modalOpen = false">Batal</BaseButton>
        <BaseButton :loading="saving" :disabled="!canSubmit" @click="submitRecord">Simpan</BaseButton>
      </template>
    </BaseModal>
  </BaseCard>
</template>
