<script setup lang="ts">
import { computed } from 'vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import { usePeriodStore } from '@/stores/periodStore'
import { periodLabelLong } from '@/utils/date'

/**
 * Pemilih periode akuntansi | SATU untuk seluruh aplikasi.
 *
 * Diletakkan di topbar, bukan di tiap halaman, karena periode adalah konteks
 * global: mustahil membandingkan Laba Rugi bulan Juni dengan Neraca bulan Mei
 * tanpa sadar, sebab keduanya membaca store yang sama.
 */
const period = usePeriodStore()

const YTD_VALUE = 'ytd'

const selected = computed<string>({
  get: () => (period.mode === 'ytd' ? YTD_VALUE : period.period),
  set: (value) => (value === YTD_VALUE ? period.selectYearToDate() : period.selectMonth(value)),
})
</script>

<template>
  <label class="relative flex items-center">
    <span class="sr-only">Periode akuntansi</span>

    <BaseIcon
      name="calendar"
      :size="16"
      class="pointer-events-none absolute left-3 text-ink-secondary"
    />

    <select
      v-model="selected"
      class="w-full appearance-none rounded-control border border-line bg-surface py-2 pl-9 pr-8 text-small font-medium text-ink-primary outline-none transition-colors hover:bg-surface-alt focus:border-brand focus:ring-2 focus:ring-brand/20 sm:w-56"
    >
      <option :value="YTD_VALUE">Tahun Berjalan {{ period.fiscalYear }}</option>
      <option v-for="item in period.availablePeriods" :key="item" :value="item">
        {{ periodLabelLong(item) }}
      </option>
    </select>

    <BaseIcon
      name="chevronDown"
      :size="15"
      class="pointer-events-none absolute right-3 text-ink-muted"
    />
  </label>
</template>
