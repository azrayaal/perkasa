<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Jumlah baris skeleton yang ditampilkan. */
    rows?: number
    label?: string
  }>(),
  { rows: 3, label: 'Memuat data…' },
)
</script>

<template>
  <div class="flex flex-col gap-3" role="status" :aria-label="label">
    <div
      v-for="index in rows"
      :key="index"
      class="h-4 animate-pulse rounded-control bg-surface-alt"
      :style="{ width: `${100 - index * 8}%` }"
    />
  </div>
</template>
