export function useSupabaseAvailability() {
  const runtimeConfig = useRuntimeConfig()

  return computed(() => runtimeConfig.public.hasPublicSupabaseConfig)
}
