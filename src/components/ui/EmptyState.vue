<script setup lang="ts">
/**
 * Empty state memakai ilustrasi maskot, bukan ikon generik — design system
 * meminta kepribadian muncul justru saat layar kosong.
 *
 * Maskotnya digambar sendiri (landak sederhana) supaya tidak memakai aset
 * bermerek milik pihak lain. Ganti dengan maskot resmi Ginkgo Living kalau
 * asetnya sudah tersedia.
 */
withDefaults(
  defineProps<{
    title: string
    description?: string
  }>(),
  {},
)
</script>

<template>
  <div
    class="flex flex-col items-center justify-center rounded-card bg-surface-alt px-6 py-8 text-center"
  >
    <svg width="80" height="60" viewBox="0 0 80 60" fill="none" aria-hidden="true" class="mb-3">
      <!-- Moncong -->
      <path
        d="M52 40c8 0 14 2 14 5.5S60 51 54 50.5"
        fill="rgb(var(--brand))"
        stroke="rgb(var(--ink-muted))"
        stroke-width="2"
        stroke-linejoin="round"
      />
      <!-- Badan berduri -->
      <path
        d="M10 50C10 32 20 22 32 22s22 10 22 28Z"
        fill="rgb(var(--brand))"
        stroke="rgb(var(--ink-muted))"
        stroke-width="2"
        stroke-linejoin="round"
      />
      <!-- Duri -->
      <path
        d="M13 42l5-11 5 9 6-13 6 12 6-11 5 9"
        stroke="rgb(var(--ink-muted))"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
      <!-- Kaki -->
      <path
        d="M22 50v4M40 50v4"
        stroke="rgb(var(--ink-muted))"
        stroke-width="2"
        stroke-linecap="round"
      />
      <circle cx="65" cy="45" r="2" fill="rgb(var(--ink-primary))" />
      <circle cx="50" cy="41" r="1.8" fill="rgb(var(--ink-primary))" />
    </svg>

    <p class="text-h4 text-ink-primary">{{ title }}</p>
    <p v-if="description" class="mt-1 max-w-sm text-small text-ink-secondary">{{ description }}</p>

    <div v-if="$slots.default" class="mt-4">
      <slot />
    </div>
  </div>
</template>
