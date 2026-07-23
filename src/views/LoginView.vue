<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLogo from '@/components/layout/AppLogo.vue'
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

const HIGHLIGHTS = [
  'Penjualan, pembelian, dan gudang terhubung ke satu buku besar',
  'Jurnal terbentuk otomatis dari dokumen — tidak ada posting manual',
  'SPT Masa PPN & PPh tersusun langsung dari transaksi',
  'Neraca dan laporan keuangan selalu mengikuti transaksi terakhir',
]

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
        Panel kiri gelap, bukan amber: amber adalah warna sorotan dan teks putih
        di atasnya tidak akan terbaca. Amber tetap muncul sebagai ornamen.
      -->
      <div
        class="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-white lg:flex"
      >
        <!--
          Latar dibangun dari gradien, bukan file gambar: tidak ada aset
          tambahan untuk dimuat dan warnanya otomatis ikut token brand.
        -->
        <div
          class="pointer-events-none absolute inset-0"
          style="
            background:
              radial-gradient(120% 85% at 100% 0%, rgb(var(--brand) / 0.25), transparent 58%),
              radial-gradient(95% 70% at 0% 100%, rgb(var(--brand) / 0.14), transparent 55%);
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
        <div
          class="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-sidebar to-transparent"
          aria-hidden="true"
        />

        <div class="relative">
          <AppLogo :size="64" />
          <h1 class="mt-10 max-w-md text-4xl font-bold leading-tight text-white">Perkasa ERP</h1>
          <p class="mt-4 max-w-md text-lg text-white/80">
            Sistem terpadu PT Perkasa Gemilang Distrindo — dari faktur di gudang sampai laporan keuangan,
            semuanya satu sumber data.
          </p>
        </div>

        <ul class="relative flex flex-col gap-4 text-white/85">
          <li v-for="item in HIGHLIGHTS" :key="item" class="flex items-start gap-3">
            <BaseIcon name="check" :size="18" class="mt-0.5 shrink-0 text-brand" />
            {{ item }}
          </li>
        </ul>

        <p class="relative text-sm text-white/50">
          POC · Data simulasi, tersimpan lokal di browser
        </p>
      </div>

      <!-- Panel kanan: form, terpusat vertikal -->
      <div class="flex items-center justify-center px-6 py-12 sm:px-10">
        <div class="w-full max-w-md">
          <!-- Identitas ringkas untuk layar kecil, karena panel kiri disembunyikan -->
          <div class="mb-8 flex items-center gap-3 lg:hidden">
            <AppLogo :size="44" />
            <div class="leading-tight">
              <p class="font-semibold text-ink-primary">Perkasa ERP</p>
              <p class="text-sm text-ink-muted">PT Perkasa Gemilang Distrindo</p>
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
              placeholder="nama@perkasagemilang.co.id"
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
