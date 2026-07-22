<script setup lang="ts">
import BaseIcon from '@/components/ui/BaseIcon.vue'
import type { IconName } from '@/components/ui/icons'

type Tone = 'brand' | 'accent' | 'success' | 'warning'

withDefaults(
  defineProps<{
    label: string
    value: string
    icon: IconName
    caption?: string
    tone?: Tone
  }>(),
  { tone: 'brand' },
)

/**
 * Hanya kartu bernada `brand` yang memakai blok lime penuh — persis pola
 * referensi: satu sorotan berwarna di antara kartu-kartu putih, bukan semuanya.
 */
const TONE_CLASS: Record<Tone, string> = {
  brand: 'bg-brand text-brand-ink border-transparent',
  accent: 'bg-surface text-ink-primary border-line',
  success: 'bg-surface text-ink-primary border-line',
  warning: 'bg-surface text-ink-primary border-line',
}

const ICON_CLASS: Record<Tone, string> = {
  brand: 'bg-brand-ink/10 text-brand-ink',
  accent: 'bg-surface-alt text-ink-primary',
  success: 'bg-state-success/10 text-state-success',
  warning: 'bg-state-warning/15 text-state-warning',
}
</script>

<template>
  <div
    class="rounded-card border p-5 shadow-raised transition-shadow hover:shadow-overlay"
    :class="TONE_CLASS[tone]"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <p class="text-small font-medium" :class="tone === 'brand' ? 'opacity-70' : 'text-ink-secondary'">
          {{ label }}
        </p>
        <!-- Jangan dipotong: nominal rupiah yang terpangkas ("Rp 6.800….")
             menyesatkan. Biarkan membungkus baris kalau perlu. -->
        <p class="mt-2 text-metric [overflow-wrap:anywhere]">{{ value }}</p>
        <p
          v-if="caption"
          class="mt-1 text-small"
          :class="tone === 'brand' ? 'opacity-70' : 'text-ink-secondary'"
        >
          {{ caption }}
        </p>
      </div>

      <span
        class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-rail"
        :class="ICON_CLASS[tone]"
      >
        <BaseIcon :name="icon" :size="20" />
      </span>
    </div>
  </div>
</template>
