import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { login as loginRequest, logout as logoutRequest } from '@/services/authService'
import type { AuthUser, LoginPayload, UserRole } from '@/types'

const SESSION_KEY = 'ginkgo-living.session.v1'

function readSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

function writeSession(user: AuthUser | null): void {
  try {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // Sesi tetap hidup di memori walau storage tidak tersedia.
  }
}

/**
 * Sesi login. Dipersist ke localStorage supaya reload tidak melempar user
 * kembali ke halaman login.
 *
 * TODO: ganti dengan token (access/refresh) dari backend saat API siap.
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(readSession())
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => user.value !== null)
  const role = computed<UserRole | null>(() => user.value?.role ?? null)

  /** Resident yang boleh dilihat user ini; `null` untuk admin (boleh semua). */
  const scopedResidentId = computed(() => user.value?.residentId ?? null)

  async function signIn(payload: LoginPayload): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      const authenticated = await loginRequest(payload)
      user.value = authenticated
      writeSession(authenticated)
      return true
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Gagal masuk.'
      return false
    } finally {
      loading.value = false
    }
  }

  async function signOut(): Promise<void> {
    await logoutRequest()
    user.value = null
    error.value = null
    writeSession(null)
  }

  return { user, loading, error, isAuthenticated, role, scopedResidentId, signIn, signOut }
})
