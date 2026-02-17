import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { calculateMRR, monthlyEquivalent } from '../lib/mrr'
import type { AlertSeverity, UnifiedAlert } from '../types'

export type DevicesByCategoryRow = { device_type: string; count: number }
export type MRRByPlanRow = { plan_name: string; mrr: number }
export type MRRByDeviceTypeRow = { device_type: string; mrr: number }
export type MRRByClientRow = { client_id: string; client_name: string; mrr: number }
export type MonthlyCostByProviderPlanRow = {
  provider_plan_id: string
  plan_name: string
  provider_name: string
  monthly_cost: number
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = { high: 0, medium: 1, low: 2 }

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [devicesRes, assignedRes, subscriptionsRes, providerRes] = await Promise.all([
        supabase.from('devices').select('id', { count: 'exact', head: true }),
        supabase
          .from('device_assignments')
          .select('id', { count: 'exact', head: true })
          .is('unassigned_at', null),
        supabase
          .from('subscriptions')
          .select('id, amount, billing_cycle')
          .eq('status', 'active'),
        supabase
          .from('provider_payments')
          .select('id, amount')
          .in('status', ['pending', 'scheduled', 'overdue']),
      ])

      const mrr = calculateMRR(subscriptionsRes.data ?? [])
      const providerDue =
        (providerRes.data ?? []).reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0

      return {
        totalDevices: devicesRes.count ?? 0,
        assignedDevices: assignedRes.count ?? 0,
        activeSubscriptions: subscriptionsRes.data?.length ?? 0,
        mrr,
        providerDue,
      }
    },
  })
}

export function useDevicesByCategory() {
  return useQuery<DevicesByCategoryRow[]>({
    queryKey: ['dashboard-devices-by-category'],
    queryFn: async () => {
      const { data, error } = await supabase.from('devices').select('device_type')
      if (error) throw error
      const byType = (data ?? []).reduce(
        (acc, d) => {
          const t = d.device_type ?? 'other'
          acc[t] = (acc[t] ?? 0) + 1
          return acc
        },
        {} as Record<string, number>,
      )
      return Object.entries(byType).map(([device_type, count]) => ({ device_type, count }))
    },
  })
}

export function useMRRByPlan() {
  return useQuery<MRRByPlanRow[]>({
    queryKey: ['dashboard-mrr-by-plan'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('plan_name, amount, billing_cycle')
        .eq('status', 'active')
      if (error) throw error
      const byPlan: Record<string, number> = {}
      for (const row of data ?? []) {
        const name = row.plan_name ?? '—'
        const mrr = monthlyEquivalent(row.amount ?? 0, row.billing_cycle ?? null)
        byPlan[name] = (byPlan[name] ?? 0) + mrr
      }
      return Object.entries(byPlan)
        .map(([plan_name, mrr]) => ({ plan_name, mrr }))
        .filter((r) => r.mrr > 0)
        .sort((a, b) => b.mrr - a.mrr)
    },
  })
}

export function useMRRByDeviceType() {
  return useQuery<MRRByDeviceTypeRow[]>({
    queryKey: ['dashboard-mrr-by-device-type'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('amount, billing_cycle, device_id, devices(device_type)')
        .eq('status', 'active')
      if (error) throw error
      const byType: Record<string, number> = {}
      for (const row of data ?? []) {
        const dev = (row as { devices?: { device_type?: string } | { device_type?: string }[] | null }).devices
        const deviceType = Array.isArray(dev) ? dev[0]?.device_type : dev?.device_type
        const key = deviceType ?? 'unassigned'
        const mrr = monthlyEquivalent(row.amount ?? 0, row.billing_cycle ?? null)
        byType[key] = (byType[key] ?? 0) + mrr
      }
      return Object.entries(byType)
        .map(([device_type, mrr]) => ({ device_type, mrr }))
        .filter((r) => r.mrr > 0)
        .sort((a, b) => b.mrr - a.mrr)
    },
  })
}

