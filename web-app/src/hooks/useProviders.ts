import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { Provider, ProviderPayment } from '../types'

export type ProviderBillingRecord = {
  id: string
  provider_id: string
  device_id: string | null
  provider_payment_id: string | null
  period_start: string | null
  period_end: string | null
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  paid_date: string | null
  amount: number
  currency: string | null
  status: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export function useProviders() {
  return useQuery({
    queryKey: ['providers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('providers')
        .select('*')
        .order('name', { ascending: false })
      if (error) throw error
      return (data ?? []) as Provider[]
    },
  })
}

export function useProviderPayments(status?: string) {
  return useQuery({
    queryKey: ['provider-payments', status],
    queryFn: async () => {
      let query = supabase
        .from('provider_payments')
        .select(
          `
          *,
          providers(id, name),
          provider_plans(id, name),
          devices(id, name, identifier)
        `,
        )
        .order('due_at', { ascending: true, nullsFirst: false })

      if (status) {
        query = query.eq('status', status)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as (ProviderPayment & {
        providers: { id: string; name: string } | null
        provider_plans: { id: string; name: string } | null
        devices: { id: string; name: string | null; identifier: string | null } | null
      })[]
    },
  })
}

export function useCreateProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (provider: Partial<Provider>) => {
      const { data, error } = await supabase
        .from('providers')
        .insert(provider)
        .select()
        .single()
      if (error) throw error
      return data as Provider
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['providers'] })
    },
  })
}

export function useUpdateProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...provider }: Partial<Provider> & { id: string }) => {
      const { data, error } = await supabase
        .from('providers')
        .update(provider)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Provider
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['providers'] }),
  })
}

export function useDeleteProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('providers').delete().eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['providers'] }),
  })
}

export function useCreateProviderPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payment: Partial<ProviderPayment>) => {
      const { data, error } = await supabase
        .from('provider_payments')
        .insert(payment)
        .select()
        .single()
      if (error) throw error
      return data as ProviderPayment
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['provider-payments'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

export function useUpdateProviderPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payment }: Partial<ProviderPayment> & { id: string }) => {
      const { data, error } = await supabase
        .from('provider_payments')
        .update(payment)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as ProviderPayment
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['provider-payments'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

export function useCreateProviderPaymentSuggestions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ periodStart, periodEnd }: { periodStart: string; periodEnd: string }) => {
      const { data, error } = await supabase.rpc('create_provider_payment_suggestions_for_period', {
        period_start: periodStart,
        period_end: periodEnd,
      })
      if (error) throw error
      return (data as number) ?? 0
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['provider-payments'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

export function useProviderBillingHistory(providerId: string | null) {
  return useQuery({
    queryKey: ['provider-billing-history', providerId],
    queryFn: async () => {
      if (!providerId) return []
      const { data, error } = await supabase
        .from('provider_billing_history')
        .select('*')
        .eq('provider_id', providerId)
        .order('invoice_date', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as ProviderBillingRecord[]
    },
    enabled: !!providerId,
  })
}

export function useRecentProviderBillingHistory(limit = 20) {
  return useQuery({
    queryKey: ['provider-billing-history-recent', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('provider_billing_history')
        .select('*, providers(id, name)')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as (ProviderBillingRecord & { providers: { id: string; name: string } | null })[]
    },
  })
}

export function useCreateProviderBillingRecord() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (record: Partial<ProviderBillingRecord>) => {
      const { data, error } = await supabase
        .from('provider_billing_history')
        .insert(record)
        .select()
        .single()
      if (error) throw error
      return data as ProviderBillingRecord
    },
    onSuccess: (_, variables) => {
      if (variables.provider_id) {
        void queryClient.invalidateQueries({ queryKey: ['provider-billing-history', variables.provider_id] })
      }
      void queryClient.invalidateQueries({ queryKey: ['provider-billing-history-recent'] })
    },
  })
}
