<script setup lang="ts">
import { computed } from 'vue'
import { ICON_PATHS, type IconName } from '@/components/ui/icons'

const props = withDefaults(
  defineProps<{
    name: IconName
    /** Ukuran dalam px; mengikuti currentColor untuk warnanya. */
    size?: number
  }>(),
  { size: 18 },
)

const path = computed(() => ICON_PATHS[props.name])
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="shrink-0"
  >
    <path :d="path" />
  </svg>
</template>
