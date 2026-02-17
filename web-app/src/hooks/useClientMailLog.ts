import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export interface ClientMailLogEntry {
  id: string
  sent_at: string
  sent_by: string
  client_id: string | null
  template_id: string | null
  subject: string
  outcome: string
  recipient_email: string | null
  recipient_count: number | null
  sent_count: number | null
  failed_count: number | null
  active_only: boolean | null
  client_name?: string | null
}

export function useClientMailLog(limit = 20, clientId: string | null) {
  return useQuery({
    queryKey: ['client-mail-log', limit, clientId ?? null],
    queryFn: async () => {
      let query = supabase
        .from('client_mail_log')
        .select('id, sent_at, sent_by, client_id, template_id, subject, outcome, recipient_email, recipient_count, sent_count, failed_count, active_only, clients(name)')
        .order('sent_at', { ascending: false })
        .limit(limit)

      if (clientId) {
        query = query.eq('client_id', clientId)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []).map((row) => {
        const r = row as ClientMailLogEntry & { clients?: { name?: string | null } | null }
        return {
          ...r,
          client_name: r.clients?.name ?? null,
        }
      }) as ClientMailLogEntry[]
    },
  })
}

