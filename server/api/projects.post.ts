import type { Database } from '~/types/database.types'
import type { ProjectCreateInput } from '~/types/inventory'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'You must be signed in to create a project.',
    })
  }

  const body = await readBody<ProjectCreateInput>(event)

  if (!body?.name?.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Project name is required.',
    })
  }

  const supabase = serverSupabaseServiceRole<Database>(event)
  const payload: Database['public']['Tables']['projects']['Insert'] = {
    owner_id: user.id,
    name: body.name.trim(),
    description: body.description?.trim() || null,
    project_type_id: body.projectTypeId || null,
  }

  const { data, error } = await supabase
    .from('projects')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    })
  }

  return data
})
