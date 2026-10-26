import { sendNotificationEmail, escapeHtml, emailButton } from '@/lib/mail'
import { issuePasswordToken, SETUP_TOKEN_TTL_MS } from '@/lib/tokens'
import { getBaseUrl } from '@/lib/url'

/**
 * Issues a fresh 7-day password setup link and emails it.
 * Returns the link so an admin can also share it directly if the email doesn't arrive.
 */
export async function sendSetupInvite(employee: { name: string; email: string }): Promise<string> {
  const token = await issuePasswordToken(employee.email, SETUP_TOKEN_TTL_MS)
  const setupUrl = `${getBaseUrl()}/setup-password?token=${token}`

  await sendNotificationEmail({
    to: employee.email,
    subject: 'Set up your staff account',
    html: `<h2 style="margin:0 0 12px;">Welcome, ${escapeHtml(employee.name)}</h2>
           <p>An account has been created for you on the staff attendance and payroll system.</p>
           <p>Click the button below to choose your password and sign in.</p>
           ${emailButton(setupUrl, 'Set up my password')}
           <p style="color:#64748b;font-size:13px;">This link expires in 7 days and can only be used once.</p>`,
  })

  return setupUrl
}
