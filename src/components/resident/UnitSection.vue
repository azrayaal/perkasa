<script setup lang="ts">
import { ref, watch } from 'vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import type { SelectOption } from '@/components/ui/BaseSelect.types'
import { updateUnitStatus } from '@/services/unitService'
import { useToastStore } from '@/stores/toastStore'
import { statusLabel } from '@/utils/statusBadgeColor'
import type { Unit, UnitStatus } from '@/types'

const props = withDefaults(
  defineProps<{
    unit: Unit | null
    /** Hanya staf yang boleh mengubah status okupansi. */
    canManage?: boolean
  }>(),
  { canManage: false },
)

const emit = defineEmits<{
  changed: []
}>()

const toast = useToastStore()

const UNIT_STATUSES: UnitStatus[] = ['occupied', 'vacant', 'booked', 'maintenance']

const statusOptions: SelectOption<UnitStatus>[] = UNIT_STATUSES.map((status) => ({
  value: status,
  label: statusLabel(status),
}))

const draftStatus = ref<UnitStatus | null>(props.unit?.status ?? null)

watch(
  () => props.unit?.status,
  (status) => (draftStatus.value = status ?? null),
)

async function applyStatus(status: UnitStatus | null): Promise<void> {
  if (!props.unit || !status || status === props.unit.status) return

  try {
    await updateUnitStatus(props.unit.id, status)
    toast.push(`Status unit ${props.unit.unitCode} diperbarui.`)
    emit('changed')
  } catch {
    toast.push('Gagal memperbarui status unit.', 'error')
    draftStatus.value = props.unit.status
  }
}

watch(draftStatus, (status) => void applyStatus(status))
</script>

<template>
  <BaseCard title="Unit / Properti" subtitle="Data okupansi dari modul property">
    <EmptyState
      v-if="!unit"
      title="Unit belum ditetapkan"
      description="Resident ini belum terhubung ke unit mana pun."
    />

    <div v-else class="flex flex-col gap-5">
      <dl class="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <div>
          <dt class="text-xs font-semibold uppercase tracking-wide text-ink-muted">Kode Unit</dt>
          <dd class="mt-1 text-data font-medium text-ink-primary">{{ unit.unitCode }}</dd>
        </div>
        <div>
          <dt class="text-xs font-semibold uppercase tracking-wide text-ink-muted">Tipe</dt>
          <dd class="mt-1 text-data font-medium text-ink-primary">{{ unit.type }}</dd>
        </div>
        <div>
          <dt class="text-xs font-semibold uppercase tracking-wide text-ink-muted">Lantai</dt>
          <dd class="mt-1 text-data font-medium text-ink-primary">{{ unit.floor }}</dd>
        </div>
        <div>
          <dt class="text-xs font-semibold uppercase tracking-wide text-ink-muted">Okupansi</dt>
          <dd class="mt-1">
            <BaseBadge :status="unit.status" />
          </dd>
        </div>
      </dl>

      <BaseSelect
        v-if="canManage"
        v-model="draftStatus"
        label="Ubah status okupansi"
        :options="statusOptions"
      />
    </div>
  </BaseCard>
</template>
