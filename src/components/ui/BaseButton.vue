<script setup lang="ts">
import { computed } from 'vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import type { IconName } from '@/components/ui/icons'

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    size?: Size
    icon?: IconName
    loading?: boolean
    disabled?: boolean
    type?: 'button' | 'submit'
    block?: boolean
  }>(),
  { variant: 'primary', size: 'md', loading: false, disabled: false, type: 'button', block: false },
)

/** Config-driven: satu tempat untuk seluruh gaya tombol di aplikasi. */
const VARIANT_CLASS: Record<Variant, string> = {
  // Aksi utama memakai warna gelap; lime disimpan untuk sorotan & status.
  primary: 'bg-ink-strong text-page hover:opacity-90',
  // Aksen lime: teks di atasnya selalu gelap, tidak pernah putih.
  accent: 'bg-brand text-brand-ink hover:bg-brand-hover',
  secondary: 'border border-line bg-surface text-ink-primary hover:bg-surface-alt',
  ghost: 'text-ink-secondary hover:bg-surface-alt hover:text-ink-primary',
  danger: 'border border-state-error/30 bg-transparent text-state-error hover:bg-state-error/10',
}

const SIZE_CLASS: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-[13px] gap-1.5',
  md: 'px-[18px] py-[10px] text-[14px] gap-2',
}

const isInactive = computed(() => props.disabled || props.loading)
</script>

<template>
  <button
    :type="type"
    :disabled="isInactive"
    class="inline-flex items-center justify-center rounded-control font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50"
    :class="[VARIANT_CLASS[variant], SIZE_CLASS[size], block ? 'w-full' : '']"
  >
    <BaseIcon v-if="icon && !loading" :name="icon" :size="size === 'sm' ? 15 : 17" />
    <span
      v-if="loading"
      class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
    <slot />
  </button>
</template>
