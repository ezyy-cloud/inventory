import { Link } from 'react-router-dom'
import { QueryErrorBanner } from '../components/QueryErrorBanner'
import { useAuditLog } from '../hooks/useAuditLog'

function entityUrl(type: string | null, id: string | null): string | null {
  if (!type || !id) return null
  switch (type) {
    case 'devices':
      return `/devices/${id}`
    case 'profiles':
      return '/settings'
    case 'client_invoices':
      return `/invoices/${id}`
    default:
      return null
  }
}

export function ActivityPage() {
  const { data: entries, isLoading, isError, error, refetch } = useAuditLog(50)

  if (isError) {
    return (
      <div className="space-y-6">
        <QueryErrorBanner
          message={error?.message ?? 'Failed to load activity.'}
          onRetry={() => void refetch()}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
        <h2 className="text-lg font-semibold text-black">Recent activity</h2>
        {isLoading ? (
          <div className="mt-4 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-2xl bg-black/10" />
            ))}
          </div>
        ) : (entries ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-black/60">No activity yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {(entries ?? []).map((entry) => {
              const url = entityUrl(entry.entity_type, entry.entity_id)
              return (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/10 bg-black/5 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-black">{entry.action}</p>
                    <p className="text-xs text-black/60">
                      {(entry.profiles as { full_name?: string } | null)?.full_name ?? 'System'}
                      {' · '}
                      {new Date(entry.created_at).toLocaleString()}
                    </p>
                  </div>
                  {url && (
                    <Link
                      to={url}
                      className="text-xs font-semibold tracking-wide text-black transition duration-200 hover:underline"
                    >
                      View
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
