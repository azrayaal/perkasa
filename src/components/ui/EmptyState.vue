<script setup lang="ts">
/**
 * Empty state memakai ilustrasi dokumen kosong | bahasa visual ERP, bukan
 * maskot: layar kosong di aplikasi keuangan sebaiknya terbaca sebagai
 * "belum ada dokumen", bukan sebagai lelucon.
 */
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div
    class="flex flex-col items-center justify-center rounded-card bg-surface-alt px-6 py-10 text-center"
  >
    <svg width="72" height="64" viewBox="0 0 72 64" fill="none" aria-hidden="true" class="mb-4">
      <rect
        x="16"
        y="8"
        width="34"
        height="44"
        rx="4"
        fill="rgb(var(--surface))"
        stroke="rgb(var(--ink-muted))"
        stroke-width="2"
      />
      <path
        d="M24 20h18M24 28h18M24 36h11"
        stroke="rgb(var(--ink-muted))"
        stroke-width="2"
        stroke-linecap="round"
      />
      <circle cx="52" cy="44" r="10" fill="rgb(var(--brand))" />
      <path
        d="M52 40v8M48 44h8"
        stroke="rgb(var(--brand-ink))"
        stroke-width="2.2"
        stroke-linecap="round"
      />
    </svg>

    <p class="text-h4 text-ink-primary">{{ title }}</p>
    <p v-if="description" class="mt-1 max-w-sm text-small text-ink-secondary">{{ description }}</p>

    <div v-if="$slots.default" class="mt-4">
      <slot />
    </div>
  </div>
</template>
