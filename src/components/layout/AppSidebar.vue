<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import AppLogo from '@/components/layout/AppLogo.vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import { navSectionsForRole, ROLE_LABEL } from '@/config/navigation'
import { useAuthStore } from '@/stores/authStore'

const props = defineProps<{
  /** Drawer mobile terbuka. Di mobile label SELALU tampil. */
  open: boolean
  /** Rail ikon di desktop. Di mobile nilai ini diabaikan. */
  collapsed: boolean
}>()

const emit = defineEmits<{
  close: []
  signOut: []
}>()

const auth = useAuthStore()

const sections = computed(() => (auth.user ? navSectionsForRole(auth.user.role) : []))

const drawerClass = computed(() =>
  props.open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
)

/**
 * Saat diciutkan, label & judul section hanya disembunyikan di breakpoint
 * desktop | layar kecil tetap memakai drawer berlabel penuh.
 */
const labelClass = computed(() => (props.collapsed ? 'lg:hidden' : ''))
const tooltipClass = computed(() => (props.collapsed ? 'lg:block' : 'lg:hidden'))
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-30 bg-black/50 lg:hidden"
    aria-hidden="true"
    @click="emit('close')"
  />

  <!--
    Sidebar SELALU gelap | di light mode ia jadi jangkar visual di sebelah
    konten terang | jadi seluruh warnanya memakai token `sidebar-*`.
  -->
  <aside
    class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-line bg-sidebar transition-[transform,width] duration-200 lg:translate-x-0"
    :class="[drawerClass, collapsed ? 'lg:w-rail' : 'lg:w-sidebar']"
  >
    <div
      class="flex items-center gap-3 px-5 py-5"
      :class="collapsed ? 'lg:justify-center lg:px-0' : ''"
    >
      <AppLogo :size="36" />
      <div class="leading-tight" :class="labelClass">
        <p class="font-semibold text-sidebar-ink-strong">Perkasa ERP</p>
        <p class="text-xs text-sidebar-ink">PT Perkasa Gemilang Distrindo</p>
      </div>
    </div>

    <nav
      class="flex-1 overflow-y-auto px-3 pb-4"
      :class="collapsed ? 'lg:overflow-visible' : ''"
      aria-label="Navigasi utama"
    >
      <div v-for="section in sections" :key="section.title" class="mb-5 last:mb-0">
        <p
          class="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-ink/70"
          :class="labelClass"
        >
          {{ section.title }}
        </p>

        <ul class="flex flex-col gap-1" :class="collapsed ? 'lg:items-center' : ''">
          <li v-for="item in section.items" :key="item.name" class="group relative">
            <RouterLink
              :to="{ name: item.name }"
              class="flex h-11 items-center gap-3 rounded-control px-3 text-small font-medium text-sidebar-ink transition-colors hover:bg-white/5 hover:text-sidebar-ink-strong"
              :class="collapsed ? 'lg:w-11 lg:justify-center lg:rounded-rail lg:px-0' : ''"
              active-class="!bg-brand !text-brand-ink"
              :aria-label="item.label"
              @click="emit('close')"
            >
              <BaseIcon :name="item.icon" :size="19" />
              <span :class="labelClass">{{ item.label }}</span>
            </RouterLink>

            <!-- Tooltip hanya perlu saat rail: tanpa label, ikon harus dijelaskan. -->
            <span
              class="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-control bg-ink-strong px-2.5 py-1.5 text-xs font-medium text-page opacity-0 shadow-overlay transition-opacity group-hover:opacity-100"
              :class="tooltipClass"
            >
              {{ item.label }}
            </span>
          </li>
        </ul>
      </div>
    </nav>

    <footer v-if="auth.user" class="border-t border-sidebar-line px-3 py-3">
      <div
        class="flex items-center gap-3 px-2 py-2"
        :class="collapsed ? 'lg:justify-center lg:px-0' : ''"
      >
        <span
          class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-small font-semibold text-brand-ink"
          aria-hidden="true"
        >
          {{ auth.user.name.charAt(0) }}
        </span>
        <div class="min-w-0 flex-1 leading-tight" :class="labelClass">
          <p class="truncate text-small font-semibold text-sidebar-ink-strong">
            {{ auth.user.name }}
          </p>
          <p class="truncate text-xs text-sidebar-ink">{{ ROLE_LABEL[auth.user.role] }}</p>
        </div>
      </div>

      <button
        type="button"
        class="flex h-11 w-full items-center gap-3 rounded-control px-3 text-small font-medium text-sidebar-ink transition-colors hover:bg-white/5 hover:text-state-error"
        :class="collapsed ? 'lg:w-11 lg:justify-center lg:px-0' : ''"
        @click="emit('signOut')"
      >
        <BaseIcon name="logout" :size="19" />
        <span :class="labelClass">Keluar</span>
      </button>
    </footer>
  </aside>
</template>
