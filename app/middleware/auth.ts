export default defineNuxtRouteMiddleware(async (to) => {
  const isSupabaseConfigured = useSupabaseAvailability()
  const supabase = useSupabaseClient()
  const session = useSupabaseSession()
  const user = useSupabaseUser()
  const isAuthCheckPending = useState('auth-is-checking', () => false)

  if (!isSupabaseConfigured.value) {
    return
  }

  if (user.value || session.value) {
    return
  }

  isAuthCheckPending.value = true

  try {
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Unable to verify your sign-in status.',
      })
    }

    if (!data.session) {
      return navigateTo({
        path: '/login',
        query: {
          redirect: to.fullPath,
        },
      })
    }
  }
  finally {
    isAuthCheckPending.value = false
  }
})
