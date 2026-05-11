import type { ProjectItemPhotoDeleteInput } from '~/types/inventory'
import { createInventoryClient, requireInventoryUser } from '~~/server/utils/inventory'

export default defineEventHandler(async (event) => {
  await requireInventoryUser(event)
  const itemId = getRouterParam(event, 'itemId')
  const body = await readBody<ProjectItemPhotoDeleteInput>(event)

  if (!itemId || !body?.storagePath) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Item id and storage path are required.',
    })
  }

  const supabase = createInventoryClient(event)
  const { error: deleteMetadataError } = await supabase
    .from('item_photos')
    .delete()
    .eq('project_item_id', itemId)

  if (deleteMetadataError) {
    throw createError({
      statusCode: 500,
      statusMessage: deleteMetadataError.message,
    })
  }

  const { error: deleteObjectError } = await supabase
    .storage
    .from('item-photos')
    .remove([body.storagePath])

  if (deleteObjectError) {
    throw createError({
      statusCode: 500,
      statusMessage: deleteObjectError.message,
    })
  }

  return { success: true }
})
