import { supabase } from './supabaseClient'

export type AuditAction =
  | 'device.assigned'
  | 'device.unassigned'
  | 'device.bulk_unassign'
  | 'device.status_changed'
  | 'invoice.created'
  | 'invoice.sent'
  | 'invoice.paid'
  | 'invoice.void'
  | 'client.created'
  | 'client.deleted'
  | 'profile.role_changed'
  | 'client_mail.sent'
  | 'client_mail.broadcast'

export async function recordAudit(
  action: AuditAction,
  entityType: string,
  entityId: string | null,
  details?: Record<string, unknown>,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('audit_log').insert({
    user_id: user?.id ?? null,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    details: details ?? null,
  })
}
