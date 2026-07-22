<script setup lang="ts">
import BaseIcon from '@/components/ui/BaseIcon.vue'

/**
 * Penjelas keterkaitan antar-modul.
 *
 * Setiap halaman modul memakainya untuk menyatakan secara eksplisit: data di
 * layar ini berasal dari mana, dan begitu diubah, apa saja yang ikut bergerak.
 * Ini bagian dari produk, bukan sekadar hiasan | pengguna ERP perlu percaya
 * bahwa angkanya satu sumber.
 */
defineProps<{ title: string }>()
</script>

<template>
  <aside class="flex gap-3 rounded-card border border-line bg-surface-alt/70 px-4 py-3">
    <span
      class="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-rail bg-brand/20 text-ink-primary"
      aria-hidden="true"
    >
      <BaseIcon name="link" :size="15" />
    </span>

    <div class="min-w-0 flex-1">
      <p class="text-h4 text-ink-primary">{{ title }}</p>
      <div class="mt-1 text-small text-ink-secondary">
        <slot />
      </div>
    </div>
  </aside>
</template>
