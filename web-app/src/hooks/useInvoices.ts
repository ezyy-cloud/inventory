import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { recordAudit } from '../lib/auditLog'
import { supabase } from '../lib/supabaseClient'
import type { ClientInvoice } from '../types'

export function useInvoice(id: string | null) {
  return useQuery({
    queryKey: ['client-invoice', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('client_invoices')
        .select(
          `
          *,
          clients(id, name, email),
          subscription_plans(id, name),
          devices(id, name, identifier),
          client_invoice_items(id, description, quantity, unit_price, total)
        `,
        )
        .eq('id', id)
        .single()
      if (error) throw error
      return data as ClientInvoice & {
        clients: { id: string; name: string; email: string | null } | null
        subscription_plans: { id: string; name: string } | null
        devices: { id: string; name: string | null; identifier: string | null } | null
        client_invoice_items: Array<{
          id: string
          description: string | null
          quantity: number
          unit_price: number
          total: number
        }>
      }
    },
    enabled: !!id,
  })
}

export type ClientInvoicesListParams = {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  sortBy?: 'invoice_number' | 'issued_at' | 'due_at' | 'updated_at'
  sortOrder?: 'asc' | 'desc'
}

export function useInvoicesByClient(clientId: string | null) {
  return useQuery({
    queryKey: ['client-invoices-by-client', clientId],
    queryFn: async () => {
      if (!clientId) return []
      const { data, error } = await supabase
        .from('client_invoices')
        .select(
          `
          *,
          clients(id, name),
          subscription_plans(id, name),
          subscriptions(id, plan_name),
          devices(id, name, identifier)
        `
        )
        .eq('client_id', clientId)
        .order('invoice_number', { ascending: false })
      if (error) throw error
      return (data ?? []) as (ClientInvoice & {
        clients: { id: string; name: string } | null
        subscription_plans: { id: string; name: string } | null
        subscriptions: { id: string; plan_name: string } | null
        devices: { id: string; name: string | null; identifier: string | null } | null
      })[]
    },
    enabled: !!clientId,
  })
}

