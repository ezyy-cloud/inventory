import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export type AuditLogEntry = {
  id: string
  created_at: string
  user_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  details: unknown
  profiles: { full_name: string | null } | null
}

export function useAuditLog(limit = 50) {
  return useQuery({
    queryKey: ['audit-log', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('id, created_at, user_id, action, entity_type, entity_id, details, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as unknown as AuditLogEntry[]
    },
  })
}
