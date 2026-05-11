<script setup lang="ts">
definePageMeta({
  layout: 'auth',
})

const user = useSupabaseUser()
const runtimeConfig = useRuntimeConfig()
const { signInWithGoogle } = useAuthActions()

const isSigningIn = ref(false)
const authError = ref<string | null>(null)

if (user.value) {
  await navigateTo('/dashboard')
}

const isSupabaseConfigured = computed(() =>
  Boolean(runtimeConfig.public.supabase.url && runtimeConfig.public.supabase.key),
)

const handleSignIn = async () => {
  authError.value = null
  isSigningIn.value = true

  try {
    await signInWithGoogle()
  }
  catch (error) {
    authError.value = error instanceof Error ? error.message : 'Unable to start Google sign-in.'
    isSigningIn.value = false
  }
}
</script>

<template>
  <div class="surface-card">
    <div class="eyebrow">Inventory Manager</div>
    <h1 class="hero-title">Shared inventory for projects and makers</h1>
    <p class="muted">
      Sign in with Google to manage project-specific supply counts, low-stock thresholds,
      shared tags, and suggested items by project type.
    </p>

    <cindor-alert v-if="!isSupabaseConfigured" tone="warning">
      Supabase environment variables are not configured yet. Add the values from
      <span class="mono">.env.example</span> before testing login.
    </cindor-alert>

    <cindor-alert v-if="authError" tone="danger">
      {{ authError }}
    </cindor-alert>

    <div class="surface-card surface-card--tight">
      <div class="stack-list">
        <div class="row-between">
          <strong>Google auth through Supabase</strong>
          <cindor-badge tone="accent">Open sign-up</cindor-badge>
        </div>
        <span class="muted">
          Any Google user can sign in and create private projects, then invite collaborators later.
        </span>
      </div>

      <div class="button-row">
        <cindor-button
          :disabled="!isSupabaseConfigured || isSigningIn"
          @click="handleSignIn"
        >
          {{ isSigningIn ? 'Redirecting...' : 'Continue with Google' }}
        </cindor-button>
      </div>
    </div>
  </div>
</template>