export function useMRRByClient(limit = 10) {
  return useQuery<MRRByClientRow[]>({
    queryKey: ['dashboard-mrr-by-client', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('client_id, amount, billing_cycle, clients(id, name)')
        .eq('status', 'active')
      if (error) throw error
      const byClient: Record<string, { name: string; mrr: number }> = {}
      for (const row of data ?? []) {
        const clientId = row.client_id ?? ''
        const clients = (row as { clients?: { name: string } | { name: string }[] | null }).clients
        const name = Array.isArray(clients) ? clients[0]?.name ?? '—' : clients?.name ?? '—'
        const mrr = monthlyEquivalent(row.amount ?? 0, row.billing_cycle ?? null)
        if (!byClient[clientId]) byClient[clientId] = { name, mrr: 0 }
        byClient[clientId].name = name
        byClient[clientId].mrr += mrr
      }
      return Object.entries(byClient)
        .map(([client_id, { name, mrr }]) => ({ client_id, client_name: name, mrr }))
        .filter((r) => r.mrr > 0)
        .sort((a, b) => b.mrr - a.mrr)
        .slice(0, limit)
    },
  })
}

export function useMonthlyCostByProviderPlan(limit = 10) {
  return useQuery<MonthlyCostByProviderPlanRow[]>({
    queryKey: ['dashboard-monthly-cost-by-provider-plan', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('device_provider_plans')
        .select('provider_plan_id, provider_plans(id, name, amount, billing_cycle, providers(id, name))')
        .eq('status', 'active')
      if (error) throw error
      const byPlan: Record<
        string,
        { plan_name: string; provider_name: string; monthly_cost: number }
      > = {}
      for (const row of data ?? []) {
        const raw = row as {
          provider_plan_id: string
          provider_plans?:
            | { id: string; name: string; amount: number; billing_cycle: string; providers?: { name: string } | { name: string }[] | null }
            | { id: string; name: string; amount: number; billing_cycle: string; providers?: { name: string } | { name: string }[] | null }[]
            | null
        }
        const ppRaw = raw.provider_plans
        const pp = Array.isArray(ppRaw) ? ppRaw[0] ?? null : ppRaw
        if (!pp) continue
        const planId = pp.id
        const planName = pp.name ?? '—'
        const providers = pp.providers
        const providerName = Array.isArray(providers) ? providers[0]?.name ?? '—' : providers?.name ?? '—'
        const monthly = monthlyEquivalent(pp.amount ?? 0, pp.billing_cycle ?? null)
        if (!byPlan[planId]) {
          byPlan[planId] = { plan_name: planName, provider_name: providerName, monthly_cost: 0 }
        }
        byPlan[planId].monthly_cost += monthly
      }
      return Object.entries(byPlan)
        .map(([provider_plan_id, v]) => ({
          provider_plan_id,
          plan_name: v.plan_name,
          provider_name: v.provider_name,
          monthly_cost: v.monthly_cost,
        }))
        .filter((r) => r.monthly_cost > 0)
        .sort((a, b) => b.monthly_cost - a.monthly_cost)
        .slice(0, limit)
    },
  })
}

export function useRenewalAlerts(limit = 10) {
  return useQuery({
    queryKey: ['renewal-alerts', limit],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10)
      const in14Days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

      const { data, error } = await supabase
        .from('subscriptions')
        .select(
          `
          id,
          plan_name,
          amount,
          next_invoice_date,
          status,
          clients(id, name)
        `,
        )
        .eq('status', 'active')
        .not('next_invoice_date', 'is', null)
        .lte('next_invoice_date', in14Days)
        .gte('next_invoice_date', today)
        .order('next_invoice_date', { ascending: true })
        .limit(limit)

      if (error) throw error
      const items = (data ?? []).map((d) => ({
        ...d,
        clients: Array.isArray(d.clients) ? d.clients[0] ?? null : d.clients ?? null,
      }))
      return items as Array<{
        id: string
        plan_name: string
        amount: number
        next_invoice_date: string | null
        status: string
        clients: { id: string; name: string } | null
      }>
    },
  })
}

export function useSubscriptionsEndingWithin(days: number, limit = 10) {
  return useQuery({
    queryKey: ['subscriptions-ending-within', days, limit],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10)
      const future = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const { data, error } = await supabase
        .from('subscriptions')
        .select(
          `
          id,
          plan_name,
          end_date,
          status,
          clients(id, name)
        `,
        )
        .not('end_date', 'is', null)
        .gte('end_date', today)
        .lte('end_date', future)
        .order('end_date', { ascending: true })
        .limit(limit)
      if (error) throw error
      const items = (data ?? []).map((d) => ({
        ...d,
        clients: Array.isArray(d.clients) ? d.clients[0] ?? null : d.clients ?? null,
      }))
      return items as Array<{
        id: string
        plan_name: string
        end_date: string | null
        status: string
        clients: { id: string; name: string } | null
      }>
    },
  })
}

