import type { Database } from '~/types/database.types'
import { createInventoryClient, requireInventoryUser } from '~~/server/utils/inventory'

const itemPhotoBucketName = 'item-photos'
const itemPhotoMaxBytes = 5 * 1024 * 1024
const allowedItemPhotoMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

function buildItemPhotoStoragePath(projectId: string, itemId: string) {
  return `${projectId}/${itemId}/photo`
}

export default defineEventHandler(async (event) => {
  const user = await requireInventoryUser(event)
  const itemId = getRouterParam(event, 'itemId')
  const formData = await readFormData(event)
  const file = formData.get('file')
  const projectId = formData.get('projectId')
  const existingStoragePath = formData.get('existingStoragePath')

  if (!itemId || typeof projectId !== 'string' || !(file instanceof File)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Project id, item id, and image file are required.',
    })
  }

  if (!allowedItemPhotoMimeTypes.has(file.type)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Item photos must be a JPEG, PNG, or WebP image.',
    })
  }

  if (file.size <= 0 || file.size > itemPhotoMaxBytes) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Item photos must be between 1 byte and 5 MB.',
    })
  }

  const storagePath = buildItemPhotoStoragePath(projectId, itemId)
  const supabase = await createInventoryClient(event)
  const { error: uploadError } = await supabase
    .storage
    .from(itemPhotoBucketName)
    .upload(storagePath, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    throw createError({
      statusCode: 500,
      statusMessage: uploadError.message,
    })
  }

  try {
    if (typeof existingStoragePath === 'string' && existingStoragePath) {
      const { error } = await supabase
        .from('item_photos')
        .update({
          file_size_bytes: file.size,
          mime_type: file.type,
          storage_path: storagePath,
        })
        .eq('project_item_id', itemId)

      if (error) {
        throw error
      }
    }
    else {
      const { error } = await supabase
        .from('item_photos')
        .insert({
          created_by: user.id,
          file_size_bytes: file.size,
          mime_type: file.type,
          project_item_id: itemId,
          storage_path: storagePath,
        } satisfies Database['public']['Tables']['item_photos']['Insert'])

      if (error) {
        throw error
      }
    }
  }
  catch (photoError) {
    if (!(typeof existingStoragePath === 'string' && existingStoragePath)) {
      await supabase.storage.from(itemPhotoBucketName).remove([storagePath])
    }

    throw createError({
      statusCode: 500,
      statusMessage: photoError instanceof Error ? photoError.message : 'Unable to save the item photo.',
    })
  }

  return { storagePath, success: true }
})
