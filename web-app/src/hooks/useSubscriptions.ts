import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { BillingCycle, Subscription } from '../types'

function addBillingCycle(date: Date, cycle: BillingCycle): Date {
  const d = new Date(date)
  switch (cycle) {
    case 'monthly':
      d.setMonth(d.getMonth() + 1)
      break
    case 'quarterly':
      d.setMonth(d.getMonth() + 3)
      break
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1)
      break
    default:
      d.setMonth(d.getMonth() + 1)
  }
  return d
}

export type SubscriptionsListParams = {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  sortBy?: 'plan_name' | 'start_date' | 'updated_at'
  sortOrder?: 'asc' | 'desc'
  /** Filter: end_date within the next N days */
  endWithinDays?: number
}

export function useSubscriptionsByClient(clientId: string | null) {
  return useQuery({
    queryKey: ['subscriptions-by-client', clientId],
    queryFn: async () => {
      if (!clientId) return []
      const { data, error } = await supabase
        .from('subscriptions')
        .select(
          `
          *,
          clients(id, name),
          devices(id, name, identifier),
          subscription_plans(id, name, billing_cycle, amount, applicable_device_types)
        `
        )
        .eq('client_id', clientId)
        .order('plan_name', { ascending: false })
      if (error) throw error
      return (data ?? []) as (Subscription & {
        clients: { id: string; name: string } | null
        devices: { id: string; name: string | null; identifier: string | null } | null
        subscription_plans: { id: string; name: string; billing_cycle: string; amount: number; applicable_device_types: string[] | null } | null
      })[]
    },
    enabled: !!clientId,
  })
}

export function useSubscriptions(status?: string) {
  return useQuery({
    queryKey: ['subscriptions', status],
    queryFn: async () => {
      let query = supabase
        .from('subscriptions')
        .select(
          `
          *,
          clients(id, name),
          devices(id, name, identifier),
          subscription_plans(id, name, billing_cycle, amount, applicable_device_types)
        `,
        )
        .order('plan_name', { ascending: false })

      if (status) {
        query = query.eq('status', status)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as (Subscription & {
        clients: { id: string; name: string } | null
        devices: { id: string; name: string | null; identifier: string | null } | null
        subscription_plans: { id: string; name: string; billing_cycle: string; amount: number; applicable_device_types: string[] | null } | null
      })[]
    },
  })
}

export function useSubscriptionsList(params: SubscriptionsListParams = {}) {
  const {
    page = 1,
    pageSize = 25,
    search,
    status,
    sortBy = 'plan_name',
    sortOrder = 'desc',
    endWithinDays,
  } = params

  return useQuery({
    queryKey: ['subscriptions-list', page, pageSize, search ?? '', status ?? '', sortBy, sortOrder, endWithinDays ?? null],
    queryFn: async () => {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      let query = supabase
        .from('subscriptions')
        .select(
          `
          *,
          clients(id, name),
          devices(id, name, identifier, device_type),
          subscription_plans(id, name, billing_cycle, amount, applicable_device_types)
        `,
          { count: 'exact' }
        )
        .order(sortBy, { ascending: sortOrder === 'asc', nullsFirst: false })
        .range(from, to)

      if (status) {
        query = query.eq('status', status)
      }

      if (endWithinDays != null && endWithinDays > 0) {
        const today = new Date().toISOString().slice(0, 10)
        const future = new Date(Date.now() + endWithinDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        query = query.not('end_date', 'is', null).gte('end_date', today).lte('end_date', future)
      }

      const searchTrim = search?.trim()
      if (searchTrim) {
        const pattern = `%${searchTrim}%`
        query = query.ilike('plan_name', pattern)
      }

      const { data, error, count } = await query
      if (error) throw error
      return {
        rows: (data ?? []) as (Subscription & {
          clients: { id: string; name: string } | null
          devices: { id: string; name: string | null; identifier: string | null; device_type?: string } | null
          subscription_plans: { id: string; name: string; billing_cycle: string; amount: number; applicable_device_types: string[] | null } | null
        })[],
        totalCount: count ?? 0,
      }
    },
  })
}

export function useCreateSubscription() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (sub: Partial<Subscription> & { plan_id: string }) => {
      if (!sub.plan_id) throw new Error('plan_id is required')

      const { data: plan, error: planErr } = await supabase
        .from('subscription_plans')
        .select('id, name, billing_cycle, amount, currency')
        .eq('id', sub.plan_id)
        .single()
      if (planErr ?? !plan) throw new Error('Plan not found')

      const startDate = sub.start_date ?? new Date().toISOString().slice(0, 10)
      const nextInvoiceDate = addBillingCycle(
        new Date(startDate),
        (plan.billing_cycle ?? 'monthly') as BillingCycle,
      )
        .toISOString()
        .slice(0, 10)

      const { data, error } = await supabase
        .from('subscriptions')
        .insert({
          client_id: sub.client_id,
          device_id: sub.device_id ?? null,
          plan_id: sub.plan_id,
          plan_name: plan.name,
          billing_cycle: plan.billing_cycle,
          amount: plan.amount,
          currency: plan.currency ?? 'USD',
          start_date: startDate,
          next_invoice_date: nextInvoiceDate,
          status: sub.status ?? 'active',
          notes: sub.notes ?? null,
        })
        .select()
        .single()
      if (error) throw error
      return data as Subscription
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      void queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...sub }: Partial<Subscription> & { id: string }) => {
      const { data, error } = await supabase
        .from('subscriptions')
        .update(sub)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Subscription
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      void queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      void queryClient.invalidateQueries({ queryKey: ['renewal-alerts'] })
    },
  })
}

export function useDeleteSubscription() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('subscriptions').delete().eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}
