<script setup lang="ts">
/**
 * Judul halaman standar (H1 36px, tracking -0.01em) + deskripsi.
 * Dipakai seluruh view supaya hierarki tipografi tidak ditulis ulang di tiap
 * halaman — mengubah skala judul cukup di sini.
 */
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <header class="flex flex-wrap items-start justify-between gap-4">
    <div class="min-w-0">
      <h1 class="text-h2 text-ink-primary sm:text-h1">{{ title }}</h1>
      <p v-if="description" class="mt-2 max-w-2xl text-body text-ink-secondary">
        {{ description }}
      </p>
    </div>

    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-3">
      <slot name="actions" />
    </div>
  </header>
</template>
