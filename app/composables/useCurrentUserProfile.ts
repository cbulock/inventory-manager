const readUserMetadataString = (metadata: unknown, key: string) => {
  if (!metadata || typeof metadata !== 'object') {
    return null
  }

  const value = (metadata as Record<string, unknown>)[key]

  if (typeof value !== 'string') {
    return null
  }

  const trimmedValue = value.trim()

  return trimmedValue.length > 0 ? trimmedValue : null
}

const getInitials = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')

export function useCurrentUserProfile() {
  const user = useSupabaseUser()

  const email = computed(() => {
    if (!user.value || typeof user.value.email !== 'string') {
      return null
    }

    const trimmedEmail = user.value.email.trim()
    return trimmedEmail.length > 0 ? trimmedEmail : null
  })

  const fullName = computed(() =>
    readUserMetadataString(user.value?.user_metadata, 'full_name')
    ?? readUserMetadataString(user.value?.user_metadata, 'name'),
  )

  const givenName = computed(() =>
    readUserMetadataString(user.value?.user_metadata, 'given_name')
    ?? fullName.value?.split(/\s+/)[0]
    ?? null,
  )

  const avatarUrl = computed(() =>
    readUserMetadataString(user.value?.user_metadata, 'avatar_url')
    ?? readUserMetadataString(user.value?.user_metadata, 'picture'),
  )

  const displayName = computed(() => fullName.value ?? givenName.value ?? email.value ?? 'maker')
  const headerLabel = computed(() => email.value ?? displayName.value ?? 'Signed in')
  const initials = computed(() => {
    const source = fullName.value ?? givenName.value ?? email.value ?? 'maker'

    if (source.includes('@')) {
      return source.slice(0, 1).toUpperCase()
    }

    return getInitials(source) || 'M'
  })

  return {
    avatarUrl,
    displayName,
    email,
    fullName,
    givenName,
    headerLabel,
    initials,
  }
}
