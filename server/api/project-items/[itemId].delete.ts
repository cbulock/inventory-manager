import { createInventoryClient, requireInventoryUser } from '~~/server/utils/inventory'

export default defineEventHandler(async (event) => {
  await requireInventoryUser(event)
  const itemId = getRouterParam(event, 'itemId')

  if (!itemId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Item id is required.',
    })
  }

  const supabase = await createInventoryClient(event)
  const { error } = await supabase
    .from('project_items')
    .delete()
    .eq('id', itemId)

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    })
  }

  return { success: true }
})
