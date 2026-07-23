<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatCurrencyShort } from '@/utils/formatCurrency'
import type { ChartSeries } from '@/components/charts/chart.types'

const props = withDefaults(
  defineProps<{
    /** Label sumbu X, mis. ["Jan 2026", "Feb 2026", …]. */
    labels: string[]
    /** Maksimal tiga seri; warnanya mengikuti urutan tetap chart-1..3. */
    series: ChartSeries[]
    height?: number
  }>(),
  { height: 240 },
)

const hovered = ref<number | null>(null)

/**
 * Skala tunggal untuk seluruh seri | TIDAK PERNAH dua sumbu Y. Membandingkan
 * dua sumbu berbeda skala adalah cara paling umum membuat grafik menipu.
 */
const maxValue = computed(() => {
  const values = props.series.flatMap((item) => item.values)
  return Math.max(1, ...values)
})

/** Sumbu Y hanya tiga garis bantu | grid harus resesif, bukan ikut bersuara. */
const gridLines = computed(() => [0, 0.5, 1].map((ratio) => ({ ratio, value: maxValue.value * ratio })))

const SERIES_FILL = ['fill-chart-1', 'fill-chart-2', 'fill-chart-3']
const SERIES_BG = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3']

function barHeight(value: number, plotHeight: number): number {
  return Math.max(value <= 0 ? 0 : 2, (value / maxValue.value) * plotHeight)
}
</script>

<template>
  <figure class="flex flex-col gap-4">
    <!-- Legenda selalu ada untuk ≥2 seri: identitas tidak boleh warna semata. -->
    <figcaption v-if="series.length > 1" class="flex flex-wrap items-center gap-4">
      <span v-for="(item, index) in series" :key="item.name" class="flex items-center gap-2">
        <span class="h-2.5 w-2.5 rounded-sm" :class="SERIES_BG[index]" aria-hidden="true" />
        <span class="text-small text-ink-secondary">{{ item.name }}</span>
      </span>
    </figcaption>

    <div class="overflow-x-auto">
      <div class="min-w-[560px]">
        <div class="flex" :style="{ height: `${height}px` }">
          <!-- Sumbu nilai, dibaca sekali di kiri. -->
          <div class="flex w-20 shrink-0 flex-col justify-between pb-6 pr-2 text-right">
            <span
              v-for="line in [...gridLines].reverse()"
              :key="line.ratio"
              class="amount text-[11px] text-ink-muted"
            >
              {{ formatCurrencyShort(line.value) }}
            </span>
          </div>

          <div class="relative flex-1">
            <!-- Garis bantu horizontal, tipis dan pucat. -->
            <div class="absolute inset-x-0 bottom-6 top-0">
              <div
                v-for="line in gridLines"
                :key="line.ratio"
                class="absolute inset-x-0 border-t border-line"
                :style="{ bottom: `${line.ratio * 100}%` }"
              />
            </div>

            <div class="absolute inset-0 flex items-end gap-2">
              <div
                v-for="(label, index) in labels"
                :key="label"
                class="group flex h-full flex-1 flex-col justify-end"
                @mouseenter="hovered = index"
                @mouseleave="hovered = null"
              >
                <!-- Batang berdampingan; jarak 2px antar-batang = pemisah permukaan. -->
                <div class="flex h-[calc(100%-24px)] items-end justify-center gap-[2px]">
                  <svg
                    v-for="(item, seriesIndex) in series"
                    :key="item.name"
                    class="h-full flex-1"
                    :class="hovered !== null && hovered !== index ? 'opacity-45' : ''"
                    preserveAspectRatio="none"
                    viewBox="0 0 10 100"
                  >
                    <title>{{ label }} — {{ item.name }}: {{ formatCurrencyShort(item.values[index] ?? 0) }}</title>
                    <rect
                      x="0"
                      :y="100 - barHeight(item.values[index] ?? 0, 100)"
                      width="10"
                      :height="barHeight(item.values[index] ?? 0, 100)"
                      rx="1.2"
                      :class="SERIES_FILL[seriesIndex]"
                    />
                  </svg>
                </div>

                <span
                  class="mt-1.5 h-6 truncate text-center text-[11px]"
                  :class="hovered === index ? 'font-semibold text-ink-primary' : 'text-ink-muted'"
                >
                  {{ label }}
                </span>
              </div>
            </div>

            <!--
              Tooltip: nilai persis hanya muncul saat ditunjuk. Menempelkan angka
              di setiap batang membuat grafik penuh teks dan justru sulit dibaca.
            -->
            <div
              v-if="hovered !== null"
              class="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 rounded-control border border-line bg-surface px-3 py-2 shadow-overlay"
            >
              <p class="text-xs font-semibold text-ink-primary">{{ labels[hovered] }}</p>
              <p
                v-for="(item, index) in series"
                :key="item.name"
                class="mt-1 flex items-center gap-2 text-xs text-ink-secondary"
              >
                <span class="h-2 w-2 rounded-sm" :class="SERIES_BG[index]" aria-hidden="true" />
                {{ item.name }}
                <span class="amount ml-auto font-semibold text-ink-primary">
                  {{ formatCurrencyShort(item.values[hovered] ?? 0) }}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </figure>
</template>
