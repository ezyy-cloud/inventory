import { AlertTriangle, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { QueryErrorBanner } from '../components/QueryErrorBanner'
import { StatusPill } from '../components/StatusPill'
import {
  useDashboardStats,
  useOverdueSubscriptions,
  useRenewalAlerts,
  useSubscriptionsEndingWithin,
  useOverdueInvoices,
  useDevicesInMaintenance,
  useMRRTrend,
} from '../hooks/useDashboard'
import { useOverdueInvoicesSummary } from '../hooks/useInvoices'

function MiniBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full rounded-full bg-black/10">
      <div className="h-2 rounded-full bg-black" style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-shadow rounded-2xl border border-black/10 bg-white p-6">
      <p className="text-xs tracking-wide text-black/60">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-black">{value}</p>
    </div>
  )
}

export function DashboardPage() {
  const { data: stats, isLoading: statsLoading, isError: statsError, error: statsErrorObj, refetch: refetchStats } = useDashboardStats()
  const { data: renewals, isError: renewalsError, error: renewalsErrorObj, refetch: refetchRenewals } = useRenewalAlerts(5)
  const { data: endingWithin30 } = useSubscriptionsEndingWithin(30, 5)
  const { data: overdueSubs, isError: overdueError, error: overdueErrorObj, refetch: refetchOverdue } = useOverdueSubscriptions(5)
  const { data: overdueInvs } = useOverdueInvoices(5)
  const { data: overdueSummary } = useOverdueInvoicesSummary()
  const { data: maintenanceDevices } = useDevicesInMaintenance(5, 7)
  const { data: mrrTrend } = useMRRTrend(6)

  const hasError = statsError ?? renewalsError ?? overdueError
  const refetchAll = () => {
    void refetchStats()
    void refetchRenewals()
    void refetchOverdue()
  }
  const overdue = overdueSubs

  return (
    <div className="space-y-8">
      {hasError && (
        <QueryErrorBanner
          message={statsErrorObj?.message ?? renewalsErrorObj?.message ?? overdueErrorObj?.message ?? 'Failed to load dashboard data.'}
          onRetry={refetchAll}
        />
      )}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Devices"
          value={statsLoading ? '—' : String(stats?.totalDevices ?? 0)}
        />
        <StatCard
          label="Assigned"
          value={statsLoading ? '—' : String(stats?.assignedDevices ?? 0)}
        />
        <StatCard
          label="MRR"
          value={
            statsLoading
              ? '—'
              : `USD ${(stats?.mrr ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
          }
        />
        <StatCard
          label="Provider Due"
          value={
            statsLoading
              ? '—'
              : `USD ${(stats?.providerDue ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
          }
        />
      </section>

      {(overdueInvs?.length ?? 0) > 0 && (
        <section className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-black">Overdue invoices summary</h2>
            <Link to="/invoices?status=overdue" className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:opacity-80">
              View all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-2 text-2xl font-semibold text-black">
            {overdueSummary?.count ?? 0} invoice(s) · USD {(overdueSummary?.total ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-black">Renewals (14 days)</h2>
            <Link
              to="/invoices"
              className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:opacity-80"
            >
              Invoices <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-6 space-y-4">
            {(endingWithin30?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-semibold tracking-wide text-black/60">Ending in 30 days</p>
                {(endingWithin30 ?? []).slice(0, 3).map((sub) => (
                  <Link
                    key={sub.id}
                    to={`/subscriptions?end_within=30`}
                    className="mt-2 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm transition duration-200 hover:bg-amber-100 active:scale-[0.99]"
                  >
                    <span className="font-medium text-black">{sub.plan_name}</span>
                    <span className="text-xs text-black/60">{sub.clients?.name ?? '—'} · End {sub.end_date ?? '—'}</span>
                  </Link>
                ))}
                {(endingWithin30?.length ?? 0) > 3 && (
                  <Link to="/subscriptions?end_within=30" className="mt-2 block text-xs font-semibold tracking-wide text-black/70 transition duration-200 hover:underline">
                    View all ({endingWithin30?.length ?? 0})
                  </Link>
                )}
              </div>
            )}
            {(renewals ?? []).length === 0 && (overdue ?? []).length === 0 ? (
              <p className="rounded-2xl border border-black/10 bg-black/5 p-4 text-sm text-black/60">
                No renewals due in the next 14 days.
              </p>
            ) : (
              <>
                {(overdue ?? []).map((sub) => (
                  <div
                    key={sub.id}
                    className="rounded-2xl border border-red-200 bg-red-50 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-black">{sub.plan_name}</p>
                        <p className="text-xs text-black/60">{sub.clients?.name ?? '—'}</p>
                      </div>
                      <StatusPill value="overdue" />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-black/60">
                      <span>Due {sub.next_invoice_date ?? '—'}</span>
                      <span>USD {sub.amount?.toLocaleString() ?? '—'}</span>
                    </div>
                  </div>
                ))}
                {(renewals ?? []).map((sub) => (
                  <div
                    key={sub.id}
                    className="rounded-2xl border border-black/10 bg-black/5 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-black">{sub.plan_name}</p>
                        <p className="text-xs text-black/60">{sub.clients?.name ?? '—'}</p>
                      </div>
                      <StatusPill value="due_soon" />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-black/60">
                      <span>Due {sub.next_invoice_date ?? '—'}</span>
                      <span>USD {sub.amount?.toLocaleString() ?? '—'}</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-black">Device coverage</h2>
            <Link
              to="/devices"
              className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:opacity-80"
            >
              View Inventory <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-black">Assigned</span>
                <span className="text-xs text-black/60">
                  {stats?.totalDevices
                    ? `${Math.round(((stats.assignedDevices ?? 0) / stats.totalDevices) * 100)}%`
                    : '0%'}
                </span>
              </div>
              <MiniBar
                value={
                  stats?.totalDevices
                    ? ((stats.assignedDevices ?? 0) / stats.totalDevices) * 100
                    : 0
                }
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-black">Active Subscriptions</span>
                <span className="text-xs text-black/60">{stats?.activeSubscriptions ?? 0}</span>
              </div>
              <MiniBar value={100} />
            </div>
            {(mrrTrend?.length ?? 0) > 0 && (
              <div className="mt-6 space-y-2">
                <p className="text-sm font-semibold text-black">MRR trend (last 6 months)</p>
                <div className="flex gap-1">
                  {mrrTrend?.map(({ month, revenue }) => {
                    const max = Math.max(...(mrrTrend?.map((r) => r.revenue) ?? [1]), 1)
                    return (
                      <div
                        key={month}
                        className="flex-1 rounded bg-black/20"
                        style={{ height: `${(revenue / max) * 60}px`, minHeight: 4 }}
                        title={`${month}: USD ${revenue.toLocaleString()}`}
                      />
                    )
                  })}
                </div>
                <p className="text-xs text-black/60">{mrrTrend?.[0]?.month ?? ''} – {mrrTrend?.[mrrTrend.length - 1]?.month ?? ''}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-black">
          <AlertTriangle className="h-5 w-5" />
          Alerts
        </h2>
        <div className="mt-4 space-y-4">
          {overdueInvs && overdueInvs.length > 0 && (
            <div>
              <p className="text-xs font-semibold tracking-wide text-black/60">Overdue invoices</p>
              <ul className="mt-2 space-y-2">
                {overdueInvs.slice(0, 5).map((inv) => (
                  <li key={inv.id}>
                    <Link to={`/invoices/${inv.id}`} className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm transition duration-200 hover:bg-red-100 active:scale-[0.99]">
                      <span className="font-medium text-black">{inv.invoice_number}</span>
                      <span className="text-xs text-black/60">{inv.clients?.name ?? '—'} · USD {inv.amount?.toLocaleString() ?? '—'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {maintenanceDevices && maintenanceDevices.length > 0 && (
            <div>
              <p className="text-xs font-semibold tracking-wide text-black/60">Devices in maintenance &gt; 7 days</p>
              <ul className="mt-2 space-y-2">
                {maintenanceDevices.map((d) => (
                  <li key={d.id}>
                    <Link to={`/devices/${d.id}`} className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-3 py-2 text-sm transition duration-200 hover:bg-black/10 active:scale-[0.99]">
                      <span className="font-medium text-black">{d.name ?? d.identifier ?? d.id}</span>
                      <span className="text-xs text-black/60">Since {d.updated_at ? new Date(d.updated_at).toLocaleDateString() : '—'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(overdueInvs?.length ?? 0) === 0 && (maintenanceDevices?.length ?? 0) === 0 && (
            <p className="text-sm text-black/60">No alerts.</p>
          )}
        </div>
      </section>
    </div>
  )
}
