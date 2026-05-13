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
const { normalizeAuthRedirectPath, signInWithGoogle } = useAuthActions()
const isSupabaseConfigured = useSupabaseAvailability()

const isSigningIn = ref(false)
const isCheckingSession = ref(typeof route.query.redirect === 'string')
const authError = ref<string | null>(null)
const redirectPath = computed(() => normalizeAuthRedirectPath(route.query.redirect))
const shouldShowSessionCheck = computed(() => isCheckingSession.value && !authError.value)

onMounted(async () => {
  if (!isSupabaseConfigured.value) {
    isCheckingSession.value = false
    return
  }

  const { data, error } = await supabase.auth.getSession()

  if (error) {
    authError.value = error.message
    isCheckingSession.value = false
    return
  }

  if (session.value ?? data.session ?? user.value) {
    await navigateTo(redirectPath.value)
    return
  }

  isCheckingSession.value = false
})

const handleSignIn = async () => {
  authError.value = null
  isSigningIn.value = true

  try {
    await signInWithGoogle(redirectPath.value)
  }
  catch (error) {
    authError.value = error instanceof Error ? error.message : 'Unable to start Google sign-in.'
    isSigningIn.value = false
  }
}
</script>

<template>
  <div class="page-stack">
    <CindorPageHeader
      :description="shouldShowSessionCheck ? 'Checking your saved session before showing sign-in.' : 'Sign in to continue to the inventory app.'"
      eyebrow="Inventory Manager"
      :title="shouldShowSessionCheck ? 'Checking your session' : 'Sign in'"
    />

    <cindor-alert v-if="!isSupabaseConfigured" tone="warning">
      Supabase environment variables are not configured yet. Add the values from
      <span class="mono">.env.example</span> before testing login.
    </cindor-alert>

    <cindor-alert v-if="authError" tone="danger">
      {{ authError }}
    </cindor-alert>

    <CindorCard v-if="shouldShowSessionCheck">
      <div class="session-check">
        <div class="row-between">
          <strong>Checking your session…</strong>
          <cindor-spinner />
        </div>
        <span class="helper-text">If you're already signed in, you'll be returned to the page you requested.</span>
      </div>
    </CindorCard>

    <CindorCard v-else>
      <div class="button-row">
        <cindor-button
          :disabled="!isSupabaseConfigured || isSigningIn"
          @click="handleSignIn"
        >
          {{ isSigningIn ? 'Redirecting…' : 'Continue with Google' }}
        </cindor-button>
      </div>
    </CindorCard>
  </div>
</template>
