import type { H3Event } from 'h3'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { JwtPayload } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'
import type {
  DashboardData,
  ItemAdjustmentPreview,
  LowStockItemPreview,
  ProjectDetailData,
  ProjectInvitePreview,
  ProjectMemberPreview,
  ProjectItemPhotoPreview,
  ProjectItemPreview,
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

function formatShortDateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

export async function requireInventoryUser(event: H3Event) {
  const user = await serverSupabaseUser(event)

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'You must be signed in to access inventory data.',
    })
  }

  const userId = getInventoryUserId(user)

  if (!userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Your session is missing a valid user id.',
    })
  }

  return {
    ...user,
    id: userId,
  }
}

function getInventoryUserId(user: JwtPayload) {
  if ('id' in user && typeof user.id === 'string' && user.id) {
    return user.id
  }

  if (typeof user.sub === 'string' && user.sub) {
    return user.sub
  }

  return null
}

export async function createInventoryClient(event: H3Event) {
  return await serverSupabaseClient<Database>(event)
}

export async function loadDashboardDataForUser(event: H3Event): Promise<DashboardData> {
  const user = await requireInventoryUser(event)
  const supabase = await createInventoryClient(event)

  const [projectTypesResult, projectsResult] = await Promise.all([
    supabase
      .from('project_types')
      .select('id, label, description, sort_order')
      .order('sort_order', { ascending: true }),
    supabase
      .from('projects')
      .select('id, owner_id, name, description, project_type_id, created_at, updated_at')
      .order('updated_at', { ascending: false }),
  ])

  if (projectTypesResult.error) {
    throw createError({
      statusCode: 500,
      statusMessage: projectTypesResult.error.message,
    })
  }

  if (projectsResult.error) {
    throw createError({
      statusCode: 500,
      statusMessage: projectsResult.error.message,
    })
  }

  const projectTypes: ProjectTypeOption[] = projectTypesResult.data.map(projectType => ({
    id: projectType.id,
    label: projectType.label,
    description: projectType.description,
  }))

  const projectTypeLabels = new Map(projectTypes.map(projectType => [projectType.id, projectType.label]))
  const projectIds = projectsResult.data.map(project => project.id)

  if (projectIds.length === 0) {
    return {
      source: 'live',
      notice: null,
      lowStockItems: [],
      projectTypes,
      projects: [],
    }
  }

  const [projectMembersResult, projectItemsResult] = await Promise.all([
    supabase
      .from('project_members')
      .select('project_id, user_id, role')
      .in('project_id', projectIds),
    supabase
      .from('project_items')
      .select('id, project_id, name, quantity, unit, low_stock_threshold, storage_location')
      .in('project_id', projectIds),
  ])

  if (projectMembersResult.error) {
    throw createError({
      statusCode: 500,
      statusMessage: projectMembersResult.error.message,
    })
  }

  if (projectItemsResult.error) {
    throw createError({
      statusCode: 500,
      statusMessage: projectItemsResult.error.message,
    })
  }

  const memberMap = new Map<string, number>()
  const currentUserRoleMap = new Map<string, ProjectPreview['membershipRole']>()

  for (const member of projectMembersResult.data) {
    memberMap.set(member.project_id, (memberMap.get(member.project_id) ?? 0) + 1)

    if (member.user_id === user.id) {
      currentUserRoleMap.set(member.project_id, member.role)
    }
  }

  const itemCountMap = new Map<string, number>()
  const lowStockCountMap = new Map<string, number>()
  const lowStockItems: LowStockItemPreview[] = []
  const projectNameMap = new Map(projectsResult.data.map(project => [project.id, project.name]))

  for (const item of projectItemsResult.data) {
    itemCountMap.set(item.project_id, (itemCountMap.get(item.project_id) ?? 0) + 1)

    const isLowStock = item.low_stock_threshold > 0 && item.quantity <= item.low_stock_threshold

    if (isLowStock) {
      lowStockCountMap.set(item.project_id, (lowStockCountMap.get(item.project_id) ?? 0) + 1)

      lowStockItems.push({
        id: item.id,
        projectId: item.project_id,
        projectName: projectNameMap.get(item.project_id) ?? 'Project',
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        threshold: item.low_stock_threshold,
        location: item.storage_location ?? 'No location set',
        tags: [],
      })
    }
  }

  const projects: ProjectPreview[] = projectsResult.data.map(project => ({
    id: project.id,
    name: project.name,
    typeId: project.project_type_id ?? 'general-crafting',
    typeLabel: project.project_type_id
      ? (projectTypeLabels.get(project.project_type_id) ?? 'Custom project')
      : 'Crafting',
    summary: project.description ?? 'No project description yet.',
    memberCount: memberMap.get(project.id) ?? 1,
    itemCount: itemCountMap.get(project.id) ?? 0,
    lowStockCount: lowStockCountMap.get(project.id) ?? 0,
    lastUpdated: formatUpdatedLabel(project.updated_at),
    tags: [],
    membershipRole: currentUserRoleMap.get(project.id) ?? null,
  }))

  return {
    source: 'live',
    notice: null,
    lowStockItems,
    projectTypes,
    projects,
  }
}

