<script setup lang="ts">
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import { ROLE_LABEL } from '@/config/navigation'
import { useTheme } from '@/composables/useTheme'
import { useAuthStore } from '@/stores/authStore'

defineProps<{
  title: string
  /** Status rail sidebar; menentukan arah ikon tombol ciutkan. */
  sidebarCollapsed: boolean
}>()

const emit = defineEmits<{
  toggleSidebar: []
  toggleCollapse: []
}>()

const auth = useAuthStore()
const { isDark, toggle } = useTheme()
</script>

<template>
  <header
    class="sticky top-0 z-20 flex h-topbar items-center gap-4 border-b border-line bg-page/90 px-4 backdrop-blur sm:px-6"
  >
    <!-- Mobile: buka drawer. Desktop: ciutkan/lebarkan sidebar.
         Keduanya menempati slot yang sama di kiri topbar. -->
    <button
      type="button"
      class="-ml-2 flex h-11 w-11 items-center justify-center rounded-control text-ink-secondary transition-colors hover:bg-surface-alt hover:text-ink-primary lg:hidden"
      aria-label="Buka menu"
      @click="emit('toggleSidebar')"
    >
      <BaseIcon name="menu" :size="20" />
    </button>

    <button
      type="button"
      class="-ml-2 hidden h-11 w-11 items-center justify-center rounded-control text-ink-secondary transition-colors hover:bg-surface-alt hover:text-ink-primary lg:flex"
      :aria-label="sidebarCollapsed ? 'Lebarkan menu' : 'Ciutkan menu'"
      :title="sidebarCollapsed ? 'Lebarkan menu' : 'Ciutkan menu'"
      @click="emit('toggleCollapse')"
    >
      <BaseIcon :name="sidebarCollapsed ? 'expand' : 'collapse'" :size="20" />
    </button>

    <h1 class="flex-1 truncate text-h4 text-ink-primary">{{ title }}</h1>

    <button
      type="button"
      class="flex h-11 w-11 items-center justify-center rounded-control text-ink-secondary transition-colors hover:bg-surface-alt hover:text-ink-primary"
      :aria-label="isDark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'"
      @click="toggle"
    >
      <BaseIcon :name="isDark ? 'sun' : 'moon'" :size="18" />
    </button>

    <div v-if="auth.user" class="flex items-center gap-3">
      <BaseBadge
        :status="auth.user.role === 'admin' ? 'active' : 'Premium'"
        :label="ROLE_LABEL[auth.user.role]"
      />
      <span class="hidden text-small text-ink-secondary sm:inline">{{ auth.user.title }}</span>
    </div>
  </header>
</template>
