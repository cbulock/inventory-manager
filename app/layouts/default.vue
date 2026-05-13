<script setup lang="ts">
import {
  CindorChip,
  CindorLayout,
  CindorLayoutContent,
  CindorLayoutHeader,
} from 'cindor-ui-vue'

const { signOut } = useAuthActions()
const user = useSupabaseUser()
const { avatarUrl, headerLabel, initials } = useCurrentUserProfile()

const isSigningOut = ref(false)
const signOutError = ref<string | null>(null)

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
  <CindorLayout class="app-shell">
    <CindorLayoutHeader class="app-header">
      <div class="app-header__inner">
        <div class="app-brand">
          <NuxtLink class="app-brand__title" to="/dashboard">
            Inventory Manager
          </NuxtLink>
        </div>

        <div class="app-header__actions">
          <CindorChip tone="neutral">
            <span class="user-chip">
              <img
                v-if="avatarUrl"
                :src="avatarUrl"
                alt=""
                class="user-avatar"
                referrerpolicy="no-referrer"
              >
              <span v-else class="user-avatar user-avatar--fallback" aria-hidden="true">
                {{ initials }}
              </span>
              <span class="user-chip__label">{{ headerLabel }}</span>
            </span>
          </CindorChip>

          <cindor-button
            v-if="user"
            :disabled="isSigningOut"
            variant="ghost"
            @click="handleSignOut"
          >
            {{ isSigningOut ? 'Signing out...' : 'Sign out' }}
          </cindor-button>
        </div>
      </div>
    </CindorLayoutHeader>

    <CindorLayoutContent class="page-shell page-stack">
      <cindor-alert v-if="signOutError" tone="danger">
        {{ signOutError }}
      </cindor-alert>
      <slot />
    </CindorLayoutContent>
  </CindorLayout>
</template>
