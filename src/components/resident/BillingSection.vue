<script setup lang="ts">
import { computed, ref } from 'vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseTable from '@/components/ui/BaseTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import type { TableColumn } from '@/components/ui/BaseTable.types'
import { createInvoice, markInvoiceAsPaid } from '@/services/billingService'
import { useToastStore } from '@/stores/toastStore'
import { formatCurrency } from '@/utils/formatCurrency'
import type { Billing, ResidentId } from '@/types'

const props = withDefaults(
  defineProps<{
    invoices: Billing[]
    residentId: ResidentId
    /** Hanya staf yang boleh membuat invoice & menandai lunas. */
    canManage?: boolean
  }>(),
  { canManage: false },
)

const emit = defineEmits<{
  /** Data berubah — parent perlu memuat ulang agregatnya. */
  changed: []
}>()

const toast = useToastStore()

const columns = computed<TableColumn<Billing>[]>(() => {
  const base: TableColumn<Billing>[] = [
    { key: 'period', label: 'Periode', value: (row) => row.period },
    { key: 'id', label: 'No. Invoice', value: (row) => row.id },
    { key: 'rent', label: 'Sewa', align: 'right', value: (row) => formatCurrency(row.rent) },
    { key: 'careFee', label: 'Biaya Care', align: 'right', value: (row) => formatCurrency(row.careFee) },
    { key: 'total', label: 'Total', align: 'right' },
    { key: 'status', label: 'Status', align: 'right' },
  ]

  return props.canManage ? [...base, { key: 'actions', label: 'Aksi', align: 'right' }] : base
})

/* ---------------------------------------------------------------------- */
/* Aksi: tandai lunas                                                      */
/* ---------------------------------------------------------------------- */

const payingId = ref<string | null>(null)

async function payInvoice(invoice: Billing): Promise<void> {
  payingId.value = invoice.id
  try {
    await markInvoiceAsPaid(invoice.id)
    toast.push(`Invoice ${invoice.id} ditandai lunas.`)
    emit('changed')
  } catch {
    toast.push('Gagal memperbarui invoice.', 'error')
  } finally {
    payingId.value = null
  }
}

/* ---------------------------------------------------------------------- */
/* Aksi: buat invoice                                                      */
/* ---------------------------------------------------------------------- */

const modalOpen = ref(false)
const saving = ref(false)
const form = ref({ period: 'Agu 2026', rent: 0, careFee: 0 })

const previewTotal = computed(() => Number(form.value.rent) + Number(form.value.careFee))
const canSubmit = computed(() => form.value.period.trim().length > 0 && previewTotal.value > 0)

function openModal(): void {
  form.value = { period: 'Agu 2026', rent: 0, careFee: 0 }
  modalOpen.value = true
}

async function submitInvoice(): Promise<void> {
  if (!canSubmit.value) return

  saving.value = true
  try {
    const created = await createInvoice({
      residentId: props.residentId,
      period: form.value.period.trim(),
      rent: Number(form.value.rent),
      careFee: Number(form.value.careFee),
    })
    modalOpen.value = false
    toast.push(`Invoice ${created.id} dibuat.`)
    emit('changed')
  } catch {
    toast.push('Gagal membuat invoice.', 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseCard title="Billing" subtitle="Tagihan sewa & layanan care" flush>
    <template v-if="canManage" #actions>
      <BaseButton size="sm" variant="secondary" icon="plus" @click="openModal">
        Buat Invoice
      </BaseButton>
    </template>

    <BaseTable :columns="columns" :rows="invoices" :row-key="(row) => row.id">
      <template #cell-id="{ row }">
        <span class="identifier">{{ row.id }}</span>
      </template>

      <template #cell-total="{ row }">
        <span class="font-semibold text-ink-primary">{{ formatCurrency(row.total) }}</span>
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
          :loading="payingId === row.id"
          @click="payInvoice(row)"
        >
          Tandai Lunas
        </BaseButton>
        <span v-else class="text-sm text-ink-muted">—</span>
      </template>

      <template #empty>
        <div class="px-4">
          <EmptyState
            title="Belum ada tagihan"
            description="Invoice akan muncul di sini setelah periode penagihan pertama berjalan."
          >
            <BaseButton v-if="canManage" size="sm" icon="plus" @click="openModal">
              Buat Invoice
            </BaseButton>
          </EmptyState>
        </div>
      </template>
    </BaseTable>

    <BaseModal
      :open="modalOpen"
      title="Buat Invoice"
      description="Total dihitung otomatis dari sewa + biaya care."
      @close="modalOpen = false"
    >
      <form class="flex flex-col gap-4" @submit.prevent="submitInvoice">
        <BaseInput v-model="form.period" label="Periode" placeholder="mis. Agu 2026" required />
        <BaseInput v-model="form.rent" label="Sewa (Rp)" type="number" :min="0" required />
        <BaseInput v-model="form.careFee" label="Biaya care (Rp)" type="number" :min="0" required />

        <div class="rounded-control bg-surface-alt px-4 py-3">
          <p class="text-xs font-semibold uppercase tracking-wide text-ink-muted">Total</p>
          <p class="mt-1 text-lg font-bold text-ink-primary">{{ formatCurrency(previewTotal) }}</p>
        </div>
      </form>

      <template #footer>
        <BaseButton variant="secondary" @click="modalOpen = false">Batal</BaseButton>
        <BaseButton :loading="saving" :disabled="!canSubmit" @click="submitInvoice">
          Simpan
        </BaseButton>
      </template>
    </BaseModal>
  </BaseCard>
</template>
