<script setup lang="ts">
import { formatCurrency } from '@/utils/formatCurrency'
import type { ReportSection } from '@/types'

/**
 * Blok laporan keuangan: daftar akun + subtotal.
 * Dipakai Neraca, Laba Rugi, dan Arus Kas supaya tipografi angka (monospace,
 * rata kanan, lebar digit tetap) identik di ketiganya.
 */
withDefaults(
  defineProps<{
    section: ReportSection
    /** Judul subtotal; default "Jumlah <judul section>". */
    totalLabel?: string
    /** Tampilkan kode akun di depan nama. */
    showCodes?: boolean
    /** Sorot subtotal dengan garis ganda ala laporan cetak. */
    emphasizeTotal?: boolean
  }>(),
  { showCodes: true, emphasizeTotal: false },
)
</script>

<template>
  <div>
    <h3 class="text-h4 text-ink-primary">{{ section.title }}</h3>

    <table class="mt-2 w-full border-collapse text-data">
      <tbody>
        <tr v-for="line in section.lines" :key="line.code" class="border-b border-line/70">
          <td class="py-2.5 pr-4">
            <span v-if="showCodes" class="identifier mr-2">{{ line.code }}</span>
            <span class="text-ink-primary">{{ line.label }}</span>
          </td>
          <td class="amount w-44 py-2.5 text-right text-ink-primary">
            {{ formatCurrency(line.amount) }}
          </td>
        </tr>

        <tr v-if="section.lines.length === 0">
          <td class="py-3 text-small text-ink-muted" colspan="2">Tidak ada saldo pada periode ini.</td>
        </tr>
      </tbody>

      <tfoot>
        <tr :class="emphasizeTotal ? 'border-t-2 border-ink-strong' : 'border-t border-line'">
          <td class="py-3 pr-4 text-data font-semibold text-ink-primary">
            {{ totalLabel ?? `Jumlah ${section.title}` }}
          </td>
          <td class="amount py-3 text-right text-data font-bold text-ink-primary">
            {{ formatCurrency(section.total) }}
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>
