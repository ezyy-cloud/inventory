import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { Notification } from '../types'

const NOTIFICATIONS_QUERY_KEY = ['notifications']

function notificationLink(n: Notification): string {
  if (n.entity_type === 'client_invoice' && n.entity_id) return `/invoices/${n.entity_id}`
  if (n.entity_type === 'device' && n.entity_id) return `/devices/${n.entity_id}`
  if (n.entity_type === 'subscription') return '/subscriptions'
  if (n.entity_type === 'client' && n.entity_id) return `/clients/${n.entity_id}`
  if (n.entity_type === 'mail_broadcast') return '/mail'
  return '/alerts'
}

export function useNotifications(limit = 20) {
  const query = useQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, user_id, type, title, body, entity_type, entity_id, read_at, created_at')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as Notification[]
    },
    staleTime: 60 * 1000,
  })

  const unreadCount =
    query.data?.filter((n) => n.read_at == null).length ?? 0

  return {
    ...query,
    notifications: query.data ?? [],
    unreadCount,
    linkFor: notificationLink,
  }
}

export function useMarkNotificationRead() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) return
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null)
      if (error) throw error
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY })
    },
  })
}
