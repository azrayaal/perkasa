<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import PeriodPicker from '@/components/erp/PeriodPicker.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppTopbar from '@/components/layout/AppTopbar.vue'
import ToastHost from '@/components/ui/ToastHost.vue'
import { ROUTE } from '@/router/routeNames'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const toast = useToastStore()

const sidebarOpen = ref(false)

/**
 * Sidebar berlabel adalah default | ERP ini punya dua belas menu dan ikon saja
 * memaksa user menghafal. Rail ikon tersedia lewat tombol ciutkan, dan
 * pilihannya diingat antar sesi.
 */
const SIDEBAR_KEY = 'perkasa-erp.sidebar-collapsed.v1'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1'
  } catch {
    return false
  }
}

const sidebarCollapsed = ref(readCollapsed())

function toggleCollapse(): void {
  sidebarCollapsed.value = !sidebarCollapsed.value
  try {
    localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed.value ? '1' : '0')
  } catch {
    // Preferensi tetap berlaku untuk sesi ini walau tidak bisa disimpan.
  }
}

/** Halaman login tampil polos, tanpa shell ERP. */
const showShell = computed(() => auth.isAuthenticated && route.name !== ROUTE.login)

const pageTitle = computed(() => route.meta.title ?? 'Perkasa ERP')

// Tutup drawer setiap kali pindah halaman di mobile.
watch(() => route.fullPath, () => (sidebarOpen.value = false))

async function handleSignOut(): Promise<void> {
  await auth.signOut()
  toast.push('Anda telah keluar.', 'info')
  void router.push({ name: ROUTE.login })
}
</script>

<template>
  <div class="min-h-screen bg-page">
    <template v-if="showShell">
      <AppSidebar
        :open="sidebarOpen"
        :collapsed="sidebarCollapsed"
        @close="sidebarOpen = false"
        @sign-out="handleSignOut"
      />

      <div
        class="transition-[padding] duration-200"
        :class="sidebarCollapsed ? 'lg:pl-rail' : 'lg:pl-sidebar'"
      >
        <AppTopbar
          :title="pageTitle"
          :sidebar-collapsed="sidebarCollapsed"
          @toggle-sidebar="sidebarOpen = !sidebarOpen"
          @toggle-collapse="toggleCollapse"
        />

        <!-- Di layar sempit pemilih periode turun ke bawah topbar, tetap terlihat. -->
        <div class="border-b border-line bg-page px-4 py-3 sm:hidden">
          <PeriodPicker />
        </div>

        <!-- Lebar dashboard maksimal 1440px sesuai design system. -->
        <main class="mx-auto w-full max-w-dashboard px-4 py-6 sm:px-6">
          <RouterView />
        </main>
      </div>
    </template>

    <RouterView v-else />

    <ToastHost />
  </div>
</template>