export async function loadProjectDataForUser(event: H3Event, projectId: string): Promise<ProjectDetailData> {
  const user = await requireInventoryUser(event)
  const supabase = await createInventoryClient(event)

  const projectResult = await supabase
    .from('projects')
    .select('id, owner_id, name, description, project_type_id, created_at, updated_at')
    .eq('id', projectId)
    .single()

  if (projectResult.error) {
    if (projectResult.error.code === 'PGRST116') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Project not found',
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: projectResult.error.message,
    })
  }

  const [projectTypesResult, membersResult, itemsResult, tagsResult, invitesResult] = await Promise.all([
    supabase
      .from('project_types')
      .select('id, label, description, sort_order')
      .order('sort_order', { ascending: true }),
    supabase
      .from('project_members')
      .select('project_id, user_id, role, created_at')
      .eq('project_id', projectId),
    supabase
      .from('project_items')
      .select('id, project_id, suggested_item_id, name, quantity, unit, low_stock_threshold, storage_location, vendor, cost, currency_code, notes')
      .eq('project_id', projectId)
      .order('name', { ascending: true }),
    supabase
      .from('item_tags')
      .select('id, name, color')
      .eq('owner_id', projectResult.data.owner_id)
      .order('name', { ascending: true }),
    supabase
      .from('project_invites')
      .select('id, email, role, status, created_at, expires_at')
      .eq('project_id', projectId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
  ])

  if (projectTypesResult.error) {
    throw createError({
      statusCode: 500,
      statusMessage: projectTypesResult.error.message,
    })
  }

  if (membersResult.error) {
    throw createError({
      statusCode: 500,
      statusMessage: membersResult.error.message,
    })
  }

  if (itemsResult.error) {
    throw createError({
      statusCode: 500,
      statusMessage: itemsResult.error.message,
    })
  }

  if (tagsResult.error) {
    throw createError({
      statusCode: 500,
      statusMessage: tagsResult.error.message,
    })
  }

  if (invitesResult.error) {
    throw createError({
      statusCode: 500,
      statusMessage: invitesResult.error.message,
    })
  }

  const projectTypeLabels = new Map(
    projectTypesResult.data.map(projectType => [projectType.id, projectType.label]),
  )
  const currentUserMembership = membersResult.data.find(member => member.user_id === user.id)
  const memberIds = [...new Set(membersResult.data.map(member => member.user_id))]
  const memberProfilesResult = memberIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .in('id', memberIds)
    : { data: [], error: null }

  if (memberProfilesResult.error) {
    throw createError({
      statusCode: 500,
      statusMessage: memberProfilesResult.error.message,
    })
  }

  const memberProfilesById = new Map(memberProfilesResult.data.map(profile => [profile.id, profile]))
  const itemIds = itemsResult.data.map(item => item.id)

  let tagLinks: Database['public']['Tables']['item_tag_links']['Row'][] = []
  let adjustments: Database['public']['Tables']['item_adjustments']['Row'][] = []
  let itemPhotos: Database['public']['Tables']['item_photos']['Row'][] = []

  if (itemIds.length > 0) {
    const [tagLinksResult, adjustmentsResult, itemPhotosResult] = await Promise.all([
      supabase
        .from('item_tag_links')
        .select('project_item_id, tag_id, created_at')
        .in('project_item_id', itemIds),
      supabase
        .from('item_adjustments')
        .select('id, project_item_id, actor_user_id, reason, delta, previous_quantity, new_quantity, note, created_at')
        .in('project_item_id', itemIds)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('item_photos')
        .select('project_item_id, storage_path, mime_type, file_size_bytes, created_by, created_at, updated_at')
        .in('project_item_id', itemIds),
    ])

    if (tagLinksResult.error) {
      throw createError({
        statusCode: 500,
        statusMessage: tagLinksResult.error.message,
      })
    }

    if (adjustmentsResult.error) {
      throw createError({
        statusCode: 500,
        statusMessage: adjustmentsResult.error.message,
      })
    }

    if (itemPhotosResult.error) {
      throw createError({
        statusCode: 500,
        statusMessage: itemPhotosResult.error.message,
      })
    }

    tagLinks = tagLinksResult.data
    adjustments = adjustmentsResult.data
    itemPhotos = itemPhotosResult.data
  }

  const tagsById = new Map(tagsResult.data.map(tag => [tag.id, tag.name]))
  const tagsByItemId = new Map<string, string[]>()

  for (const tagLink of tagLinks) {
    const tagName = tagsById.get(tagLink.tag_id)

    if (!tagName) {
      continue
    }

    const tags = tagsByItemId.get(tagLink.project_item_id) ?? []
    tags.push(tagName)
    tagsByItemId.set(tagLink.project_item_id, tags)
  }

  const itemNameMap = new Map(itemsResult.data.map(item => [item.id, item.name]))
  const itemPhotoByItemId = new Map(itemPhotos.map(photo => [photo.project_item_id, photo]))
  const itemPhotoUrlByItemId = new Map<string, string>()

  if (itemPhotos.length > 0) {
    const signedUrlResults = await Promise.all(
      itemPhotos.map(async (photo) => {
        const { data, error } = await supabase
          .storage
          .from('item-photos')
          .createSignedUrl(photo.storage_path, 60 * 60)

        if (error) {
          throw createError({
            statusCode: 500,
            statusMessage: error.message,
          })
        }

        if (!data?.signedUrl) {
          throw createError({
            statusCode: 500,
            statusMessage: 'Unable to create a signed URL for an item photo.',
          })
        }

        return [photo.project_item_id, data.signedUrl] as const
      }),
    )

    for (const [itemId, signedUrl] of signedUrlResults) {
      itemPhotoUrlByItemId.set(itemId, signedUrl)
    }
  }

  const suggestionsResult = await supabase
    .from('suggested_items')
    .select('id, project_type_id, name, default_unit')
    .eq('project_type_id', projectResult.data.project_type_id ?? 'general-crafting')
    .order('name', { ascending: true })

  if (suggestionsResult.error) {
    throw createError({
      statusCode: 500,
      statusMessage: suggestionsResult.error.message,
    })
  }

  const availableTags: TagOption[] = tagsResult.data.map(tag => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
  }))

  const items: ProjectItemPreview[] = itemsResult.data.map((item) => {
    const photoRecord = itemPhotoByItemId.get(item.id)
    const photoUrl = itemPhotoUrlByItemId.get(item.id)
    const photo: ProjectItemPhotoPreview | null = photoRecord && photoUrl
      ? {
          fileSizeBytes: photoRecord.file_size_bytes,
          mimeType: photoRecord.mime_type,
          storagePath: photoRecord.storage_path,
          url: photoUrl,
        }
      : null

    return {
      id: item.id,
      name: item.name,
      suggestedItemId: item.suggested_item_id,
      quantity: item.quantity,
      unit: item.unit,
      threshold: item.low_stock_threshold,
      location: item.storage_location,
      vendor: item.vendor,
      cost: formatCurrency(item.cost, item.currency_code),
      notes: item.notes,
      photo,
      tags: tagsByItemId.get(item.id) ?? [],
      isLowStock: item.low_stock_threshold > 0 && item.quantity <= item.low_stock_threshold,
    }
  })

  const project: ProjectPreview = {
    id: projectResult.data.id,
    name: projectResult.data.name,
    typeId: projectResult.data.project_type_id ?? 'general-crafting',
    typeLabel: projectResult.data.project_type_id
      ? (projectTypeLabels.get(projectResult.data.project_type_id) ?? 'Custom project')
      : 'Crafting',
    summary: projectResult.data.description ?? 'No project description yet.',
    memberCount: membersResult.data.length,
    itemCount: items.length,
    lowStockCount: items.filter(item => item.isLowStock).length,
    lastUpdated: formatUpdatedLabel(projectResult.data.updated_at),
    tags: [...new Set(items.flatMap(item => item.tags))].slice(0, 6),
    membershipRole: currentUserMembership?.role ?? null,
  }

  const members: ProjectMemberPreview[] = membersResult.data
    .map((member) => {
      const profile = memberProfilesById.get(member.user_id)

      if (!profile) {
        return null
      }

      return {
        avatarUrl: profile.avatar_url,
        email: profile.email,
        fullName: profile.full_name,
        joinedAtLabel: formatShortDateLabel(member.created_at),
        role: member.role,
        userId: member.user_id,
      }
    })
    .filter((member): member is ProjectMemberPreview => member !== null)

  const pendingInvites: ProjectInvitePreview[] = invitesResult.data.map(invite => ({
    email: invite.email,
    expiresAtLabel: formatShortDateLabel(invite.expires_at),
    id: invite.id,
    invitedAtLabel: formatShortDateLabel(invite.created_at),
    recipientName: null,
    role: invite.role as ProjectInvitePreview['role'],
    status: invite.status,
  }))

  const suggestions: SuggestedItemPreview[] = suggestionsResult.data.map(suggestion => ({
    id: suggestion.id,
    projectTypeId: suggestion.project_type_id,
    name: suggestion.name,
    defaultUnit: suggestion.default_unit,
    tags: [],
  }))

  const recentAdjustments: ItemAdjustmentPreview[] = adjustments.map(adjustment => ({
    id: adjustment.id,
    itemId: adjustment.project_item_id,
    itemName: itemNameMap.get(adjustment.project_item_id) ?? 'Item',
    delta: adjustment.delta,
    note: adjustment.note,
    createdAtLabel: formatAdjustmentLabel(adjustment.created_at),
    newQuantity: adjustment.new_quantity,
    reason: adjustment.reason,
  }))

  return {
    source: 'live',
    notice: null,
    availableTags,
    canEditProject: project.membershipRole === 'owner' || project.membershipRole === 'editor',
    canInviteUsers: project.membershipRole === 'owner',
    members,
    pendingInvites,
    project,
    items,
    recentAdjustments,
    suggestions,
  }
}
