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

  const { invite, supabase } = await loadInviteContextByToken(event, token)

  if (normalizeInviteEmail(user.email ?? '') !== normalizeInviteEmail(invite.email)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'This invite is for a different email address.',
    })
  }

  if (invite.status !== 'pending') {
    throw createError({
      statusCode: 400,
      statusMessage: 'This invite can no longer be declined.',
    })
  }

  const { error } = await supabase
    .from('project_invites')
    .update({
      responded_at: new Date().toISOString(),
      status: 'declined',
    })
    .eq('id', invite.id)

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    })
  }

  return { success: true }
})
