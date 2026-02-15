import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { UserRole } from '../types'
import { ALERT_TYPE_LABELS } from '../types'
import { Breadcrumbs } from './Breadcrumbs'
import { useToast } from '../context/ToastContext'
import { useNotifications, useMarkAllNotificationsRead, useMarkNotificationRead } from '../hooks/useNotifications'
import { useSidebarCounts } from '../hooks/useSidebarCounts'
import {
  Bell,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileBarChart2,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Search,
  Server,
  Settings,
  UploadCloud,
  Users,
  Wrench,
  X,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useRole } from '../context/RoleContext'
import ezyyIcon from '../assets/ezyy.svg'
import { useSearch } from '../context/SearchContext'
import { supabase } from '../lib/supabaseClient'

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  front_desk: 'Front desk',
  technician: 'Technician',
  viewer: 'Viewer',
}

function getRoleLabel(role: string | null | undefined): string {
  if (role == null || role === '') return '—'
  return ROLE_LABELS[role as UserRole] ?? '—'
}

type NavItem = {
  path: string
  label: string
  icon: LucideIcon
}

type NavSection = {
  id: string
  label: string
  icon: LucideIcon
  items: NavItem[]
  /** Section is visible only when this role check passes */
  visible: (helpers: { isTechnician: boolean; isFrontDesk: boolean; isSuperAdmin: boolean; isViewer: boolean }) => boolean
  /** Optional: filter nav items for viewer (e.g. hide Imports) */
  filterItemsForViewer?: boolean
}

const allNavSections: NavSection[] = [
  {
    id: 'devices',
    label: 'Devices',
    icon: Package,
    items: [{ path: '/devices', label: 'Inventory', icon: Package }],
    visible: ({ isTechnician, isViewer }) => isTechnician || isViewer,
  },
  {
    id: 'clients',
    label: 'Clients',
    icon: Users,
    items: [
      { path: '/clients', label: 'Clients', icon: Users },
      { path: '/subscriptions', label: 'Subscriptions', icon: ClipboardList },
      { path: '/plans', label: 'Plans', icon: FileText },
      { path: '/invoices', label: 'Invoices', icon: CreditCard },
    ],
    visible: ({ isFrontDesk, isViewer }) => isFrontDesk || isViewer,
  },
  {
    id: 'providers',
    label: 'Services',
    icon: Server,
    items: [
      { path: '/providers', label: 'Providers', icon: Server },
      { path: '/provider-payments', label: 'Payments', icon: CreditCard },
    ],
    visible: ({ isFrontDesk, isViewer }) => isFrontDesk || isViewer,
  },
  {
    id: 'tools',
    label: 'Tools',
    icon: Wrench,
    items: [
      { path: '/alerts', label: 'Alerts', icon: Bell },
      { path: '/imports', label: 'Imports', icon: UploadCloud },
      { path: '/reports', label: 'Reports', icon: FileBarChart2 },
    ],
    visible: ({ isFrontDesk, isViewer }) => isFrontDesk || isViewer,
    filterItemsForViewer: true,
  },
]

const pageMeta: Record<string, { title: string }> = {
  '/': { title: 'Dashboard' },
  '/search': { title: 'Search' },
  '/devices': { title: 'Inventory' },
  '/clients': { title: 'Clients' },
  '/subscriptions': { title: 'Subscriptions' },
  '/plans': { title: 'Plans' },
  '/providers': { title: 'Services' },
  '/invoices': { title: 'Invoices' },
  '/provider-payments': { title: 'Payments' },
  '/reports': { title: 'Reports' },
  '/imports': { title: 'Imports' },
  '/settings': { title: 'Settings' },
  '/activity': { title: 'Activity' },
}

interface AppLayoutProps {
  children: React.ReactNode
  profile: { full_name?: string | null; role?: string | null }
}

