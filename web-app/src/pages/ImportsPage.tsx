import { useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { getImportTemplate, parseAndImportCarTrackers, parseAndImportClients, type ImportEntity } from '../lib/csvImport'
import { supabase } from '../lib/supabaseClient'
import { useImportJobs } from '../hooks/useImportJobs'

export function ImportsPage() {
  const queryClient = useQueryClient()
  const [preview, setPreview] = useState<string[][]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ success: number; failed: number; skipped: number; errors: { row: number; message: string }[] } | null>(null)
  const { data: importJobs = [], isLoading: jobsLoading } = useImportJobs(30)

  const recordImportJob = async (
    sourceFile: string,
    entityType: string,
    totalRows: number,
    successRows: number,
    failedRows: number,
  ) => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('import_jobs').insert({
      source_file: sourceFile,
      entity_type: entityType,
      total_rows: totalRows,
      success_rows: successRows,
      failed_rows: failedRows,
      status: 'completed',
      created_by: user?.id ?? null,
    })
    void queryClient.invalidateQueries({ queryKey: ['import-jobs'] })
  }

  const handleFile = async (file: File, entity: ImportEntity) => {
    const text = await file.text()
    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    const rows = lines.slice(0, 6).map((line) => {
      const rowResult: string[] = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const c = line[i]
        if (c === '"') inQuotes = !inQuotes
        else if (c === ',' && !inQuotes) {
          rowResult.push(current.trim())
          current = ''
        } else current += c
      }
      rowResult.push(current.trim())
      return rowResult
    })
    setPreview(rows)
    setResult(null)

    if (entity === 'car_trackers') {
      setImporting(true)
      try {
        const res = await parseAndImportCarTrackers(text, async (device, line) => {
          const { data: ins } = await supabase.from('devices').insert({
            device_type: 'car_tracker',
            name: device.name,
            status: device.status ?? 'in_stock',
            identifier: device.identifier ?? null,
            location: device.location ?? null,
            notes: device.notes ?? null,
          }).select().single()
          if (ins) {
            await supabase.from('car_trackers').insert({
              device_id: ins.id,
              ...line,
            })
          }
        })
        setResult({ success: res.success, failed: res.failed, skipped: res.skipped, errors: res.errors })
        await recordImportJob(file.name, 'car_trackers', res.success + res.failed + res.skipped, res.success, res.failed)
      } finally {
        setImporting(false)
      }
    } else if (entity === 'clients') {
      setImporting(true)
      try {
        const res = await parseAndImportClients(text, async (client) => {
          await supabase.from('clients').insert(client)
        })
        setResult({ success: res.success, failed: res.failed, skipped: res.skipped, errors: res.errors })
        await recordImportJob(file.name, 'clients', res.success + res.failed + res.skipped, res.success, res.failed)
      } finally {
        setImporting(false)
      }
    }
  }

  const downloadTemplate = (entity: ImportEntity) => {
    const csv = getImportTemplate(entity)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${entity}-template.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
        <h2 className="text-lg font-semibold text-black">Import data</h2>
        <div className="mt-6 space-y-4">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-black/15 bg-black/5 px-6 py-10 text-center">
            <UploadCloud className="h-10 w-10 text-black" />
            <p className="mt-4 text-sm font-semibold text-black">
              Drop CSV or click to upload
            </p>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  const name = file.name.toLowerCase()
                  const entity: ImportEntity = name.includes('tracker') ? 'car_trackers' : 'clients'
                  void handleFile(file, entity)
                }
              }}
            />
          </label>
          {importing && (
            <p className="text-center text-sm font-semibold text-black">Importing…</p>
          )}
          {result && (
            <div className="rounded-2xl border border-black/10 bg-white p-4">
              <p className="text-sm font-semibold text-black">Result</p>
              <p className="mt-2 text-sm font-semibold text-black">
                {result.success} successful, {result.failed} failed
                {result.skipped > 0 && `, ${result.skipped} duplicate row(s) skipped`}
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-xs text-red-600">
                  {result.errors.slice(0, 5).map((e) => (
                    <li key={e.row}>Row {e.row}: {e.message}</li>
                  ))}
                  {result.errors.length > 5 && (
                    <li>… and {result.errors.length - 5} more</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
        {preview.length > 0 && (
          <div className="mt-6 rounded-2xl border border-black/10 bg-white p-4">
            <p className="text-sm font-semibold text-black">Preview</p>
            <div className="mt-3 space-y-2 text-xs text-black/70">
              {preview.map((row, i) => (
                <p key={i}>{row.join(' | ')}</p>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
          <h3 className="text-lg font-semibold text-black">Templates</h3>
          <div className="mt-4 space-y-3">
            {(['car_trackers', 'clients', 'subscriptions', 'provider_payments'] as ImportEntity[]).map((entity) => (
              <div
                key={entity}
                className="flex items-center justify-between rounded-2xl border border-black/10 bg-white px-4 py-3"
              >
                <span className="text-sm font-semibold text-black">
                  {entity.replace(/_/g, ' ')} template
                </span>
                <button
                  type="button"
                  onClick={() => downloadTemplate(entity)}
                  className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
          <h3 className="text-lg font-semibold text-black">Import history</h3>
          {jobsLoading ? (
            <p className="mt-4 text-sm text-black/60">Loading…</p>
          ) : importJobs.length === 0 ? (
            <p className="mt-4 text-sm text-black/60">No imports yet.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {importJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/10 bg-black/5 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-black">
                      {job.source_file ?? '—'} · {job.entity_type ?? '—'}
                    </p>
                    <p className="text-xs text-black/60">
                      {job.total_rows ?? 0} total · {job.success_rows ?? 0} success · {job.failed_rows ?? 0} failed
                      {job.profiles?.full_name ? ` · ${job.profiles.full_name}` : ''}
                    </p>
                  </div>
                  <span className="text-xs text-black/60">
                    {job.created_at ? new Date(job.created_at).toLocaleString() : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
