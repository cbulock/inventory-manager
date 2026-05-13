import type { ProjectInviteDetail } from '~/types/inventory'
import { requireInventoryUser } from '~~/server/utils/inventory'
import { loadInviteContextByToken, normalizeInviteEmail } from '~~/server/utils/project-invites'

const formatInviteDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))

export default defineEventHandler(async (event) => {
  const user = await requireInventoryUser(event)
  const token = getRouterParam(event, 'token')

  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invite token is required.',
    })
  }

  const { invite, inviter, project } = await loadInviteContextByToken(event, token)

  if (normalizeInviteEmail(user.email ?? '') !== normalizeInviteEmail(invite.email)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'This invite is for a different email address.',
    })
  }

  return {
    email: invite.email,
    expiresAtLabel: formatInviteDate(invite.expires_at),
    id: invite.id,
    invitedAtLabel: formatInviteDate(invite.created_at),
    inviterEmail: inviter?.email ?? '',
    inviterName: inviter?.full_name ?? inviter?.email ?? 'Project owner',
    projectId: project.id,
    projectName: project.name,
    projectSummary: project.description ?? 'No project description yet.',
    projectTypeLabel: project.typeLabel,
    role: invite.role as ProjectInviteDetail['role'],
    status: invite.status,
    token: invite.token,
  } satisfies ProjectInviteDetail
})
