<script setup lang="ts">
import BaseIcon from '@/components/ui/BaseIcon.vue'
import { useToastStore, type ToastTone } from '@/stores/toastStore'
import type { IconName } from '@/components/ui/icons'

const toastStore = useToastStore()

const TONE_CLASS: Record<ToastTone, string> = {
  success: 'border-state-success/30 bg-surface text-state-success',
  error: 'border-state-error/30 bg-surface text-state-error',
  info: 'border-line bg-surface text-ink-primary',
}

const TONE_ICON: Record<ToastTone, IconName> = {
  success: 'check',
  error: 'alert',
  info: 'alert',
}
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:bottom-auto sm:right-0 sm:top-0 sm:items-end"
    role="status"
    aria-live="polite"
  >
    <div
      v-for="toast in toastStore.toasts"
      :key="toast.id"
      class="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-control border px-4 py-3 text-sm font-medium shadow-overlay"
      :class="TONE_CLASS[toast.tone]"
    >
      <BaseIcon :name="TONE_ICON[toast.tone]" />
      <span class="flex-1 text-ink-primary">{{ toast.message }}</span>
      <button
        type="button"
        class="text-ink-muted transition-colors hover:text-ink-primary"
        aria-label="Tutup notifikasi"
        @click="toastStore.dismiss(toast.id)"
      >
        <BaseIcon name="close" :size="15" />
      </button>
    </div>
  </div>
</template>
