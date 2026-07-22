import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastTone = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  message: string
  tone: ToastTone
}

const AUTO_DISMISS_MS = 3200

/** Notifikasi global hasil aksi (simpan, bayar, batalkan, …). */
export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])
  let counter = 0

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  function push(message: string, tone: ToastTone = 'success'): void {
    const id = ++counter
    toasts.value = [...toasts.value, { id, message, tone }]
    setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
  }

  return { toasts, push, dismiss }
})
