import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export type ImportJob = {
  id: string
  source_file: string | null
  entity_type: string | null
  total_rows: number | null
  success_rows: number | null
  failed_rows: number | null
  status: string | null
  created_by: string | null
  created_at: string
  profiles?: { full_name: string | null } | null
}

export function useImportJobs(limit = 20) {
  return useQuery({
    queryKey: ['import-jobs', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_jobs')
        .select('id, source_file, entity_type, total_rows, success_rows, failed_rows, status, created_by, created_at, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as unknown as ImportJob[]
    },
  })
}
