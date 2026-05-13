<script setup lang="ts">
import {
  CindorCard,
  CindorDescriptionItem,
  CindorDescriptionList,
  CindorPageHeader,
} from 'cindor-ui-vue'
import type { ProjectPreview } from '~/types/inventory'

defineProps<{
  project: ProjectPreview
}>()
</script>

<template>
  <NuxtLink :to="`/projects/${project.id}`">
    <CindorCard>
      <CindorPageHeader
        :description="project.summary"
        :eyebrow="project.typeLabel"
        :title="project.name"
      >
        <cindor-badge slot="meta" :tone="project.lowStockCount > 0 ? 'accent' : 'success'">
          {{ project.lowStockCount }} low stock
        </cindor-badge>
      </CindorPageHeader>

      <div v-if="project.tags.length > 0" class="tag-list">
        <cindor-chip
          v-for="tag in project.tags"
          :key="tag"
          tone="neutral"
        >
          {{ tag }}
        </cindor-chip>
      </div>

      <CindorDescriptionList>
        <CindorDescriptionItem>
          <span slot="term">Items</span>
          {{ project.itemCount }}
        </CindorDescriptionItem>
        <CindorDescriptionItem>
          <span slot="term">Collaborators</span>
          {{ project.memberCount }}
        </CindorDescriptionItem>
        <CindorDescriptionItem>
          <span slot="term">Updated</span>
          {{ project.lastUpdated }}
        </CindorDescriptionItem>
      </CindorDescriptionList>
    </CindorCard>
  </NuxtLink>
</template>
