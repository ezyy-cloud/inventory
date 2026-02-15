import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export type SavedViewEntityType = 'devices' | 'clients' | 'subscriptions' | 'invoices'

export type SavedView = {
  id: string
  user_id: string
  name: string
  entity_type: SavedViewEntityType
  params: Record<string, unknown>
  is_default: boolean
  created_at: string
}

export function useSavedViews(entityType: SavedViewEntityType) {
  return useQuery({
    queryKey: ['saved-views', entityType],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) return []
      const { data, error } = await supabase
        .from('saved_views')
        .select('*')
        .eq('user_id', user.id)
        .eq('entity_type', entityType)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true })
      if (error) throw error
      return (data ?? []) as SavedView[]
    },
  })
}

export function useSaveView(entityType: SavedViewEntityType) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, params, isDefault }: { name: string; params: Record<string, unknown>; isDefault?: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) throw new Error('Not authenticated')
      if (isDefault) {
        await supabase
          .from('saved_views')
          .update({ is_default: false })
          .eq('user_id', user.id)
          .eq('entity_type', entityType)
      }
      const { data, error } = await supabase
        .from('saved_views')
        .insert({
          user_id: user.id,
          name: name.trim(),
          entity_type: entityType,
          params: params ?? {},
          is_default: isDefault ?? false,
        })
        .select()
        .single()
      if (error) throw error
      return data as SavedView
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['saved-views', entityType] })
    },
  })
}

export function useDeleteSavedView(entityType: SavedViewEntityType) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('saved_views').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['saved-views', entityType] })
    },
  })
}

export function useSetDefaultSavedView(entityType: SavedViewEntityType) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) throw new Error('Not authenticated')
      await supabase
        .from('saved_views')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .eq('entity_type', entityType)
      const { error } = await supabase
        .from('saved_views')
        .update({ is_default: true })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['saved-views', entityType] })
    },
  })
}
