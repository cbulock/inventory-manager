import type { Database } from '~/types/database.types'
import type { ProjectItemAdjustmentInput } from '~/types/inventory'
import { createInventoryClient, requireInventoryUser } from '~~/server/utils/inventory'

export default defineEventHandler(async (event) => {
  await requireInventoryUser(event)
  const itemId = getRouterParam(event, 'itemId')
  const body = await readBody<ProjectItemAdjustmentInput>(event)

  if (!itemId || !Number.isFinite(body?.delta) || body.delta === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid item id and non-zero adjustment delta are required.',
    })
  }

  const supabase = await createInventoryClient(event)
  const { data, error } = await supabase.rpc('adjust_project_item_quantity', {
    adjustment_note: body.note,
    adjustment_reason: body.reason,
    delta_value: body.delta,
    project_item_uuid: itemId,
  } satisfies Database['public']['Functions']['adjust_project_item_quantity']['Args'])

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    })
  }

  return data
})
