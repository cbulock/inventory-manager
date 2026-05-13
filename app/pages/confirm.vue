<script setup lang="ts">
import {
  CindorCard,
  CindorPageHeader,
} from 'cindor-ui-vue'

definePageMeta({
  layout: 'auth',
})

const route = useRoute()
const supabase = useSupabaseClient()
const session = useSupabaseSession()
const user = useSupabaseUser()
const { normalizeAuthRedirectPath } = useAuthActions()
const isSupabaseConfigured = useSupabaseAvailability()
const errorMessage = ref<string | null>(null)
const isFinalizingSignIn = ref(true)
const redirectPath = computed(() => normalizeAuthRedirectPath(route.query.redirect))

const navigateToDashboard = async () => {
  await navigateTo(redirectPath.value)
}

if (user.value || session.value) {
  isFinalizingSignIn.value = false
  await navigateTo(redirectPath.value)
}

watch([user, session], async ([nextUser, nextSession]) => {
  if (nextUser || nextSession) {
    isFinalizingSignIn.value = false
    await navigateToDashboard()
  }
})

onMounted(async () => {
  if (!isSupabaseConfigured.value) {
    isFinalizingSignIn.value = false
    errorMessage.value = 'Supabase environment variables are not configured yet. Add the values from .env.example before testing sign-in.'
    return
  }

  if (typeof route.query.error_description === 'string') {
    isFinalizingSignIn.value = false
    errorMessage.value = route.query.error_description
    return
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      isFinalizingSignIn.value = false
      errorMessage.value = error.message
      return
    }

    if (user.value || data.session) {
      isFinalizingSignIn.value = false
      await navigateToDashboard()
      return
    }

    await new Promise(resolve => setTimeout(resolve, 250))
  }

  isFinalizingSignIn.value = false
  errorMessage.value = 'The auth callback did not create a session. Check your Supabase Google provider redirect URLs and try signing in again.'
})
</script>

<template>
  <div class="page-stack">
    <CindorPageHeader
      description="Supabase is finalizing your Google session and returning you to the app."
      eyebrow="Finishing sign-in"
      title="Connecting your account"
    />

    <cindor-alert v-if="errorMessage" tone="danger">
      {{ errorMessage }}
    </cindor-alert>

    <CindorCard v-else-if="isFinalizingSignIn">
      <div class="row-between">
        <strong>Waiting for the auth callback</strong>
        <cindor-spinner />
      </div>
      <NuxtLink class="empty-link" to="/login">
        Back to login
      </NuxtLink>
    </CindorCard>
  </div>
</template>
