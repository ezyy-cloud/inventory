import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { DeviceProviderPlan } from '../types'

export function useDeviceProviderPlans(deviceId?: string) {
  return useQuery({
    queryKey: ['device-provider-plans', deviceId],
    queryFn: async () => {
      let query = supabase
        .from('device_provider_plans')
        .select(
          `
          *,
          provider_plans(id, name, amount, billing_cycle, provider_id, providers(id, name)),
          devices(id, name, identifier, device_type)
        `,
        )
        .order('start_date', { ascending: false })

      if (deviceId) {
        query = query.eq('device_id', deviceId)
      }

      const { data, error } = await query
      if (error) throw error

      return (data ?? []) as (DeviceProviderPlan & {
        provider_plans?: {
          id: string
          name: string
          amount: number
          billing_cycle: string
          provider_id: string
          providers?: { id: string; name: string } | null
        } | null
        devices?: {
          id: string
          name: string | null
          identifier: string | null
          device_type: string
        } | null
      })[]
    },
  })
}

export function useActiveDeviceProviderPlan(deviceId: string | null) {
  const { data, ...rest } = useDeviceProviderPlans(deviceId ?? undefined)
  const active = (data ?? []).find((a) => a.status === 'active')
  return { data: active ?? null, ...rest }
}

export function useAssignDeviceToProviderPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      deviceId,
      providerPlanId,
      startDate,
      notes,
    }: {
      deviceId: string
      providerPlanId: string
      startDate?: string
      notes?: string | null
    }) => {
      const start = startDate ?? new Date().toISOString().slice(0, 10)

      const { data: existing } = await supabase
        .from('device_provider_plans')
        .select('id')
        .eq('device_id', deviceId)
        .eq('status', 'active')
        .maybeSingle()

      if (existing) {
        await supabase
          .from('device_provider_plans')
          .update({ status: 'ended', end_date: start })
          .eq('id', existing.id)
      }

      const { data, error } = await supabase
        .from('device_provider_plans')
        .insert({
          device_id: deviceId,
          provider_plan_id: providerPlanId,
          start_date: start,
          status: 'active',
          notes: notes ?? null,
        })
        .select()
        .single()
      if (error) throw error
      return data as DeviceProviderPlan
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['device-provider-plans'] })
    },
  })
}

export function useUnassignDeviceFromProviderPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, endDate }: { id: string; endDate?: string }) => {
      const end = endDate ?? new Date().toISOString().slice(0, 10)
      const { data, error } = await supabase
        .from('device_provider_plans')
        .update({ status: 'ended', end_date: end })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as DeviceProviderPlan
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['device-provider-plans'] })
    },
  })
}
