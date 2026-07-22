<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/layout/PageHeader.vue'
import ResidentCard from '@/components/resident/ResidentCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import type { SelectOption } from '@/components/ui/BaseSelect.types'
import { useResidentList } from '@/composables/useResidentList'
import { createResident } from '@/services/residentService'
import { getUnits } from '@/services/unitService'
import { ROUTE } from '@/router/routeNames'
import { useResidentStore } from '@/stores/residentStore'
import { useToastStore } from '@/stores/toastStore'
import type { MembershipTier, ResidentId, Unit } from '@/types'

const { items, loading, error, refresh } = useResidentList()
const router = useRouter()
const residentStore = useResidentStore()
const toast = useToastStore()

const search = ref('')

const filtered = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) return items.value

  return items.value.filter(({ resident, unit }) =>
    [resident.name, resident.id, unit?.unitCode ?? '']
      .join(' ')
      .toLowerCase()
      .includes(keyword),
  )
})

function openResident(residentId: ResidentId): void {
  residentStore.selectResident(residentId)
  void router.push({ name: ROUTE.residentDetail, params: { id: residentId } })
}

/* ---------------------------------------------------------------------- */
/* Aksi: tambah resident                                                   */
/* ---------------------------------------------------------------------- */

const modalOpen = ref(false)
const saving = ref(false)
const units = ref<Unit[]>([])

const form = ref({
  name: '',
  unitId: null as string | null,
  membershipTier: 'Standard' as MembershipTier,
  joinDate: '2026-07-22',
})

const unitOptions = computed<SelectOption<string>[]>(() =>
  units.value.map((unit) => ({
    value: unit.id,
    label: `${unit.unitCode} · ${unit.type} · Lantai ${unit.floor}`,
  })),
)

const TIER_OPTIONS: SelectOption<MembershipTier>[] = [
  { value: 'Standard', label: 'Standard' },
  { value: 'Premium', label: 'Premium' },
]

const canSubmit = computed(() => form.value.name.trim().length > 0 && form.value.unitId !== null)

onMounted(async () => {
  units.value = await getUnits()
})

function openModal(): void {
  form.value = { name: '', unitId: null, membershipTier: 'Standard', joinDate: '2026-07-22' }
  modalOpen.value = true
}

async function submitResident(): Promise<void> {
  if (!canSubmit.value || !form.value.unitId) return

  saving.value = true
  try {
    const created = await createResident({
      name: form.value.name.trim(),
      unitId: form.value.unitId,
      membershipTier: form.value.membershipTier,
      status: 'active',
      joinDate: form.value.joinDate,
    })

    await refresh()
    modalOpen.value = false
    toast.push(`${created.name} berhasil ditambahkan.`)
  } catch {
    toast.push('Gagal menambahkan penghuni.', 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      title="Resident"
      description="Seluruh penghuni beserta unit dan status keanggotaannya."
    >
      <template #actions>
        <BaseButton icon="plus" @click="openModal">Tambah Resident</BaseButton>
      </template>
    </PageHeader>

    <div class="relative max-w-md">
      <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
        <BaseIcon name="search" />
      </span>
      <input
        v-model="search"
        type="search"
        placeholder="Cari nama, ID, atau kode unit…"
        class="w-full rounded-control border border-line bg-surface-alt py-2 pl-10 pr-3 text-data text-ink-primary outline-none transition-colors placeholder:text-ink-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
    </div>

    <LoadingState v-if="loading" :rows="4" />

    <EmptyState
      v-else-if="error"
      title="Gagal memuat daftar resident"
      :description="error.message"
    >
      <BaseButton variant="secondary" icon="refresh" @click="refresh">Coba lagi</BaseButton>
    </EmptyState>

    <EmptyState
      v-else-if="filtered.length === 0"
      :title="search ? 'Tidak ada hasil' : 'Belum ada resident'"
      :description="
        search
          ? `Tidak ditemukan penghuni yang cocok dengan “${search}”.`
          : 'Data penghuni akan tampil di sini setelah proses onboarding pertama.'
      "
    />

    <div v-else class="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <ResidentCard
        v-for="item in filtered"
        :key="item.resident.id"
        :item="item"
        @select="openResident"
      />
    </div>

    <BaseModal
      :open="modalOpen"
      title="Tambah Resident"
      description="Penghuni baru otomatis menempati unit yang dipilih."
      @close="modalOpen = false"
    >
      <form class="flex flex-col gap-4" @submit.prevent="submitResident">
        <BaseInput v-model="form.name" label="Nama lengkap" placeholder="mis. Rina Kartika" required />
        <BaseSelect
          v-model="form.unitId"
          label="Unit"
          placeholder="— Pilih unit —"
          :options="unitOptions"
        />
        <BaseSelect v-model="form.membershipTier" label="Membership" :options="TIER_OPTIONS" />
        <BaseInput v-model="form.joinDate" label="Tanggal bergabung" type="date" required />
      </form>

      <template #footer>
        <BaseButton variant="secondary" @click="modalOpen = false">Batal</BaseButton>
        <BaseButton :loading="saving" :disabled="!canSubmit" @click="submitResident">
          Simpan
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
