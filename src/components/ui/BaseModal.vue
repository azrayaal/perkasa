<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'

const props = defineProps<{
  open: boolean
  title: string
  description?: string
}>()

const emit = defineEmits<{
  close: []
}>()

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close')
}

// Kunci scroll body selama modal terbuka supaya latar tidak ikut bergeser.
watch(
  () => props.open,
  (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
    if (open) window.addEventListener('keydown', onKeydown)
    else window.removeEventListener('keydown', onKeydown)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-end justify-center bg-ink-primary/40 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      @click.self="emit('close')"
    >
      <div
        class="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-card border border-line bg-surface shadow-modal sm:rounded-card"
      >
        <header class="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 class="text-h3 text-ink-primary">{{ title }}</h2>
            <p v-if="description" class="mt-1 text-small text-ink-secondary">{{ description }}</p>
          </div>

          <button
            type="button"
            class="rounded-control p-1 text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink-primary"
            aria-label="Tutup"
            @click="emit('close')"
          >
            <BaseIcon name="close" />
          </button>
        </header>

        <div class="flex-1 overflow-y-auto px-5 py-5">
          <slot />
        </div>

        <footer
          v-if="$slots.footer"
          class="flex flex-wrap justify-end gap-3 border-t border-line px-5 py-4"
        >
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>
