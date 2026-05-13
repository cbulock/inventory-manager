import nodemailer from 'nodemailer'
import type { ProjectMembershipRole } from '~/types/inventory'

const formatInviteRole = (role: Exclude<ProjectMembershipRole, 'owner'>) =>
  role === 'editor' ? 'Editor' : 'Viewer'

export async function sendProjectInviteEmail(payload: {
  inviteUrl: string
  inviterEmail: string
  inviterName: string
  projectName: string
  recipientEmail: string
  role: Exclude<ProjectMembershipRole, 'owner'>
}) {
  const runtimeConfig = useRuntimeConfig()
  const { smtp } = runtimeConfig

  if (!smtp.host || !smtp.from || !Number.isFinite(Number(smtp.port))) {
    throw new Error('SMTP settings are required before project invite emails can be sent.')
  }

  const transporter = nodemailer.createTransport({
    auth: smtp.user && smtp.pass
      ? {
          pass: smtp.pass,
          user: smtp.user,
        }
      : undefined,
    host: smtp.host,
    port: Number(smtp.port),
    secure: Boolean(smtp.secure),
  })

  const roleLabel = formatInviteRole(payload.role)
  const inviterLabel = payload.inviterName || payload.inviterEmail
  const subject = `${inviterLabel} invited you to ${payload.projectName}`
  const text = [
    `You were invited to join ${payload.projectName} as a ${roleLabel}.`,
    '',
    `Invited by: ${inviterLabel} (${payload.inviterEmail})`,
    '',
    `Open this link to review the invite: ${payload.inviteUrl}`,
    '',
    'If you did not expect this invitation, you can ignore this email.',
  ].join('\n')
  const html = `
    <p>You were invited to join <strong>${payload.projectName}</strong> as a <strong>${roleLabel}</strong>.</p>
    <p>Invited by: ${inviterLabel} (${payload.inviterEmail})</p>
    <p><a href="${payload.inviteUrl}">Review this invitation</a></p>
    <p>If you did not expect this invitation, you can ignore this email.</p>
  `

  await transporter.sendMail({
    from: smtp.fromName ? `"${smtp.fromName}" <${smtp.from}>` : smtp.from,
    html,
    subject,
    text,
    to: payload.recipientEmail,
  })
}
