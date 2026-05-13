<script setup lang="ts">
import { CindorCard } from 'cindor-ui-vue'
</script>

<template>
  <div class="auth-shell">
    <CindorCard class="auth-card">
      <slot />
    </CindorCard>
  </div>
</template>
