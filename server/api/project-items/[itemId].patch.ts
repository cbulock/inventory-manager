import type { Database } from '~/types/database.types'
import type { ProjectItemUpdateInput } from '~/types/inventory'
import { createInventoryClient, requireInventoryUser } from '~~/server/utils/inventory'

function assertNonNegativeNumber(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `${label} must be a non-negative number.`,
    })
  }
}

export default defineEventHandler(async (event) => {
  await requireInventoryUser(event)
  const itemId = getRouterParam(event, 'itemId')
  const body = await readBody<ProjectItemUpdateInput>(event)

  if (!itemId || !body?.name?.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Item id and item name are required.',
    })
  }

  assertNonNegativeNumber(body.quantity, 'Quantity')
  assertNonNegativeNumber(body.lowStockThreshold, 'Low-stock threshold')

  if (body.cost !== null) {
    assertNonNegativeNumber(body.cost, 'Cost')
  }

  const supabase = createInventoryClient(event)
  const { data, error } = await supabase.rpc('update_project_item_with_tags', {
    existing_tag_ids: body.existingTagIds.length > 0 ? body.existingTagIds : null,
    item_cost: body.cost,
    item_low_stock_threshold: body.lowStockThreshold,
    item_name: body.name.trim(),
    item_notes: body.notes,
    item_quantity: body.quantity,
    item_storage_location: body.storageLocation,
    item_unit: body.unit.trim() || 'units',
    item_vendor: body.vendor,
    new_tag_names: body.newTagNames.length > 0 ? body.newTagNames : null,
    project_item_uuid: itemId,
    suggested_item_key: body.suggestedItemId,
  } satisfies Database['public']['Functions']['update_project_item_with_tags']['Args'])

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    })
  }

  return data
})
