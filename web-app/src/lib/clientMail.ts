import { supabase } from './supabaseClient'

export type SendClientMailParams =
  | { clientId: string; subject: string; bodyHtml: string }
  | { clientId: string; templateId: string }

export type SendBroadcastMailParams =
  | { subject: string; bodyHtml: string; activeOnly?: boolean; deviceTypes?: string[] }
  | { templateId: string; activeOnly?: boolean; deviceTypes?: string[] }

export async function sendClientMail(
  params: SendClientMailParams,
): Promise<{ success: true } | { error: string }> {
  const body =
    'templateId' in params && params.templateId
      ? { clientId: params.clientId, templateId: params.templateId }
      : {
          clientId: params.clientId,
          subject: (params as { clientId: string; subject: string; bodyHtml: string }).subject,
          bodyHtml: (params as { clientId: string; subject: string; bodyHtml: string }).bodyHtml,
        }

  const { data, error } = await supabase.functions.invoke('send-client-mail', { body })

  if (error) {
    return { error: error.message }
  }
  if (data?.error) {
    return { error: typeof data.error === 'string' ? data.error : String(data.error) }
  }
  return { success: true }
}

export type BroadcastResult = { success: true; sent: number; failed: number; errors?: string[] } | { error: string }

export async function sendBroadcastMail(params: SendBroadcastMailParams): Promise<BroadcastResult> {
  const deviceTypes = params.deviceTypes?.length ? params.deviceTypes : undefined
  const body =
    'templateId' in params && params.templateId
      ? { broadcast: true, templateId: params.templateId, activeOnly: params.activeOnly, deviceTypes }
      : {
          broadcast: true,
          subject: (params as { subject: string; bodyHtml: string; activeOnly?: boolean }).subject,
          bodyHtml: (params as { subject: string; bodyHtml: string; activeOnly?: boolean }).bodyHtml,
          activeOnly: (params as { subject: string; bodyHtml: string; activeOnly?: boolean }).activeOnly,
          deviceTypes,
        }

  const { data, error } = await supabase.functions.invoke('send-client-mail', { body })

  if (error) {
    return { error: error.message }
  }
  if (data?.error) {
    return { error: typeof data.error === 'string' ? data.error : String(data.error) }
  }
  return {
    success: true,
    sent: data?.sent ?? 0,
    failed: data?.failed ?? 0,
    errors: data?.errors,
  }
}
