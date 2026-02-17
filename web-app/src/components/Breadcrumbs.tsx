import { Link, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

const PATH_LABELS: Record<string, string> = {
  '': 'Dashboard',
  search: 'Search',
  devices: 'Inventory',
  clients: 'Clients',
  mail: 'Mail',
  subscriptions: 'Subscriptions',
  plans: 'Plans',
  invoices: 'Invoices',
  providers: 'Services',
  'provider-payments': 'Payments',
  imports: 'Imports',
  reports: 'Reports',
  settings: 'Settings',
  groups: 'Groups',
  car_tracker: 'Car Trackers',
  ip_camera: 'IP Cameras',
  starlink: 'Starlinks',
  wifi_access_point: 'WiFi Access Points',
  tv: 'TVs',
  drone: 'Drones',
  printer: 'Printers',
  websuite: 'Websuites',
  isp_link: 'ISP Links',
  other: 'Other',
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
    const segment = segments[i]
    if (segment === 'type' && segments[i + 1] && PATH_LABELS[segments[i + 1]]) {
      acc += (acc ? '/' : '') + segment + '/' + segments[i + 1]
      crumbs.push({ path: acc, label: PATH_LABELS[segments[i + 1]] ?? segments[i + 1].replace(/_/g, ' ') })
      i++
      continue
    }
    acc += (acc ? '/' : '') + segment
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
