import {
  Box,
  Camera,
  Car,
  ChevronRight,
  Globe,
  MoreVertical,
  Monitor,
  Plane,
  Printer,
  Router,
  SatelliteDish,
  Wifi,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Pagination } from '../components/Pagination'
import { QueryErrorBanner } from '../components/QueryErrorBanner'
import { StatusPill } from '../components/StatusPill'
import { ClientSelector } from '../components/ClientSelector'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useDevices, useBulkUpdateDeviceStatus, useUpdateDevice } from '../hooks/useDevices'
import { useAssignDevice, useBulkUnassignDevices } from '../hooks/useAssignments'
import { useDeviceGroups, useAddDevicesToGroup, useRemoveDevicesFromGroup } from '../hooks/useDeviceGroups'
import { useSubscriptionPlans } from '../hooks/useSubscriptionPlans'
import { downloadCsv } from '../lib/csvExport'
import { supabase } from '../lib/supabaseClient'
import { useToast } from '../context/ToastContext'
import { useRole } from '../context/RoleContext'
import { ConfirmModal } from '../components/ConfirmModal'
import { Modal } from '../components/Modal'
import { DEVICE_TYPE_LABELS, type DeviceType, type DeviceWithDetails } from '../types'

const DEFAULT_PAGE_SIZE = 25
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
const DEVICE_TABS: { id: DeviceType; label: string; icon: typeof Car }[] = [
  { id: 'car_tracker', label: 'Car Trackers', icon: Car },
  { id: 'ip_camera', label: 'IP Cameras', icon: Camera },
  { id: 'starlink', label: 'Starlinks', icon: SatelliteDish },
  { id: 'wifi_access_point', label: 'WiFi Access Points', icon: Wifi },
  { id: 'tv', label: 'TVs', icon: Monitor },
  { id: 'drone', label: 'Drones', icon: Plane },
  { id: 'printer', label: 'Printers', icon: Printer },
  { id: 'websuite', label: 'Websuites', icon: Globe },
  { id: 'isp_link', label: 'ISP Links', icon: Router },
  { id: 'other', label: 'Other', icon: Box },
]

function formatDeviceRow(d: DeviceWithDetails, type: DeviceType): Record<string, string> {
  const c = (d.assignment as { clients?: { name: string } } | null)?.clients?.name ?? '—'
  const base: Record<string, string> = {
    name: d.name ?? d.identifier ?? '—',
    status: d.status,
    client: c,
    action: 'View',
  }

  switch (type) {
    case 'car_tracker': {
      const t = d.car_tracker
      return {
        ...base,
        brand: t?.brand ?? '—',
        model: t?.model ?? '—',
        sim: t?.sim_number ?? '—',
        imei: t?.imei ?? '—',
        reg: t?.reg_number ?? '—',
      }
    }
    case 'ip_camera': {
      const t = d.ip_camera
      return {
        ...base,
        type: t?.camera_type ?? '—',
        range: t?.range ?? '—',
        location: d.location ?? '—',
        latlong: d.latitude && d.longitude ? `${d.latitude}, ${d.longitude}` : '—',
      }
    }
    case 'starlink': {
      const t = d.starlink
      return {
        ...base,
        account: t?.account ?? '—',
        subscription: t?.subscription ?? '—',
        amount: t?.amount ? `USD ${t.amount}` : '—',
        renewal: t?.renewal_date ?? '—',
        period: t?.service_period ?? '—',
      }
    }
    case 'wifi_access_point': {
      const t = d.wifi_access_point
      return {
        ...base,
        type: t?.ap_type ?? '—',
        range: t?.range ?? '—',
        location: d.location ?? '—',
        latlong: d.latitude && d.longitude ? `${d.latitude}, ${d.longitude}` : '—',
        environment: d.environment ?? '—',
        console: t?.console ?? '—',
      }
    }
    case 'tv': {
      const t = d.tv
      return {
        ...base,
        type: t?.tv_type ?? '—',
        speakers: t?.speakers ?? '—',
        location: d.location ?? '—',
        latlong: d.latitude && d.longitude ? `${d.latitude}, ${d.longitude}` : '—',
      }
    }
    case 'drone': {
      const t = d.drone
      return {
        ...base,
        type: t?.drone_type ?? '—',
        range: t?.range ?? '—',
        location: d.location ?? '—',
        latlong: d.latitude && d.longitude ? `${d.latitude}, ${d.longitude}` : '—',
      }
    }
    case 'printer': {
      const t = d.printer
      return {
        ...base,
        username: t?.username ?? '—',
        password: t?.password ? '•••••' : '—',
        ip: t?.ip_address ?? '—',
      }
    }
    case 'websuite': {
      const t = d.websuite
      return {
        ...base,
        package: t?.package ?? '—',
        domain: t?.domain ?? '—',
      }
    }
    case 'isp_link': {
      const t = d.isp_link
      return {
        ...base,
        type: t?.link_type ?? '—',
        line: t?.line_number ?? '—',
        location: d.location ?? '—',
        ip: t?.ip_address ?? '—',
      }
    }
    default:
      return base
  }
}

