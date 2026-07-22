<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseTable from '@/components/ui/BaseTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import type { SelectOption } from '@/components/ui/BaseSelect.types'
import type { TableColumn } from '@/components/ui/BaseTable.types'
import { bookActivity, getActivityCatalog, updateActivityStatus } from '@/services/activityService'
import { useToastStore } from '@/stores/toastStore'
import { formatDate } from '@/utils/formatDate'
import type { Activity, ResidentId } from '@/types'

const props = withDefaults(
  defineProps<{
    activities: Activity[]
    residentId: ResidentId
    /** Staf & penghuni boleh booking; keluarga hanya melihat. */
    canManage?: boolean
  }>(),
  { canManage: false },
)

const emit = defineEmits<{
  changed: []
}>()

const toast = useToastStore()

const columns = computed<TableColumn<Activity>[]>(() => {
  const base: TableColumn<Activity>[] = [
    { key: 'activity', label: 'Aktivitas', value: (row) => row.activity },
    { key: 'date', label: 'Tanggal', value: (row) => formatDate(row.date) },
    { key: 'status', label: 'Status', align: 'right' },
  ]

  return props.canManage ? [...base, { key: 'actions', label: 'Aksi', align: 'right' }] : base
})

/* ---------------------------------------------------------------------- */
/* Aksi: ubah status                                                       */
/* ---------------------------------------------------------------------- */

const busyId = ref<string | null>(null)

async function setStatus(activity: Activity, status: Activity['status']): Promise<void> {
  busyId.value = activity.id
  try {
    await updateActivityStatus(activity.id, status)
    toast.push(status === 'attended' ? 'Kehadiran dicatat.' : 'Booking dibatalkan.')
    emit('changed')
  } catch {
    toast.push('Gagal memperbarui aktivitas.', 'error')
  } finally {
    busyId.value = null
  }
}

/* ---------------------------------------------------------------------- */
/* Aksi: booking baru                                                      */
/* ---------------------------------------------------------------------- */

const modalOpen = ref(false)
const saving = ref(false)
const catalog = ref<string[]>([])
const form = ref({ activity: null as string | null, date: '2026-07-23' })

const catalogOptions = computed<SelectOption<string>[]>(() =>
  catalog.value.map((name) => ({ value: name, label: name })),
)

const canSubmit = computed(() => form.value.activity !== null)

onMounted(async () => {
  catalog.value = await getActivityCatalog()
})

function openModal(): void {
  form.value = { activity: null, date: '2026-07-23' }
  modalOpen.value = true
}

async function submitBooking(): Promise<void> {
  if (!form.value.activity) return

  saving.value = true
  try {
    await bookActivity({
      residentId: props.residentId,
      activity: form.value.activity,
      date: form.value.date,
    })
    modalOpen.value = false
    toast.push('Aktivitas berhasil di-booking.')
    emit('changed')
  } catch {
    toast.push('Gagal melakukan booking.', 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseCard title="Aktivitas" subtitle="Booking program & kehadiran" flush>
    <template v-if="canManage" #actions>
      <BaseButton size="sm" variant="secondary" icon="plus" @click="openModal">
        Booking Aktivitas
      </BaseButton>
    </template>

    <BaseTable :columns="columns" :rows="activities" :row-key="(row) => row.id">
      <template #cell-status="{ row }">
        <BaseBadge :status="row.status" />
      </template>

      <template #cell-actions="{ row }">
        <div v-if="row.status === 'booked'" class="flex justify-end gap-2">
          <BaseButton
            size="sm"
            variant="secondary"
            icon="check"
            :loading="busyId === row.id"
            @click="setStatus(row, 'attended')"
          >
            Hadir
          </BaseButton>
          <BaseButton
            size="sm"
            variant="danger"
            :loading="busyId === row.id"
            @click="setStatus(row, 'cancelled')"
          >
            Batal
          </BaseButton>
        </div>
        <span v-else class="text-sm text-ink-muted">—</span>
      </template>

      <template #empty>
        <div class="px-4">
          <EmptyState
            title="Belum ada aktivitas"
            description="Booking program komunitas akan tercatat di sini."
          >
            <BaseButton v-if="canManage" size="sm" icon="plus" @click="openModal">
              Booking Aktivitas
            </BaseButton>
          </EmptyState>
        </div>
      </template>
    </BaseTable>

    <BaseModal :open="modalOpen" title="Booking Aktivitas" @close="modalOpen = false">
      <form class="flex flex-col gap-4" @submit.prevent="submitBooking">
        <BaseSelect
          v-model="form.activity"
          label="Program"
          placeholder="— Pilih aktivitas —"
          :options="catalogOptions"
        />
        <BaseInput v-model="form.date" label="Tanggal" type="date" required />
      </form>

      <template #footer>
        <BaseButton variant="secondary" @click="modalOpen = false">Batal</BaseButton>
        <BaseButton :loading="saving" :disabled="!canSubmit" @click="submitBooking">
          Booking
        </BaseButton>
      </template>
    </BaseModal>
  </BaseCard>
</template>
