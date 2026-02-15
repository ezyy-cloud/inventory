import { AlertTriangle, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { QueryErrorBanner } from '../components/QueryErrorBanner'
import { StatusPill } from '../components/StatusPill'
import {
  useDashboardStats,
  useDevicesByCategory,
  useMRRByClient,
  useMRRByPlan,
  useMRRTrend,
  useOverdueInvoices,
  useOverdueSubscriptions,
  useRenewalAlerts,
  useSubscriptionsEndingWithin,
  useDevicesInMaintenance,
} from '../hooks/useDashboard'
import { useOverdueInvoicesSummary } from '../hooks/useInvoices'
import { useDeviceStatusBreakdown } from '../hooks/useReports'
import { DEVICE_TYPE_LABELS } from '../types'

const CHART_COLORS = [
  'oklch(0.65 0 0)',
  'oklch(0.55 0 0)',
  'oklch(0.35 0 0)',
  'oklch(0.8 0 0)',
  'oklch(0.4 0 0)',
]

const STATUS_ORDER = ['in_stock', 'assigned', 'maintenance', 'retired', 'lost'] as const

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

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
  const { data: devicesByCategory, isLoading: devicesByCategoryLoading } = useDevicesByCategory()
  const { data: mrrByPlan, isLoading: mrrByPlanLoading } = useMRRByPlan()
  const { data: mrrByClient, isLoading: mrrByClientLoading } = useMRRByClient(10)
  const { data: statusBreakdown, isLoading: statusBreakdownLoading } = useDeviceStatusBreakdown()

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
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard
          label="Total Devices"
          value={statsLoading ? '—' : String(stats?.totalDevices ?? 0)}
        />
        <StatCard
          label="Assigned"
          value={statsLoading ? '—' : String(stats?.assignedDevices ?? 0)}
        />
        <StatCard
          label="Available"
          value={statusBreakdownLoading ? '—' : String(statusBreakdown?.find((r) => r.status === 'in_stock')?.count ?? 0)}
        />
        <StatCard
          label="Active Subscriptions"
          value={statsLoading ? '—' : String(stats?.activeSubscriptions ?? 0)}
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

      {((overdueInvs?.length ?? 0) > 0 || (maintenanceDevices?.length ?? 0) > 0) && (
        <section className="card-shadow rounded-3xl border border-black/10 bg-white p-4">
          <p className="text-sm text-black">
            <Link
              to="/invoices?status=overdue"
              className="font-semibold text-black underline transition hover:opacity-80"
            >
              {overdueInvs?.length ?? 0} overdue invoice(s)
            </Link>
            {' · '}
            <Link
              to="/devices?status=maintenance"
              className="font-semibold text-black underline transition hover:opacity-80"
            >
              {maintenanceDevices?.length ?? 0} device(s) in maintenance &gt;7 days
            </Link>
          </p>
        </section>
      )}

      <section className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-black">Devices by status</h2>
          <Link
            to="/devices"
            className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:opacity-80"
          >
            View Inventory <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        {statusBreakdownLoading ? (
          <p className="mt-6 text-sm text-black/60">Loading…</p>
        ) : (statusBreakdown?.length ?? 0) > 0 ? (
          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={STATUS_ORDER.map((status) => {
                  const row = statusBreakdown?.find((r) => r.status === status)
                  return {
                    name: formatStatusLabel(status),
                    count: row?.count ?? 0,
                  }
                })}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
              >
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number | undefined) => [value ?? 0, 'Devices']} />
                <Bar dataKey="count" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-6 text-sm text-black/60">No device data.</p>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-black">Devices by category</h2>
            <Link
              to="/devices"
              className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:opacity-80"
            >
              View Inventory <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          {devicesByCategoryLoading ? (
            <p className="mt-6 text-sm text-black/60">Loading…</p>
          ) : (devicesByCategory?.length ?? 0) > 0 ? (
            <div className="mt-6 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[...(devicesByCategory ?? [])]
                  .sort((a, b) => b.count - a.count)
                  .map((r) => ({
                    name: DEVICE_TYPE_LABELS[r.device_type as keyof typeof DEVICE_TYPE_LABELS] ?? r.device_type,
                    count: r.count,
                  }))}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                >
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number | undefined) => [value ?? 0, 'Devices']} />
                  <Bar dataKey="count" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-6 text-sm text-black/60">No device data.</p>
          )}
        </div>

        <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-black">MRR breakdown</h2>
            <Link
              to="/subscriptions"
              className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:opacity-80"
            >
              Subscriptions <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          {mrrByPlanLoading ? (
            <p className="mt-6 text-sm text-black/60">Loading…</p>
          ) : (mrrByPlan?.length ?? 0) > 0 ? (
            <div className="mt-6 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={(mrrByPlan ?? []).map((r) => ({ name: r.plan_name, value: r.mrr }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {(mrrByPlan ?? []).map((r, i) => (
                      <Cell key={r.plan_name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number | undefined) => [`USD ${(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 'MRR']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-6 text-sm text-black/60">No MRR data.</p>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-black">Revenue (from invoices, last 6 months)</h2>
              <p className="text-xs text-black/60">From paid, sent, and overdue invoices.</p>
            </div>
            <Link
              to="/reports"
              className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:opacity-80"
            >
              Reports <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          {(mrrTrend?.length ?? 0) > 0 ? (
            <div className="mt-6 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mrrTrend ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    formatter={(value: number | undefined) => [`USD ${(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 'Revenue']}
                    labelFormatter={(label) => `Month: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke={CHART_COLORS[0]}
                    strokeWidth={2}
                    dot={{ fill: CHART_COLORS[0] }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-6 text-sm text-black/60">No revenue trend data.</p>
          )}
        </div>

        <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-black">Cost centers (MRR by client)</h2>
            <Link
              to="/clients"
              className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:opacity-80"
            >
              View clients <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          {mrrByClientLoading ? (
            <p className="mt-6 text-sm text-black/60">Loading…</p>
          ) : (mrrByClient?.length ?? 0) > 0 ? (
            <div className="mt-6 space-y-4">
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(mrrByClient ?? []).map((r) => ({
                      name: r.client_name.length > 20 ? r.client_name.slice(0, 20) + '…' : r.client_name,
                      mrr: r.mrr,
                      fullName: r.client_name,
                    }))}
                    layout="vertical"
                    margin={{ top: 4, right: 60, left: 0, bottom: 4 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(value: number | undefined, _n, props: { payload?: { fullName?: string } }) => [
                        `USD ${(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                        props?.payload?.fullName ?? 'MRR',
                      ]}
                    />
                    <Bar dataKey="mrr" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="max-h-32 space-y-1 overflow-y-auto text-xs">
                {(mrrByClient ?? []).map((r) => (
                  <li key={r.client_id} className="flex justify-between gap-2">
                    <Link to={`/clients/${r.client_id}`} className="truncate font-medium text-black hover:underline">
                      {r.client_name}
                    </Link>
                    <span className="shrink-0 text-black/60">
                      USD {r.mrr.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-6 text-sm text-black/60">No client MRR data.</p>
          )}
        </div>
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
                <span className="text-xs text-black/60">
                  {stats?.activeSubscriptions ?? 0}
                  {stats?.assignedDevices != null && stats.assignedDevices > 0
                    ? ` · ${Math.round(((stats?.activeSubscriptions ?? 0) / stats.assignedDevices) * 100)}% of assigned`
                    : ''}
                </span>
              </div>
              <MiniBar
                value={
                  (stats?.assignedDevices ?? 0) > 0
                    ? ((stats?.activeSubscriptions ?? 0) / (stats?.assignedDevices ?? 1)) * 100
                    : 0
                }
              />
            </div>
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
