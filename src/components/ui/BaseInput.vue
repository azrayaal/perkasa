<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    type?: 'text' | 'number' | 'date' | 'email' | 'password'
    placeholder?: string
    required?: boolean
    hint?: string
    min?: number
  }>(),
  { type: 'text', required: false },
)

const model = defineModel<string | number>({ required: true })
</script>

<template>
  <label class="flex w-full flex-col gap-2">
    <span class="text-sm font-medium text-ink-secondary">
      {{ label }}
      <span v-if="required" class="text-state-error" aria-hidden="true">*</span>
    </span>

    <input
      v-model="model"
      :type="type"
      :placeholder="placeholder"
      :required="required"
      :min="min"
      class="w-full rounded-control border border-line bg-surface-alt px-3 py-2 text-data text-ink-primary outline-none transition-colors placeholder:text-ink-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
    />

    <span v-if="hint" class="text-xs text-ink-muted">{{ hint }}</span>
  </label>
</template>
