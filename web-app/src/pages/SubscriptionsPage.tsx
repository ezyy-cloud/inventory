import { CheckCircle2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ClientSelector } from '../components/ClientSelector'
import { Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { QueryErrorBanner } from '../components/QueryErrorBanner'
import { StatusPill } from '../components/StatusPill'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useSubscriptions, useSubscriptionsList, useCreateSubscription, useDeleteSubscription, useUpdateSubscription } from '../hooks/useSubscriptions'
import { useRole } from '../context/RoleContext'
import { useSubscriptionPlans, useDefaultPlansPerDeviceType } from '../hooks/useSubscriptionPlans'
import { calculateMRR } from '../lib/mrr'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { DEVICE_TYPE_LABELS, type DeviceType } from '../types'

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
  'pos_device',
  'other',
]

const inputClass = 'w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-black'
const labelClass = 'block text-xs tracking-wide text-black/60 mt-3 first:mt-0'
const DEFAULT_PAGE_SIZE = 25

function parseSubscriptionsListParams(searchParams: URLSearchParams) {
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(10, Number.parseInt(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE))
  const q = searchParams.get('q') ?? ''
  const status = searchParams.get('status') ?? ''
  const deviceType = searchParams.get('device_type') ?? ''
  const sort = (searchParams.get('sort') ?? 'plan_name') as 'plan_name' | 'start_date' | 'updated_at'
  const order = (searchParams.get('order') ?? 'desc') as 'asc' | 'desc'
  const endWithin = searchParams.get('end_within')
  const endWithinDays = endWithin ? Math.max(1, Number.parseInt(endWithin, 10) || 30) : undefined
  return { page, pageSize, q, status, deviceType: deviceType || undefined, sort, order, endWithinDays }
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-black/10 bg-black/5 px-4 py-3">
      <p className="text-xs tracking-wide text-black/60">{label}</p>
      <p className="mt-2 break-words text-lg font-semibold text-black">{value}</p>
    </div>
  )
}

