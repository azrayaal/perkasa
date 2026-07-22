<script setup lang="ts">
import BaseIcon from '@/components/ui/BaseIcon.vue'
import type { IconName } from '@/components/ui/icons'

type Tone = 'brand' | 'plain' | 'success' | 'warning' | 'error'

withDefaults(
  defineProps<{
    label: string
    value: string
    icon: IconName
    caption?: string
    tone?: Tone
    /** Perubahan terhadap periode pembanding, dalam persen. */
    trend?: number | null
    /** `false` kalau kenaikan justru pertanda buruk (mis. beban, utang). */
    trendIsGood?: boolean
  }>(),
  { tone: 'plain', trend: null, trendIsGood: true },
)

/**
 * Hanya kartu bernada `brand` yang memakai blok amber penuh | satu sorotan di
 * antara kartu-kartu putih, bukan semuanya, supaya mata tahu ke mana melihat.
 */
const TONE_CLASS: Record<Tone, string> = {
  brand: 'bg-brand text-brand-ink border-transparent',
  plain: 'bg-surface text-ink-primary border-line',
  success: 'bg-surface text-ink-primary border-line',
  warning: 'bg-surface text-ink-primary border-line',
  error: 'bg-surface text-ink-primary border-line',
}

const ICON_CLASS: Record<Tone, string> = {
  brand: 'bg-brand-ink/10 text-brand-ink',
  plain: 'bg-surface-alt text-ink-secondary',
  success: 'bg-state-success/10 text-state-success',
  warning: 'bg-state-warning/12 text-state-warning',
  error: 'bg-state-error/10 text-state-error',
}

function trendClass(trend: number, isGood: boolean, tone: Tone): string {
  if (tone === 'brand') return 'text-brand-ink/80'
  const positive = trend >= 0 ? isGood : !isGood
  return positive ? 'text-state-success' : 'text-state-error'
}

function trendText(trend: number): string {
  const sign = trend > 0 ? '+' : ''
  return `${sign}${trend.toFixed(1).replace('.', ',')}%`
}
</script>

<template>
  <div
    class="rounded-card border p-5 shadow-raised transition-shadow hover:shadow-overlay"
    :class="TONE_CLASS[tone]"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p
          class="text-small font-medium"
          :class="tone === 'brand' ? 'opacity-70' : 'text-ink-secondary'"
        >
          {{ label }}
        </p>

        <!-- Jangan dipotong: nominal rupiah yang terpangkas menyesatkan. -->
        <p class="amount mt-2 text-metric [overflow-wrap:anywhere]">{{ value }}</p>

        <div class="mt-1 flex flex-wrap items-center gap-2">
          <span
            v-if="trend !== null"
            class="text-small font-semibold"
            :class="trendClass(trend, trendIsGood, tone)"
          >
            <BaseIcon :name="trend >= 0 ? 'trendUp' : 'trendDown'" :size="13" class="inline" />
            {{ trendText(trend) }}
          </span>
          <span
            v-if="caption"
            class="text-small"
            :class="tone === 'brand' ? 'opacity-70' : 'text-ink-secondary'"
          >
            {{ caption }}
          </span>
        </div>
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
