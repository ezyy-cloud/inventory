import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export type SidebarCounts = {
  devices: number
  clients: number
  overdue_invoices: number
  subscriptions_ending_soon: number
}

export function useSidebarCounts() {
  return useQuery({
    queryKey: ['sidebar-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_sidebar_counts')
      if (error) throw error
      const raw = Array.isArray(data) ? data[0] : data
      return (raw as SidebarCounts) ?? { devices: 0, clients: 0, overdue_invoices: 0, subscriptions_ending_soon: 0 }
    },
    staleTime: 60 * 1000,
  })
}
