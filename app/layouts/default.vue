<script setup lang="ts">
const route = useRoute()
const user = useSupabaseUser()
const { signOut } = useAuthActions()

const isSigningOut = ref(false)
const signOutError = ref<string | null>(null)

const navItems = [
  { label: 'Dashboard', to: '/dashboard' },
]

const userLabel = computed(() => {
  if (!user.value) {
    return 'Signed out'
  }

  return typeof user.value.email === 'string' ? user.value.email : 'Signed in'
})

const handleSignOut = async () => {
  signOutError.value = null
  isSigningOut.value = true

  try {
    await signOut()
  }
  catch (error) {
    signOutError.value = error instanceof Error ? error.message : 'Unable to sign out.'
  }
  finally {
    isSigningOut.value = false
  }
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="app-brand">
        <NuxtLink class="app-brand__title" to="/dashboard">
          Inventory Manager
        </NuxtLink>
        <span class="app-brand__subtitle">
          Shared project-centric inventory for makers
        </span>
      </div>

      <nav class="app-nav" aria-label="Primary navigation">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          class="app-nav__link"
          :class="{ 'app-nav__link--active': route.path === item.to }"
          :to="item.to"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <div class="app-header__actions">
        <div class="user-pill">
          <span>{{ userLabel }}</span>
        </div>

        <cindor-button
          v-if="user"
          :disabled="isSigningOut"
          variant="ghost"
          @click="handleSignOut"
        >
          {{ isSigningOut ? 'Signing out...' : 'Sign out' }}
        </cindor-button>
      </div>
    </header>

    <main class="page-shell page-stack">
      <cindor-alert v-if="signOutError" tone="danger">
        {{ signOutError }}
      </cindor-alert>
      <slot />
    </main>
  </div>
</template>
