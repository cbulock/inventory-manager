import { serverSupabaseServiceRole } from '#supabase/server'
import type { H3Event } from 'h3'
import type { Database } from '~/types/database.types'

export const normalizeInviteEmail = (value: string) => value.trim().toLowerCase()

export function assertInviteRole(
  value: unknown,
): asserts value is Exclude<Database['public']['Enums']['project_member_role'], 'owner'> {
  if (value !== 'editor' && value !== 'viewer') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invite role must be editor or viewer.',
    })
  }
}

export function assertInviteEmail(value: unknown) {
  if (typeof value !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invite email is required.',
    })
  }

  const normalizedEmail = normalizeInviteEmail(value)

  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Enter a valid invite email address.',
    })
  }

  return normalizedEmail
}

export function createInviteUrl(token: string) {
  const runtimeConfig = useRuntimeConfig()
  return new URL(`/invites/${token}`, runtimeConfig.public.siteUrl).toString()
}

export async function loadInviteContextByToken(event: H3Event, token: string) {
  const supabase = serverSupabaseServiceRole<Database>(event)
  const inviteResult = await supabase
    .from('project_invites')
    .select('id, project_id, email, role, status, token, expires_at, invited_by, accepted_by, created_at, responded_at')
    .eq('token', token)
    .maybeSingle()

  if (inviteResult.error) {
    throw createError({
      statusCode: 500,
      statusMessage: inviteResult.error.message,
    })
  }

  if (!inviteResult.data) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Project invite not found.',
    })
  }

  const [projectResult, inviterResult] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, description, project_type_id')
      .eq('id', inviteResult.data.project_id)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', inviteResult.data.invited_by)
      .maybeSingle(),
  ])

  if (projectResult.error) {
    throw createError({
      statusCode: 500,
      statusMessage: projectResult.error.message,
    })
  }

  if (!projectResult.data) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Project invite not found.',
    })
  }

  if (inviterResult.error) {
    throw createError({
      statusCode: 500,
      statusMessage: inviterResult.error.message,
    })
  }

  const projectTypeResult = projectResult.data.project_type_id
    ? await supabase
        .from('project_types')
        .select('label')
        .eq('id', projectResult.data.project_type_id)
        .maybeSingle()
    : { data: null, error: null }

  if (projectTypeResult.error) {
    throw createError({
      statusCode: 500,
      statusMessage: projectTypeResult.error.message,
    })
  }

  return {
    invite: inviteResult.data,
    inviter: inviterResult.data,
    project: {
      ...projectResult.data,
      typeLabel: projectTypeResult.data?.label ?? 'Crafting',
    },
    supabase,
  }
}
