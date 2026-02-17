import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { QueryErrorBanner } from '../components/QueryErrorBanner'
import { StatusPill } from '../components/StatusPill'
import { useToast } from '../context/ToastContext'
import { useRole } from '../context/RoleContext'
import { ClientSelector } from '../components/ClientSelector'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useClientInvoicesList, useCreateInvoice, useOverdueInvoicesSummary, useUpdateInvoice, useGeneratePeriodInvoices } from '../hooks/useInvoices'
import { sendInvoiceEmail } from '../lib/resend'
import { useSubscriptionPlans } from '../hooks/useSubscriptionPlans'
import { useClientDevices } from '../hooks/useDevices'
import type { DeviceType } from '../types'

const inputClass = 'w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-black'
const labelClass = 'block text-xs tracking-wide text-black/60 mt-3 first:mt-0'
const DEFAULT_PAGE_SIZE = 25

function parseInvoicesListParams(searchParams: URLSearchParams) {
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(10, Number.parseInt(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE))
  const q = searchParams.get('q') ?? ''
  const status = searchParams.get('status') ?? ''
  const sort = (searchParams.get('sort') ?? 'invoice_number') as 'invoice_number' | 'issued_at' | 'due_at' | 'updated_at'
  const order = (searchParams.get('order') ?? 'desc') as 'asc' | 'desc'
  return { page, pageSize, q, status, sort, order }
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-black/10 bg-black/5 px-4 py-3">
      <p className="text-xs tracking-wide text-black/60">{label}</p>
      <p className="mt-2 break-words text-lg font-semibold text-black">{value}</p>
    </div>
  )
}

