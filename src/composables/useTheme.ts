import { computed, readonly, ref, type ComputedRef, type Ref } from 'vue'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'ginkgo-living.theme.v1'

/**
 * Default aplikasi adalah LIGHT — bukan mengikuti preferensi sistem — supaya
 * tampilan awal selalu sama untuk semua orang saat demo. Dark mode hanya aktif
 * kalau user menekan tombol tema. Logika ini digandakan di skrip inline
 * `index.html` agar tema sudah benar sebelum paint pertama.
 */
function preferredTheme(): ThemeMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/**
 * State modul (bukan per-pemanggil) supaya semua komponen melihat tema yang
 * sama — tombol di topbar dan indikator di halaman Pengaturan selalu sinkron.
 */
const mode = ref<ThemeMode>(preferredTheme())
const isDark = computed(() => mode.value === 'dark')

function apply(next: ThemeMode): void {
  document.documentElement.classList.toggle('dark', next === 'dark')
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Tema tetap aktif untuk sesi ini walau tidak bisa disimpan.
  }
}

export interface UseThemeReturn {
  mode: Readonly<Ref<ThemeMode>>
  isDark: ComputedRef<boolean>
  toggle: () => void
  init: () => void
}

/**
 * Light/dark mode. Pergantian tema hanya menukar nilai CSS variable di `.dark`
 * (lihat `assets/main.css`) — komponen tidak perlu tahu tema sama sekali.
 */
export function useTheme(): UseThemeReturn {
  function set(next: ThemeMode): void {
    mode.value = next
    apply(next)
  }

  return {
    mode: readonly(mode),
    isDark,
    toggle: () => set(mode.value === 'dark' ? 'light' : 'dark'),
    init: () => apply(mode.value),
  }
}