export function useOverdueSubscriptions(limit = 10) {
  return useQuery({
    queryKey: ['overdue-subscriptions', limit],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10)

      const { data, error } = await supabase
        .from('subscriptions')
        .select(
          `
          id,
          plan_name,
          amount,
          next_invoice_date,
          clients(id, name)
        `,
        )
        .eq('status', 'active')
        .lt('next_invoice_date', today)
        .order('next_invoice_date', { ascending: true })
        .limit(limit)

      if (error) throw error
      const items = (data ?? []).map((d) => ({
        ...d,
        clients: Array.isArray(d.clients) ? d.clients[0] ?? null : d.clients ?? null,
      }))
      return items as Array<{
        id: string
        plan_name: string
        amount: number
        next_invoice_date: string | null
        clients: { id: string; name: string } | null
      }>
    },
  })
}

export function useOverdueInvoices(limit = 10) {
  return useQuery({
    queryKey: ['overdue-invoices', limit],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10)
      const { data, error } = await supabase
        .from('client_invoices')
        .select('id, invoice_number, amount, due_at, clients(id, name)')
        .in('status', ['sent', 'overdue'])
        .lt('due_at', today)
        .order('due_at', { ascending: true })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as unknown as Array<{
        id: string
        invoice_number: string
        amount: number
        due_at: string | null
        clients: { id: string; name: string } | null
      }>
    },
  })
}

export function useDevicesInMaintenance(limit = 10, olderThanDays = 7) {
  return useQuery({
    queryKey: ['devices-maintenance', limit, olderThanDays],
    queryFn: async () => {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - olderThanDays)
      const cutoffStr = cutoff.toISOString()
      const { data, error } = await supabase
        .from('devices')
        .select('id, name, identifier, updated_at')
        .eq('status', 'maintenance')
        .lt('updated_at', cutoffStr)
        .order('updated_at', { ascending: true })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as Array<{ id: string; name: string | null; identifier: string | null; updated_at: string }>
    },
  })
}

export function useMRRTrend(months = 6) {
  return useQuery({
    queryKey: ['mrr-trend', months],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_invoices')
        .select('issued_at, amount')
        .in('status', ['paid', 'sent', 'overdue'])
      if (error) throw error
      const byMonth: Record<string, number> = {}
      for (const row of data ?? []) {
        const month = (row.issued_at ?? '').slice(0, 7)
        if (month) byMonth[month] = (byMonth[month] ?? 0) + (row.amount ?? 0)
      }
      const sorted = Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-months)
      return sorted.map(([month, revenue]) => ({ month, revenue }))
    },
  })
}

type UnifiedAlertsRpcRow = {
  id: string
  alert_type: string
  severity: string
  date_val: string | null
  title: string
  subtitle: string
  link_path: string
  entity_type: string
  entity_id: string | null
}

function rpcRowsToUnifiedAlerts(rows: UnifiedAlertsRpcRow[]): UnifiedAlert[] {
  const severity = (s: string): AlertSeverity => (s === 'high' || s === 'medium' || s === 'low' ? s : 'low')
  const alerts: UnifiedAlert[] = (rows ?? []).map((r) => ({
    id: r.id,
    type: r.alert_type as UnifiedAlert['type'],
    severity: severity(r.severity),
    date: r.date_val ?? '',
    title: r.title,
    subtitle: r.subtitle,
    link: r.link_path,
    entityType: r.entity_type,
    entityId: r.entity_id ?? '',
  }))
  alerts.sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (sev !== 0) return sev
    return (a.date ?? '').localeCompare(b.date ?? '')
  })
  return alerts
}

export function useUnifiedAlerts(limit = 50) {
  const rpc = useQuery({
    queryKey: ['unified-alerts', limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_unified_alerts', { p_limit: limit })
      if (error) throw error
      return rpcRowsToUnifiedAlerts((data ?? []) as UnifiedAlertsRpcRow[])
    },
  })

  return {
    data: rpc.data ?? [],
    isLoading: rpc.isLoading,
    isError: rpc.isError,
    error: rpc.error,
    refetch: rpc.refetch,
  }
}
