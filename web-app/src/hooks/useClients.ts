import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { recordAudit } from '../lib/auditLog'
import { supabase } from '../lib/supabaseClient'
import type { Client } from '../types'

export type ClientsListParams = {
  page?: number
  pageSize?: number
  search?: string
  sortBy?: 'name' | 'created_at' | 'updated_at'
  sortOrder?: 'asc' | 'desc'
  tagIds?: string[]
  /** true = active only, false = inactive only, undefined = all */
  active?: boolean
}

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: false })
      if (error) throw error
      return (data ?? []) as Client[]
    },
  })
}

export function useClientsList(params: ClientsListParams = {}) {
  const {
    page = 1,
    pageSize = 25,
    search,
    sortBy = 'name',
    sortOrder = 'desc',
    tagIds,
    active,
  } = params

  const useRpc = (tagIds != null && tagIds.length > 0) || active !== undefined

  return useQuery({
    queryKey: ['clients-list', page, pageSize, search ?? '', sortBy, sortOrder, useRpc ? tagIds : null, active],
    queryFn: async () => {
      if (useRpc) {
        const { data, error } = await supabase.rpc('get_clients_list_filtered', {
          p_page_size: pageSize,
          p_offset: (page - 1) * pageSize,
          p_search: search?.trim() || null,
          p_sort_by: sortBy,
          p_sort_order: sortOrder,
          p_tag_ids: tagIds ?? null,
          p_active: active ?? null,
        })
        if (error) throw error
        const row = Array.isArray(data) ? data[0] : data
        const rows = (row?.rows ?? []) as Client[]
        const totalCount = Number(row?.total_count ?? 0)
        return { rows, totalCount }
      }

      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      let query = supabase
        .from('clients')
        .select('*', { count: 'exact' })
        .order(sortBy, { ascending: sortOrder === 'asc', nullsFirst: false })
        .range(from, to)

      if (active !== undefined) {
        query = query.eq('is_active', active)
      }

      const searchTrim = search?.trim()
      if (searchTrim) {
        const pattern = `%${searchTrim}%`
        query = query.or(`name.ilike.${pattern},email.ilike.${pattern},contact_name.ilike.${pattern}`)
      }

      const { data, error, count } = await query
      if (error) throw error
      return { rows: (data ?? []) as Client[], totalCount: count ?? 0 }
    },
  })
}

export function useClient(id: string | null) {
  return useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Client
    },
    enabled: !!id,
  })
}

export function useCreateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (client: Partial<Client>) => {
      const { data, error } = await supabase
        .from('clients')
        .insert(client)
        .select()
        .single()
      if (error) throw error
      return data as Client
    },
    onSuccess: (data) => {
      if (data?.id) void recordAudit('client.created', 'clients', data.id)
      void queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useUpdateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...client }: Partial<Client> & { id: string }) => {
      const { data, error } = await supabase
        .from('clients')
        .update(client)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Client
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['clients'] })
      void queryClient.invalidateQueries({ queryKey: ['clients-list'] })
      void queryClient.invalidateQueries({ queryKey: ['client', data?.id] })
    },
  })
}

/** Unassign all devices for a client (complete assignments, cancel subscriptions, set devices in_stock). */
async function unassignAllDevicesForClient(clientId: string): Promise<void> {
  const { data: assignments, error: fetchErr } = await supabase
    .from('device_assignments')
    .select('id, device_id')
    .eq('client_id', clientId)
    .is('unassigned_at', null)
  if (fetchErr) throw fetchErr
  const now = new Date().toISOString()
  const today = now.slice(0, 10)
  for (const a of assignments ?? []) {
    await supabase
      .from('device_assignments')
      .update({ unassigned_at: now, status: 'completed' })
      .eq('id', a.id)
    await supabase
      .from('subscriptions')
      .update({ status: 'canceled', end_date: today })
      .eq('device_id', a.device_id)
      .eq('status', 'active')
    await supabase.from('devices').update({ status: 'in_stock' }).eq('id', a.device_id)
  }
}

export function useDeleteClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await unassignAllDevicesForClient(id)
      const { error } = await supabase.from('clients').delete().eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: (deletedId) => {
      if (deletedId) void recordAudit('client.deleted', 'clients', deletedId)
      void queryClient.invalidateQueries({ queryKey: ['clients'] })
      void queryClient.invalidateQueries({ queryKey: ['clients-list'] })
      void queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      void queryClient.invalidateQueries({ queryKey: ['devices'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}
