<script setup lang="ts">
import type { NuxtError } from '#app'
import {
  CindorCard,
  CindorDescriptionItem,
  CindorDescriptionList,
  CindorPageHeader,
} from 'cindor-ui-vue'

const props = defineProps<{
  error: NuxtError
}>()

const route = useRoute()
const user = useSupabaseUser()

const statusCode = computed(() => props.error.statusCode ?? 500)
const statusLabel = computed(() => String(statusCode.value))
const title = computed(() => {
  if (statusCode.value === 401) {
    return 'Sign in required'
  }

  if (statusCode.value === 404) {
    return 'Page not found'
  }

  return 'Something went wrong'
})
const description = computed(() => {
  if (statusCode.value === 401) {
    return 'You need to sign in before accessing that part of the inventory app.'
  }

  if (statusCode.value === 404) {
    return 'The page or project you asked for could not be found.'
  }

  return 'The app hit an unexpected problem. You can head back to a safe page and keep working.'
})
const detailMessage = computed(() =>
  props.error.statusMessage
  || props.error.message
  || 'An unexpected error occurred.',
)
const primaryDestination = computed(() => {
  if (statusCode.value === 401) {
    return '/login'
  }

  return user.value ? '/dashboard' : '/login'
})
const primaryLabel = computed(() => {
  if (statusCode.value === 401) {
    return 'Go to login'
  }

  return user.value ? 'Back to dashboard' : 'Go to login'
})

const handlePrimaryAction = async () => {
  await clearError({
    redirect: statusCode.value === 401
      ? {
          path: '/login',
          query: {
            redirect: route.fullPath,
          },
        }
      : primaryDestination.value,
  })
}

const handleRetry = async () => {
  await clearError({
    redirect: route.fullPath,
  })
}
</script>

<template>
  <div class="auth-shell">
    <CindorCard class="auth-card">
      <div class="page-stack">
        <CindorPageHeader
          eyebrow="Inventory Manager"
          :description="description"
          :title="title"
        />

        <cindor-alert tone="danger">
          {{ detailMessage }}
        </cindor-alert>

        <CindorDescriptionList>
          <CindorDescriptionItem>
            <span slot="term">Status</span>
            {{ statusLabel }}
          </CindorDescriptionItem>
          <CindorDescriptionItem>
            <span slot="term">Next step</span>
            {{ primaryLabel }}
          </CindorDescriptionItem>
        </CindorDescriptionList>

        <div class="button-row">
          <cindor-button @click="handlePrimaryAction">
            {{ primaryLabel }}
          </cindor-button>
          <cindor-button
            v-if="statusCode !== 401"
            variant="ghost"
            @click="handleRetry"
          >
            Try again
          </cindor-button>
        </div>
      </div>
    </CindorCard>
  </div>
</template>