export function useClientInvoices(status?: string) {
  return useQuery({
    queryKey: ['client-invoices', status],
    queryFn: async () => {
      let query = supabase
        .from('client_invoices')
        .select(
          `
          *,
          clients(id, name),
          subscription_plans(id, name),
          subscriptions(id, plan_name),
          devices(id, name, identifier)
        `,
        )
        .order('invoice_number', { ascending: false })

      if (status) {
        query = query.eq('status', status)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as (ClientInvoice & {
        clients: { id: string; name: string } | null
        subscription_plans: { id: string; name: string } | null
        subscriptions: { id: string; plan_name: string } | null
        devices: { id: string; name: string | null; identifier: string | null } | null
      })[]
    },
  })
}

export type OutstandingInvoicesParams = {
  page?: number
  pageSize?: number
  search?: string
  sortBy?: 'invoice_number' | 'due_at' | 'updated_at'
  sortOrder?: 'asc' | 'desc'
}

/** Paginated list of invoices with status overdue or sent (outstanding). */
export function useOutstandingInvoices(params: OutstandingInvoicesParams = {}) {
  const {
    page = 1,
    pageSize = 25,
    search,
    sortBy = 'due_at',
    sortOrder = 'asc',
  } = params

  return useQuery({
    queryKey: ['outstanding-invoices', page, pageSize, search ?? '', sortBy, sortOrder],
    queryFn: async () => {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      let query = supabase
        .from('client_invoices')
        .select(
          `
          *,
          clients(id, name),
          subscription_plans(id, name),
          subscriptions(id, plan_name),
          devices(id, name, identifier)
        `,
          { count: 'exact' }
        )
        .in('status', ['overdue', 'sent'])
        .order(sortBy, { ascending: sortOrder === 'asc', nullsFirst: false })
        .range(from, to)

      const searchTrim = search?.trim()
      if (searchTrim) {
        const pattern = `%${searchTrim}%`
        query = query.ilike('invoice_number', pattern)
      }

      const { data, error, count } = await query
      if (error) throw error
      return {
        rows: (data ?? []) as (ClientInvoice & {
          clients: { id: string; name: string } | null
          subscription_plans: { id: string; name: string } | null
          subscriptions: { id: string; plan_name: string } | null
          devices: { id: string; name: string | null; identifier: string | null } | null
        })[],
        totalCount: count ?? 0,
      }
    },
  })
}

/** Count and total amount for overdue/sent invoices. Uses RPC. */
export function useOverdueInvoicesSummary() {
  return useQuery({
    queryKey: ['overdue-invoices-summary'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_overdue_invoices_summary')
      if (error) throw error
      const result = data as { count: number; total: number } | null
      const total = Number(result?.total ?? 0)
      return {
        count: result?.count ?? 0,
        totalAmount: total,
        total,
      }
    },
  })
}

export function useClientInvoicesList(params: ClientInvoicesListParams = {}) {
  const {
    page = 1,
    pageSize = 25,
    search,
    status,
    sortBy = 'invoice_number',
    sortOrder = 'desc',
  } = params

  return useQuery({
    queryKey: ['client-invoices-list', page, pageSize, search ?? '', status ?? '', sortBy, sortOrder],
    queryFn: async () => {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      let query = supabase
        .from('client_invoices')
        .select(
          `
          *,
          clients(id, name),
          subscription_plans(id, name),
          subscriptions(id, plan_name),
          devices(id, name, identifier)
        `,
          { count: 'exact' }
        )
        .order(sortBy, { ascending: sortOrder === 'asc', nullsFirst: false })
        .range(from, to)

      if (status) {
        query = query.eq('status', status)
      }

      const searchTrim = search?.trim()
      if (searchTrim) {
        const pattern = `%${searchTrim}%`
        query = query.ilike('invoice_number', pattern)
      }

      const { data, error, count } = await query
      if (error) throw error
      return {
        rows: (data ?? []) as (ClientInvoice & {
          clients: { id: string; name: string } | null
          subscription_plans: { id: string; name: string } | null
          subscriptions: { id: string; plan_name: string } | null
          devices: { id: string; name: string | null; identifier: string | null } | null
        })[],
        totalCount: count ?? 0,
      }
    },
  })
}

export function useCreateInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (invoice: Partial<ClientInvoice>) => {
      const { data, error } = await supabase
        .from('client_invoices')
        .insert(invoice)
        .select()
        .single()
      if (error) throw error
      const amount = data.amount ?? invoice.amount ?? 0
      await supabase.from('client_invoice_items').insert({
        invoice_id: data.id,
        description: 'Invoice',
        quantity: 1,
        unit_price: amount,
      })
      return data as ClientInvoice
    },
    onSuccess: (data) => {
      if (data?.id) void recordAudit('invoice.created', 'client_invoices', data.id)
      void queryClient.invalidateQueries({ queryKey: ['client-invoices'] })
      void queryClient.invalidateQueries({ queryKey: ['client-invoices-list'] })
      void queryClient.invalidateQueries({ queryKey: ['overdue-invoices-summary'] })
      void queryClient.invalidateQueries({ queryKey: ['outstanding-invoices'] })
    },
  })
}

export function useGeneratePeriodInvoices() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('generate_period_invoices')
      if (error) throw error
      return (data as number) ?? 0
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['client-invoices'] })
      void queryClient.invalidateQueries({ queryKey: ['client-invoices-list'] })
      void queryClient.invalidateQueries({ queryKey: ['overdue-invoices-summary'] })
      void queryClient.invalidateQueries({ queryKey: ['outstanding-invoices'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...invoice }: Partial<ClientInvoice> & { id: string }) => {
      const { data, error } = await supabase
        .from('client_invoices')
        .update(invoice)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as ClientInvoice
    },
    onSuccess: (data) => {
      if (data?.id && data?.status) {
        let action: 'invoice.sent' | 'invoice.paid' | 'invoice.void' | null = null
        if (data.status === 'sent') action = 'invoice.sent'
        else if (data.status === 'paid') action = 'invoice.paid'
        else if (data.status === 'void') action = 'invoice.void'
        if (action) void recordAudit(action, 'client_invoices', data.id)
      }
      void queryClient.invalidateQueries({ queryKey: ['client-invoices'] })
      void queryClient.invalidateQueries({ queryKey: ['overdue-invoices-summary'] })
      void queryClient.invalidateQueries({ queryKey: ['outstanding-invoices'] })
      if (data?.id) {
        void queryClient.invalidateQueries({ queryKey: ['client-invoice', data.id] })
      }
    },
  })
}
