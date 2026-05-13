import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '~/types/database.types'
import { requireInventoryUser } from '~~/server/utils/inventory'

export default defineEventHandler(async (event) => {
  const user = await requireInventoryUser(event)
  const inviteId = getRouterParam(event, 'inviteId')

  if (!inviteId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invite id is required.',
    })
  }

  const supabase = serverSupabaseServiceRole<Database>(event)
  const inviteResult = await supabase
    .from('project_invites')
    .select('id, project_id')
    .eq('id', inviteId)
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
      statusMessage: 'Invite not found.',
    })
  }

  const projectResult = await supabase
    .from('projects')
    .select('id')
    .eq('id', inviteResult.data.project_id)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (projectResult.error) {
    throw createError({
      statusCode: 500,
      statusMessage: projectResult.error.message,
    })
  }

  if (!projectResult.data) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only project owners can revoke invites.',
    })
  }

  const { error } = await supabase
    .from('project_invites')
    .update({
      responded_at: new Date().toISOString(),
      status: 'revoked',
    })
    .eq('id', inviteId)

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    })
  }

  return { success: true }
})
