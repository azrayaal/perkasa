<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseTable from '@/components/ui/BaseTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import StatCard from '@/components/ui/StatCard.vue'
import type { TableColumn } from '@/components/ui/BaseTable.types'
import { markInvoiceAsPaid } from '@/services/billingService'
import { getBillingRows } from '@/services/reportsService'
import { ROUTE } from '@/router/routeNames'
import { useToastStore } from '@/stores/toastStore'
import { formatCurrency } from '@/utils/formatCurrency'
import type { Billing, WithResident } from '@/types'

const router = useRouter()
const toast = useToastStore()

const rows = ref<WithResident<Billing>[]>([])
const loading = ref(true)
const busyId = ref<string | null>(null)

const outstanding = computed(() =>
  rows.value.filter((row) => row.status !== 'paid').reduce((sum, row) => sum + row.total, 0),
)

const paidCount = computed(() => rows.value.filter((row) => row.status === 'paid').length)

const columns: TableColumn<WithResident<Billing>>[] = [
  { key: 'id', label: 'No. Invoice', value: (row) => row.id },
  { key: 'residentName', label: 'Penghuni', value: (row) => row.residentName },
  { key: 'period', label: 'Periode', value: (row) => row.period },
  { key: 'total', label: 'Total', align: 'right' },
  { key: 'status', label: 'Status', align: 'right' },
  { key: 'actions', label: 'Aksi', align: 'right' },
]

async function load(): Promise<void> {
  loading.value = true
  rows.value = await getBillingRows()
  loading.value = false
}

onMounted(load)

async function payInvoice(row: WithResident<Billing>): Promise<void> {
  busyId.value = row.id
  try {
    await markInvoiceAsPaid(row.id)
    toast.push(`Invoice ${row.id} ditandai lunas.`)
    await load()
  } catch {
    toast.push('Gagal memperbarui invoice.', 'error')
  } finally {
    busyId.value = null
  }
}

function openResident(residentId: string): void {
  void router.push({ name: ROUTE.residentDetail, params: { id: residentId } })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      title="Billing"
      description="Seluruh invoice dari semua penghuni."
    />

    <LoadingState v-if="loading" :rows="4" />

    <template v-else>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Tertunggak"
          :value="formatCurrency(outstanding)"
          icon="billing"
          tone="warning"
        />
        <StatCard label="Invoice Lunas" :value="String(paidCount)" icon="check" tone="success" />
        <StatCard label="Total Invoice" :value="String(rows.length)" icon="billing" />
      </div>

      <BaseCard title="Daftar Invoice" flush>
        <BaseTable :columns="columns" :rows="rows" :row-key="(row) => row.id">
          <!-- Identifier teknis dirender monospace. -->
          <template #cell-id="{ row }">
            <span class="identifier">{{ row.id }}</span>
          </template>

          <template #cell-residentName="{ row }">
            <button
              type="button"
              class="font-medium text-ink-primary underline decoration-brand decoration-2 underline-offset-4 transition-colors hover:decoration-ink-primary"
              @click="openResident(row.residentId)"
            >
              {{ row.residentName }}
            </button>
          </template>

          <template #cell-total="{ row }">
            <span class="font-semibold">{{ formatCurrency(row.total) }}</span>
          </template>

          <template #cell-status="{ row }">
            <BaseBadge :status="row.status" />
          </template>

          <template #cell-actions="{ row }">
            <BaseButton
              v-if="row.status !== 'paid'"
              size="sm"
              variant="secondary"
              icon="check"
              :loading="busyId === row.id"
              @click="payInvoice(row)"
            >
              Tandai Lunas
            </BaseButton>
            <span v-else class="text-sm text-ink-muted">—</span>
          </template>

          <template #empty>
            <div class="px-4">
              <EmptyState title="Belum ada invoice" description="Tagihan akan muncul di sini." />
            </div>
          </template>
        </BaseTable>
      </BaseCard>
    </template>
  </div>
</template>
