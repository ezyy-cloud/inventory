import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export function useSearchResults(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: async () => {
      const q = query.trim()
      if (!q) return { devices: [], clients: [], invoices: [], subscriptions: [] }
      const pattern = `%${q}%`

      const [devicesRes, clientsRes, invoicesRes, subsRes] = await Promise.all([
        supabase
          .from('devices')
          .select('id, name, identifier, device_type, status')
          .or(`name.ilike.${pattern},identifier.ilike.${pattern}`)
          .limit(20),
        supabase
          .from('clients')
          .select('id, name, email, phone')
          .or(`name.ilike.${pattern},email.ilike.${pattern},contact_name.ilike.${pattern}`)
          .limit(20),
        supabase
          .from('client_invoices')
          .select('id, invoice_number, amount, status, clients(id, name)')
          .ilike('invoice_number', pattern)
          .limit(20),
        supabase
          .from('subscriptions')
          .select('id, plan_name, amount, status, clients(id, name)')
          .ilike('plan_name', pattern)
          .limit(20),
      ])

      return {
        devices: devicesRes.data ?? [],
        clients: clientsRes.data ?? [],
        invoices: invoicesRes.data ?? [],
        subscriptions: subsRes.data ?? [],
      }
    },
    enabled: query.trim().length >= 2,
  })
}
