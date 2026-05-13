export function useAuthActions() {
  const isSupabaseConfigured = useSupabaseAvailability()
  const supabase = useSupabaseClient()
  const runtimeConfig = useRuntimeConfig()

  const normalizeAuthRedirectPath = (redirectPath: unknown, fallback = '/dashboard') => {
    if (typeof redirectPath !== 'string') {
      return fallback
    }

    const trimmedPath = redirectPath.trim()

    if (!trimmedPath.startsWith('/') || trimmedPath.startsWith('//')) {
      return fallback
    }

    try {
      const parsedPath = new URL(trimmedPath, 'http://inventory-manager.local')
      return `${parsedPath.pathname}${parsedPath.search}${parsedPath.hash}` || fallback
    }
    catch {
      return fallback
    }
  }

  const getRedirectUrl = (redirectPath?: string) => {
    const normalizedRedirectPath = normalizeAuthRedirectPath(redirectPath)

    if (process.client) {
      const redirectUrl = new URL('/confirm', window.location.origin)
      redirectUrl.searchParams.set('redirect', normalizedRedirectPath)
      return redirectUrl.toString()
    }

    const redirectUrl = new URL('/confirm', runtimeConfig.public.siteUrl)
    redirectUrl.searchParams.set('redirect', normalizedRedirectPath)
    return redirectUrl.toString()
  }

  const signInWithGoogle = async (redirectPath?: string) => {
    if (!isSupabaseConfigured.value) {
      throw new Error('Supabase environment variables are not configured yet. Add the values from .env.example before testing sign-in.')
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getRedirectUrl(redirectPath),
      },
    })

    if (error) {
      throw error
    }
  }

  const signOut = async () => {
    if (!isSupabaseConfigured.value) {
      await navigateTo('/login')
      return
    }

    const { error } = await supabase.auth.signOut()

    if (error) {
      throw error
    }

    await navigateTo('/login')
  }

  return {
    normalizeAuthRedirectPath,
    signInWithGoogle,
    signOut,
  }
}
