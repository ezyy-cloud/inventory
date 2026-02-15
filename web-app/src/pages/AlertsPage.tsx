import { AlertTriangle, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { QueryErrorBanner } from '../components/QueryErrorBanner'
import { StatusPill } from '../components/StatusPill'
import { useUnifiedAlerts } from '../hooks/useDashboard'
import { useOverdueInvoicesSummary } from '../hooks/useInvoices'
import type { AlertType, UnifiedAlert } from '../types'

const LIMIT = 20

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  overdue_invoice: 'Overdue invoices',
  overdue_subscription: 'Overdue subscriptions',
  renewal_due: 'Renewals due (14 days)',
  subscription_ending_soon: 'Subscriptions ending in 30 days',
  device_maintenance_long: 'Devices in maintenance (> 7 days)',
}

const ALERT_TYPE_LINKS: Record<AlertType, string> = {
  overdue_invoice: '/invoices?status=overdue',
  overdue_subscription: '/subscriptions',
  renewal_due: '/subscriptions',
  subscription_ending_soon: '/subscriptions?end_within=30',
  device_maintenance_long: '/devices?status=maintenance',
}

function AlertRow({ alert }: { alert: UnifiedAlert }) {
  const isOverdue = alert.severity === 'high'
  const isEndingSoon = alert.type === 'subscription_ending_soon'
  const statusPill =
    alert.type === 'overdue_subscription' ? 'overdue' : alert.type === 'renewal_due' ? 'due_soon' : null

  return (
    <li>
      <Link
        to={alert.link}
        className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition duration-200 active:scale-[0.99] ${
          isOverdue
            ? 'border-red-200 bg-red-50 hover:bg-red-100'
            : isEndingSoon
              ? 'border-amber-200 bg-amber-50 hover:bg-amber-100'
              : 'border-black/10 bg-black/5 hover:bg-black/10'
        }`}
      >
        <span className="font-medium text-black">{alert.title}</span>
        <span className="flex items-center gap-2 text-xs text-black/60">
          {alert.subtitle}
          {statusPill != null && <StatusPill value={statusPill} />}
        </span>
      </Link>
    </li>
  )
}

function AlertSection({
  type,
  alerts,
  summary,
}: {
  type: AlertType
  alerts: UnifiedAlert[]
  summary?: { count: number; total: number }
}) {
  const label = ALERT_TYPE_LABELS[type]
  const viewAllLink = ALERT_TYPE_LINKS[type]
  const isEmpty = alerts.length === 0

  return (
    <section className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-black">{label}</h2>
        <Link
          to={viewAllLink}
          className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:opacity-80"
        >
          View all <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      {type === 'overdue_invoice' && summary != null && (
        <p className="mt-1 text-sm text-black/60">
          {summary.count} invoice(s) · USD {summary.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </p>
      )}
      <ul className="mt-4 space-y-2">
        {isEmpty ? (
          <li className="rounded-2xl border border-black/10 bg-black/5 px-4 py-3 text-sm text-black/60">
            {type === 'overdue_invoice' && 'No overdue invoices.'}
            {type === 'overdue_subscription' && 'No overdue subscriptions.'}
            {type === 'renewal_due' && 'No renewals due in the next 14 days.'}
            {type === 'subscription_ending_soon' && 'None.'}
            {type === 'device_maintenance_long' && 'None.'}
          </li>
        ) : (
          alerts.map((alert) => <AlertRow key={alert.id} alert={alert} />)
        )}
      </ul>
    </section>
  )
}

export function AlertsPage() {
  const { data: alerts, isError, error, refetch } = useUnifiedAlerts(LIMIT)
  const { data: overdueSummary } = useOverdueInvoicesSummary()

  const byType = (type: AlertType) => (alerts ?? []).filter((a) => a.type === type)
  const summary =
    overdueSummary != null
      ? { count: overdueSummary.count ?? 0, total: overdueSummary.total ?? 0 }
      : undefined

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-6 w-6 text-black" />
        <h1 className="text-xl font-semibold text-black">Alerts</h1>
      </div>

      {isError && (
        <QueryErrorBanner
          message={error instanceof Error ? error.message : 'Failed to load alerts.'}
          onRetry={refetch}
        />
      )}

      <AlertSection
        type="overdue_invoice"
        alerts={byType('overdue_invoice')}
        summary={summary}
      />
      <section className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-black">Renewals due (14 days)</h2>
          <Link
            to="/subscriptions"
            className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:opacity-80"
          >
            Subscriptions <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <ul className="mt-4 space-y-2">
          {byType('overdue_subscription').map((alert) => (
            <AlertRow key={alert.id} alert={alert} />
          ))}
          {byType('renewal_due').map((alert) => (
            <AlertRow key={alert.id} alert={alert} />
          ))}
          {byType('overdue_subscription').length === 0 && byType('renewal_due').length === 0 && (
            <li className="rounded-2xl border border-black/10 bg-black/5 px-4 py-3 text-sm text-black/60">
              No renewals due in the next 14 days.
            </li>
          )}
        </ul>
      </section>
      <AlertSection type="subscription_ending_soon" alerts={byType('subscription_ending_soon')} />
      <AlertSection type="device_maintenance_long" alerts={byType('device_maintenance_long')} />
    </div>
  )
}
