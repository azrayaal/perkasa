<script setup lang="ts">
import BaseAvatar from '@/components/ui/BaseAvatar.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import { formatDate } from '@/utils/formatDate'
import type { ResidentListItem } from '@/types'

const props = defineProps<{
  item: ResidentListItem
}>()

const emit = defineEmits<{
  select: [residentId: string]
}>()
</script>

<template>
  <BaseCard
    interactive
    role="button"
    tabindex="0"
    class="focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
    @click="emit('select', props.item.resident.id)"
    @keydown.enter="emit('select', props.item.resident.id)"
  >
    <div class="flex items-start gap-4">
      <BaseAvatar :name="item.resident.name" size="lg" />

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="truncate text-lg font-semibold text-ink-primary">
            {{ item.resident.name }}
          </h3>
          <BaseBadge :status="item.resident.membershipTier" />
        </div>

        <p class="mt-1 text-data text-ink-secondary">
          {{ item.unit ? `${item.unit.unitCode} · ${item.unit.type}` : 'Unit belum ditetapkan' }}
        </p>

        <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <BaseBadge :status="item.resident.status" />
          <span class="text-sm text-ink-muted">
            Bergabung {{ formatDate(item.resident.joinDate) }}
          </span>
        </div>
      </div>
    </div>
  </BaseCard>
</template>
