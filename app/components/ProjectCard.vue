<script setup lang="ts">
import type { ProjectPreview } from '~/types/inventory'

defineProps<{
  project: ProjectPreview
}>()
</script>

<template>
  <NuxtLink :to="`/projects/${project.id}`">
    <div class="surface-card surface-card--tight">
      <div class="row-between">
        <div>
          <div class="eyebrow">{{ project.typeLabel }}</div>
          <h3 class="section-title">{{ project.name }}</h3>
        </div>

        <cindor-badge :tone="project.lowStockCount > 0 ? 'accent' : 'success'">
          {{ project.lowStockCount }} low stock
        </cindor-badge>
      </div>

      <p class="muted">
        {{ project.summary }}
      </p>

      <div v-if="project.tags.length > 0" class="tag-list">
        <cindor-chip
          v-for="tag in project.tags"
          :key="tag"
          tone="neutral"
        >
          {{ tag }}
        </cindor-chip>
      </div>

      <div class="project-card__footer">
        <span>{{ project.itemCount }} items</span>
        <span>{{ project.memberCount }} collaborators</span>
        <span>{{ project.lastUpdated }}</span>
      </div>
    </div>
  </NuxtLink>
</template>
