import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export type DeviceGroup = {
  id: string
  name: string
  description: string | null
  created_at: string
}

export function useDeviceGroups() {
  return useQuery({
    queryKey: ['device-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('device_groups')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw error
      return (data ?? []) as DeviceGroup[]
    },
  })
}

export function useDeviceGroupMembers(groupId: string | null) {
  return useQuery({
    queryKey: ['device-group-members', groupId],
    queryFn: async () => {
      if (!groupId) return []
      const { data, error } = await supabase
        .from('device_group_members')
        .select('device_id')
        .eq('group_id', groupId)
      if (error) throw error
      return (data ?? []).map((r) => r.device_id)
    },
    enabled: !!groupId,
  })
}

export function useDevicesByGroup(groupId: string | null) {
  return useQuery({
    queryKey: ['devices-by-group', groupId],
    queryFn: async () => {
      if (!groupId) return []
      const { data, error } = await supabase
        .from('device_group_members')
        .select('device_id')
        .eq('group_id', groupId)
      if (error) throw error
      const ids = (data ?? []).map((r) => r.device_id)
      if (ids.length === 0) return []
      const { data: devices, error: devErr } = await supabase
        .from('devices')
        .select('id, name, identifier, device_type, status')
        .in('id', ids)
      if (devErr) throw devErr
      return devices ?? []
    },
    enabled: !!groupId,
  })
}

export function useCreateDeviceGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      const { data, error } = await supabase
        .from('device_groups')
        .insert({ name: name.trim(), description: description?.trim() || null })
        .select()
        .single()
      if (error) throw error
      return data as DeviceGroup
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['device-groups'] })
    },
  })
}

export function useDeleteDeviceGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.from('device_groups').delete().eq('id', groupId)
      if (error) throw error
    },
    onSuccess: (_, groupId) => {
      void queryClient.invalidateQueries({ queryKey: ['device-groups'] })
      void queryClient.invalidateQueries({ queryKey: ['device-group-members', groupId] })
    },
  })
}

export function useAddDevicesToGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, deviceIds }: { groupId: string; deviceIds: string[] }) => {
      if (deviceIds.length === 0) return
      const rows = deviceIds.map((device_id) => ({ group_id: groupId, device_id }))
      const { error } = await supabase.from('device_group_members').upsert(rows, { onConflict: 'device_id,group_id' })
      if (error) throw error
    },
    onSuccess: (_, { groupId }) => {
      void queryClient.invalidateQueries({ queryKey: ['device-groups'] })
      void queryClient.invalidateQueries({ queryKey: ['device-group-members', groupId] })
      void queryClient.invalidateQueries({ queryKey: ['devices-by-group', groupId] })
      void queryClient.invalidateQueries({ queryKey: ['devices'] })
    },
  })
}

export function useRemoveDevicesFromGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, deviceIds }: { groupId: string; deviceIds: string[] }) => {
      if (deviceIds.length === 0) return
      const { error } = await supabase
        .from('device_group_members')
        .delete()
        .eq('group_id', groupId)
        .in('device_id', deviceIds)
      if (error) throw error
    },
    onSuccess: (_, { groupId }) => {
      void queryClient.invalidateQueries({ queryKey: ['device-groups'] })
      void queryClient.invalidateQueries({ queryKey: ['device-group-members', groupId] })
      void queryClient.invalidateQueries({ queryKey: ['devices-by-group', groupId] })
      void queryClient.invalidateQueries({ queryKey: ['devices'] })
    },
  })
}
