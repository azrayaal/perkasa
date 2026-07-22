<script setup lang="ts">
/**
 * Tab navigasi di dalam satu halaman (mis. Pembukuan: jurnal umum / buku besar
 * / neraca saldo). Dipakai supaya modul yang berkaitan erat tetap satu halaman |
 * pengguna tidak perlu berpindah menu untuk melihat data yang sama dari sisi lain.
 */
import type { TabItem } from '@/components/ui/BaseTabs.types'

defineProps<{ tabs: TabItem[] }>()

const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="flex gap-1 overflow-x-auto border-b border-line" role="tablist">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      type="button"
      role="tab"
      :aria-selected="model === tab.key"
      class="-mb-px whitespace-nowrap border-b-2 px-4 py-3 text-small font-semibold transition-colors"
      :class="
        model === tab.key
          ? 'border-brand text-ink-primary'
          : 'border-transparent text-ink-secondary hover:text-ink-primary'
      "
      @click="model = tab.key"
    >
      {{ tab.label }}
      <span
        v-if="tab.count !== undefined"
        class="ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold"
        :class="model === tab.key ? 'bg-brand/25 text-ink-primary' : 'bg-surface-alt text-ink-muted'"
      >
        {{ tab.count }}
      </span>
    </button>
  </div>
</template>
