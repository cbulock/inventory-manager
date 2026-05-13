<script setup lang="ts">
import { cindorCobaltTheme } from 'cindor-ui-core'

const isAuthCheckPending = useState('auth-is-checking', () => false)
</script>

<template>
  <cindor-provider theme="dark" v-bind="cindorCobaltTheme">
    <NuxtLoadingIndicator :color="cindorCobaltTheme.primaryColor" />
    <NuxtRouteAnnouncer />
    <div v-if="isAuthCheckPending" class="auth-loading-overlay" role="status" aria-live="polite">
      <div class="auth-loading-card">
        <cindor-spinner />
        <strong>Checking your session...</strong>
      </div>
    </div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </cindor-provider>
</template>
