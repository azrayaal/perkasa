<script setup lang="ts">
import { ref } from 'vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCallout from '@/components/ui/BaseCallout.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { ROLE_LABEL } from '@/config/navigation'
import { resetDatabase } from '@/data/db'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'

const auth = useAuthStore()
const toast = useToastStore()

const confirmOpen = ref(false)

function resetDemoData(): void {
  resetDatabase()
  confirmOpen.value = false
  toast.push('Data demo dikembalikan ke kondisi awal.')
  // Reload penuh supaya seluruh view mengambil ulang data dari awal.
  window.location.reload()
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      title="Pengaturan"
      description="Informasi akun dan pengelolaan data demo."
    />

    <BaseCard v-if="auth.user" title="Akun Saya">
      <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt class="text-xs font-semibold uppercase tracking-wide text-ink-muted">Nama</dt>
          <dd class="mt-1 text-data font-medium text-ink-primary">{{ auth.user.name }}</dd>
        </div>
        <div>
          <dt class="text-xs font-semibold uppercase tracking-wide text-ink-muted">Email</dt>
          <dd class="mt-1 text-data font-medium text-ink-primary">{{ auth.user.email }}</dd>
        </div>
        <div>
          <dt class="text-xs font-semibold uppercase tracking-wide text-ink-muted">Peran</dt>
          <dd class="mt-1 text-data font-medium text-ink-primary">
            {{ ROLE_LABEL[auth.user.role] }}
          </dd>
        </div>
        <div>
          <dt class="text-xs font-semibold uppercase tracking-wide text-ink-muted">Keterangan</dt>
          <dd class="mt-1 text-data font-medium text-ink-primary">{{ auth.user.title }}</dd>
        </div>
      </dl>
    </BaseCard>

    <BaseCard
      title="Data Demo"
      subtitle="Semua perubahan tersimpan di localStorage browser ini"
    >
      <BaseCallout tone="warning" title="Perubahan tersimpan di browser ini saja">
        Invoice yang dilunasi, catatan kesehatan baru, dan booking aktivitas bertahan setelah
        halaman di-reload. Membuka aplikasi di browser lain akan memulai dari data awal.
      </BaseCallout>

      <div class="mt-4">
        <BaseButton variant="danger" icon="refresh" @click="confirmOpen = true">
          Reset Data Demo
        </BaseButton>
      </div>
    </BaseCard>

    <BaseModal
      :open="confirmOpen"
      title="Reset data demo?"
      description="Seluruh perubahan yang Anda buat akan hilang dan data kembali ke kondisi awal."
      @close="confirmOpen = false"
    >
      <p class="text-data text-ink-secondary">
        Tindakan ini tidak dapat dibatalkan. Sesi login Anda tetap aktif.
      </p>

      <template #footer>
        <BaseButton variant="secondary" @click="confirmOpen = false">Batal</BaseButton>
        <BaseButton variant="danger" @click="resetDemoData">Ya, reset</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
