<script setup lang="ts">
import BaseIcon from '@/components/ui/BaseIcon.vue'
import type { IconName } from '@/components/ui/icons'

type CalloutTone = 'note' | 'info' | 'warning' | 'danger'

withDefaults(defineProps<{ tone?: CalloutTone; title?: string }>(), { tone: 'note' })

/**
 * Callout ala dokumentasi: border kiri 4px berwarna semantik + latar tipis
 * dengan warna yang sama. Config-driven, tidak ada if-else warna di template.
 */
/**
 * Lime dipakai sebagai garis & latar tipis, tapi TIDAK sebagai warna teks |
 * lime di atas putih tidak terbaca, jadi teksnya memakai tinta gelap.
 */
const TONE_CLASS: Record<CalloutTone, string> = {
  note: 'border-l-brand bg-brand/[0.18] text-ink-primary',
  info: 'border-l-state-info bg-state-info/[0.06] text-state-info',
  warning: 'border-l-state-warning bg-state-warning/[0.10] text-state-warning',
  danger: 'border-l-state-error bg-state-error/[0.06] text-state-error',
}

const TONE_ICON: Record<CalloutTone, IconName> = {
  note: 'check',
  info: 'alert',
  warning: 'alert',
  danger: 'alert',
}
</script>

<template>
  <div class="flex gap-3 rounded-card  px-4 py-3" :class="TONE_CLASS[tone]">
    <BaseIcon :name="TONE_ICON[tone]" :size="18" class="mt-0.5" />

    <div class="min-w-0 flex-1">
      <p v-if="title" class="text-h4">{{ title }}</p>
      <div class="text-small text-ink-secondary" :class="title ? 'mt-1' : ''">
        <slot />
      </div>
    </div>
  </div>
</template>
