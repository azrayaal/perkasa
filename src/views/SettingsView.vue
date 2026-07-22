<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCallout from '@/components/ui/BaseCallout.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import { useTheme } from '@/composables/useTheme'
import { ROLE_LABEL } from '@/config/navigation'
import { resetDatabase } from '@/data/db'
import { getCompanyProfile } from '@/services/masterService'
import { useAuthStore } from '@/stores/authStore'
import { formatPercent } from '@/utils/formatCurrency'
import type { CompanyProfile } from '@/types'

const auth = useAuthStore()
const { isDark, toggle } = useTheme()

const company = ref<CompanyProfile | null>(null)
const loading = ref(true)

async function load(): Promise<void> {
  company.value = await getCompanyProfile()
  loading.value = false
}

void load()

/** Profil perusahaan tampil read-only | nilainya dipakai posting engine & SPT. */
const companyFields = computed<Array<{ label: string; value: string; mono?: boolean }>>(() => {
  const profile = company.value
  if (!profile) return []

  return [
    { label: 'Nama legal', value: profile.legalName },
    { label: 'NPWP', value: profile.npwp, mono: true },
    { label: 'Alamat', value: profile.address },
    { label: 'Kota', value: profile.city },
    { label: 'Telepon', value: profile.phone },
    { label: 'Email', value: profile.email },
    { label: 'Tahun buku', value: String(profile.fiscalYear) },
    { label: 'Tarif PPN', value: formatPercent(profile.vatRate) },
    { label: 'Tarif PPh badan', value: formatPercent(profile.corporateTaxRate) },
  ]
})

const accountFields = computed<Array<{ label: string; value: string }>>(() => {
  const user = auth.user
  if (!user) return []

  return [
    { label: 'Nama', value: user.name },
    { label: 'Email', value: user.email },
    { label: 'Peran', value: ROLE_LABEL[user.role] },
    { label: 'Jabatan', value: user.title },
  ]
})

/* Reset data demo bersifat merusak | selalu lewat konfirmasi. */
const resetOpen = ref(false)

function confirmReset(): void {
  resetDatabase()
  // Reload penuh dipilih supaya seluruh store & cache service ikut lahir ulang.
  window.location.reload()
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      title="Pengaturan"
      description="Identitas perusahaan, akun yang sedang masuk, tampilan, dan pengelolaan data demo."
    />

    <LoadingState v-if="loading" :rows="5" />

    <div v-else class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <BaseCard
        title="Profil Perusahaan"
        subtitle="Dipakai pada kop dokumen, faktur pajak, dan perhitungan SPT."
      >
        <dl class="flex flex-col divide-y divide-line">
          <div
            v-for="field in companyFields"
            :key="field.label"
            class="flex flex-wrap items-baseline justify-between gap-2 py-2.5"
          >
            <dt class="text-small text-ink-secondary">{{ field.label }}</dt>
            <dd
              class="text-right text-data text-ink-primary"
              :class="field.mono ? 'identifier' : ''"
            >
              {{ field.value }}
            </dd>
          </div>
        </dl>
      </BaseCard>

      <div class="flex flex-col gap-6">
        <BaseCard title="Akun Saya" subtitle="Hak akses menu mengikuti peran ini.">
          <dl class="flex flex-col divide-y divide-line">
            <div
              v-for="field in accountFields"
              :key="field.label"
              class="flex flex-wrap items-baseline justify-between gap-2 py-2.5"
            >
              <dt class="text-small text-ink-secondary">{{ field.label }}</dt>
              <dd class="text-right text-data text-ink-primary">{{ field.value }}</dd>
            </div>
          </dl>
        </BaseCard>

        <BaseCard title="Tampilan" subtitle="Mode gelap disimpan di browser ini.">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <span
                class="inline-flex h-9 w-9 items-center justify-center rounded-rail bg-surface-alt text-ink-secondary"
              >
                <BaseIcon :name="isDark ? 'moon' : 'sun'" :size="18" />
              </span>
              <div>
                <p class="text-h4 text-ink-primary">
                  Mode {{ isDark ? 'gelap' : 'terang' }} aktif
                </p>
                <p class="text-small text-ink-secondary">
                  Seluruh halaman mengikuti pilihan ini.
                </p>
              </div>
            </div>

            <BaseButton variant="secondary" :icon="isDark ? 'sun' : 'moon'" @click="toggle">
              Ganti ke mode {{ isDark ? 'terang' : 'gelap' }}
            </BaseButton>
          </div>
        </BaseCard>
      </div>

      <BaseCard title="Data Demo" subtitle="Kembalikan seluruh data ke kondisi awal.">
        <div class="flex flex-col gap-4">
          <BaseCallout tone="warning" title="Seluruh perubahan tersimpan lokal">
            Faktur, pembayaran, beban, dan jurnal yang Anda buat disimpan di
            <strong>localStorage browser ini</strong> | tidak dikirim ke server mana pun. Membuka
            aplikasi di browser atau perangkat lain berarti memulai dari data awal.
          </BaseCallout>

          <div>
            <BaseButton variant="danger" icon="refresh" @click="resetOpen = true">
              Reset Data Demo
            </BaseButton>
            <p class="mt-2 text-small text-ink-secondary">
              Semua dokumen buatan Anda hilang dan data simulasi dibangun ulang.
            </p>
          </div>
        </div>
      </BaseCard>

      <BaseCard title="Tentang Sistem" subtitle="Cara Perkasa ERP menjaga angkanya konsisten.">
        <div class="flex flex-col gap-3 text-small text-ink-secondary">
          <p>
            <strong class="text-ink-primary">Dokumen adalah fakta.</strong> Faktur penjualan, faktur
            pembelian, beban, pembayaran, dan penyesuaian stok adalah satu-satunya tempat angka
            dimasukkan.
          </p>
          <p>
            <strong class="text-ink-primary">Jurnal diturunkan otomatis.</strong> Begitu sebuah
            dokumen diposting, jurnalnya terbentuk sendiri dari bagan akun | tidak ada entri
            akuntansi yang diketik manual kecuali jurnal penyesuaian.
          </p>
          <p>
            <strong class="text-ink-primary">Laporan dihitung dari jurnal.</strong> Buku besar,
            neraca saldo, neraca, laba rugi, arus kas, dan rekap pajak semuanya membaca jurnal yang
            sama | karena itu tidak mungkin ada laporan yang saling bertentangan.
          </p>
          <p>
            Data transaksi <strong class="text-ink-primary">Januari–Juli 2026</strong> dihasilkan
            dari simulasi harian yang saling terkait: penjualan menarik stok, stok memicu pembelian,
            pembelian dan beban membentuk utang, dan pelunasannya menggerakkan kas.
          </p>
        </div>
      </BaseCard>
    </div>

    <BaseModal
      :open="resetOpen"
      title="Reset Data Demo?"
      description="Tindakan ini tidak bisa dibatalkan."
      @close="resetOpen = false"
    >
      <p class="text-body text-ink-secondary">
        Seluruh dokumen, jurnal, dan pergerakan stok yang tersimpan di browser ini akan dihapus,
        lalu data simulasi awal dibangun ulang. Halaman akan dimuat ulang setelahnya.
      </p>

      <template #footer>
        <BaseButton variant="secondary" @click="resetOpen = false">Batal</BaseButton>
        <BaseButton variant="danger" icon="refresh" @click="confirmReset">
          Ya, Reset Sekarang
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
