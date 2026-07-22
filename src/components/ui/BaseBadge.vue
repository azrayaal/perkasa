<script setup lang="ts">
import { computed } from 'vue'
import { statusBadgeClass, statusLabel } from '@/utils/statusBadgeColor'
import type { BadgeStatus } from '@/types'

const props = defineProps<{
  status: BadgeStatus
  /** Override label; default memakai label terdaftar di statusBadgeColor.ts. */
  label?: string
}>()

const toneClass = computed(() => statusBadgeClass(props.status))
const text = computed(() => props.label ?? statusLabel(props.status))
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide whitespace-nowrap"
    :class="toneClass"
  >
    {{ text }}
  </span>
</template>
