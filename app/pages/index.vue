<script setup lang="ts">
const supabase = useSupabaseClient()
const session = useSupabaseSession()
const isSupabaseConfigured = useSupabaseAvailability()

onMounted(async () => {
  if (!isSupabaseConfigured.value) {
    await navigateTo('/dashboard')
    return
  }

  const { data } = await supabase.auth.getSession()

  await navigateTo(session.value ?? data.session ? '/dashboard' : '/login')
})
</script>

<template>
  <div />
</template>
