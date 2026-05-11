import { loadProjectDataForUser } from '~~/server/utils/inventory'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')

  if (!projectId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Project id is required.',
    })
  }

  return await loadProjectDataForUser(event, projectId)
})
