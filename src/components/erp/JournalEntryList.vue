<script setup lang="ts">
import BaseBadge from '@/components/ui/BaseBadge.vue'
import { accountName } from '@/data/chartOfAccounts'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import type { JournalEntry } from '@/types'
import { EMPTY } from '@/utils/placeholder'

withDefaults(
  defineProps<{
    entries: JournalEntry[]
    /** Sembunyikan tanggal & nomor jurnal saat dipakai di dalam halaman dokumen. */
    compact?: boolean
  }>(),
  { compact: false },
)

function totalDebit(entry: JournalEntry): number {
  return entry.lines.reduce((sum, line) => sum + line.debit, 0)
}

function totalCredit(entry: JournalEntry): number {
  return entry.lines.reduce((sum, line) => sum + line.credit, 0)
}
</script>

<template>
  <ul class="flex flex-col gap-3">
    <li
      v-for="entry in entries"
      :key="entry.id"
      class="overflow-hidden rounded-card border border-line bg-surface"
    >
      <header
        class="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-alt/60 px-4 py-3"
      >
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span v-if="!compact" class="identifier">{{ entry.number }}</span>
            <BaseBadge :status="entry.source" />
            <span v-if="entry.refNumber" class="identifier">{{ entry.refNumber }}</span>
          </div>
          <p class="mt-1 truncate text-data font-medium text-ink-primary">{{ entry.description }}</p>
        </div>

        <span v-if="!compact" class="shrink-0 text-small text-ink-secondary">
          {{ formatDate(entry.date) }}
        </span>
      </header>

      <table class="w-full border-collapse text-data">
        <thead>
          <tr class="border-b border-line">
            <th scope="col" class="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Akun
            </th>
            <th scope="col" class="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Debit
            </th>
            <th scope="col" class="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Kredit
            </th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="(line, index) in entry.lines" :key="`${entry.id}-${index}`" class="border-b border-line/70">
            <!-- Baris kredit ditakik ke kanan, konvensi baku penulisan jurnal. -->
            <td class="px-4 py-2.5" :class="line.credit > 0 ? 'pl-10' : ''">
              <span class="identifier mr-2">{{ line.accountCode }}</span>
              <span class="text-ink-primary">{{ accountName(line.accountCode) }}</span>
              <span class="block text-xs text-ink-muted">{{ line.memo }}</span>
            </td>
            <td class="amount px-4 py-2.5 text-right text-ink-primary">
              {{ line.debit > 0 ? formatCurrency(line.debit) : EMPTY }}
            </td>
            <td class="amount px-4 py-2.5 text-right text-ink-primary">
              {{ line.credit > 0 ? formatCurrency(line.credit) : EMPTY }}
            </td>
          </tr>
        </tbody>

        <tfoot>
          <tr class="bg-surface-alt/60">
            <td class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">
              Jumlah
            </td>
            <td class="amount px-4 py-2.5 text-right font-semibold text-ink-primary">
              {{ formatCurrency(totalDebit(entry)) }}
            </td>
            <td class="amount px-4 py-2.5 text-right font-semibold text-ink-primary">
              {{ formatCurrency(totalCredit(entry)) }}
            </td>
          </tr>
        </tfoot>
      </table>
    </li>
  </ul>
</template>
