<script setup lang="ts">
import { computed, useSlots } from 'vue'

const props = withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    /** Hover shadow | matikan untuk card statis yang tidak bisa diklik. */
    interactive?: boolean
    /** Hilangkan padding badan card, mis. saat isinya tabel full-bleed. */
    flush?: boolean
  }>(),
  { interactive: false, flush: false },
)

const slots = useSlots()

const hasHeader = computed(() => Boolean(props.title || slots.header || slots.actions))

// Padding kartu = 16px (p-4) sesuai design system; saat ada header, badan kartu
// hanya menyisakan jarak 12px agar kepadatan data tetap terjaga.
const bodyClass = computed(() => {
  if (props.flush) return hasHeader.value ? 'pb-4' : ''
  return hasHeader.value ? 'px-4 pb-4 pt-3' : 'p-4'
})
</script>

<template>
  <section
    class="rounded-card border border-line bg-surface shadow-raised transition-shadow duration-150"
    :class="interactive ? 'cursor-pointer hover:shadow-overlay' : ''"
  >
    <header
      v-if="hasHeader"
      class="flex flex-wrap items-start justify-between gap-4 px-4 pt-4"
    >
      <slot name="header">
        <div>
          <h2 class="text-h3 text-ink-primary">{{ title }}</h2>
          <p v-if="subtitle" class="mt-1 text-small text-ink-secondary">{{ subtitle }}</p>
        </div>
      </slot>
      <slot name="actions" />
    </header>

    <div :class="bodyClass">
      <slot />
    </div>
  </section>
</template>
