<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    name: string
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { size: 'md' },
)

const SIZE_CLASS: Record<NonNullable<typeof props.size>, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
}

const initials = computed(() =>
  props.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join(''),
)

const sizeClass = computed(() => SIZE_CLASS[props.size])
</script>

<template>
  <span
    class="inline-flex shrink-0 select-none items-center justify-center rounded-full bg-brand font-semibold text-brand-ink"
    :class="sizeClass"
    :aria-label="name"
    role="img"
  >
    {{ initials }}
  </span>
</template>