export function SubscriptionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { page, pageSize, q: searchQuery, status: statusFilter, deviceType: deviceTypeFilter, sort: sortBy, order: sortOrder, endWithinDays } = parseSubscriptionsListParams(searchParams)
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

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<{
    client_id: string
    plan_id: string
    device_id: string
    start_date: string
  }>({
    client_id: '',
    plan_id: '',
    device_id: '',
    start_date: new Date().toISOString().slice(0, 10),
  })
  const { data: listData, isLoading, isError, error, refetch } = useSubscriptionsList({
    page,
    pageSize,
    search: debouncedSearch.trim() || undefined,
    status: statusFilter || undefined,
    deviceType: deviceTypeFilter,
    sortBy,
    sortOrder,
    endWithinDays,
  })
  const { data: subscriptions } = useSubscriptions()
  const { data: plans } = useSubscriptionPlans()
  const { data: defaultPlansMap } = useDefaultPlansPerDeviceType()
  const { data: devices, isError: devicesError, error: devicesErrorObj, refetch: refetchDevices } = useQuery({
    queryKey: ['devices-for-subscription'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('id, name, identifier, device_type')
        .order('name', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
  const { isViewer } = useRole()
  const createSub = useCreateSubscription()
  const updateSub = useUpdateSubscription()
  const deleteSub = useDeleteSubscription()
  const { rows: paginatedSubs, totalCount } = listData ?? { rows: [], totalCount: 0 }
  const [changePlanSub, setChangePlanSub] = useState<typeof paginatedSubs[0] | null>(null)
  const [changePlanId, setChangePlanId] = useState('')
  const [changePlanRenewalDate, setChangePlanRenewalDate] = useState('')
  const changePlanDeviceType = (changePlanSub as { devices?: { device_type?: string } | null } | null)?.devices?.device_type as DeviceType | undefined
  const { data: changePlanOptions } = useSubscriptionPlans(changePlanDeviceType)
  const activeCount = (subscriptions ?? []).filter((s) => s.status === 'active').length

  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      const urlQ = next.get('q') ?? ''
      const urlStatus = next.get('status') ?? ''
      const urlDeviceType = next.get('device_type') ?? ''
      const urlEndWithin = next.get('end_within') ?? ''
      const expectedEndWithin = endWithinDays != null ? String(endWithinDays) : ''
      if (
        urlQ !== searchQuery ||
        urlStatus !== (statusFilter ?? '') ||
        urlDeviceType !== (deviceTypeFilter ?? '') ||
        urlEndWithin !== expectedEndWithin
      )
        next.set('page', '1')
      return next
    })
  }, [searchQuery, statusFilter, deviceTypeFilter, endWithinDays, setSearchParams])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createSub.mutateAsync({
        client_id: form.client_id,
        plan_id: form.plan_id,
        device_id: form.device_id || undefined,
        start_date: form.start_date,
      })
      setShowModal(false)
      setForm({ client_id: '', plan_id: '', device_id: '', start_date: new Date().toISOString().slice(0, 10) })
    } catch (err) {
      console.error(err)
    }
  }

  const hasQueryError = isError ?? devicesError
  const refetchAll = () => {
    void refetch()
    void refetchDevices()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      {hasQueryError && (
        <QueryErrorBanner
          className="col-span-full"
          message={error?.message ?? devicesErrorObj?.message ?? 'Failed to load subscriptions.'}
          onRetry={refetchAll}
        />
      )}
      {(createSub.isError ?? updateSub.isError ?? deleteSub.isError) && (
        <div className="col-span-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {(createSub.error ?? updateSub.error ?? deleteSub.error)?.message ?? 'Action failed. Please try again.'}
        </div>
      )}
      <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
        <div className="sticky top-16 z-20 -m-6 mb-4 rounded-t-3xl border-b border-black/10 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-black">Subscriptions</h2>
            <input
              type="search"
              placeholder="Search…"
              aria-label="Search subscriptions"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-black placeholder:text-black/40"
            />
            <select
              aria-label="Page size"
              value={pageSize}
              onChange={(e) => setParams({ pageSize: Number(e.target.value), page: 1 })}
              className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold tracking-wide text-black"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <select
              aria-label="Filter by device type"
              value={deviceTypeFilter ?? 'all'}
              onChange={(e) => setParams({ device_type: e.target.value === 'all' ? undefined : e.target.value, page: 1 })}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold tracking-wide text-black"
            >
              <option value="all">All device types</option>
              {DEVICE_TYPES.map((dt) => (
                <option key={dt} value={dt}>
                  {DEVICE_TYPE_LABELS[dt]}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by status"
              value={statusFilter ?? 'all'}
              onChange={(e) => setParams({ status: e.target.value === 'all' ? undefined : e.target.value, page: 1 })}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold tracking-wide text-black"
            >
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="canceled">Canceled</option>
              <option value="expired">Expired</option>
            </select>
            <button
              type="button"
              onClick={() => setParams({ end_within: endWithinDays === 30 ? undefined : 30, page: 1 })}
              className={`rounded-full border px-4 py-2 text-xs font-semibold tracking-wide transition duration-200 active:scale-[0.98] ${
                endWithinDays === 30 ? 'border-amber-500 bg-amber-50 text-amber-800 hover:bg-amber-100' : 'border-black/10 bg-white text-black hover:bg-black/5'
              }`}
            >
              Ending soon (30d)
            </button>
            <span className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold tracking-wide text-black">
              {activeCount} active
            </span>
          </div>
          {!isViewer && (
            <button
              onClick={() => setShowModal(true)}
              className="rounded-full bg-black px-4 py-2 text-xs font-semibold tracking-wide whitespace-nowrap text-white transition duration-200 hover:bg-black/90 active:scale-[0.98]"
            >
              New Subscription
            </button>
          )}
        </div>
        </div>
        <div className="mt-6 space-y-4">
          {isLoading ? (
            <div className="space-y-2 py-8">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-2xl bg-black/10" />
              ))}
            </div>
          ) : paginatedSubs.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-black/60">
                {searchQuery || statusFilter || deviceTypeFilter
                  ? 'No subscriptions match your filters.'
                  : 'No subscriptions.'}
              </p>
              {(searchQuery || statusFilter || deviceTypeFilter) && (
                <button
                  type="button"
                  onClick={() => setParams({ q: undefined, status: undefined, device_type: undefined, page: 1 })}
                  className="mt-3 text-xs font-semibold tracking-wide text-black underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
            {paginatedSubs.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center justify-between rounded-2xl border border-black/10 bg-white px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-black">{sub.plan_name}</p>
                  <p className="text-xs text-black/60">
                    {(sub as { clients?: { name: string } }).clients?.name ?? '—'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-black/60">
                    <span>USD {sub.amount?.toLocaleString() ?? '—'}</span>
                    <span>Renews {sub.next_invoice_date ?? '—'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill value={sub.status} />
                  {!isViewer && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setChangePlanSub(sub)
                          setChangePlanId(sub.plan_id ?? '')
                          setChangePlanRenewalDate(sub.next_invoice_date ?? new Date().toISOString().slice(0, 10))
                        }}
                        className="text-xs font-semibold tracking-wide text-black/70 hover:underline"
                      >
                        Change plan
                      </button>
                      <button
                        onClick={() => deleteSub.mutate(sub.id)}
                        className="text-xs font-semibold tracking-wide text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
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
          <h3 className="text-lg font-semibold text-black">Summary</h3>
          <div className="mt-5 space-y-4">
            <MiniMetric label="Active plans" value={String(activeCount)} />
            <MiniMetric
              label="Total MRR"
              value={`USD ${calculateMRR(
                (subscriptions ?? []).filter((s) => s.status === 'active'),
              ).toLocaleString()}`}
            />
          </div>
        </div>
        <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
          <div className="space-y-3 text-sm text-black/70">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Manage subscriptions from the Payments page
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <Modal title="New Subscription" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <label className={labelClass}>Plan</label>
            <select
              value={form.plan_id}
              onChange={(e) => setForm((p) => ({ ...p, plan_id: e.target.value }))}
              className={inputClass}
              required
            >
              <option value="">Select plan</option>
              {(plans ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — USD {p.amount.toLocaleString()} / {p.billing_cycle}
                </option>
              ))}
            </select>
            <label className={labelClass}>Client</label>
            <ClientSelector
              value={form.client_id}
              onChange={(id) => setForm((p) => ({ ...p, client_id: id ?? '' }))}
              placeholder="Select client"
              aria-label="Select client"
            />
            <label className={labelClass}>Device (optional)</label>
            <select
              value={form.device_id}
              onChange={(e) => {
                const deviceId = e.target.value
                const device = (devices ?? []).find((d) => d.id === deviceId) as { id: string; device_type?: string } | undefined
                const defaultPlanId = device?.device_type && defaultPlansMap?.[device.device_type as DeviceType] ? defaultPlansMap[device.device_type as DeviceType] : ''
                setForm((p) => ({ ...p, device_id: deviceId, plan_id: defaultPlanId || p.plan_id }))
              }}
              className={inputClass}
            >
              <option value="">No device</option>
              {(devices ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name ?? d.identifier ?? d.id}
                </option>
              ))}
            </select>
            <label className={labelClass}>Start date</label>
            <input type="date" value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} className={inputClass} required />
            <div className="mt-6 flex gap-3">
              <button type="submit" disabled={createSub.isPending || !form.plan_id} className="rounded-2xl bg-black px-6 py-2 text-sm font-semibold tracking-wide text-white transition duration-200 hover:bg-black/90 active:scale-[0.98] disabled:opacity-50">Create</button>
              <button type="button" onClick={() => setShowModal(false)} className="rounded-2xl border border-black/15 px-6 py-2 text-sm font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]">Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {changePlanSub != null && (
        <Modal title="Change plan" onClose={() => setChangePlanSub(null)}>
          <p className="text-sm text-black/70">
            {(changePlanSub as { clients?: { name: string } }).clients?.name ?? '—'} · {changePlanSub.plan_name}
          </p>
          <div className="mt-4 space-y-3">
            <label className={labelClass}>New plan</label>
            <select
              value={changePlanId}
              onChange={(e) => setChangePlanId(e.target.value)}
              className={inputClass}
            >
              <option value="">Select plan</option>
              {(changePlanOptions ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — USD {p.amount.toLocaleString()} / {p.billing_cycle}
                </option>
              ))}
            </select>
            <label className={labelClass}>Renewal date</label>
            <input
              type="date"
              value={changePlanRenewalDate}
              onChange={(e) => setChangePlanRenewalDate(e.target.value)}
              className={inputClass}
              aria-label="Renewal date"
            />
            <div className="flex gap-3">
              <button
                type="button"
                disabled={!changePlanId || updateSub.isPending}
                onClick={async () => {
                  if (!changePlanId) return
                  await updateSub.mutateAsync({
                    id: changePlanSub.id,
                    plan_id: changePlanId,
                    next_invoice_date: changePlanRenewalDate || null,
                  })
                  setChangePlanSub(null)
                }}
                className="rounded-2xl bg-black px-6 py-2 text-sm font-semibold tracking-wide text-white transition duration-200 hover:bg-black/90 active:scale-[0.98] disabled:opacity-50"
              >
                Save
              </button>
              <button type="button" onClick={() => setChangePlanSub(null)} className="rounded-2xl border border-black/15 px-6 py-2 text-sm font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]">Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