function getColumns(type: DeviceType): { key: string; label: string }[] {
  const common = [
    { key: 'name', label: 'Name' },
    { key: 'status', label: 'Status' },
    { key: 'client', label: 'Assigned Client' },
    { key: 'action', label: '' },
  ]
  const commonWithoutName = [
    { key: 'status', label: 'Status' },
    { key: 'client', label: 'Assigned Client' },
    { key: 'action', label: '' },
  ]
  switch (type) {
    case 'car_tracker':
      return [
        { key: 'name', label: 'Name' },
        { key: 'sim', label: 'SIM' },
        { key: 'imei', label: 'IMEI' },
        { key: 'reg', label: 'Reg Number' },
        ...commonWithoutName,
      ]
    case 'ip_camera':
    case 'tv':
    case 'drone':
      return [
        { key: 'name', label: 'Name' },
        { key: 'type', label: 'Type' },
        { key: 'range', label: 'Range' },
        { key: 'location', label: 'Location' },
        ...commonWithoutName,
      ]
    case 'starlink':
      return [
        { key: 'account', label: 'Account' },
        { key: 'subscription', label: 'Subscription' },
        { key: 'amount', label: 'Amount' },
        { key: 'renewal', label: 'Renewal' },
        ...common,
      ]
    case 'wifi_access_point':
      return [
        { key: 'name', label: 'Name' },
        { key: 'type', label: 'Type' },
        { key: 'range', label: 'Range' },
        { key: 'location', label: 'Location' },
        { key: 'environment', label: 'Environment' },
        { key: 'console', label: 'Console' },
        ...commonWithoutName,
      ]
    case 'printer':
      return [
        { key: 'name', label: 'Name' },
        { key: 'username', label: 'Username' },
        { key: 'ip', label: 'IP Address' },
        ...commonWithoutName,
      ]
    case 'websuite':
      return [
        { key: 'package', label: 'Package' },
        { key: 'domain', label: 'Domain' },
        ...common,
      ]
    case 'isp_link':
      return [
        { key: 'name', label: 'Name' },
        { key: 'type', label: 'Type' },
        { key: 'line', label: 'Line' },
        { key: 'location', label: 'Location' },
        { key: 'ip', label: 'IP' },
        ...commonWithoutName,
      ]
    default:
      return common
  }
}

function parseDeviceListParams(searchParams: URLSearchParams) {
  const type = (searchParams.get('type') ?? 'car_tracker') as DeviceType
  const validType = DEVICE_TYPES.includes(type) ? type : 'car_tracker'
  const statusParam = searchParams.get('status') ?? 'all'
  const status = statusParam === 'all' ? undefined : (statusParam as 'in_stock' | 'assigned' | 'maintenance')
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(10, Number.parseInt(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE))
  const q = searchParams.get('q') ?? ''
  const sort = (searchParams.get('sort') ?? 'name') as 'name' | 'status' | 'updated_at'
  const order = (searchParams.get('order') ?? 'desc') as 'asc' | 'desc'
  return { type: validType, status, page, pageSize, q, sort, order }
}

