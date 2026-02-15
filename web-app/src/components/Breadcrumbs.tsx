import { Link, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

const PATH_LABELS: Record<string, string> = {
  '': 'Dashboard',
  search: 'Search',
  devices: 'Inventory',
  clients: 'Clients',
  subscriptions: 'Subscriptions',
  plans: 'Plans',
  invoices: 'Invoices',
  providers: 'Services',
  'provider-payments': 'Payments',
  imports: 'Imports',
  reports: 'Reports',
  settings: 'Settings',
}

export function Breadcrumbs() {
  const location = useLocation()
  const pathname = location.pathname
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) {
    return (
      <nav aria-label="Breadcrumb" className="text-xs tracking-wide text-black/60">
        <Link to="/" className="font-semibold text-black transition duration-200 hover:underline">
          Dashboard
        </Link>
      </nav>
    )
  }
  const crumbs: { path: string; label: string }[] = []
  let acc = ''
  for (let i = 0; i < segments.length; i++) {
    acc += (acc ? '/' : '') + segments[i]
    const segment = segments[i]
    const label =
      PATH_LABELS[segment] ??
      (segment === 'new' && segments[i - 1] ? `New ${PATH_LABELS[segments[i - 1]] ?? segment}` : null) ??
      (i === segments.length - 1 && !['new', 'edit'].includes(segment) ? segment : segment.replace(/-/g, ' '))
    crumbs.push({ path: acc, label })
  }
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs tracking-wide text-black/60">
      <Link to="/" className="font-semibold text-black transition duration-200 hover:underline">
        Home
      </Link>
      {crumbs.map((crumb, i) => (
        <span key={crumb.path} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3 shrink-0" />
          {i === crumbs.length - 1 ? (
            <span className="font-semibold text-black">{crumb.label}</span>
          ) : (
            <Link to={`/${crumb.path}`} className="font-semibold text-black transition duration-200 hover:underline">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