function getPageMeta(path: string) {
  if (pageMeta[path]) return pageMeta[path]
  const segments = path.split('/').filter(Boolean)
  for (let i = segments.length; i >= 1; i--) {
    const base = '/' + segments.slice(0, i).join('/')
    if (pageMeta[base]) return pageMeta[base]
  }
  return pageMeta['/']
}

function getSectionForPath(path: string, sections: NavSection[]): string | null {
  for (const section of sections) {
    if (section.items.some((i) => path === i.path || (i.path !== '/' && path.startsWith(i.path)))) {
      return section.id
    }
  }
  return null
}

export function AppLayout({ children, profile }: AppLayoutProps) {
  const location = useLocation()
  const path = location.pathname
  const meta = getPageMeta(path)
  const { query, setQuery, submitSearch } = useSearch()
  const { isTechnician, isFrontDesk, isSuperAdmin, isAdmin, isViewer } = useRole()
  const { data: sidebarCounts } = useSidebarCounts()
  const navSections = useMemo(() => {
    const sections = allNavSections.filter((s) =>
      s.visible({ isTechnician, isFrontDesk, isSuperAdmin, isViewer }),
    )
    return sections.map((s) => {
      if (s.filterItemsForViewer && isViewer) {
        return { ...s, items: s.items.filter((i) => i.path !== '/imports') }
      }
      return s
    })
  }, [isTechnician, isFrontDesk, isSuperAdmin, isViewer])

  /** Flat list of nav items for collapsed icon-only sidebar */
  const flatNavItems = useMemo(() => {
    const items: { path: string; icon: LucideIcon; label: string }[] = [
      { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    ]
    for (const section of navSections) {
      for (const item of section.items) {
        items.push({ path: item.path, icon: item.icon, label: item.label })
      }
    }
    if (isAdmin) items.push({ path: '/activity', icon: History, label: 'Activity' })
    if (isSuperAdmin) items.push({ path: '/settings', icon: Settings, label: 'Settings' })
    return items
  }, [navSections, isAdmin, isSuperAdmin])

  const activeSection = getSectionForPath(path, navSections)
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const s of navSections) {
      initial[s.id] = s.id === (activeSection ?? '')
    }
    if (!activeSection && navSections.length > 0) {
      initial[navSections[0].id] = true
    }
    return initial
  })

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      return JSON.parse(globalThis.localStorage?.getItem('sidebarOpen') ?? 'true')
    } catch {
      return true
    }
  })
  useEffect(() => {
    try {
      globalThis.localStorage?.setItem('sidebarOpen', JSON.stringify(sidebarOpen))
    } catch {
      // ignore
    }
  }, [sidebarOpen])

  const searchInputRef = useRef<HTMLInputElement>(null)
  const notificationsDropdownRef = useRef<HTMLDivElement>(null)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const { notifications, unreadCount, linkFor, isLoading } = useNotifications(20)
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const queryClient = useQueryClient()
  const { addToast } = useToast()

  const closeNotifications = useCallback(() => setNotificationsOpen(false), [])

  // Realtime: toast on new notification and refresh list
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    void supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user?.id
      if (userId == null) return
      channel = supabase
        .channel('notifications-realtime')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          (payload) => {
            const row = payload.new as { title?: string; type?: string }
            addToast(`New alert: ${row?.title ?? 'Notification'}`, 'success')
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
          },
        )
        .subscribe()
    })
    return () => {
      channel?.unsubscribe()
    }
  }, [addToast, queryClient])
  useEffect(() => {
    if (!notificationsOpen) return
    const handler = (e: MouseEvent) => {
      if (notificationsDropdownRef.current != null && !notificationsDropdownRef.current.contains(e.target as Node)) {
        closeNotifications()
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [notificationsOpen, closeNotifications])

  function formatRelativeTime(iso: string) {
    const d = new Date(iso)
    const now = Date.now()
    const diff = now - d.getTime()
    if (diff < 60_000) return 'Just now'
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
    if (diff < 604800_000) return `${Math.floor(diff / 86400_000)}d ago`
    return d.toLocaleDateString()
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const toggleSection = (id: string) => {
    setExpanded((p) => ({ ...p, [id]: !p[id] }))
  }

  useEffect(() => {
    if (activeSection) {
      setExpanded((p) => (p[activeSection] ? p : { ...p, [activeSection]: true }))
    }
  }, [activeSection])

  return (
    <div className="app-shell min-h-screen app-noise">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`sidebar-glow fixed inset-y-0 left-0 z-40 flex h-screen flex-col overflow-y-auto bg-black text-white transition-[width] duration-200 ease-out ${
          sidebarOpen ? 'w-72 px-6 pb-8' : 'w-16 items-center py-6'
        }`}
      >
          {sidebarOpen ? (
            <>
              <div className="-mx-6 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-white/20 px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <img src={ezyyIcon} alt="" className="h-8 w-8 shrink-0" aria-hidden />
                  <h2 className="truncate text-xl font-semibold tracking-tight">Inventory</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white"
                  aria-label="Collapse sidebar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="mt-6 flex flex-1 flex-col gap-1">
                <Link
                  to="/"
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition ${
                    path === '/' ? 'bg-white text-black' : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <LayoutDashboard className="h-5 w-5 shrink-0" />
                  <span className="text-sm font-semibold">Dashboard</span>
                </Link>
                {navSections.map((section) => {
                  const Icon = section.icon
                  const isExp = expanded[section.id] ?? false
                  const hasActive = section.items.some(
                    (i) => path === i.path || (i.path !== '/' && path.startsWith(i.path)),
                  )
                  return (
                    <div key={section.id} className="mt-2">
                      <button
                        type="button"
                        onClick={() => toggleSection(section.id)}
                        className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition ${
                          hasActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <Icon className="h-5 w-5 shrink-0" />
                          <span className="text-sm font-semibold">{section.label}</span>
                        </span>
                        {isExp ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      {isExp && (
                        <div className="ml-4 mt-1 space-y-1 border-l border-white/20 pl-3">
                          {section.items.map((item) => {
                            const ItemIcon = item.icon
                            const isActive =
                              path === item.path || (item.path !== '/' && path.startsWith(item.path))
                            return (
                              <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
                                  isActive
                                    ? 'bg-white text-black'
                                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                <ItemIcon className="h-4 w-4 shrink-0" />
                                <span className="text-xs font-semibold">
                                  {item.path === '/invoices' && (sidebarCounts?.overdue_invoices ?? 0) > 0
                                    ? `${item.label} (${sidebarCounts?.overdue_invoices ?? 0} overdue)`
                                    : item.path === '/subscriptions' && (sidebarCounts?.subscriptions_ending_soon ?? 0) > 0
                                      ? `${item.label} (${sidebarCounts?.subscriptions_ending_soon ?? 0} ending soon)`
                                      : item.label}
                                </span>
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
                {isAdmin && (
                  <Link
                    to="/activity"
                    className={`mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition ${
                      path.startsWith('/activity') ? 'bg-white text-black' : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <History className="h-5 w-5 shrink-0" />
                    <span className="text-sm font-semibold">Activity</span>
                  </Link>
                )}
                {isSuperAdmin && (
                  <Link
                    to="/settings"
                    className={`mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition ${
                      path.startsWith('/settings') ? 'bg-white text-black' : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Settings className="h-5 w-5 shrink-0" />
                    <span className="text-sm font-semibold">Settings</span>
                  </Link>
                )}
              </nav>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-white/90 transition hover:bg-white/10 hover:text-white"
                aria-label="Expand sidebar"
              >
                <Menu className="h-5 w-5" />
              </button>
              <hr className="mt-4 w-full border-white/20" />
              <nav className="mt-4 flex flex-1 flex-col gap-1">
                {flatNavItems.map((item) => {
                  const Icon = item.icon
                  const isActive =
                    path === item.path || (item.path !== '/' && path.startsWith(item.path))
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      title={item.label}
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
                        isActive ? 'bg-white text-black' : 'text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </Link>
                  )
                })}
              </nav>
            </>
          )}
      </aside>

      <div
        className={`flex min-h-screen flex-1 flex-col transition-[margin] duration-200 ease-out ${sidebarOpen ? 'ml-72' : 'ml-16'}`}
      >
        <header className="sticky top-0 z-30 flex h-16 flex-wrap items-center justify-between gap-4 border-b border-black/10 bg-background px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-2xl font-semibold text-black">{meta.title}</h1>
            <form
              className="relative"
              onSubmit={(e) => {
                e.preventDefault()
                submitSearch()
              }}
            >
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
              <input
                ref={searchInputRef}
                type="search"
                placeholder="Search devices, clients, invoices (⌘K)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-64 rounded-2xl border border-black/10 bg-white px-10 py-2 text-sm text-black placeholder:text-black/40"
              />
            </form>
            <div className="relative" ref={notificationsDropdownRef}>
              <button
                type="button"
                onClick={() => setNotificationsOpen((o) => !o)}
                className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-white transition hover:bg-black/5"
                aria-label="Notifications"
                aria-expanded={notificationsOpen ? 'true' : 'false'}
              >
                <Bell className="h-4 w-4 text-black" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[10px] font-semibold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-96 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-lg">
                  <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
                    <span className="text-sm font-semibold text-black">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={() => { markAllRead.mutate(); closeNotifications() }}
                        className="text-xs font-semibold text-black/60 hover:text-black"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {isLoading ? (
                      <div className="px-4 py-6 text-center text-sm text-black/60">Loading…</div>
                    ) : notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-black/60">No notifications.</div>
                    ) : (
                      (() => {
                        const byType = notifications.reduce<Record<string, typeof notifications>>((acc, n) => {
                          const t = n.type
                          if (!acc[t]) acc[t] = []
                          acc[t].push(n)
                          return acc
                        }, {})
                        const order: Array<keyof typeof ALERT_TYPE_LABELS> = [
                          'overdue_invoice',
                          'overdue_subscription',
                          'renewal_due',
                          'subscription_ending_soon',
                          'device_maintenance_long',
                        ]
                        return (
                          <ul className="divide-y divide-black/5">
                            {order.filter((t) => (byType[t]?.length ?? 0) > 0).map((type) => (
                              <li key={type}>
                                <p className="sticky top-0 bg-white/95 px-4 py-1.5 text-xs font-semibold text-black/60">
                                  {ALERT_TYPE_LABELS[type]} ({byType[type].length})
                                </p>
                                {byType[type].map((n) => (
                                  <Link
                                    key={n.id}
                                    to={linkFor(n)}
                                    onClick={() => {
                                      if (n.read_at == null) markRead.mutate(n.id)
                                      closeNotifications()
                                    }}
                                    className={`block px-4 py-3 text-left transition hover:bg-black/5 ${n.read_at == null ? 'bg-black/[0.02]' : ''}`}
                                  >
                                    <p className="text-sm font-medium text-black">{n.title}</p>
                                    {n.body != null && n.body !== '' && (
                                      <p className="mt-0.5 truncate text-xs text-black/60">{n.body}</p>
                                    )}
                                    <p className="mt-1 text-xs text-black/40">{formatRelativeTime(n.created_at)}</p>
                                  </Link>
                                ))}
                              </li>
                            ))}
                          </ul>
                        )
                      })()
                    )}
                  </div>
                  <div className="border-t border-black/10 px-4 py-2">
                    <Link
                      to="/alerts"
                      onClick={closeNotifications}
                      className="block text-center text-xs font-semibold text-black/60 hover:text-black"
                    >
                      View all alerts
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-black">{profile.full_name ?? 'User'}</p>
              <p className="text-xs text-black/60">{getRoleLabel(profile.role)}</p>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-2xl border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </header>

        <main className="flex-1 px-6 py-8 lg:px-10">
          <div className="mb-4">
            <Breadcrumbs />
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}