export function DevicesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { type: activeTab, status: statusFilter, page, pageSize, q: searchQuery, sort: sortBy, order: sortOrder } = parseDeviceListParams(searchParams)

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

  const [searchInput, setSearchInput] = useState(searchQuery)
  const debouncedSearch = useDebouncedValue(searchInput, 350)
  useEffect(() => {
    setSearchInput(searchQuery)
  }, [searchQuery])
  useEffect(() => {
    if (debouncedSearch !== searchQuery) {
      setParams({ q: debouncedSearch.trim() || undefined, page: 1 })
    }
  }, [debouncedSearch, searchQuery, setParams])

  const { data, isLoading, isError, error, refetch } = useDevices({
    type: activeTab,
    status: statusFilter,
    page,
    pageSize,
    search: debouncedSearch.trim() || undefined,
    sortBy,
    sortOrder,
  })

  const { rows: devices, totalCount } = data ?? { rows: [], totalCount: 0 }
  const columns = getColumns(activeTab)
  const rows = devices.map((d) => formatDeviceRow(d, activeTab))

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false)
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false)
  const [bulkAssignClientId, setBulkAssignClientId] = useState('')
  const [bulkAssignPlanId, setBulkAssignPlanId] = useState('')
  const [bulkAssignStartDate, setBulkAssignStartDate] = useState('')
  const { addToast } = useToast()
  const { isViewer } = useRole()
  const bulkStatus = useBulkUpdateDeviceStatus()
  const bulkUnassign = useBulkUnassignDevices()
  const updateDevice = useUpdateDevice(activeTab)
  const assignDevice = useAssignDevice()
  const [bulkUnassignOpen, setBulkUnassignOpen] = useState(false)
  const [bulkRetireOpen, setBulkRetireOpen] = useState(false)
  const [bulkAddToGroupOpen, setBulkAddToGroupOpen] = useState(false)
  const [bulkRemoveFromGroupOpen, setBulkRemoveFromGroupOpen] = useState(false)
  const [bulkGroupId, setBulkGroupId] = useState('')
  const [openRowId, setOpenRowId] = useState<string | null>(null)
  const { data: plans } = useSubscriptionPlans()
  const { data: deviceGroups = [] } = useDeviceGroups()
  const addToGroup = useAddDevicesToGroup()
  const removeFromGroup = useRemoveDevicesFromGroup()
  const pageIds = devices.map((d) => d.id)
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id))

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds((prev) => new Set([...prev].filter((id) => !pageIds.includes(id))))
    else setSelectedIds((prev) => new Set([...prev, ...pageIds]))
  }
  const clearSelection = () => setSelectedIds(new Set())

  const handleBulkStatus = async (status: 'in_stock' | 'maintenance') => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    await bulkStatus.mutateAsync({ ids, status })
    addToast(`${ids.length} device(s) updated.`)
    clearSelection()
    setBulkStatusOpen(false)
  }
  const handleBulkAssign = async () => {
    if (!bulkAssignClientId || !bulkAssignPlanId || selectedIds.size === 0) return
    const { data: { user } } = await supabase.auth.getUser()
    const ids = Array.from(selectedIds)
    const inStockIds = devices.filter((d) => ids.includes(d.id) && d.status === 'in_stock').map((d) => d.id)
    let assigned = 0
    for (const deviceId of inStockIds) {
      try {
        await assignDevice.mutateAsync({
          deviceId,
          clientId: bulkAssignClientId,
          planId: bulkAssignPlanId,
          assignedBy: user?.id ?? undefined,
          startDate: bulkAssignStartDate || undefined,
        })
        assigned += 1
      } catch {
        // skip failed (e.g. already assigned)
      }
    }
    addToast(`${assigned} device(s) assigned.`)
    clearSelection()
    setBulkAssignOpen(false)
    setBulkAssignClientId('')
    setBulkAssignPlanId('')
    setBulkAssignStartDate('')
  }
  const handleExportSelected = () => {
    const toExport = devices.filter((d) => selectedIds.has(d.id))
    const csvRows = toExport.map((d) => {
      const r = formatDeviceRow(d, activeTab)
      return { id: d.id, ...r }
    })
    downloadCsv(csvRows, `devices-${activeTab}-export.csv`)
    addToast(`Exported ${toExport.length} device(s).`)
    clearSelection()
  }

  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      const urlType = next.get('type') ?? 'car_tracker'
      const urlStatus = next.get('status') ?? 'all'
      const urlQ = next.get('q') ?? ''
      if (urlType !== activeTab || urlStatus !== (statusFilter ?? 'all') || urlQ !== searchQuery) {
        next.set('page', '1')
      }
      return next
    })
  }, [activeTab, statusFilter, searchQuery, setSearchParams])

  return (
    <div className="space-y-6">
      {isError && (
        <QueryErrorBanner
          message={error?.message ?? 'Failed to load devices.'}
          onRetry={() => void refetch()}
        />
      )}
      <section className="flex flex-wrap items-center gap-3">
        {DEVICE_TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setParams({ type: tab.id, page: 1 })}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold tracking-wide whitespace-nowrap transition ${
                activeTab === tab.id
                  ? 'border-black bg-black text-white'
                  : 'border-black/10 bg-white text-black'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
        <Link
          to="/devices/groups"
          className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold tracking-wide whitespace-nowrap text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
        >
          Groups
        </Link>
      </section>

      <section className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
        <div className="sticky top-16 z-20 -m-6 mb-4 rounded-t-3xl border-b border-black/10 bg-white p-6">
        {selectedIds.size > 0 && !isViewer && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-black/10 bg-black/5 px-4 py-3">
            <span className="text-sm font-semibold text-black">{selectedIds.size} selected</span>
            <button
              type="button"
              onClick={clearSelection}
              className="text-xs font-semibold tracking-wide whitespace-nowrap text-black/70 hover:text-black"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setBulkStatusOpen(true)}
              disabled={bulkStatus.isPending}
              className="rounded-full border border-black/20 bg-white px-3 py-1.5 text-xs font-semibold tracking-wide whitespace-nowrap text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
            >
              Set status
            </button>
            <button
              type="button"
              onClick={() => {
                setBulkAssignStartDate(new Date().toISOString().slice(0, 10))
                setBulkAssignOpen(true)
              }}
              className="rounded-full border border-black/20 bg-white px-3 py-1.5 text-xs font-semibold tracking-wide whitespace-nowrap text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
            >
              Assign to client
            </button>
            <button
              type="button"
              onClick={() => setBulkUnassignOpen(true)}
              disabled={bulkUnassign.isPending}
              className="rounded-full border border-black/20 bg-white px-3 py-1.5 text-xs font-semibold tracking-wide whitespace-nowrap text-black transition duration-200 hover:bg-black/5 active:scale-[0.98] disabled:opacity-50"
            >
              Unassign
            </button>
            <button
              type="button"
              onClick={() => setBulkRetireOpen(true)}
              disabled={bulkStatus.isPending}
              className="rounded-full border border-black/20 bg-white px-3 py-1.5 text-xs font-semibold tracking-wide whitespace-nowrap text-black transition duration-200 hover:bg-black/5 active:scale-[0.98] disabled:opacity-50"
            >
              Set to retired
            </button>
            <button
              type="button"
              onClick={handleExportSelected}
              className="rounded-full border border-black/20 bg-white px-3 py-1.5 text-xs font-semibold tracking-wide whitespace-nowrap text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => setBulkAddToGroupOpen(true)}
              disabled={deviceGroups.length === 0}
              className="rounded-full border border-black/20 bg-white px-3 py-1.5 text-xs font-semibold tracking-wide whitespace-nowrap text-black transition duration-200 hover:bg-black/5 active:scale-[0.98] disabled:opacity-50"
            >
              Add to group
            </button>
            <button
              type="button"
              onClick={() => setBulkRemoveFromGroupOpen(true)}
              disabled={deviceGroups.length === 0}
              className="rounded-full border border-black/20 bg-white px-3 py-1.5 text-xs font-semibold tracking-wide whitespace-nowrap text-black transition duration-200 hover:bg-black/5 active:scale-[0.98] disabled:opacity-50"
            >
              Remove from group
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-black">{DEVICE_TYPE_LABELS[activeTab] ?? 'Devices'}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              placeholder="Search…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-black placeholder:text-black/40"
            />
            <select
              aria-label="Filter by device status"
              value={statusFilter ?? 'all'}
              onChange={(e) => setParams({ status: e.target.value === 'all' ? undefined : e.target.value, page: 1 })}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold tracking-wide whitespace-nowrap text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
            >
              <option value="all">Status: All</option>
              <option value="assigned">Assigned</option>
              <option value="in_stock">In stock</option>
              <option value="maintenance">Maintenance</option>
            </select>
            {!isViewer && (
              <Link
                to={`/devices/new/${activeTab}`}
                className="rounded-full bg-black px-4 py-2 text-xs font-semibold tracking-wide whitespace-nowrap text-white transition duration-200 hover:bg-black/90 active:scale-[0.98]"
              >
                Add Device
              </Link>
            )}
          </div>
        </div>
        </div>
        <div className="mt-6 overflow-x-auto">
          {isLoading ? (
            <div className="space-y-2 py-8">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-2xl bg-black/10" />
              ))}
            </div>
          ) : devices.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-black/60">
                {(searchQuery ?? statusFilter)
                  ? 'No devices match your filters.'
                  : 'No devices found.'}
              </p>
              {(searchQuery ?? statusFilter) && (
                <button
                  type="button"
                  onClick={() => setParams({ q: undefined, status: undefined, page: 1 })}
                  className="mt-3 text-xs font-semibold tracking-wide whitespace-nowrap text-black underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <table className="min-w-full border-separate border-spacing-y-2 text-left text-sm">
                <thead className="sticky top-0 z-[1] bg-white">
                  <tr className="text-xs font-semibold tracking-wide text-black/50">
                    {!isViewer && (
                      <th className="w-10 px-2 py-2 font-semibold align-middle">
                        <input
                          type="checkbox"
                          aria-label="Select all on page"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-black/20"
                        />
                      </th>
                    )}
                    {columns.map((col) => (
                      <th key={col.key} className="px-4 py-2 font-semibold">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d, index) => (
                    <tr
                      key={d.id}
                      className="rounded-2xl bg-white transition hover:bg-black/5"
                    >
                      {!isViewer && (
                        <td className="w-10 px-2 py-3">
                          <input
                            type="checkbox"
                            aria-label={`Select ${d.name ?? d.id}`}
                            checked={selectedIds.has(d.id)}
                            onChange={() => toggleSelect(d.id)}
                            className="h-4 w-4 rounded border-black/20"
                          />
                        </td>
                      )}
                      {columns.map((col) => {
                        const val = rows[index]?.[col.key] ?? '—'
                        if (col.key === 'status') {
                          return (
                            <td key={col.key} className="px-4 py-3">
                              <StatusPill value={val} />
                            </td>
                          )
                        }
                        if (col.key === 'action') {
                          return (
                            <td key={col.key} className="relative px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Link
                                  to={`/devices/${d.id}`}
                                  className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide whitespace-nowrap text-black"
                                >
                                  View <ChevronRight className="h-4 w-4" />
                                </Link>
                                {!isViewer && (
                                  <div className="relative">
                                    <button
                                      type="button"
                                      aria-label="Row actions"
                                      onClick={() => setOpenRowId(openRowId === d.id ? null : d.id)}
                                      className="rounded p-1 text-black/60 hover:bg-black/10 hover:text-black"
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </button>
                                    {openRowId === d.id && (
                                      <>
                                        <div
                                          className="fixed inset-0 z-10"
                                          aria-hidden
                                          onClick={() => setOpenRowId(null)}
                                        />
                                        <div className="absolute right-0 top-full z-20 mt-1 min-w-[10rem] rounded-2xl border border-black/10 bg-white py-1 shadow-lg">
                                          <Link
                                            to={`/devices/${d.id}`}
                                            className="block px-4 py-2 text-left text-sm text-black hover:bg-black/5"
                                            onClick={() => setOpenRowId(null)}
                                          >
                                            View
                                          </Link>
                                          <Link
                                            to={`/devices/${d.id}/edit`}
                                            className="block px-4 py-2 text-left text-sm text-black hover:bg-black/5"
                                            onClick={() => setOpenRowId(null)}
                                          >
                                            Edit
                                          </Link>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              updateDevice.mutate({ id: d.id, status: 'maintenance' })
                                              setOpenRowId(null)
                                            }}
                                            className="block w-full px-4 py-2 text-left text-sm text-black hover:bg-black/5"
                                          >
                                            Set to maintenance
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          )
                        }
                        return (
                          <td key={col.key} className="px-4 py-3 text-black/80">
                            {val}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={page}
                pageSize={pageSize}
                totalCount={totalCount}
                onPageChange={(p) => setParams({ page: p })}
              />
            </>
          )}
        </div>
      </section>

      {bulkStatusOpen && (
        <Modal title="Set status" onClose={() => setBulkStatusOpen(false)}>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => handleBulkStatus('in_stock')}
              disabled={bulkStatus.isPending}
              className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-black/90 active:scale-[0.98] disabled:opacity-50"
            >
              In stock
            </button>
            <button
              type="button"
              onClick={() => handleBulkStatus('maintenance')}
              disabled={bulkStatus.isPending}
              className="rounded-2xl border border-black/20 bg-white px-4 py-2 text-sm font-semibold text-black transition duration-200 hover:bg-black/5 active:scale-[0.98] disabled:opacity-50"
            >
              Maintenance
            </button>
            <button
              type="button"
              onClick={() => setBulkStatusOpen(false)}
              className="rounded-2xl border border-black/15 px-4 py-2 text-sm font-semibold text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      <ConfirmModal
        open={bulkUnassignOpen}
        title="Unassign devices"
        body={`${selectedIds.size} device(s) will be unassigned. Their subscriptions will be canceled and status set to in stock.`}
        confirmLabel="Unassign"
        variant="danger"
        onConfirm={async () => {
          const count = (await bulkUnassign.mutateAsync(Array.from(selectedIds))).count
          addToast(`${count} device(s) unassigned.`)
          clearSelection()
          setBulkUnassignOpen(false)
        }}
        onCancel={() => setBulkUnassignOpen(false)}
      />
      <ConfirmModal
        open={bulkRetireOpen}
        title="Set to retired"
        body={`${selectedIds.size} device(s) will be marked as retired.`}
        confirmLabel="Retire"
        variant="danger"
        onConfirm={async () => {
          await bulkStatus.mutateAsync({ ids: Array.from(selectedIds), status: 'retired' })
          addToast(`${selectedIds.size} device(s) set to retired.`)
          clearSelection()
          setBulkRetireOpen(false)
        }}
        onCancel={() => setBulkRetireOpen(false)}
      />

      {bulkAddToGroupOpen && (
        <Modal title="Add to group" onClose={() => { setBulkAddToGroupOpen(false); setBulkGroupId('') }}>
          <div className="space-y-4">
            <label htmlFor="bulk-add-group" className="block text-xs font-semibold tracking-wide text-black/50 text-black/60">Group</label>
            <select
              id="bulk-add-group"
              value={bulkGroupId}
              onChange={(e) => setBulkGroupId(e.target.value)}
              className="w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-black"
            >
              <option value="">Select group</option>
              {deviceGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={async () => {
                  if (!bulkGroupId) return
                  await addToGroup.mutateAsync({ groupId: bulkGroupId, deviceIds: Array.from(selectedIds) })
                  addToast(`${selectedIds.size} device(s) added to group.`)
                  clearSelection()
                  setBulkAddToGroupOpen(false)
                  setBulkGroupId('')
                }}
                disabled={!bulkGroupId || addToGroup.isPending}
                className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-black/90 active:scale-[0.98] disabled:opacity-50"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => { setBulkAddToGroupOpen(false); setBulkGroupId('') }}
                className="rounded-2xl border border-black/15 px-4 py-2 text-sm font-semibold text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
      {bulkRemoveFromGroupOpen && (
        <Modal title="Remove from group" onClose={() => { setBulkRemoveFromGroupOpen(false); setBulkGroupId('') }}>
          <div className="space-y-4">
            <label htmlFor="bulk-remove-group" className="block text-xs font-semibold tracking-wide text-black/50 text-black/60">Group</label>
            <select
              id="bulk-remove-group"
              value={bulkGroupId}
              onChange={(e) => setBulkGroupId(e.target.value)}
              className="w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-black"
            >
              <option value="">Select group</option>
              {deviceGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={async () => {
                  if (!bulkGroupId) return
                  await removeFromGroup.mutateAsync({ groupId: bulkGroupId, deviceIds: Array.from(selectedIds) })
                  addToast(`${selectedIds.size} device(s) removed from group.`)
                  clearSelection()
                  setBulkRemoveFromGroupOpen(false)
                  setBulkGroupId('')
                }}
                disabled={!bulkGroupId || removeFromGroup.isPending}
                className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-black/90 active:scale-[0.98] disabled:opacity-50"
              >
                Remove
              </button>
              <button
                type="button"
                onClick={() => { setBulkRemoveFromGroupOpen(false); setBulkGroupId('') }}
                className="rounded-2xl border border-black/15 px-4 py-2 text-sm font-semibold text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
      {bulkAssignOpen && (
        <Modal title="Assign to client" onClose={() => setBulkAssignOpen(false)}>
          <div className="space-y-4">
            <label className="block text-xs font-semibold tracking-wide text-black/50 text-black/60">Client</label>
            <ClientSelector
              value={bulkAssignClientId}
              onChange={(id) => setBulkAssignClientId(id ?? '')}
              placeholder="Select client"
              aria-label="Select client"
            />
            <label className="block text-xs font-semibold tracking-wide text-black/50 text-black/60">Plan</label>
            <select
              value={bulkAssignPlanId}
              onChange={(e) => setBulkAssignPlanId(e.target.value)}
              className="w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-black"
              aria-label="Select plan"
            >
              <option value="">Select plan</option>
              {(plans ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name} — USD {p.amount.toLocaleString()} / {p.billing_cycle}</option>
              ))}
            </select>
            <label className="block text-xs font-semibold tracking-wide text-black/50 text-black/60">Subscription start date</label>
            <input
              type="date"
              value={bulkAssignStartDate}
              onChange={(e) => setBulkAssignStartDate(e.target.value)}
              className="w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-black"
              aria-label="Subscription start date"
            />
            <p className="text-xs text-black/60">Only devices currently in stock will be assigned.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleBulkAssign}
                disabled={!bulkAssignClientId || !bulkAssignPlanId || assignDevice.isPending}
                className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-black/90 active:scale-[0.98] disabled:opacity-50"
              >
                Assign
              </button>
              <button
                type="button"
                onClick={() => setBulkAssignOpen(false)}
                className="rounded-2xl border border-black/15 px-4 py-2 text-sm font-semibold text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
