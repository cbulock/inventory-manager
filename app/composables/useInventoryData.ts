import type { Database } from '~/types/database.types'
import type {
  DashboardData,
  ItemAdjustmentPreview,
  LowStockItemPreview,
  ProjectCreateInput,
  ProjectDetailData,
  ProjectItemAdjustmentInput,
  ProjectItemCreateInput,
  ProjectItemPhotoDeleteInput,
  ProjectItemPhotoPreview,
  ProjectItemPhotoUploadInput,
  ProjectItemPreview,
  ProjectItemUpdateInput,
  ProjectPreview,
  ProjectTypeOption,
  SuggestedItemPreview,
  TagOption,
} from '~/types/inventory'

function formatUpdatedLabel(value: string) {
  return `Updated ${new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))}`
}

function formatAdjustmentLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatCurrency(cost: number | null, currencyCode: string) {
  if (cost === null) {
    return null
  }

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currencyCode,
  }).format(cost)
}

function normalizeInventoryError(error: unknown) {
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message
  }

  return 'Live inventory data is not available yet, so preview data is being shown instead.'
}

function assertNonNegativeNumber(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative number.`)
  }
}

function assertRequiredText(value: string, label: string) {
  if (!value.trim()) {
    throw new Error(`${label} is required.`)
  }
}

const itemPhotoBucketName = 'item-photos'
const itemPhotoMaxBytes = 5 * 1024 * 1024
const allowedItemPhotoMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

function buildItemPhotoStoragePath(projectId: string, itemId: string) {
  return `${projectId}/${itemId}/photo`
}

function assertValidItemPhotoFile(file: File) {
  if (!allowedItemPhotoMimeTypes.has(file.type)) {
    throw new Error('Item photos must be a JPEG, PNG, or WebP image.')
  }

  if (file.size <= 0) {
    throw new Error('Choose an image file before uploading.')
  }

  if (file.size > itemPhotoMaxBytes) {
    throw new Error('Item photos must be 5 MB or smaller.')
  }
}

export function useInventoryData() {
  const supabase = useSupabaseClient<Database>()
  const runtimeConfig = useRuntimeConfig()
  const user = useSupabaseUser()
  const preview = useInventoryPreview()

  const currentUserId = computed(() => {
    if (!user.value) {
      return null
    }

    if (typeof user.value.id === 'string' && user.value.id) {
      return user.value.id
    }

    if ('sub' in user.value && typeof user.value.sub === 'string' && user.value.sub) {
      return user.value.sub
    }

    return null
  })

  const isSupabaseConfigured = computed(() =>
    Boolean(runtimeConfig.public.supabase.url && runtimeConfig.public.supabase.key),
  )

  const canUseLiveData = computed(() => isSupabaseConfigured.value && Boolean(currentUserId.value))

  const getPreviewAvailableTags = (projectId: string): TagOption[] => {
    const itemTags = preview
      .getProjectItemsByProjectId(projectId)
      .flatMap(item => item.tags)

    return [...new Set(itemTags)].map((tag, index) => ({
      id: `preview-tag-${index + 1}`,
      name: tag,
      color: null,
    }))
  }

  const getPreviewRecentAdjustments = (projectId: string): ItemAdjustmentPreview[] => {
    const items = preview.getProjectItemsByProjectId(projectId)

    return items
      .filter(item => item.isLowStock)
      .slice(0, 3)
      .map((item, index) => ({
        id: `preview-adjustment-${index + 1}`,
        itemId: item.id,
        itemName: item.name,
        delta: -1,
        note: 'Preview adjustment history becomes live after the Supabase schema is deployed.',
        createdAtLabel: 'Preview only',
        newQuantity: item.quantity,
        reason: 'usage',
      }))
  }

  const getPreviewDashboard = (notice: string | null): DashboardData => ({
    source: 'preview',
    notice,
    lowStockItems: preview.lowStockItems,
    projectTypes: preview.projectTypes,
    projects: preview.projects,
  })

  const getPreviewProject = (projectId: string, notice: string | null): ProjectDetailData => {
    const project = preview.getProjectById(projectId)

    if (!project) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Project not found',
      })
    }

    return {
      source: 'preview',
      notice,
      availableTags: getPreviewAvailableTags(projectId),
      canEditProject: true,
      project,
      items: preview.getProjectItemsByProjectId(projectId),
      recentAdjustments: getPreviewRecentAdjustments(projectId),
      suggestions: preview.getSuggestionsByProjectType(project.typeId),
    }
  }

  const loadDashboardData = async (): Promise<DashboardData> => {
    if (!canUseLiveData.value) {
      return getPreviewDashboard(
        'Supabase is not configured in this environment yet, so the dashboard is using preview data.',
      )
    }
    return await $fetch<DashboardData>('/api/dashboard')
  }

  const loadProjectData = async (projectId: string): Promise<ProjectDetailData> => {
    if (!canUseLiveData.value) {
      return getPreviewProject(
        projectId,
        'Supabase is not configured in this environment yet, so this project is using preview data.',
      )
    }
    return await $fetch<ProjectDetailData>(`/api/projects/${projectId}`)
  }

  const createProject = async (input: ProjectCreateInput) => {
    if (!canUseLiveData.value || !currentUserId.value) {
      throw new Error('Supabase must be configured before creating projects.')
    }

    assertRequiredText(input.name, 'Project name')
    return await $fetch<{ id: string }>('/api/projects', {
      method: 'POST',
      body: {
        description: input.description,
        name: input.name.trim(),
        projectTypeId: input.projectTypeId,
      },
    })
  }

  const createProjectItem = async (input: ProjectItemCreateInput) => {
    if (!canUseLiveData.value) {
      throw new Error('Supabase must be configured before creating project items.')
    }

    assertRequiredText(input.name, 'Item name')
    assertNonNegativeNumber(input.quantity, 'Quantity')
    assertNonNegativeNumber(input.lowStockThreshold, 'Low-stock threshold')

    if (input.cost !== null) {
      assertNonNegativeNumber(input.cost, 'Cost')
    }

    return await $fetch<string>(`/api/projects/${input.projectId}/items`, {
      method: 'POST',
      body: input,
    })
  }

  const updateProjectItem = async (input: ProjectItemUpdateInput) => {
    if (!canUseLiveData.value) {
      throw new Error('Supabase must be configured before editing project items.')
    }

    if (!input.itemId) {
      throw new Error('Select an item to edit.')
    }

    assertRequiredText(input.name, 'Item name')
    assertNonNegativeNumber(input.quantity, 'Quantity')
    assertNonNegativeNumber(input.lowStockThreshold, 'Low-stock threshold')

    if (input.cost !== null) {
      assertNonNegativeNumber(input.cost, 'Cost')
    }

    return await $fetch<string>(`/api/project-items/${input.itemId}`, {
      method: 'PATCH',
      body: input,
    })
  }

  const deleteProjectItem = async (itemId: string) => {
    if (!canUseLiveData.value) {
      throw new Error('Supabase must be configured before deleting project items.')
    }

    if (!itemId) {
      throw new Error('Select an item to delete.')
    }

    await $fetch(`/api/project-items/${itemId}`, {
      method: 'DELETE',
    })
  }

  const adjustProjectItemQuantity = async (input: ProjectItemAdjustmentInput) => {
    if (!canUseLiveData.value) {
      throw new Error('Supabase must be configured before adjusting item quantities.')
    }

    if (!input.itemId) {
      throw new Error('Select an item to adjust.')
    }

    if (!Number.isFinite(input.delta) || input.delta === 0) {
      throw new Error('Adjustment delta must be a non-zero number.')
    }

    return await $fetch<Database['public']['Tables']['project_items']['Row']>(
      `/api/project-items/${input.itemId}/adjustments`,
      {
        method: 'POST',
        body: input,
      },
    )
  }

  const uploadProjectItemPhoto = async (input: ProjectItemPhotoUploadInput) => {
    if (!canUseLiveData.value || !currentUserId.value) {
      throw new Error('Supabase must be configured before uploading item photos.')
    }

    if (!input.projectId || !input.itemId) {
      throw new Error('Select a project item before uploading a photo.')
    }

    assertValidItemPhotoFile(input.file)

    const formData = new FormData()
    formData.set('file', input.file)
    formData.set('projectId', input.projectId)

    if (input.existingStoragePath) {
      formData.set('existingStoragePath', input.existingStoragePath)
    }

    await $fetch(`/api/project-items/${input.itemId}/photo`, {
      method: 'POST',
      body: formData,
    })
  }

  const deleteProjectItemPhoto = async (input: ProjectItemPhotoDeleteInput) => {
    if (!canUseLiveData.value) {
      throw new Error('Supabase must be configured before deleting item photos.')
    }

    if (!input.itemId || !input.storagePath) {
      throw new Error('Select an item photo before deleting it.')
    }

    await $fetch(`/api/project-items/${input.itemId}/photo`, {
      method: 'DELETE',
      body: input,
    })
  }

  return {
    adjustProjectItemQuantity,
    canUseLiveData,
    createProject,
    createProjectItem,
    currentUserId,
    deleteProjectItemPhoto,
    deleteProjectItem,
    isSupabaseConfigured,
    loadDashboardData,
    loadProjectData,
    uploadProjectItemPhoto,
    updateProjectItem,
  }
}
