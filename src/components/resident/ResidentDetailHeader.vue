<script setup lang="ts">
import BaseAvatar from '@/components/ui/BaseAvatar.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import { formatDate } from '@/utils/formatDate'
import type { Resident, Unit } from '@/types'

defineProps<{
  resident: Resident
  unit: Unit | null
  /** Family Portal menyembunyikan metadata internal seperti ID resident. */
  isFamilyView?: boolean
}>()
</script>

<template>
  <header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div class="flex items-center gap-4">
      <BaseAvatar :name="resident.name" size="lg" />

      <div>
        <h1 class="text-h2 text-ink-primary sm:text-h1">
          {{ resident.name }}
        </h1>
        <p class="mt-1 text-data text-ink-secondary">
          {{ unit ? `${unit.unitCode} · ${unit.type} · Lantai ${unit.floor}` : 'Unit belum ditetapkan' }}
          <template v-if="!isFamilyView">
            · <span class="identifier">{{ resident.id }}</span>
          </template>
        </p>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <BaseBadge :status="resident.membershipTier" />
      <BaseBadge :status="resident.status" />
      <span v-if="!isFamilyView" class="text-sm text-ink-muted">
        Bergabung {{ formatDate(resident.joinDate) }}
      </span>
      <slot name="actions" />
    </div>
  </header>
</template>
