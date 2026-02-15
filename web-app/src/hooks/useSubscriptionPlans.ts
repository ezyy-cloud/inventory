import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { DeviceType, SubscriptionPlan } from '../types'

export function useSubscriptionPlans(deviceType?: DeviceType, options?: { includeInactive?: boolean }) {
  return useQuery({
    queryKey: ['subscription-plans', deviceType, options?.includeInactive],
    queryFn: async () => {
      let query = supabase
        .from('subscription_plans')
        .select('*')
        .order('name', { ascending: false })

      if (!options?.includeInactive) {
        query = query.eq('is_active', true)
      }

      const { data, error } = await query
      if (error) throw error

      let plans = (data ?? []) as SubscriptionPlan[]
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

export function useCreateSubscriptionPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (plan: Partial<SubscriptionPlan>) => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .insert({
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
      return data as SubscriptionPlan
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['subscription-plans'] })
    },
  })
}

export function useUpdateSubscriptionPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...plan }: Partial<SubscriptionPlan> & { id: string }) => {
      const { data, error } = await supabase
        .from('subscription_plans')
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
      return data as SubscriptionPlan
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['subscription-plans'] })
    },
  })
}

export function useDeleteSubscriptionPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('subscription_plans').delete().eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['subscription-plans'] })
    },
  })
}

/** Default plan per device type (for pre-filling assign subscription / new subscription). */
export function useDefaultPlansPerDeviceType() {
  return useQuery({
    queryKey: ['default-plan-per-device-type'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('default_plan_per_device_type')
        .select('device_type, plan_id')
      if (error) throw error
      const map: Partial<Record<DeviceType, string>> = {}
      for (const row of data ?? []) {
        map[row.device_type as DeviceType] = row.plan_id
      }
      return map
    },
  })
}

export function useSetDefaultPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ deviceType, planId }: { deviceType: DeviceType; planId: string }) => {
      const { error } = await supabase
        .from('default_plan_per_device_type')
        .upsert({ device_type: deviceType, plan_id: planId }, { onConflict: 'device_type' })
      if (error) throw error
      return { deviceType, planId }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['default-plan-per-device-type'] })
    },
  })
}
