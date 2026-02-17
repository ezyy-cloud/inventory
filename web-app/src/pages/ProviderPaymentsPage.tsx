import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { QueryErrorBanner } from '../components/QueryErrorBanner'
import { StatusPill } from '../components/StatusPill'
import { useRole } from '../context/RoleContext'
import {
  useProviderPayments,
  useCreateProviderPayment,
  useUpdateProviderPayment,
  useCreateProviderPaymentSuggestions,
  useCreateProviderBillingRecord,
  useRecentProviderBillingHistory,
  useProviders,
} from '../hooks/useProviders'
import { useProviderPlans } from '../hooks/useProviderPlans'
import { supabase } from '../lib/supabaseClient'

const inputClass = 'w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-black'
const labelClass = 'block text-xs tracking-wide text-black/60 mt-3 first:mt-0'
const PAGE_SIZE = 10

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-black/10 bg-black/5 px-4 py-3">
      <p className="text-xs tracking-wide text-black/60">{label}</p>
      <p className="mt-2 break-words text-lg font-semibold text-black">{value}</p>
    </div>
  )
}

export function ProviderPaymentsPage() {
  const [showPayModal, setShowPayModal] = useState(false)
  const [showSuggestModal, setShowSuggestModal] = useState(false)
  const [showLogBillingModal, setShowLogBillingModal] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [payForm, setPayForm] = useState({ provider_id: '', provider_plan_id: '', device_id: '', amount: 0, due_at: '', description: '' })
  const now = new Date()
  const [suggestPeriod, setSuggestPeriod] = useState({
    periodStart: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    periodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
  })
  const [billingForm, setBillingForm] = useState({
    provider_id: '',
    amount: 0,
    period_start: '',
    period_end: '',
    invoice_number: '',
    due_date: '',
  })
  const { data: providerPayments, isError: paymentsError, error: paymentsErrorObj, refetch: refetchPayments } = useProviderPayments()
  const { data: providers, isError: providersError, error: providersErrorObj, refetch: refetchProviders } = useProviders()
  const { data: providerPlans } = useProviderPlans(payForm.provider_id || undefined)
  const { data: devices, isError: devicesError, error: devicesErrorObj, refetch: refetchDevices } = useQuery({
    queryKey: ['devices-for-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('id, name, identifier')
        .order('name', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
  const { isViewer } = useRole()
  const createPay = useCreateProviderPayment()
  const updatePay = useUpdateProviderPayment()
  const suggestPayments = useCreateProviderPaymentSuggestions()
  const createBillingRecord = useCreateProviderBillingRecord()
  const { data: recentBillingHistory } = useRecentProviderBillingHistory(15)

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createPay.mutateAsync({
        provider_id: payForm.provider_id,
        provider_plan_id: payForm.provider_plan_id || null,
        device_id: payForm.device_id || null,
        amount: payForm.amount,
        due_at: payForm.due_at || null,
        description: payForm.description || null,
      })
      setShowPayModal(false)
      setPayForm({ provider_id: '', provider_plan_id: '', device_id: '', amount: 0, due_at: '', description: '' })
    } catch (err) {
      console.error(err)
    }
  }

  const handleMarkPaymentPaid = (id: string) => {
    updatePay.mutate({ id, status: 'paid', paid_at: new Date().toISOString().slice(0, 10) })
  }

  const hasQueryError = paymentsError ?? providersError ?? devicesError
  const refetchAll = () => {
    void refetchPayments()
    void refetchProviders()
    void refetchDevices()
  }

  const searchLower = search.trim().toLowerCase()
  const pendingPaymentsRaw = (providerPayments ?? []).filter((p) => ['pending', 'scheduled', 'overdue'].includes(p.status))
  const filteredPayments = searchLower
    ? pendingPaymentsRaw.filter((p) => {
        const provName = (p as { providers?: { name: string } }).providers?.name?.toLowerCase() ?? ''
        return provName.includes(searchLower)
      })
    : pendingPaymentsRaw
  const paginatedPayments = filteredPayments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const providerDue = (providerPayments ?? [])
    .filter((p) => ['pending', 'scheduled', 'overdue'].includes(p.status))
    .reduce((s, p) => s + (p.amount ?? 0), 0)

  useEffect(() => {
    setPage(1)
  }, [search])

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      {hasQueryError && (
        <QueryErrorBanner
          className="col-span-full"
          message={paymentsErrorObj?.message ?? providersErrorObj?.message ?? devicesErrorObj?.message ?? 'Failed to load payments.'}
          onRetry={refetchAll}
        />
      )}
      {(createPay.isError ?? updatePay.isError) && (
        <div className="col-span-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {(createPay.error ?? updatePay.error)?.message ?? 'Action failed. Please try again.'}
        </div>
      )}
      <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
        <div className="sticky top-16 z-20 -m-6 mb-4 rounded-t-3xl border-b border-black/10 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-black">Provider payments</h2>
            <div className="flex items-center gap-3">
              <input
                type="search"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-black placeholder:text-black/40"
              />
              {!isViewer && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowSuggestModal(true)}
                    disabled={suggestPayments.isPending}
                    className="rounded-full border border-black/20 bg-white px-4 py-2 text-xs font-semibold tracking-wide whitespace-nowrap text-black transition duration-200 hover:bg-black/5 active:scale-[0.98] disabled:opacity-50"
                  >
                    Suggest payments
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLogBillingModal(true)}
                    className="rounded-full border border-black/20 bg-white px-4 py-2 text-xs font-semibold tracking-wide whitespace-nowrap text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
                  >
                    Log billing record
                  </button>
                  <button
                    onClick={() => setShowPayModal(true)}
                    className="rounded-full bg-black px-4 py-2 text-xs font-semibold tracking-wide whitespace-nowrap text-white transition duration-200 hover:bg-black/90 active:scale-[0.98]"
                  >
                    Add payment
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="mt-6 space-y-4">
          {filteredPayments.length === 0 ? (
            <p className="py-8 text-center text-sm text-black/60">No pending provider payments.</p>
          ) : (
            <>
              {paginatedPayments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-black">
                      {(p as { providers?: { name: string } }).providers?.name ?? '—'}
                      {(p as { provider_plans?: { name: string } | null }).provider_plans != null && (
                        <> · {(p as { provider_plans?: { name: string } }).provider_plans?.name ?? '—'}</>
                      )}
                      {(p as { devices?: { name: string | null; identifier: string | null } | null }).devices != null && (
                        <> · {(p as { devices?: { name?: string | null; identifier?: string | null } }).devices?.name ?? (p as { devices?: { identifier?: string | null } }).devices?.identifier ?? '—'}</>
                      )}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-xs text-black/60">
                      <span>Due {p.due_at ?? '—'}</span>
                      <span>USD {p.amount?.toLocaleString() ?? '—'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill value={p.status} />
                    {!isViewer && (p.status === 'pending' || p.status === 'overdue') && (
                      <button
                        onClick={() => handleMarkPaymentPaid(p.id)}
                        className="text-xs font-semibold tracking-wide text-black/60 hover:text-black"
                      >
                        Mark paid
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                totalCount={filteredPayments.length}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
          <h3 className="text-lg font-semibold text-black">Balance overview</h3>
          <div className="mt-5 space-y-4">
            <MiniMetric label="Provider due" value={`USD ${providerDue.toLocaleString()}`} />
          </div>
        </div>
        <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
          <h3 className="text-lg font-semibold text-black">Recent billing records</h3>
          <div className="mt-4 space-y-2">
            {(recentBillingHistory ?? []).length === 0 ? (
              <p className="text-sm text-black/60">No billing records yet.</p>
            ) : (
              (recentBillingHistory ?? []).map((r) => (
                <div key={r.id} className="flex justify-between rounded-2xl border border-black/10 bg-black/5 px-4 py-2 text-sm">
                  <span className="font-medium text-black">{(r as { providers?: { name: string } | null }).providers?.name ?? '—'}</span>
                  <span className="text-black/70">{(r as { invoice_number?: string | null }).invoice_number ?? '—'} · USD {r.amount?.toLocaleString() ?? '0'}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showSuggestModal && (
        <Modal title="Suggest provider payments" onClose={() => setShowSuggestModal(false)}>
          <p className="text-sm text-black/70">Create draft provider payments for active device–provider plans in this period.</p>
          <div className="mt-4 space-y-3">
            <label className={labelClass}>Period start</label>
            <input
              type="date"
              value={suggestPeriod.periodStart}
              onChange={(e) => setSuggestPeriod((p) => ({ ...p, periodStart: e.target.value }))}
              className={inputClass}
            />
            <label className={labelClass}>Period end</label>
            <input
              type="date"
              value={suggestPeriod.periodEnd}
              onChange={(e) => setSuggestPeriod((p) => ({ ...p, periodEnd: e.target.value }))}
              className={inputClass}
            />
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                disabled={suggestPayments.isPending}
                onClick={async () => {
                  const count = await suggestPayments.mutateAsync({
                    periodStart: suggestPeriod.periodStart,
                    periodEnd: suggestPeriod.periodEnd,
                  })
                  setShowSuggestModal(false)
                  alert(`Created ${count} suggested payment(s).`)
                }}
                className="rounded-2xl bg-black px-6 py-2 text-sm font-semibold tracking-wide text-white transition duration-200 hover:bg-black/90 active:scale-[0.98] disabled:opacity-50"
              >
                {suggestPayments.isPending ? 'Creating…' : 'Create suggestions'}
              </button>
              <button type="button" onClick={() => setShowSuggestModal(false)} className="rounded-2xl border border-black/15 px-6 py-2 text-sm font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]">Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {showLogBillingModal && (
        <Modal title="Log provider billing record" onClose={() => setShowLogBillingModal(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              await createBillingRecord.mutateAsync({
                provider_id: billingForm.provider_id,
                amount: billingForm.amount,
                period_start: billingForm.period_start || null,
                period_end: billingForm.period_end || null,
                invoice_number: billingForm.invoice_number || null,
                due_date: billingForm.due_date || null,
              })
              setShowLogBillingModal(false)
              setBillingForm({ provider_id: '', amount: 0, period_start: '', period_end: '', invoice_number: '', due_date: '' })
            }}
            className="space-y-4"
          >
            <label className={labelClass}>Provider</label>
            <select
              value={billingForm.provider_id}
              onChange={(e) => setBillingForm((p) => ({ ...p, provider_id: e.target.value }))}
              className={inputClass}
              required
            >
              <option value="">Select provider</option>
              {(providers ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <label className={labelClass}>Amount</label>
            <input type="number" step="0.01" value={billingForm.amount || ''} onChange={(e) => setBillingForm((p) => ({ ...p, amount: Number.parseFloat(e.target.value) || 0 }))} className={inputClass} required />
            <label className={labelClass}>Invoice number</label>
            <input type="text" value={billingForm.invoice_number} onChange={(e) => setBillingForm((p) => ({ ...p, invoice_number: e.target.value }))} className={inputClass} />
            <label className={labelClass}>Period start</label>
            <input type="date" value={billingForm.period_start} onChange={(e) => setBillingForm((p) => ({ ...p, period_start: e.target.value }))} className={inputClass} />
            <label className={labelClass}>Period end</label>
            <input type="date" value={billingForm.period_end} onChange={(e) => setBillingForm((p) => ({ ...p, period_end: e.target.value }))} className={inputClass} />
            <label className={labelClass}>Due date</label>
            <input type="date" value={billingForm.due_date} onChange={(e) => setBillingForm((p) => ({ ...p, due_date: e.target.value }))} className={inputClass} />
            <div className="mt-6 flex gap-3">
              <button type="submit" disabled={createBillingRecord.isPending} className="rounded-2xl bg-black px-6 py-2 text-sm font-semibold tracking-wide text-white transition duration-200 hover:bg-black/90 active:scale-[0.98] disabled:opacity-50">Save</button>
              <button type="button" onClick={() => setShowLogBillingModal(false)} className="rounded-2xl border border-black/15 px-6 py-2 text-sm font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]">Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {showPayModal && (
        <Modal title="Add Provider Payment" onClose={() => setShowPayModal(false)}>
          <form onSubmit={handleCreatePayment} className="space-y-4">
            <label className={labelClass}>Provider</label>
            <select
              value={payForm.provider_id}
              onChange={(e) => setPayForm((p) => ({ ...p, provider_id: e.target.value, provider_plan_id: '' }))}
              className={inputClass}
              required
            >
              <option value="">Select provider</option>
              {(providers ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <label className={labelClass}>Provider Plan</label>
            <select
              value={payForm.provider_plan_id}
              onChange={(e) => setPayForm((p) => ({ ...p, provider_plan_id: e.target.value }))}
              className={inputClass}
              required
              disabled={!payForm.provider_id}
            >
              <option value="">Select plan</option>
              {(providerPlans ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name} — USD {p.amount?.toLocaleString() ?? '0'} / {p.billing_cycle}</option>
              ))}
            </select>
            <label className={labelClass}>Device</label>
            <select value={payForm.device_id} onChange={(e) => setPayForm((p) => ({ ...p, device_id: e.target.value }))} className={inputClass} required>
              <option value="">Select device</option>
              {(devices ?? []).map((d) => (
                <option key={d.id} value={d.id}>{d.name ?? d.identifier ?? d.id}</option>
              ))}
            </select>
            <label className={labelClass}>Amount</label>
            <input type="number" step="0.01" value={payForm.amount || ''} onChange={(e) => setPayForm((p) => ({ ...p, amount: Number.parseFloat(e.target.value) || 0 }))} className={inputClass} required />
            <label className={labelClass}>Due date</label>
            <input type="date" value={payForm.due_at} onChange={(e) => setPayForm((p) => ({ ...p, due_at: e.target.value }))} className={inputClass} />
            <label className={labelClass}>Description</label>
            <input type="text" value={payForm.description} onChange={(e) => setPayForm((p) => ({ ...p, description: e.target.value }))} className={inputClass} placeholder="Optional" />
            <div className="mt-6 flex gap-3">
              <button type="submit" disabled={createPay.isPending} className="rounded-2xl bg-black px-6 py-2 text-sm font-semibold tracking-wide text-white transition duration-200 hover:bg-black/90 active:scale-[0.98] disabled:opacity-50">Create</button>
              <button type="button" onClick={() => setShowPayModal(false)} className="rounded-2xl border border-black/15 px-6 py-2 text-sm font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]">Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
