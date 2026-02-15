import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Pagination } from '../components/Pagination'
import { QueryErrorBanner } from '../components/QueryErrorBanner'
import { StatusPill } from '../components/StatusPill'
import { useSearchResults } from '../hooks/useSearch'

export function SearchPage() {
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''
  const { data, isLoading, isError, error, refetch } = useSearchResults(q)

  if (q.length < 2) {
    return (
      <div className="card-shadow rounded-3xl border border-black/10 bg-white p-12 text-center">
        <p className="text-sm text-black/60">Type 2+ characters to search</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="card-shadow rounded-3xl border border-black/10 bg-white p-12 text-center">
        <p className="text-sm text-black/60">Searching…</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <QueryErrorBanner
          message={error?.message ?? 'Search failed.'}
          onRetry={() => void refetch()}
        />
      </div>
    )
  }

  const { devices, clients, invoices, subscriptions } = data ?? {
    devices: [],
    clients: [],
    invoices: [],
    subscriptions: [],
  }

  const total =
    devices.length + clients.length + invoices.length + subscriptions.length

  const PAGE_SIZE = 10

  if (total === 0) {
    return (
      <div className="card-shadow rounded-3xl border border-black/10 bg-white p-12 text-center">
        <p className="text-sm text-black/60">No results for "{q}"</p>
      </div>
    )
  }

  return (
    <SearchResults
      devices={devices}
      clients={clients}
      invoices={invoices}
      subscriptions={subscriptions}
      pageSize={PAGE_SIZE}
    />
  )
}

type SearchResultItem = { type: string; id: string; url: string; label: string }

