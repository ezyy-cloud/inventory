import { FileDown } from 'lucide-react'
import { QueryErrorBanner } from '../components/QueryErrorBanner'
import {
  useDeviceStatusBreakdown,
  useRevenueByMonth,
  useProviderSpend,
  type DeviceStatusBreakdownRow,
  type RevenueByMonthRow,
  type ProviderSpendRow,
} from '../hooks/useReports'
import { downloadCsv } from '../lib/csvExport'

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-2 w-full rounded-full bg-black/10">
      <div
        className="h-2 rounded-full bg-black"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function ReportsPage() {
  const {
    data: statusBreakdown,
    isLoading: statusLoading,
    isError: statusError,
    error: statusErrorObj,
    refetch: refetchStatus,
  } = useDeviceStatusBreakdown()
  const {
    data: revenueByMonth,
    isLoading: revenueLoading,
    isError: revenueError,
    error: revenueErrorObj,
    refetch: refetchRevenue,
  } = useRevenueByMonth(6)
  const {
    data: providerSpend,
    isLoading: providerLoading,
    isError: providerError,
    error: providerErrorObj,
    refetch: refetchProvider,
  } = useProviderSpend()

  const statusList: DeviceStatusBreakdownRow[] = statusBreakdown ?? []
  const revenueList: RevenueByMonthRow[] = revenueByMonth ?? []
  const providerList: ProviderSpendRow[] = providerSpend ?? []

  const hasError = statusError ?? revenueError ?? providerError
  const refetchAll = () => {
    void refetchStatus()
    void refetchRevenue()
    void refetchProvider()
  }

  const maxStatus = Math.max(...statusList.map((r) => r.count), 1)
  const maxRevenue = Math.max(...revenueList.map((r) => r.revenue), 1)
  const maxProvider = Math.max(...providerList.map((r) => r.total), 1)

  const handleExportDeviceStatus = () => {
    const rows = statusList.map((r) => ({ status: r.status, count: r.count }))
    downloadCsv(rows, 'device_status_breakdown.csv', ['status', 'count'])
  }
  const handleExportRevenue = () => {
    const rows = revenueList.map((r) => ({
      month: r.month,
      revenue: r.revenue,
    }))
    downloadCsv(rows, 'revenue_by_month.csv', ['month', 'revenue'])
  }
  const handleExportProviderSpend = () => {
    const rows = providerList.map((r) => ({
      provider_name: r.provider_name,
      total: r.total,
    }))
    downloadCsv(rows, 'provider_spend.csv', ['provider_name', 'total'])
  }

  return (
    <div className="space-y-6">
      {hasError && (
        <QueryErrorBanner
          message={
            statusErrorObj?.message ??
            revenueErrorObj?.message ??
            providerErrorObj?.message ??
            'Failed to load reports.'
          }
          onRetry={refetchAll}
        />
      )}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
          <h2 className="text-lg font-semibold text-black">Device Status Breakdown</h2>
          <p className="mt-1 text-xs text-black/60">Assigned, in stock, maintenance, etc.</p>
          {statusLoading ? (
            <p className="mt-6 text-sm text-black/60">Loading…</p>
          ) : (
            <div className="mt-6 space-y-3">
              {statusList.map((row) => (
                <div key={row.status} className="flex items-center gap-3">
                  <span className="w-24 text-xs font-medium text-black">{row.status}</span>
                  <MiniBar value={row.count} max={maxStatus} />
                  <span className="w-8 text-right text-xs text-black/60">{row.count}</span>
                </div>
              ))}
              {statusList.length === 0 && (
                <p className="text-sm text-black/60">No device data.</p>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={handleExportDeviceStatus}
            disabled={statusLoading ?? statusList.length === 0}
            className="mt-6 inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98] disabled:opacity-50"
          >
            Export CSV <FileDown className="h-4 w-4" />
          </button>
        </div>

        <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
          <h2 className="text-lg font-semibold text-black">Revenue by Month</h2>
          <p className="mt-1 text-xs text-black/60">Paid/sent/overdue invoices, last 6 months</p>
          {revenueLoading ? (
            <p className="mt-6 text-sm text-black/60">Loading…</p>
          ) : (
            <div className="mt-6 space-y-3">
              {revenueList.map((row) => (
                <div key={row.month} className="flex items-center gap-3">
                  <span className="w-24 text-xs font-medium text-black">{row.month}</span>
                  <MiniBar value={row.revenue} max={maxRevenue} />
                  <span className="w-20 text-right text-xs text-black/60">
                    USD {row.revenue.toLocaleString()}
                  </span>
                </div>
              ))}
              {revenueList.length === 0 && (
                <p className="text-sm text-black/60">No revenue data.</p>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={handleExportRevenue}
            disabled={revenueLoading ?? revenueList.length === 0}
            className="mt-6 inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98] disabled:opacity-50"
          >
            Export CSV <FileDown className="h-4 w-4" />
          </button>
        </div>

        <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
          <h2 className="text-lg font-semibold text-black">Provider Spend</h2>
          <p className="mt-1 text-xs text-black/60">Total by provider</p>
          {providerLoading ? (
            <p className="mt-6 text-sm text-black/60">Loading…</p>
          ) : (
            <div className="mt-6 space-y-3">
              {providerList.map((row) => (
                <div key={row.provider_name} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-black">
                    {row.provider_name}
                  </span>
                  <MiniBar value={row.total} max={maxProvider} />
                  <span className="w-20 shrink-0 text-right text-xs text-black/60">
                    USD {row.total.toLocaleString()}
                  </span>
                </div>
              ))}
              {providerList.length === 0 && (
                <p className="text-sm text-black/60">No provider payments.</p>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={handleExportProviderSpend}
            disabled={providerLoading ?? providerList.length === 0}
            className="mt-6 inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98] disabled:opacity-50"
          >
            Export CSV <FileDown className="h-4 w-4" />
          </button>
        </div>
      </section>
      <section className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-black">Scheduled exports</h2>
          <button
            type="button"
            disabled
            title="Coming soon"
            className="cursor-not-allowed rounded-full border border-black/20 bg-black/5 px-4 py-2 text-xs font-semibold tracking-wide text-black/60"
          >
            Schedule Export
          </button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="min-w-0 rounded-2xl border border-black/10 bg-black/5 p-4">
            <p className="break-words text-sm font-semibold text-black">Monthly finance pack</p>
            <p className="mt-1 text-xs text-black/60">Coming soon</p>
          </div>
          <div className="min-w-0 rounded-2xl border border-black/10 bg-black/5 p-4">
            <p className="break-words text-sm font-semibold text-black">Device uptime</p>
            <p className="mt-1 text-xs text-black/60">Coming soon</p>
          </div>
          <div className="min-w-0 rounded-2xl border border-black/10 bg-black/5 p-4">
            <p className="break-words text-sm font-semibold text-black">Provider spend</p>
            <button
              type="button"
              onClick={handleExportProviderSpend}
              disabled={providerLoading ?? providerList.length === 0}
              className="mt-4 inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98] disabled:opacity-50"
            >
              Download <FileDown className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
