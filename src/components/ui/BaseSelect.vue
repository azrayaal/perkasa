<script setup lang="ts" generic="T">
import type { SelectOption } from '@/components/ui/BaseSelect.types'

defineProps<{
  label: string
  options: SelectOption<T>[]
  placeholder?: string
}>()

/** `null` = belum ada pilihan. */
const model = defineModel<T | null>({ required: true })

function optionKey(value: T): string {
  return String(value)
}
</script>

<template>
  <label class="flex w-full flex-col gap-2 sm:max-w-xs">
    <span class="text-sm font-medium text-ink-secondary">{{ label }}</span>
    <select
      v-model="model"
      class="w-full rounded-control border border-line bg-surface-alt px-3 py-2 text-data text-ink-primary outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
    >
      <option v-if="placeholder" :value="null">{{ placeholder }}</option>
      <option v-for="option in options" :key="optionKey(option.value)" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  </label>
</template>
