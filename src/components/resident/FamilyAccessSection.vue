<script setup lang="ts">
import { computed, ref } from 'vue'
import BaseAvatar from '@/components/ui/BaseAvatar.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { inviteFamilyMember, setFamilyPortalAccess } from '@/services/familyService'
import { useToastStore } from '@/stores/toastStore'
import type { FamilyMember, ResidentId } from '@/types'

const props = withDefaults(
  defineProps<{
    members: FamilyMember[]
    residentId: ResidentId
    /** Hanya staf yang boleh mengundang & mencabut akses portal. */
    canManage?: boolean
  }>(),
  { canManage: false },
)

const emit = defineEmits<{
  changed: []
}>()

const toast = useToastStore()

const busyId = ref<string | null>(null)

async function toggleAccess(member: FamilyMember): Promise<void> {
  busyId.value = member.id
  try {
    await setFamilyPortalAccess(member.id, !member.portalAccess)
    toast.push(
      member.portalAccess
        ? `Akses portal ${member.name} dicabut.`
        : `Akses portal ${member.name} diaktifkan.`,
    )
    emit('changed')
  } catch {
    toast.push('Gagal memperbarui akses.', 'error')
  } finally {
    busyId.value = null
  }
}

const modalOpen = ref(false)
const saving = ref(false)
const form = ref({ name: '', relation: 'anak' })

const canSubmit = computed(
  () => form.value.name.trim().length > 0 && form.value.relation.trim().length > 0,
)

function openModal(): void {
  form.value = { name: '', relation: 'anak' }
  modalOpen.value = true
}

async function submitInvite(): Promise<void> {
  if (!canSubmit.value) return

  saving.value = true
  try {
    await inviteFamilyMember({
      residentId: props.residentId,
      name: form.value.name.trim(),
      relation: form.value.relation.trim(),
      portalAccess: true,
    })
    modalOpen.value = false
    toast.push('Anggota keluarga diundang.')
    emit('changed')
  } catch {
    toast.push('Gagal mengundang anggota keluarga.', 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseCard title="Akses Keluarga" subtitle="Anggota keluarga dengan akses Family Portal">
    <template v-if="canManage" #actions>
      <BaseButton size="sm" variant="secondary" icon="plus" @click="openModal">
        Undang Keluarga
      </BaseButton>
    </template>

    <EmptyState
      v-if="members.length === 0"
      title="Belum ada anggota keluarga terdaftar"
      description="Undang anggota keluarga agar mereka bisa memantau lewat Family Portal."
    >
      <BaseButton v-if="canManage" size="sm" icon="plus" @click="openModal">
        Undang Keluarga
      </BaseButton>
    </EmptyState>

    <ul v-else class="flex flex-col gap-4">
      <li
        v-for="member in members"
        :key="member.id"
        class="flex flex-wrap items-center justify-between gap-3"
      >
        <div class="flex min-w-0 items-center gap-3">
          <BaseAvatar :name="member.name" size="sm" />
          <div class="min-w-0">
            <p class="truncate text-data font-medium text-ink-primary">{{ member.name }}</p>
            <p class="text-sm capitalize text-ink-secondary">{{ member.relation }}</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <BaseBadge
            :status="member.portalAccess ? 'active' : 'inactive'"
            :label="member.portalAccess ? 'Akses Portal Aktif' : 'Tanpa Akses'"
          />
          <BaseButton
            v-if="canManage"
            size="sm"
            :variant="member.portalAccess ? 'danger' : 'secondary'"
            :loading="busyId === member.id"
            @click="toggleAccess(member)"
          >
            {{ member.portalAccess ? 'Cabut' : 'Aktifkan' }}
          </BaseButton>
        </div>
      </li>
    </ul>

    <BaseModal
      :open="modalOpen"
      title="Undang Anggota Keluarga"
      description="Anggota yang diundang langsung mendapat akses Family Portal."
      @close="modalOpen = false"
    >
      <form class="flex flex-col gap-4" @submit.prevent="submitInvite">
        <BaseInput v-model="form.name" label="Nama" placeholder="mis. Dewi Santoso" required />
        <BaseInput v-model="form.relation" label="Relasi" placeholder="anak / cucu / pasangan" required />
      </form>

      <template #footer>
        <BaseButton variant="secondary" @click="modalOpen = false">Batal</BaseButton>
        <BaseButton :loading="saving" :disabled="!canSubmit" @click="submitInvite">Undang</BaseButton>
      </template>
    </BaseModal>
  </BaseCard>
</template>
