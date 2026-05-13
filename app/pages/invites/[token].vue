<script setup lang="ts">
import {
  CindorCard,
  CindorPageHeader,
} from 'cindor-ui-vue'

definePageMeta({
  middleware: 'auth',
})

const route = useRoute()
const {
  acceptProjectInvite,
  declineProjectInvite,
  loadProjectInvite,
} = useInventoryData()

const inviteToken = computed(() => String(route.params.token))

const { data, error, pending } = await useAsyncData(
  () => `invite:${inviteToken.value}`,
  () => loadProjectInvite(inviteToken.value),
  {
    watch: [inviteToken],
  },
)

if (error.value) {
  throw error.value
}

const invite = computed(() => data.value!)
const isAccepting = ref(false)
const isDeclining = ref(false)
const actionError = ref<string | null>(null)

const handleAccept = async () => {
  actionError.value = null
  isAccepting.value = true

  try {
    const result = await acceptProjectInvite(inviteToken.value)
    await navigateTo(`/projects/${result.projectId}`)
  }
  catch (inviteError) {
    actionError.value = inviteError instanceof Error ? inviteError.message : 'Unable to accept the invite.'
  }
  finally {
    isAccepting.value = false
  }
}

const handleDecline = async () => {
  actionError.value = null
  isDeclining.value = true

  try {
    await declineProjectInvite(inviteToken.value)
    await navigateTo('/dashboard')
  }
  catch (inviteError) {
    actionError.value = inviteError instanceof Error ? inviteError.message : 'Unable to decline the invite.'
  }
  finally {
    isDeclining.value = false
  }
}
</script>

<template>
  <div class="auth-shell">
    <CindorCard class="auth-card">
      <div class="page-stack">
        <CindorPageHeader
          :description="pending ? 'Loading your project invitation…' : invite.projectSummary"
          eyebrow="Project invite"
          :title="pending ? 'Checking invite' : `Join ${invite.projectName}`"
        />

        <cindor-alert v-if="actionError" tone="danger">
          {{ actionError }}
        </cindor-alert>

        <template v-if="!pending">
          <CindorPageHeader
            :description="`Invited by ${invite.inviterName} (${invite.inviterEmail})`"
            :title="`${invite.role === 'editor' ? 'Editor' : 'Viewer'} access`"
          >
            <cindor-badge slot="meta" tone="neutral">
              {{ invite.projectTypeLabel }}
            </cindor-badge>
          </CindorPageHeader>

          <div class="page-stack">
            <span class="helper-text">Sent {{ invite.invitedAtLabel }}</span>
            <span class="helper-text">Expires {{ invite.expiresAtLabel }}</span>
            <span class="helper-text">Invite email: {{ invite.email }}</span>
          </div>

          <div v-if="invite.status === 'pending'" class="button-row">
            <cindor-button
              :disabled="isAccepting || isDeclining"
              @click="handleAccept"
            >
              {{ isAccepting ? 'Accepting…' : 'Accept invite' }}
            </cindor-button>
            <cindor-button
              :disabled="isAccepting || isDeclining"
              variant="ghost"
              @click="handleDecline"
            >
              {{ isDeclining ? 'Declining…' : 'Decline invite' }}
            </cindor-button>
          </div>

          <cindor-alert v-else tone="info">
            This invite is {{ invite.status }}.
          </cindor-alert>
        </template>
      </div>
    </CindorCard>
  </div>
</template>
