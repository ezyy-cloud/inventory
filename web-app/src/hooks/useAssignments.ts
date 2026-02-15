import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { recordAudit } from '../lib/auditLog'
import { supabase } from '../lib/supabaseClient'
import type { BillingCycle } from '../types'

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

export function useDeviceAssignmentHistory(deviceId: string | null) {
  return useQuery({
    queryKey: ['device-assignments', deviceId],
    queryFn: async () => {
      if (!deviceId) return []
      const { data, error } = await supabase
        .from('device_assignments')
        .select('*, clients(id, name)')
        .eq('device_id', deviceId)
        .order('assigned_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!deviceId,
  })
}

export function useAssignDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      deviceId,
      clientId,
      planId,
      notes,
      assignedBy,
    }: {
      deviceId: string
      clientId: string
      planId: string
      notes?: string | null
      assignedBy?: string | null
    }) => {
      const startDate = new Date().toISOString().slice(0, 10)

      const { data: plan, error: planErr } = await supabase
        .from('subscription_plans')
        .select('id, name, billing_cycle, amount, currency')
        .eq('id', planId)
        .single()
      if (planErr ?? !plan) throw new Error('Plan not found')

      const nextInvoiceDate = addBillingCycle(new Date(startDate), plan.billing_cycle as BillingCycle)
        .toISOString()
        .slice(0, 10)

      const { data: assignment, error: assignErr } = await supabase
        .from('device_assignments')
        .insert({
          device_id: deviceId,
          client_id: clientId,
          assigned_by: assignedBy ?? null,
          notes: notes ?? null,
        })
        .select()
        .single()
      if (assignErr) throw assignErr

      const { error: subErr } = await supabase.from('subscriptions').insert({
        client_id: clientId,
        device_id: deviceId,
        plan_id: planId,
        plan_name: plan.name,
        billing_cycle: plan.billing_cycle,
        amount: plan.amount,
        currency: plan.currency ?? 'USD',
        start_date: startDate,
        next_invoice_date: nextInvoiceDate,
        status: 'active',
      })
      if (subErr) {
        await supabase.from('device_assignments').delete().eq('id', assignment.id)
        throw subErr
      }

      const { error: deviceErr } = await supabase
        .from('devices')
        .update({ status: 'assigned' })
        .eq('id', deviceId)
      if (deviceErr) {
        await supabase.from('device_assignments').delete().eq('id', assignment.id)
        throw deviceErr
      }

      return assignment
    },
    onSuccess: (_, variables) => {
      void recordAudit('device.assigned', 'devices', variables.deviceId, { client_id: variables.clientId })
      void queryClient.invalidateQueries({ queryKey: ['device', variables.deviceId] })
      void queryClient.invalidateQueries({ queryKey: ['devices'] })
      void queryClient.invalidateQueries({ queryKey: ['clients'] })
      void queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

export function useUnassignDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      assignmentId,
      deviceId,
    }: {
      assignmentId: string
      deviceId: string
    }) => {
      const { error } = await supabase
        .from('device_assignments')
        .update({ unassigned_at: new Date().toISOString(), status: 'completed' })
        .eq('id', assignmentId)
      if (error) throw error

      await supabase
        .from('subscriptions')
        .update({ status: 'canceled', end_date: new Date().toISOString().slice(0, 10) })
        .eq('device_id', deviceId)
        .eq('status', 'active')

      await supabase.from('devices').update({ status: 'in_stock' }).eq('id', deviceId)
      return assignmentId
    },
    onSuccess: (_, variables) => {
      void recordAudit('device.unassigned', 'devices', variables.deviceId)
      void queryClient.invalidateQueries({ queryKey: ['device', variables.deviceId] })
      void queryClient.invalidateQueries({ queryKey: ['devices'] })
      void queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

export function useBulkUnassignDevices() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (deviceIds: string[]) => {
      if (deviceIds.length === 0) return { count: 0 }
      const { data, error } = await supabase.rpc('bulk_unassign_devices', { device_ids: deviceIds })
      if (error) throw error
      return { count: (data as number) ?? 0 }
    },
    onSuccess: (data) => {
      if (data?.count != null && data.count > 0) {
        void recordAudit('device.bulk_unassign', 'devices', null, { count: data.count })
      }
      void queryClient.invalidateQueries({ queryKey: ['devices'] })
      void queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}