export function InvoicesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { page, pageSize, q: searchQuery, status: statusFilter, sort: sortBy, order: sortOrder } = parseInvoicesListParams(searchParams)
  const [searchInput, setSearchInput] = useState(searchQuery)
  const debouncedSearch = useDebouncedValue(searchInput, 350)
  useEffect(() => {
    setSearchInput(searchQuery)
  }, [searchQuery])

  const setParams = useCallback(
    (updates: Record<string, string | number | undefined>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(updates)) {
          if (v === undefined || v === '' || (k === 'page' && v === 1)) next.delete(k)
          else next.set(k, String(v))
        }
        if (!next.has('page')) next.set('page', '1')
        return next
      })
    },
    [setSearchParams]
  )
  useEffect(() => {
    if (debouncedSearch !== searchQuery) {
      setParams({ q: debouncedSearch.trim() || undefined, page: 1 })
    }
  }, [debouncedSearch, searchQuery, setParams])

  const [showInvModal, setShowInvModal] = useState(false)
  const [invForm, setInvForm] = useState({ plan_id: '', client_id: '', device_id: '', amount: 0, due_at: '', status: 'draft' as const })
  const { data: listData, isError: invoicesError, error: invoicesErrorObj, refetch: refetchInvoices } = useClientInvoicesList({
    page,
    pageSize,
    search: debouncedSearch.trim() || undefined,
    status: statusFilter || undefined,
    sortBy,
    sortOrder,
  })
  const { data: overdueSummary } = useOverdueInvoicesSummary()
  const { data: clientDevices } = useClientDevices(invForm.client_id ?? null)
  const selectedInvDevice = (clientDevices ?? []).find((d) => d.id === invForm.device_id)
  const invDeviceType = selectedInvDevice?.device_type as DeviceType | undefined
  const { data: subscriptionPlansForDevice } = useSubscriptionPlans(invDeviceType, { includeInactive: true })
  const { addToast } = useToast()
  const { isViewer } = useRole()
  const createInv = useCreateInvoice()
  const updateInv = useUpdateInvoice()
  const generatePeriodInvoices = useGeneratePeriodInvoices()
  const prevGenCountRef = useRef<number | null>(null)
  useEffect(() => {
    if (generatePeriodInvoices.isSuccess && generatePeriodInvoices.data !== undefined) {
      if (prevGenCountRef.current !== generatePeriodInvoices.data) {
        addToast(`Generated ${generatePeriodInvoices.data} period invoice(s).`)
        prevGenCountRef.current = generatePeriodInvoices.data
      }
      generatePeriodInvoices.reset()
    }
  }, [generatePeriodInvoices.isSuccess, generatePeriodInvoices.data, generatePeriodInvoices.reset, addToast])

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createInv.mutateAsync({
        client_id: invForm.client_id,
        plan_id: invForm.plan_id || null,
        device_id: invForm.device_id || null,
        amount: invForm.amount,
        due_at: invForm.due_at || null,
        status: invForm.status,
      })
      setShowInvModal(false)
      setInvForm({ plan_id: '', client_id: '', device_id: '', amount: 0, due_at: '', status: 'draft' })
    } catch (err) {
      console.error(err)
    }
  }

  const handleMarkInvoicePaid = (id: string) => {
    updateInv.mutate({ id, status: 'paid', paid_at: new Date().toISOString().slice(0, 10) })
  }
  const handleVoidInvoice = (id: string) => {
    if (window.confirm('Void this invoice? This cannot be undone.')) {
      updateInv.mutate({ id, status: 'void' })
    }
  }
  const handleSendInvoice = async (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const result = await sendInvoiceEmail(id)
    if ('error' in result) {
      addToast(result.error)
      return
    }
    await updateInv.mutateAsync({ id, status: 'sent', issued_at: new Date().toISOString().slice(0, 10) })
    addToast('Invoice sent.')
  }

  const overdueTotal = overdueSummary?.totalAmount ?? 0
  const { rows: paginatedInvoices, totalCount } = listData ?? { rows: [], totalCount: 0 }

  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      const urlQ = next.get('q') ?? ''
      const urlStatus = next.get('status') ?? ''
      if (urlQ !== searchQuery || urlStatus !== statusFilter) next.set('page', '1')
      return next
    })
  }, [searchQuery, statusFilter, setSearchParams])

  const hasQueryError = invoicesError
  const refetchAll = () => {
    void refetchInvoices()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      {hasQueryError && (
        <QueryErrorBanner
          className="col-span-full"
          message={invoicesErrorObj?.message ?? 'Failed to load invoices.'}
          onRetry={refetchAll}
        />
      )}
      {(createInv.isError ?? updateInv.isError ?? generatePeriodInvoices.isError) && (
        <div className="col-span-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {(createInv.error ?? updateInv.error ?? generatePeriodInvoices.error)?.message ?? 'Action failed. Please try again.'}
        </div>
      )}
      <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
        <div className="sticky top-16 z-20 -m-6 mb-4 rounded-t-3xl border-b border-black/10 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-black">Invoices</h2>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              placeholder="Search…"
              aria-label="Search invoices"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-black placeholder:text-black/40"
            />
            <select
              aria-label="Page size"
              value={pageSize}
              onChange={(e) => setParams({ pageSize: Number(e.target.value), page: 1 })}
              className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <select
              aria-label="Filter by status"
              value={statusFilter ?? 'all'}
              onChange={(e) => setParams({ status: e.target.value === 'all' ? undefined : e.target.value, page: 1 })}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
            >
              <option value="all">All status</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="void">Void</option>
            </select>
            {!isViewer && (
              <>
                <button
                  type="button"
                  onClick={() => generatePeriodInvoices.mutate()}
                  disabled={generatePeriodInvoices.isPending}
                  className="rounded-full border border-black/20 bg-white px-4 py-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98] disabled:opacity-50"
                >
                  {generatePeriodInvoices.isPending ? 'Generating…' : 'Generate period invoices'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInvModal(true)}
                  className="rounded-full bg-black px-4 py-2 text-xs font-semibold tracking-wide whitespace-nowrap text-white transition duration-200 hover:bg-black/90 active:scale-[0.98]"
                >
                  Create Invoice
                </button>
              </>
            )}
          </div>
        </div>
        </div>
        <div className="mt-6 space-y-4">
          {paginatedInvoices.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-black/60">
                {(searchQuery || statusFilter) ? 'No invoices match your filters.' : 'No invoices.'}
              </p>
              {(searchQuery || statusFilter) && (
                <button
                  type="button"
                  onClick={() => setParams({ q: undefined, status: undefined, page: 1 })}
                  className="mt-3 text-xs font-semibold tracking-wide text-black underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              {paginatedInvoices.map((inv) => (
                <Link
                  key={inv.id}
                  to={`/invoices/${inv.id}`}
                  className="flex items-center justify-between rounded-2xl border border-black/10 bg-white px-4 py-3 transition hover:bg-black/5"
                >
                  <div>
                    <p className="text-sm font-semibold text-black">{inv.invoice_number}</p>
                    <p className="text-xs text-black/60">
                      {(inv as { clients?: { name: string } }).clients?.name ?? '—'}
                      {(inv as { subscription_plans?: { name: string } | null }).subscription_plans != null && (
                        <> · {(inv as { subscription_plans?: { name: string } }).subscription_plans?.name ?? '—'}</>
                      )}
                      {(inv as { devices?: { name: string | null; identifier: string | null } | null }).devices != null && (
                        <> · {(inv as { devices?: { name?: string | null; identifier?: string | null } }).devices?.name ?? (inv as { devices?: { identifier?: string | null } }).devices?.identifier ?? '—'}</>
                      )}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-xs text-black/60">
                      <span>Due {inv.due_at ?? '—'}</span>
                      <span>USD {inv.amount?.toLocaleString() ?? '—'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill value={inv.status} />
                    {!isViewer && (
                      <>
                        {inv.status === 'draft' && (
                          <button
                            onClick={(e) => handleSendInvoice(inv.id, e)}
                            className="rounded-full border border-black/20 bg-white px-3 py-1.5 text-xs font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
                          >
                            Send
                          </button>
                        )}
                        {(inv.status === 'sent' || inv.status === 'overdue') && (
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleMarkInvoicePaid(inv.id)
                            }}
                            className="rounded-full bg-black px-3 py-1.5 text-xs font-semibold tracking-wide text-white transition duration-200 hover:bg-black/90 active:scale-[0.98]"
                          >
                            Mark paid
                          </button>
                        )}
                        {inv.status !== 'void' && inv.status !== 'paid' && (
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleVoidInvoice(inv.id)
                            }}
                            className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold tracking-wide text-red-600 transition duration-200 hover:bg-red-50 active:scale-[0.98]"
                          >
                            Void
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </Link>
              ))}
              <Pagination
                page={page}
                pageSize={pageSize}
                totalCount={totalCount}
                onPageChange={(p) => setParams({ page: p })}
              />
            </>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
          <h3 className="text-lg font-semibold text-black">Balance overview</h3>
          <div className="mt-5 space-y-4">
            <MiniMetric label="Overdue invoices" value={`USD ${overdueTotal.toLocaleString()}`} />
          </div>
        </div>
      </div>

      {showInvModal && (
        <Modal title="Create Invoice" onClose={() => setShowInvModal(false)}>
          <form onSubmit={handleCreateInvoice} className="space-y-4">
            <label className={labelClass}>Client</label>
            <ClientSelector
              value={invForm.client_id}
              onChange={(id) => setInvForm((p) => ({ ...p, client_id: id ?? '', device_id: '', plan_id: '' }))}
              placeholder="Select client"
              aria-label="Select client"
            />
            <label className={labelClass}>Device</label>
            <select
              value={invForm.device_id}
              onChange={(e) => setInvForm((p) => ({ ...p, device_id: e.target.value, plan_id: '' }))}
              className={inputClass}
              required
              disabled={!invForm.client_id}
            >
              <option value="">Select device</option>
              {(clientDevices ?? []).map((d) => (
                <option key={d.id} value={d.id}>{d.name ?? d.identifier ?? d.id}</option>
              ))}
            </select>
            <label className={labelClass}>Subscription Plan</label>
            <select
              value={invForm.plan_id}
              onChange={(e) => setInvForm((p) => ({ ...p, plan_id: e.target.value }))}
              className={inputClass}
              required
              disabled={!invForm.device_id}
            >
              <option value="">Select plan</option>
              {(subscriptionPlansForDevice ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name} — USD {p.amount.toLocaleString()} / {p.billing_cycle}</option>
              ))}
            </select>
            <label className={labelClass}>Amount</label>
            <input type="number" step="0.01" value={invForm.amount || ''} onChange={(e) => setInvForm((p) => ({ ...p, amount: Number.parseFloat(e.target.value) || 0 }))} className={inputClass} required />
            <label className={labelClass}>Due date</label>
            <input type="date" value={invForm.due_at} onChange={(e) => setInvForm((p) => ({ ...p, due_at: e.target.value }))} className={inputClass} />
            <div className="mt-6 flex gap-3">
              <button type="submit" disabled={createInv.isPending} className="rounded-2xl bg-black px-6 py-2 text-sm font-semibold tracking-wide text-white transition duration-200 hover:bg-black/90 active:scale-[0.98] disabled:opacity-50">Create</button>
              <button type="button" onClick={() => setShowInvModal(false)} className="rounded-2xl border border-black/15 px-6 py-2 text-sm font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]">Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
