import { useEffect, useState } from 'react'
import { Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { QueryErrorBanner } from '../components/QueryErrorBanner'
import { useRole } from '../context/RoleContext'
import { useProviders, useProviderPayments, useCreateProvider, useCreateProviderPayment } from '../hooks/useProviders'
import {
  useProviderPlans,
  useCreateProviderPlan,
  useUpdateProviderPlan,
  useDeleteProviderPlan,
} from '../hooks/useProviderPlans'
import { DEVICE_TYPE_LABELS, type DeviceType, type ProviderPlan } from '../types'

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-black/10 bg-black/5 px-4 py-3">
      <p className="text-xs tracking-wide text-black/60">{label}</p>
      <p className="mt-2 break-words text-lg font-semibold text-black">{value}</p>
    </div>
  )
}

const inputClass = 'w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-black'
const labelClass = 'block text-xs tracking-wide text-black/60 mt-3 first:mt-0'
const PAGE_SIZE = 10
const DEVICE_TYPES: DeviceType[] = [
  'car_tracker', 'ip_camera', 'starlink', 'wifi_access_point', 'tv', 'drone', 'printer', 'websuite', 'isp_link', 'pos_device', 'other',
]

export function ProvidersPage() {
  const [showProviderModal, setShowProviderModal] = useState(false)
  const [page, setPage] = useState(1)
  const [paymentsPage, setPaymentsPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [paymentsSearch, setPaymentsSearch] = useState('')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [planProviderId, setPlanProviderId] = useState<string | null>(null)
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [providerForm, setProviderForm] = useState({ name: '', provider_type: '', contact_name: '', email: '', phone: '' })
  const [paymentForm, setPaymentForm] = useState({ provider_id: '', amount: 0, due_at: '', description: '' })
  const [planForm, setPlanForm] = useState<{
    name: string
    description: string
    billing_cycle: 'monthly' | 'quarterly' | 'yearly'
    amount: number
    applicable_device_types: DeviceType[]
  }>({
    name: '',
    description: '',
    billing_cycle: 'monthly',
    amount: 0,
    applicable_device_types: [],
  })
  const { isViewer } = useRole()
  const { data: providers, isLoading, isError, error, refetch } = useProviders()
  const { data: payments, isError: paymentsError, error: paymentsErrorObj, refetch: refetchPayments } = useProviderPayments()
  const { data: providerPlans, isError: plansError, error: plansErrorObj, refetch: refetchPlans } = useProviderPlans(undefined, undefined, { includeInactive: true })
  const createProvider = useCreateProvider()
  const createPayment = useCreateProviderPayment()
  const createPlan = useCreateProviderPlan()
  const updatePlan = useUpdateProviderPlan()
  const deletePlan = useDeleteProviderPlan()

  const handleCreateProvider = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createProvider.mutateAsync(providerForm)
      setShowProviderModal(false)
      setProviderForm({ name: '', provider_type: '', contact_name: '', email: '', phone: '' })
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createPayment.mutateAsync({
        provider_id: paymentForm.provider_id,
        amount: paymentForm.amount,
        due_at: paymentForm.due_at || null,
        description: paymentForm.description || null,
      })
      setShowPaymentModal(false)
    } catch (err) {
      console.error(err)
    }
  }

  const hasQueryError = isError ?? paymentsError ?? plansError
  const refetchAll = () => {
    void refetch()
    void refetchPayments()
    void refetchPlans()
  }

  const handleOpenAddPlan = (providerId: string) => {
    setPlanProviderId(providerId)
    setEditingPlanId(null)
    setPlanForm({ name: '', description: '', billing_cycle: 'monthly', amount: 0, applicable_device_types: [] })
    setShowPlanModal(true)
  }

  const handleOpenEditPlan = (plan: {
    id: string
    name: string
    description: string | null
    billing_cycle: string
    amount: number
    applicable_device_types: DeviceType[] | null
  }) => {
    setPlanProviderId(null)
    setEditingPlanId(plan.id)
    setPlanForm({
      name: plan.name,
      description: plan.description ?? '',
      billing_cycle: plan.billing_cycle as 'monthly' | 'quarterly' | 'yearly',
      amount: plan.amount,
      applicable_device_types: plan.applicable_device_types ?? [],
    })
    setShowPlanModal(true)
  }

  const handleSubmitPlan = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingPlanId) {
        await updatePlan.mutateAsync({
          id: editingPlanId,
          ...planForm,
          applicable_device_types: planForm.applicable_device_types.length > 0 ? planForm.applicable_device_types : null,
        })
      } else if (planProviderId) {
        await createPlan.mutateAsync({
          provider_id: planProviderId,
          ...planForm,
          applicable_device_types: planForm.applicable_device_types.length > 0 ? planForm.applicable_device_types : null,
        })
      }
      setShowPlanModal(false)
      setPlanProviderId(null)
      setEditingPlanId(null)
    } catch (err) {
      console.error(err)
    }
  }

  const toggleDeviceType = (dt: DeviceType) => {
    setPlanForm((p) => ({
      ...p,
      applicable_device_types: p.applicable_device_types.includes(dt)
        ? p.applicable_device_types.filter((x) => x !== dt)
        : [...p.applicable_device_types, dt],
    }))
  }

  const plansByProvider = (providerPlans ?? []).reduce(
    (acc, p) => {
      const id = p.provider_id
      if (!acc[id]) acc[id] = []
      acc[id].push(p)
      return acc
    },
    {} as Record<string, (ProviderPlan & { providers?: { id: string; name: string } | null })[]>,
  )

  const pendingTotal = (payments ?? []).filter((p) => ['pending', 'scheduled', 'overdue'].includes(p.status)).reduce((s, p) => s + (p.amount ?? 0), 0)
  const searchLower = searchQuery.trim().toLowerCase()
  const paymentsSearchLower = paymentsSearch.trim().toLowerCase()
  const filteredProviders = searchLower
    ? (providers ?? []).filter((p) => {
        const s = [p.name, p.provider_type, p.email, p.phone].filter(Boolean).join(' ').toLowerCase()
        return s.includes(searchLower)
      })
    : providers ?? []
  const allProviders = filteredProviders
  const paginatedProviders = allProviders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const recentPaymentsRaw = payments ?? []
  const recentPayments = paymentsSearchLower
    ? recentPaymentsRaw.filter((p) => {
        const provName = (p as { providers?: { name: string } }).providers?.name?.toLowerCase() ?? ''
        return provName.includes(paymentsSearchLower)
      })
    : recentPaymentsRaw
  const paginatedPayments = recentPayments.slice((paymentsPage - 1) * PAGE_SIZE, paymentsPage * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [searchQuery])
  useEffect(() => {
    setPaymentsPage(1)
  }, [paymentsSearch])

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      {hasQueryError && (
        <QueryErrorBanner
          className="col-span-full"
          message={error?.message ?? paymentsErrorObj?.message ?? plansErrorObj?.message ?? 'Failed to load providers.'}
          onRetry={refetchAll}
        />
      )}
      {(createProvider.isError ?? createPayment.isError ?? createPlan.isError ?? updatePlan.isError ?? deletePlan.isError) && (
        <div className="col-span-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {(createProvider.error ?? createPayment.error ?? createPlan.error ?? updatePlan.error ?? deletePlan.error)?.message ?? 'Action failed. Please try again.'}
        </div>
      )}
      <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
        <div className="sticky top-16 z-20 -m-6 mb-4 rounded-t-3xl border-b border-black/10 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-black">Providers</h2>
            <div className="flex items-center gap-3">
              <input
                type="search"
                placeholder="Search…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-black placeholder:text-black/40"
              />
              {!isViewer && (
                <button
                  onClick={() => setShowProviderModal(true)}
                  className="rounded-full bg-black px-4 py-2 text-xs font-semibold tracking-wide whitespace-nowrap text-white transition duration-200 hover:bg-black/90 active:scale-[0.98]"
                >
                  Add Provider
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="mt-6 space-y-4">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-black/60">Loading…</p>
          ) : allProviders.length === 0 ? (
            <p className="py-8 text-center text-sm text-black/60">No providers yet.</p>
          ) : (
            <>
            {paginatedProviders.map((p) => {
              const plans = plansByProvider[p.id] ?? []
              return (
                <div key={p.id} className="rounded-2xl border border-black/10 bg-white px-4 py-3">
                  <p className="text-sm font-semibold text-black">{p.name}</p>
                  <p className="text-xs text-black/60">{p.provider_type ?? '—'}</p>
                  <p className="mt-1 text-xs text-black/60">{p.email ?? p.phone ?? '—'}</p>
                  <div className="mt-3 border-t border-black/10 pt-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold tracking-wide text-black/60">Plans</p>
                      {!isViewer && (
                        <button
                          onClick={() => handleOpenAddPlan(p.id)}
                          className="text-xs font-semibold tracking-wide text-black/60 hover:text-black"
                        >
                          Add plan
                        </button>
                      )}
                    </div>
                    {plans.length === 0 ? (
                      <p className="mt-2 text-xs text-black/50">No plans yet.</p>
                    ) : (
                      <ul className="mt-2 space-y-1">
                        {plans.map((plan) => (
                          <li
                            key={plan.id}
                            className="flex items-center justify-between rounded-lg bg-black/5 px-2 py-1.5 text-xs"
                          >
                            <span>
                              {plan.name} — USD {plan.amount?.toLocaleString() ?? '0'} / {plan.billing_cycle}
                              {(plan.applicable_device_types ?? []).length > 0 && (
                                <> · {(plan.applicable_device_types ?? []).map((dt) => DEVICE_TYPE_LABELS[dt]).join(', ')}</>
                              )}
                            </span>
                            {!isViewer && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleOpenEditPlan(plan)}
                                  className="text-black/60 hover:text-black"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => { if (confirm('Delete this plan?')) deletePlan.mutate(plan.id) }}
                                  className="text-red-600 hover:underline"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )
            })}
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalCount={allProviders.length}
              onPageChange={setPage}
            />
            </>
          )}
        </div>

        <div className="mt-6">
          <p className="text-sm font-semibold text-black">Recent payments</p>
          <input
            type="search"
            placeholder="Search…"
            value={paymentsSearch}
            onChange={(e) => setPaymentsSearch(e.target.value)}
            className="mt-3 w-full rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-black placeholder:text-black/40"
          />
          <div className="mt-3 space-y-2">
            {paginatedPayments.length === 0 ? (
              <p className="py-4 text-center text-sm text-black/60">No recent payments.</p>
            ) : (
              <>
            {paginatedPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-4 py-2">
                <span className="text-sm">{(p as { providers?: { name: string } }).providers?.name ?? '—'}</span>
                <span className="text-xs text-black/60">USD {p.amount?.toLocaleString()}</span>
              </div>
            ))}
            <Pagination
              page={paymentsPage}
              pageSize={PAGE_SIZE}
              totalCount={recentPayments.length}
              onPageChange={setPaymentsPage}
            />
            </>
            )}
          </div>
          <button
            onClick={() => setShowPaymentModal(true)}
            className="mt-3 w-full rounded-2xl border border-black/15 py-2 text-xs font-semibold tracking-wide text-black"
          >
            Add payment
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
          <h3 className="text-lg font-semibold text-black">Summary</h3>
          <div className="mt-5 space-y-4">
            <MiniMetric label="Total providers" value={String(providers?.length ?? 0)} />
            <MiniMetric
              label="Pending payments"
              value={`USD ${pendingTotal.toLocaleString()}`}
            />
          </div>
        </div>
      </div>

      {showProviderModal && (
        <Modal title="Add Provider" onClose={() => setShowProviderModal(false)}>
          <form onSubmit={handleCreateProvider} className="space-y-4">
            <label className={labelClass}>Name *</label>
            <input type="text" value={providerForm.name} onChange={(e) => setProviderForm((p) => ({ ...p, name: e.target.value }))} className={inputClass} required />
            <label className={labelClass}>Type</label>
            <input type="text" value={providerForm.provider_type} onChange={(e) => setProviderForm((p) => ({ ...p, provider_type: e.target.value }))} className={inputClass} placeholder="e.g. ISP, Airtime" />
            <label className={labelClass}>Contact</label>
            <input type="text" value={providerForm.contact_name} onChange={(e) => setProviderForm((p) => ({ ...p, contact_name: e.target.value }))} className={inputClass} />
            <label className={labelClass}>Email</label>
            <input type="email" value={providerForm.email} onChange={(e) => setProviderForm((p) => ({ ...p, email: e.target.value }))} className={inputClass} />
            <label className={labelClass}>Phone</label>
            <input type="tel" value={providerForm.phone} onChange={(e) => setProviderForm((p) => ({ ...p, phone: e.target.value }))} className={inputClass} />
            <div className="mt-6 flex gap-3">
              <button type="submit" disabled={createProvider.isPending} className="rounded-2xl bg-black px-6 py-2 text-sm font-semibold tracking-wide text-white transition duration-200 hover:bg-black/90 active:scale-[0.98] disabled:opacity-50">Create</button>
              <button type="button" onClick={() => setShowProviderModal(false)} className="rounded-2xl border border-black/15 px-6 py-2 text-sm font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]">Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {showPlanModal && (
        <Modal
          title={editingPlanId ? 'Edit provider plan' : 'Add provider plan'}
          onClose={() => { setShowPlanModal(false); setPlanProviderId(null); setEditingPlanId(null) }}
        >
          <form onSubmit={handleSubmitPlan} className="space-y-4">
            <label className={labelClass}>Name</label>
            <input
              type="text"
              value={planForm.name}
              onChange={(e) => setPlanForm((p) => ({ ...p, name: e.target.value }))}
              className={inputClass}
              required
            />
            <label className={labelClass}>Description</label>
            <input
              type="text"
              value={planForm.description}
              onChange={(e) => setPlanForm((p) => ({ ...p, description: e.target.value }))}
              className={inputClass}
            />
            <label className={labelClass}>Billing cycle</label>
            <select
              value={planForm.billing_cycle}
              onChange={(e) => setPlanForm((p) => ({ ...p, billing_cycle: e.target.value as 'monthly' | 'quarterly' | 'yearly' }))}
              className={inputClass}
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
            <label className={labelClass}>Amount (USD)</label>
            <input
              type="number"
              step="0.01"
              value={planForm.amount || ''}
              onChange={(e) => setPlanForm((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))}
              className={inputClass}
              required
            />
            <label className={labelClass}>Applicable device types (leave empty for all)</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {DEVICE_TYPES.map((dt) => (
                <label key={dt} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={planForm.applicable_device_types.includes(dt)}
                    onChange={() => toggleDeviceType(dt)}
                    className="h-4 w-4 rounded border-black/20"
                  />
                  <span className="text-sm">{DEVICE_TYPE_LABELS[dt]}</span>
                </label>
              ))}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                disabled={createPlan.isPending || updatePlan.isPending}
                className="rounded-2xl bg-black px-6 py-2 text-sm font-semibold tracking-wide text-white transition duration-200 hover:bg-black/90 active:scale-[0.98] disabled:opacity-50"
              >
                {editingPlanId ? 'Save' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => { setShowPlanModal(false); setPlanProviderId(null); setEditingPlanId(null) }}
                className="rounded-2xl border border-black/15 px-6 py-2 text-sm font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showPaymentModal && (
        <Modal title="Add Provider Payment" onClose={() => setShowPaymentModal(false)}>
          <form onSubmit={handleCreatePayment} className="space-y-4">
            <label className={labelClass}>Provider</label>
            <select value={paymentForm.provider_id} onChange={(e) => setPaymentForm((p) => ({ ...p, provider_id: e.target.value }))} className={inputClass} required>
              <option value="">Select provider</option>
              {(providers ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <label className={labelClass}>Amount</label>
            <input type="number" step="0.01" value={paymentForm.amount || ''} onChange={(e) => setPaymentForm((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} className={inputClass} required />
            <label className={labelClass}>Due date</label>
            <input type="date" value={paymentForm.due_at} onChange={(e) => setPaymentForm((p) => ({ ...p, due_at: e.target.value }))} className={inputClass} />
            <label className={labelClass}>Description</label>
            <input type="text" value={paymentForm.description} onChange={(e) => setPaymentForm((p) => ({ ...p, description: e.target.value }))} className={inputClass} />
            <div className="mt-6 flex gap-3">
              <button type="submit" disabled={createPayment.isPending} className="rounded-2xl bg-black px-6 py-2 text-sm font-semibold tracking-wide text-white transition duration-200 hover:bg-black/90 active:scale-[0.98] disabled:opacity-50">Create</button>
              <button type="button" onClick={() => setShowPaymentModal(false)} className="rounded-2xl border border-black/15 px-6 py-2 text-sm font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]">Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
