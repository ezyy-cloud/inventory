import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export type ClientTag = {
  id: string
  name: string
  slug: string | null
  created_at: string
}

export function useClientTags() {
  return useQuery({
    queryKey: ['client-tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_tags')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw error
      return (data ?? []) as ClientTag[]
    },
  })
}

export function useClientTagAssignments(clientId: string | null) {
  return useQuery({
    queryKey: ['client-tag-assignments', clientId],
    queryFn: async () => {
      if (!clientId) return []
      const { data, error } = await supabase
        .from('client_tag_assignments')
        .select('tag_id')
        .eq('client_id', clientId)
      if (error) throw error
      return (data ?? []).map((r) => r.tag_id)
    },
    enabled: !!clientId,
  })
}

export function useAssignClientTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ clientId, tagId }: { clientId: string; tagId: string }) => {
      const { error } = await supabase
        .from('client_tag_assignments')
        .insert({ client_id: clientId, tag_id: tagId })
      if (error) throw error
    },
    onSuccess: (_, { clientId }) => {
      void queryClient.invalidateQueries({ queryKey: ['client-tag-assignments', clientId] })
      void queryClient.invalidateQueries({ queryKey: ['clients-list'] })
    },
  })
}

export function useRemoveClientTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ clientId, tagId }: { clientId: string; tagId: string }) => {
      const { error } = await supabase
        .from('client_tag_assignments')
        .delete()
        .eq('client_id', clientId)
        .eq('tag_id', tagId)
      if (error) throw error
    },
    onSuccess: (_, { clientId }) => {
      void queryClient.invalidateQueries({ queryKey: ['client-tag-assignments', clientId] })
      void queryClient.invalidateQueries({ queryKey: ['clients-list'] })
    },
  })
}

export function useSetClientTags(clientId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { tagIds: string[]; clientId?: string }) => {
      const id = payload.clientId ?? clientId ?? null
      if (!id) throw new Error('No client')
      const tagIds = payload.tagIds
      const { error: delErr } = await supabase
        .from('client_tag_assignments')
        .delete()
        .eq('client_id', id)
      if (delErr) throw delErr
      if (tagIds.length > 0) {
        const { error: insErr } = await supabase
          .from('client_tag_assignments')
          .insert(tagIds.map((tag_id) => ({ client_id: id, tag_id })))
        if (insErr) throw insErr
      }
    },
    onSuccess: (_data, variables) => {
      const id = variables.clientId ?? clientId
      if (id) void queryClient.invalidateQueries({ queryKey: ['client-tag-assignments', id] })
      void queryClient.invalidateQueries({ queryKey: ['clients-list'] })
    },
  })
}

export function useCreateClientTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      const { data, error } = await supabase
        .from('client_tags')
        .insert({ name: name.trim(), slug: slug || null })
        .select()
        .single()
      if (error) throw error
      return data as ClientTag
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['client-tags'] })
    },
  })
}

export function useUpdateClientTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      const { data, error } = await supabase
        .from('client_tags')
        .update({ name: name.trim(), slug: slug || null })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as ClientTag
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['client-tags'] })
    },
  })
}

export function useDeleteClientTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('client_tags').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['client-tags'] })
      void queryClient.invalidateQueries({ queryKey: ['clients-list'] })
    },
  })
}
