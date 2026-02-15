import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export type DeviceStatusBreakdownRow = { status: string; count: number }

export function useDeviceStatusBreakdown() {
  return useQuery<DeviceStatusBreakdownRow[]>({
    queryKey: ['report-device-status-breakdown'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('status')
      if (error) throw error
      const byStatus = (data ?? []).reduce(
        (acc, d) => {
          const s = d.status ?? 'unknown'
          acc[s] = (acc[s] ?? 0) + 1
          return acc
        },
        {} as Record<string, number>,
      )
      return Object.entries(byStatus).map(([status, count]) => ({ status, count }))
    },
  })
}

export type RevenueByMonthRow = { month: string; revenue: number }

export function useRevenueByMonth(monthsBack = 6) {
  return useQuery<RevenueByMonthRow[]>({
    queryKey: ['report-revenue-by-month', monthsBack],
    queryFn: async () => {
      const start = new Date()
      start.setMonth(start.getMonth() - monthsBack)
      start.setDate(1)
      const startStr = start.toISOString().slice(0, 10)
      const { data, error } = await supabase
        .from('client_invoices')
        .select('issued_at, amount, status')
        .gte('issued_at', startStr)
        .in('status', ['paid', 'sent', 'overdue'])
      if (error) throw error
      const byMonth: Record<string, number> = {}
      for (const row of data ?? []) {
        const month = (row.issued_at ?? '').slice(0, 7)
        if (!month) continue
        byMonth[month] = (byMonth[month] ?? 0) + (row.amount ?? 0)
      }
      return Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, revenue]) => ({ month, revenue }))
    },
  })
}

export type ProviderSpendRow = { provider_name: string; total: number }

export function useProviderSpend() {
  return useQuery<ProviderSpendRow[]>({
    queryKey: ['report-provider-spend'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('provider_payments')
        .select('amount, providers(id, name)')
      if (error) throw error
      const byProvider: Record<string, number> = {}
      for (const row of data ?? []) {
        const prov = (row as { providers?: { name: string } | { name: string }[] | null }).providers
        const name = Array.isArray(prov) ? prov[0]?.name : prov?.name
        byProvider[name ?? 'Unknown'] = (byProvider[name ?? 'Unknown'] ?? 0) + (row.amount ?? 0)
      }
      return Object.entries(byProvider).map(([provider_name, total]) => ({
        provider_name,
        total,
      }))
    },
  })
}
