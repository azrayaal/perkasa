<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { ROLE_HOME, ROLE_LABEL } from '@/config/navigation'
import { getDemoAccounts } from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const toast = useToastStore()

const email = ref('')
const password = ref('')

/** HAPUS bersama halaman demo saat masuk produksi. */
const demoAccounts = getDemoAccounts()

async function handleSubmit(): Promise<void> {
  const success = await auth.signIn({ email: email.value, password: password.value })
  if (!success || !auth.user) return

  toast.push(`Selamat datang, ${auth.user.name}.`)

  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : null
  void router.push(redirect ?? { name: ROLE_HOME[auth.user.role] })
}

function fillDemo(account: (typeof demoAccounts)[number]): void {
  email.value = account.email
  password.value = account.password
}
</script>

<template>
  <div class="min-h-screen bg-surface">
    <div class="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <!--
        Panel kiri gelap, bukan lime: lime adalah warna sorotan dan teks putih
        di atasnya tidak akan terbaca. Lime tetap muncul sebagai ornamen.
      -->
      <div
        class="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-white lg:flex"
      >
        <!--
          Latar dibangun dari gradien, bukan file gambar: tidak ada aset
          tambahan untuk dimuat dan warnanya otomatis ikut token lime.
        -->
        <div
          class="pointer-events-none absolute inset-0"
          style="
            background:
              radial-gradient(120% 85% at 100% 0%, rgb(var(--brand) / 0.3), transparent 58%),
              radial-gradient(95% 70% at 0% 100%, rgb(var(--brand) / 0.18), transparent 55%);
          "
          aria-hidden="true"
        />
        <!-- Kisi tipis memberi kesan "sistem", tanpa mencuri perhatian. -->
        <div
          class="pointer-events-none absolute inset-0 opacity-[0.07]"
          style="
            background-image:
              linear-gradient(rgba(255, 255, 255, 0.8) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.8) 1px, transparent 1px);
            background-size: 56px 56px;
          "
          aria-hidden="true"
        />
        <!-- Sapuan gelap di bawah supaya teks tetap kontras di atas gradien. -->
        <div
          class="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-sidebar to-transparent"
          aria-hidden="true"
        />

        <div class="relative">
          <img
            src="/ginkgo_living_logo.jpeg"
            alt="Ginkgo Living"
            class="h-20 w-20 rounded-card bg-white object-contain p-1.5 shadow-overlay"
          />
          <h1 class="mt-10 max-w-md text-4xl font-bold leading-tight text-white">
            Ginkgo Living ERP
          </h1>
          <p class="mt-4 max-w-md text-lg text-white/80">
            Satu tampilan terpadu untuk property, billing, kesehatan, aktivitas, dan portal
            keluarga.
          </p>
        </div>

        <ul class="relative flex flex-col gap-4 text-white/85">
          <li class="flex items-center gap-3">
            <BaseIcon name="check" :size="18" class="text-brand" /> Data resident 360° dalam satu layar
          </li>
          <li class="flex items-center gap-3">
            <BaseIcon name="check" :size="18" class="text-brand" /> Akses bertingkat: staf, penghuni, keluarga
          </li>
          <li class="flex items-center gap-3">
            <BaseIcon name="check" :size="18" class="text-brand" /> Detail medis tidak bocor ke portal keluarga
          </li>
        </ul>

        <p class="relative text-sm text-white/50">POC · Data dummy, tersimpan lokal di browser</p>
      </div>

      <!-- Panel kanan: form, terpusat vertikal -->
      <div class="flex items-center justify-center px-6 py-12 sm:px-10">
        <div class="w-full max-w-md">
          <!-- Identitas ringkas untuk layar kecil, karena panel kiri disembunyikan -->
          <div class="mb-8 flex items-center gap-3 lg:hidden">
            <!-- <span
              class="inline-flex h-10 w-10 items-center justify-center rounded-control bg-brand text-lg font-bold text-white"
              aria-hidden="true"
            >
              G
            </span> -->
            <img src="/ginkgo_living_logo.jpeg" class="h-14" alt="Ginkgo Living ERP">
            <div class="leading-tight">
              <p class="font-semibold text-ink-secondary">Ginkgo Living ERP</p>
              <p class="text-sm text-ink-muted">Resident Journey</p>
            </div>
          </div>

          <h2 class="text-xl font-semibold text-ink-primary">Masuk ke akun Anda</h2>
          <p class="mt-1 text-sm text-ink-secondary">
            Gunakan salah satu akun demo di bawah untuk mencoba tiap peran.
          </p>

          <form class="mt-6 flex flex-col gap-4" @submit.prevent="handleSubmit">
            <BaseInput
              v-model="email"
              label="Email"
              type="email"
              placeholder="nama@ginkgo.id"
              required
            />
            <BaseInput
              v-model="password"
              label="Kata sandi"
              type="password"
              placeholder="••••••••"
              required
            />

            <p
              v-if="auth.error"
              class="rounded-control bg-state-error/10 px-3 py-2 text-sm font-medium text-state-error"
              role="alert"
            >
              {{ auth.error }}
            </p>

            <BaseButton type="submit" :loading="auth.loading" block>Masuk</BaseButton>
          </form>

          <div class="mt-8">
            <p class="text-xs font-semibold uppercase tracking-wide text-ink-muted">Akun demo</p>

            <ul class="mt-3 flex flex-col gap-2">
              <li v-for="account in demoAccounts" :key="account.email">
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-3 rounded-control border border-line px-3 py-2 text-left transition-colors hover:border-brand hover:bg-brand/5"
                  @click="fillDemo(account)"
                >
                  <span class="min-w-0">
                    <span class="block truncate text-sm font-semibold text-ink-primary">
                      {{ ROLE_LABEL[account.user.role] }} — {{ account.user.name }}
                    </span>
                    <span class="block truncate text-xs text-ink-muted">
                      {{ account.email }} / {{ account.password }}
                    </span>
                  </span>
                  <!-- Teks lime di atas putih tidak terbaca — pakai tinta gelap. -->
                  <span class="shrink-0 text-xs font-semibold text-ink-primary">Isi</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
