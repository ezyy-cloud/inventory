import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { ProviderPlan } from '../types'
import type { DeviceType } from '../types'

export function useProviderPlans(providerId?: string, deviceType?: DeviceType, options?: { includeInactive?: boolean }) {
  return useQuery({
    queryKey: ['provider-plans', providerId, deviceType, options?.includeInactive],
    queryFn: async () => {
      let query = supabase
        .from('provider_plans')
        .select('*, providers(id, name)')
        .order('name', { ascending: false })

      if (providerId) {
        query = query.eq('provider_id', providerId)
      }

      if (!options?.includeInactive) {
        query = query.eq('is_active', true)
      }

      const { data, error } = await query
      if (error) throw error

      let plans = (data ?? []) as (ProviderPlan & { providers?: { id: string; name: string } | null })[]
      if (deviceType) {
        plans = plans.filter(
          (p) =>
            !p.applicable_device_types ||
            p.applicable_device_types.length === 0 ||
            p.applicable_device_types.includes(deviceType),
        )
      }
      return plans
    },
  })
}

export function useCreateProviderPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (plan: Partial<ProviderPlan>) => {
      const { data, error } = await supabase
        .from('provider_plans')
        .insert({
          provider_id: plan.provider_id ?? '',
          name: plan.name ?? '',
          description: plan.description ?? null,
          billing_cycle: plan.billing_cycle ?? 'monthly',
          amount: plan.amount ?? 0,
          currency: plan.currency ?? 'USD',
          applicable_device_types: plan.applicable_device_types ?? null,
          is_active: plan.is_active ?? true,
        })
        .select()
        .single()
      if (error) throw error
      return data as ProviderPlan
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['provider-plans'] })
    },
  })
}

export function useUpdateProviderPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...plan }: Partial<ProviderPlan> & { id: string }) => {
      const { data, error } = await supabase
        .from('provider_plans')
        .update({
          name: plan.name,
          description: plan.description,
          billing_cycle: plan.billing_cycle,
          amount: plan.amount,
          currency: plan.currency,
          applicable_device_types: plan.applicable_device_types,
          is_active: plan.is_active,
        })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as ProviderPlan
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['provider-plans'] })
    },
  })
}

export function useDeleteProviderPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('provider_plans').delete().eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['provider-plans'] })
      void queryClient.invalidateQueries({ queryKey: ['device-provider-plans'] })
    },
  })
}
