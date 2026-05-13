import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '~/types/database.types'
import type { ProjectInviteCreateInput } from '~/types/inventory'
import { sendProjectInviteEmail } from '~~/server/utils/email'
import { requireInventoryUser } from '~~/server/utils/inventory'
import { assertInviteEmail, assertInviteRole, createInviteUrl, normalizeInviteEmail } from '~~/server/utils/project-invites'

export default defineEventHandler(async (event) => {
  const user = await requireInventoryUser(event)
  const projectId = getRouterParam(event, 'id')
  const body = await readBody<ProjectInviteCreateInput>(event)

  if (!projectId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Project id is required.',
    })
  }

  const email = assertInviteEmail(body?.email)
  assertInviteRole(body?.role)

  if (normalizeInviteEmail(user.email ?? '') === email) {
    throw createError({
      statusCode: 400,
      statusMessage: 'You are already on this project.',
    })
  }

  const supabase = serverSupabaseServiceRole<Database>(event)
  const [projectResult, inviterProfileResult, matchingProfileResult] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, owner_id')
      .eq('id', projectId)
      .eq('owner_id', user.id)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('id, email')
      .eq('email', email)
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
      statusCode: 403,
      statusMessage: 'Only project owners can invite users.',
    })
  }

  if (inviterProfileResult.error) {
    throw createError({
      statusCode: 500,
      statusMessage: inviterProfileResult.error.message,
    })
  }

  if (matchingProfileResult.error) {
    throw createError({
      statusCode: 500,
      statusMessage: matchingProfileResult.error.message,
    })
  }

  if (matchingProfileResult.data) {
    const membershipResult = await supabase
      .from('project_members')
      .select('project_id')
      .eq('project_id', projectId)
      .eq('user_id', matchingProfileResult.data.id)
      .maybeSingle()

    if (membershipResult.error) {
      throw createError({
        statusCode: 500,
        statusMessage: membershipResult.error.message,
      })
    }

    if (membershipResult.data) {
      throw createError({
        statusCode: 409,
        statusMessage: 'That user is already a project member.',
      })
    }
  }

  const inviteResult = await supabase
    .from('project_invites')
    .insert({
      email,
      invited_by: user.id,
      project_id: projectId,
      role: body.role,
    } satisfies Database['public']['Tables']['project_invites']['Insert'])
    .select('id, token')
    .single()

  if (inviteResult.error) {
    throw createError({
      statusCode: inviteResult.error.code === '23505' ? 409 : 500,
      statusMessage: inviteResult.error.code === '23505'
        ? 'A pending invite already exists for that email address.'
        : inviteResult.error.message,
    })
  }

  try {
    await sendProjectInviteEmail({
      inviteUrl: createInviteUrl(inviteResult.data.token),
      inviterEmail: inviterProfileResult.data?.email ?? user.email ?? '',
      inviterName: inviterProfileResult.data?.full_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? 'Project owner',
      projectName: projectResult.data.name,
      recipientEmail: email,
      role: body.role,
    })
  }
  catch (error) {
    await supabase
      .from('project_invites')
      .delete()
      .eq('id', inviteResult.data.id)

    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Unable to send the invitation email.',
    })
  }

  return {
    id: inviteResult.data.id,
    success: true,
  }
})
