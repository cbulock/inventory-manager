export function useAuthActions() {
  const supabase = useSupabaseClient()
  const runtimeConfig = useRuntimeConfig()

  const getRedirectUrl = () => {
    if (process.client) {
      return new URL('/confirm', window.location.origin).toString()
    }

    return new URL('/confirm', runtimeConfig.public.siteUrl).toString()
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getRedirectUrl(),
      },
    })

    if (error) {
      throw error
    }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()

    if (error) {
      throw error
    }

    await navigateTo('/login')
  }

  return {
    signInWithGoogle,
    signOut,
  }
}
