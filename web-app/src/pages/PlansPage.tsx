import { useEffect, useState } from 'react'
import { Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { QueryErrorBanner } from '../components/QueryErrorBanner'
import { useRole } from '../context/RoleContext'
import {
  useSubscriptionPlans,
  useCreateSubscriptionPlan,
  useUpdateSubscriptionPlan,
  useDeleteSubscriptionPlan,
  useDefaultPlansPerDeviceType,
  useSetDefaultPlan,
} from '../hooks/useSubscriptionPlans'
import { DEVICE_TYPE_LABELS, type DeviceType } from '../types'

const inputClass = 'w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-black'
const labelClass = 'block text-xs tracking-wide text-black/60 mt-3 first:mt-0'
const PAGE_SIZE = 10

const DEVICE_TYPES: DeviceType[] = [
  'car_tracker',
  'ip_camera',
  'starlink',
  'wifi_access_point',
  'tv',
  'drone',
  'printer',
  'websuite',
  'isp_link',
  'other',
]

export function PlansPage() {
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [form, setForm] = useState<{
    name: string
    description: string
    billing_cycle: 'monthly' | 'quarterly' | 'yearly'
    amount: number
    currency: string
    applicable_device_types: DeviceType[]
    is_active: boolean
  }>({
    name: '',
    description: '',
    billing_cycle: 'monthly',
    amount: 0,
    currency: 'USD',
    applicable_device_types: [],
    is_active: true,
  })

  const { data: plans, isLoading, isError, error, refetch } = useSubscriptionPlans(undefined, { includeInactive: true })
  const searchLower = searchQuery.trim().toLowerCase()
  const filteredPlans = searchLower
    ? (plans ?? []).filter((p) => {
        const s = [p.name, p.description].filter(Boolean).join(' ').toLowerCase()
        return s.includes(searchLower)
      })
    : plans ?? []
  const allPlans = filteredPlans
  const paginatedPlans = allPlans.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [searchQuery])
  const { isViewer } = useRole()
  const createPlan = useCreateSubscriptionPlan()
  const updatePlan = useUpdateSubscriptionPlan()
  const deletePlan = useDeleteSubscriptionPlan()
  const { data: defaultPlansMap } = useDefaultPlansPerDeviceType()
  const setDefaultPlan = useSetDefaultPlan()

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      billing_cycle: 'monthly',
      amount: 0,
      currency: 'USD',
      applicable_device_types: [],
      is_active: true,
    })
    setEditingId(null)
  }

  const handleOpenCreate = () => {
    resetForm()
    setShowModal(true)
  }

  const handleOpenEdit = (plan: {
    id: string
    name: string
    description: string | null
    billing_cycle: string
    amount: number
    currency: string | null
    applicable_device_types: DeviceType[] | null
    is_active: boolean
  }) => {
    setForm({
      name: plan.name,
      description: plan.description ?? '',
      billing_cycle: plan.billing_cycle as 'monthly' | 'quarterly' | 'yearly',
      amount: plan.amount,
      currency: plan.currency ?? 'USD',
      applicable_device_types: plan.applicable_device_types ?? [],
      is_active: plan.is_active,
    })
    setEditingId(plan.id)
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingId) {
        await updatePlan.mutateAsync({
          id: editingId,
          ...form,
          applicable_device_types: form.applicable_device_types.length > 0 ? form.applicable_device_types : null,
        })
      } else {
        await createPlan.mutateAsync({
          ...form,
          applicable_device_types: form.applicable_device_types.length > 0 ? form.applicable_device_types : null,
        })
      }
      setShowModal(false)
      resetForm()
    } catch (err) {
      console.error(err)
    }
  }

  const toggleDeviceType = (dt: DeviceType) => {
    setForm((p) => ({
      ...p,
      applicable_device_types: p.applicable_device_types.includes(dt)
        ? p.applicable_device_types.filter((x) => x !== dt)
        : [...p.applicable_device_types, dt],
    }))
  }

  const hasMutationError = createPlan.isError ?? updatePlan.isError ?? deletePlan.isError
  const mutationError = createPlan.error ?? updatePlan.error ?? deletePlan.error

  return (
    <div className="space-y-6">
      {isError && (
        <QueryErrorBanner
          message={error?.message ?? 'Failed to load plans.'}
          onRetry={() => void refetch()}
        />
      )}
      {hasMutationError && mutationError != null && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {mutationError.message}
        </div>
      )}
      <div className="sticky top-16 z-20 rounded-t-3xl border border-black/10 border-b bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-black">Subscription plans</h2>
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
                onClick={handleOpenCreate}
                className="rounded-full bg-black px-4 py-2 text-xs font-semibold tracking-wide whitespace-nowrap text-white transition duration-200 hover:bg-black/90 active:scale-[0.98]"
              >
                Add plan
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-black/60">Loading…</p>
        ) : allPlans.length === 0 ? (
          <p className="py-8 text-center text-sm text-black/60">No plans yet. Add one to get started.</p>
        ) : (
          <div className="space-y-4">
            {paginatedPlans.map((plan) => (
              <div
                key={plan.id}
                className="flex items-center justify-between rounded-2xl border border-black/10 bg-white px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-black">{plan.name}</p>
                  <p className="mt-1 text-xs text-black/60">
                    USD {plan.amount.toLocaleString()} / {plan.billing_cycle}
                    {(plan.applicable_device_types ?? []).length > 0 && (
                      <> · {(plan.applicable_device_types ?? []).map((dt) => DEVICE_TYPE_LABELS[dt]).join(', ')}</>
                    )}
                  </p>
                </div>
                {!isViewer && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenEdit(plan)}
                      className="text-xs font-semibold tracking-wide text-black/60 hover:text-black"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this plan?')) deletePlan.mutate(plan.id)
                      }}
                      className="text-xs font-semibold tracking-wide text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalCount={allPlans.length}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
        <h3 className="text-lg font-semibold text-black">Default plan per device type</h3>
        <p className="mt-1 text-sm text-black/60">Used when assigning a device or creating a subscription.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {DEVICE_TYPES.map((dt) => (
            <div key={dt} className="flex items-center gap-3">
              <label className="w-40 shrink-0 text-sm font-medium text-black">
                {DEVICE_TYPE_LABELS[dt]}
              </label>
              <select
                value={defaultPlansMap?.[dt] ?? ''}
                onChange={(e) => {
                  const planId = e.target.value
                  if (planId) setDefaultPlan.mutate({ deviceType: dt, planId })
                }}
                disabled={isViewer}
                className="min-w-0 flex-1 rounded-2xl border border-black/15 bg-white px-4 py-2 text-sm text-black disabled:opacity-60"
              >
                <option value="">—</option>
                {(plans ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <Modal title={editingId ? 'Edit plan' : 'Add plan'} onClose={() => { setShowModal(false); resetForm() }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className={labelClass}>Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className={inputClass}
              required
            />
            <label className={labelClass}>Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className={inputClass}
            />
            <label className={labelClass}>Billing cycle</label>
            <select
              value={form.billing_cycle}
              onChange={(e) => setForm((p) => ({ ...p, billing_cycle: e.target.value as 'monthly' | 'quarterly' | 'yearly' }))}
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
              value={form.amount || ''}
              onChange={(e) => setForm((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))}
              className={inputClass}
              required
            />
            <label className={labelClass}>Applicable device types (leave empty for all)</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {DEVICE_TYPES.map((dt) => (
                <label key={dt} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.applicable_device_types.includes(dt)}
                    onChange={() => toggleDeviceType(dt)}
                    className="h-4 w-4 rounded border-black/20"
                  />
                  <span className="text-sm">{DEVICE_TYPE_LABELS[dt]}</span>
                </label>
              ))}
            </div>
            <label className="mt-3 flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                className="h-4 w-4 rounded border-black/20"
              />
              <span className="text-sm">Active</span>
            </label>
            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                disabled={createPlan.isPending || updatePlan.isPending}
                className="rounded-2xl bg-black px-6 py-2 text-sm font-semibold tracking-wide text-white transition duration-200 hover:bg-black/90 active:scale-[0.98] disabled:opacity-50"
              >
                {editingId ? 'Save' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => { setShowModal(false); resetForm() }}
                className="rounded-2xl border border-black/15 px-6 py-2 text-sm font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
