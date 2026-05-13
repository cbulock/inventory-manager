<script setup lang="ts">
import {
  CindorCard,
  CindorDescriptionItem,
  CindorDescriptionList,
  CindorPageHeader,
} from 'cindor-ui-vue'
import type { LowStockItemPreview } from '~/types/inventory'

defineProps<{
  items: LowStockItemPreview[]
}>()
</script>

<template>
  <div class="low-stock-list">
    <NuxtLink
      v-for="item in items"
      :key="item.id"
      :to="`/projects/${item.projectId}`"
    >
      <CindorCard>
        <CindorPageHeader
          :description="`${item.projectName} · threshold ${item.threshold} · ${item.location}`"
          :title="item.name"
        >
          <cindor-badge slot="meta" tone="accent">
            {{ item.quantity }} {{ item.unit }} left
          </cindor-badge>
        </CindorPageHeader>

        <CindorDescriptionList>
          <CindorDescriptionItem>
            <span slot="term">Project</span>
            {{ item.projectName }}
          </CindorDescriptionItem>
          <CindorDescriptionItem>
            <span slot="term">Threshold</span>
            {{ item.threshold }}
          </CindorDescriptionItem>
          <CindorDescriptionItem>
            <span slot="term">Location</span>
            {{ item.location }}
          </CindorDescriptionItem>
        </CindorDescriptionList>

        <div v-if="item.tags.length > 0" class="tag-list">
          <cindor-chip
            v-for="tag in item.tags"
            :key="tag"
            tone="neutral"
          >
            {{ tag }}
          </cindor-chip>
        </div>
      </CindorCard>
    </NuxtLink>
  </div>
</template>
