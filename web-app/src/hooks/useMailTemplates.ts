import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { MailTemplate } from '../types'

export function useMailTemplates() {
  return useQuery({
    queryKey: ['mail-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mail_templates')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw error
      return (data ?? []) as MailTemplate[]
    },
  })
}

export function useMailTemplate(id: string | null) {
  return useQuery({
    queryKey: ['mail-template', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('mail_templates')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as MailTemplate
    },
    enabled: !!id,
  })
}

export function useCreateMailTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; subject: string; body_html: string }) => {
      const { data, error } = await supabase
        .from('mail_templates')
        .insert({ name: input.name, subject: input.subject, body_html: input.body_html })
        .select()
        .single()
      if (error) throw error
      return data as MailTemplate
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['mail-templates'] })
    },
  })
}

export function useUpdateMailTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      name,
      subject,
      body_html,
    }: {
      id: string
      name: string
      subject: string
      body_html: string
    }) => {
      const { data, error } = await supabase
        .from('mail_templates')
        .update({ name, subject, body_html })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as MailTemplate
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['mail-templates'] })
      void queryClient.invalidateQueries({ queryKey: ['mail-template', variables.id] })
    },
  })
}

export function useDeleteMailTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('mail_templates').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['mail-templates'] })
    },
  })
}
