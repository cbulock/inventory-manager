<script setup lang="ts">
definePageMeta({
  layout: 'auth',
})

const route = useRoute()
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const errorMessage = ref<string | null>(null)

if (user.value) {
  await navigateTo('/dashboard')
}

onMounted(async () => {
  if (typeof route.query.error_description === 'string') {
    errorMessage.value = route.query.error_description
    return
  }

  if (typeof route.query.code === 'string') {
    const { error } = await supabase.auth.exchangeCodeForSession(route.query.code)

    if (error) {
      errorMessage.value = error.message
      return
    }
  }

  const { error } = await supabase.auth.getSession()

  if (error) {
    errorMessage.value = error.message
    return
  }

  if (user.value) {
    await navigateTo('/dashboard')
    return
  }

  errorMessage.value = 'The auth callback did not create a session. Check your Supabase Google provider redirect URLs and try signing in again.'
})
</script>

<template>
  <div class="surface-card">
    <div class="eyebrow">Finishing sign-in</div>
    <h1 class="hero-title">Connecting your account</h1>
    <p class="muted">
      Supabase is finalizing your Google session and preparing the project dashboard.
    </p>

    <cindor-alert v-if="errorMessage" tone="danger">
      {{ errorMessage }}
    </cindor-alert>

    <div v-else class="surface-card surface-card--tight">
      <div class="row-between">
        <strong>Waiting for the auth callback</strong>
        <cindor-spinner />
      </div>
      <NuxtLink class="empty-link" to="/login">
        Back to login
      </NuxtLink>
    </div>
  </div>
</template>