function SearchResults({
  devices,
  clients,
  invoices,
  subscriptions,
  pageSize,
}: {
  devices: Array<{ id: string; name?: string; identifier?: string; device_type: string; status: string }>
  clients: Array<{ id: string; name: string; email?: string; phone?: string }>
  invoices: Array<{ id: string; invoice_number: string; status: string; clients?: { name: string } | { name: string }[] }>
  subscriptions: Array<{ id: string; plan_name: string; status: string; clients?: { name: string } | { name: string }[] }>
  pageSize: number
}) {
  const navigate = useNavigate()
  const [devicesPage, setDevicesPage] = useState(1)
  const [clientsPage, setClientsPage] = useState(1)
  const [invoicesPage, setInvoicesPage] = useState(1)
  const [subsPage, setSubsPage] = useState(1)
  const paginatedDevices = devices.slice((devicesPage - 1) * pageSize, devicesPage * pageSize)
  const paginatedClients = clients.slice((clientsPage - 1) * pageSize, clientsPage * pageSize)
  const paginatedInvoices = invoices.slice((invoicesPage - 1) * pageSize, invoicesPage * pageSize)
  const paginatedSubs = subscriptions.slice((subsPage - 1) * pageSize, subsPage * pageSize)

  const flatItems: SearchResultItem[] = [
    ...paginatedDevices.map((d) => ({
      type: 'device',
      id: d.id,
      url: `/devices/${d.id}`,
      label: d.name ?? d.identifier ?? d.id,
    })),
    ...paginatedClients.map((c) => ({
      type: 'client',
      id: c.id,
      url: `/clients/${c.id}`,
      label: c.name,
    })),
    ...paginatedInvoices.map((inv) => ({
      type: 'invoice',
      id: inv.id,
      url: `/invoices/${inv.id}`,
      label: inv.invoice_number,
    })),
    ...paginatedSubs.map((s) => ({
      type: 'subscription',
      id: s.id,
      url: '/subscriptions',
      label: s.plan_name,
    })),
  ]
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  useEffect(() => {
    setHighlightedIndex((i) => Math.min(i, Math.max(0, flatItems.length - 1)))
  }, [flatItems.length])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (flatItems.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightedIndex((i) => (i + 1) % flatItems.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightedIndex((i) => (i - 1 + flatItems.length) % flatItems.length)
      } else if (e.key === 'Enter') {
        const item = flatItems[highlightedIndex]
        if (item) {
          e.preventDefault()
          navigate(item.url)
        }
      }
    }
    globalThis.addEventListener('keydown', handler)
    return () => globalThis.removeEventListener('keydown', handler)
  }, [flatItems, highlightedIndex, navigate])

  let idx = 0
  return (
    <div className="space-y-6">
      {devices.length > 0 && (
        <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
          <h3 className="text-sm font-semibold text-black">Devices</h3>
          <p className="mt-1 text-xs text-black/50">Use arrow keys and Enter to open</p>
          <div className="mt-4 space-y-2">
            {paginatedDevices.map((d) => {
              const currentIdx = idx++
              return (
              <Link
                key={d.id}
                to={`/devices/${d.id}`}
                data-result-index={currentIdx}
                className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition ${
                  currentIdx === highlightedIndex ? 'border-black bg-black/5' : 'border-black/10 bg-white hover:bg-black/5'
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-black">
                    {d.name ?? d.identifier ?? d.id}
                  </p>
                  <p className="text-xs text-black/60">{d.device_type}</p>
                </div>
                <StatusPill value={d.status} />
                <ChevronRight className="h-4 w-4 text-black/40" />
              </Link>
            )})}
            <Pagination
              page={devicesPage}
              pageSize={pageSize}
              totalCount={devices.length}
              onPageChange={setDevicesPage}
            />
          </div>
        </div>
      )}

      {clients.length > 0 && (
        <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
          <h3 className="text-sm font-semibold text-black">Clients</h3>
          <div className="mt-4 space-y-2">
            {paginatedClients.map((c) => {
              const currentIdx = idx++
              return (
              <Link
                key={c.id}
                to={`/clients/${c.id}`}
                data-result-index={currentIdx}
                className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition ${
                  currentIdx === highlightedIndex ? 'border-black bg-black/5' : 'border-black/10 bg-white hover:bg-black/5'
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-black">{c.name}</p>
                  <p className="text-xs text-black/60">{c.email ?? c.phone ?? '—'}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-black/40" />
              </Link>
            )})}
            <Pagination
              page={clientsPage}
              pageSize={pageSize}
              totalCount={clients.length}
              onPageChange={setClientsPage}
            />
          </div>
        </div>
      )}

      {invoices.length > 0 && (
        <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
          <h3 className="text-sm font-semibold text-black">Invoices</h3>
          <div className="mt-4 space-y-2">
            {paginatedInvoices.map((inv) => {
              const currentIdx = idx++
              return (
              <Link
                key={inv.id}
                to={`/invoices/${inv.id}`}
                data-result-index={currentIdx}
                className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition ${
                  currentIdx === highlightedIndex ? 'border-black bg-black/5' : 'border-black/10 bg-white hover:bg-black/5'
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-black">{inv.invoice_number}</p>
                  <p className="text-xs text-black/60">
                    {(() => {
                      const c = (inv as { clients?: { name: string } | { name: string }[] }).clients
                      return Array.isArray(c) ? c[0]?.name ?? '—' : c?.name ?? '—'
                    })()}
                  </p>
                </div>
                <StatusPill value={inv.status} />
                <ChevronRight className="h-4 w-4 text-black/40" />
              </Link>
            )})}
            <Pagination
              page={invoicesPage}
              pageSize={pageSize}
              totalCount={invoices.length}
              onPageChange={setInvoicesPage}
            />
          </div>
        </div>
      )}

      {subscriptions.length > 0 && (
        <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
          <h3 className="text-sm font-semibold text-black">Subscriptions</h3>
          <div className="mt-4 space-y-2">
            {paginatedSubs.map((s) => {
              const currentIdx = idx++
              return (
              <Link
                key={s.id}
                to="/subscriptions"
                data-result-index={currentIdx}
                className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition ${
                  currentIdx === highlightedIndex ? 'border-black bg-black/5' : 'border-black/10 bg-white hover:bg-black/5'
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-black">{s.plan_name}</p>
                  <p className="text-xs text-black/60">
                    {(() => {
                      const c = (s as { clients?: { name: string } | { name: string }[] }).clients
                      return Array.isArray(c) ? c[0]?.name ?? '—' : c?.name ?? '—'
                    })()}
                  </p>
                </div>
                <StatusPill value={s.status} />
                <ChevronRight className="h-4 w-4 text-black/40" />
              </Link>
            )})}
            <Pagination
              page={subsPage}
              pageSize={pageSize}
              totalCount={subscriptions.length}
              onPageChange={setSubsPage}
            />
          </div>
        </div>
      )}
    </div>
  )
}
