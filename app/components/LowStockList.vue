<script setup lang="ts">
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
      class="low-stock-item"
      :to="`/projects/${item.projectId}`"
    >
      <div class="row-between">
        <strong>{{ item.name }}</strong>
        <cindor-badge tone="accent">
          {{ item.quantity }} {{ item.unit }} left
        </cindor-badge>
      </div>

      <div class="muted">
        {{ item.projectName }} · threshold {{ item.threshold }} · {{ item.location }}
      </div>

      <div v-if="item.tags.length > 0" class="tag-list">
        <cindor-chip
          v-for="tag in item.tags"
          :key="tag"
          tone="neutral"
        >
          {{ tag }}
        </cindor-chip>
      </div>
    </NuxtLink>
  </div>
</template>
