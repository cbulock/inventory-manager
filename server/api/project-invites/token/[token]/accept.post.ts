import type { Database } from '~/types/database.types'
import { requireInventoryUser } from '~~/server/utils/inventory'
import { loadInviteContextByToken, normalizeInviteEmail } from '~~/server/utils/project-invites'

export default defineEventHandler(async (event) => {
  const user = await requireInventoryUser(event)
  const token = getRouterParam(event, 'token')

  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invite token is required.',
    })
  }

  const { invite, project, supabase } = await loadInviteContextByToken(event, token)

  if (normalizeInviteEmail(user.email ?? '') !== normalizeInviteEmail(invite.email)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'This invite is for a different email address.',
    })
  }

  if (invite.status !== 'pending') {
    throw createError({
      statusCode: 400,
      statusMessage: 'This invite can no longer be accepted.',
    })
  }

  if (new Date(invite.expires_at).getTime() <= Date.now()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'This invite has expired.',
    })
  }

  const membershipPayload: Database['public']['Tables']['project_members']['Insert'] = {
    invited_by: invite.invited_by,
    project_id: invite.project_id,
    role: invite.role,
    user_id: user.id,
  }

  const membershipResult = await supabase
    .from('project_members')
    .upsert(membershipPayload, { onConflict: 'project_id,user_id' })

  if (membershipResult.error) {
    throw createError({
      statusCode: 500,
      statusMessage: membershipResult.error.message,
    })
  }

  const inviteResult = await supabase
    .from('project_invites')
    .update({
      accepted_by: user.id,
      responded_at: new Date().toISOString(),
      status: 'accepted',
    })
    .eq('id', invite.id)

  if (inviteResult.error) {
    throw createError({
      statusCode: 500,
      statusMessage: inviteResult.error.message,
    })
  }

  return {
    projectId: project.id,
    success: true,
  }
})
