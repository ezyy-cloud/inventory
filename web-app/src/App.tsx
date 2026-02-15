import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './App.css'
import { AppLayout } from './components/AppLayout'
import { RequireRole } from './components/RequireRole'
import { RouteErrorBoundary } from './components/RouteErrorBoundary'
import { RoleProvider } from './context/RoleContext'
import { SearchProvider } from './context/SearchContext'
import { ToastProvider } from './context/ToastContext'
import { supabase } from './lib/supabaseClient'
import type { UserRole } from './types'
import { DashboardPage } from './pages/DashboardPage'
import { DevicesPage } from './pages/DevicesPage'
import { DeviceDetailPage } from './pages/DeviceDetailPage'
import { DeviceFormPage } from './pages/DeviceFormPage'
import { DeviceEditPage } from './pages/DeviceEditPage'
import { DeviceGroupsPage } from './pages/DeviceGroupsPage'
import { ClientsPage } from './pages/ClientsPage'
import { ClientDetailPage } from './pages/ClientDetailPage'
import { ClientFormPage } from './pages/ClientFormPage'
import { SearchPage } from './pages/SearchPage'
import { SubscriptionsPage } from './pages/SubscriptionsPage'
import { PlansPage } from './pages/PlansPage'
import { ProvidersPage } from './pages/ProvidersPage'
import { InvoicesPage } from './pages/InvoicesPage'
import { InvoiceDetailPage } from './pages/InvoiceDetailPage'
import { ProviderPaymentsPage } from './pages/ProviderPaymentsPage'
import { ReportsPage } from './pages/ReportsPage'
import { AlertsPage } from './pages/AlertsPage'
import { ImportsPage } from './pages/ImportsPage'
import { SettingsPage } from './pages/SettingsPage'
import { ActivityPage } from './pages/ActivityPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 2,
    },
    mutations: {
      retry: false,
    },
  },
})

const ROLES_SUPER_ADMIN: UserRole[] = ['super_admin']
const ROLES_ADMIN: UserRole[] = ['super_admin', 'admin']
const ROLES_FRONT_DESK: UserRole[] = ['super_admin', 'admin', 'front_desk']
const ROLES_TECHNICIAN: UserRole[] = ['super_admin', 'admin', 'technician']
const ROLES_DEVICES_READ: UserRole[] = ['super_admin', 'admin', 'technician', 'viewer']
const ROLES_CLIENTS_READ: UserRole[] = ['super_admin', 'admin', 'front_desk', 'viewer']

type Profile = {
  full_name?: string | null
  role?: string | null
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6">
      <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" />
      <path d="M8.5 12.5l2.3 2.3 4.7-4.7" />
    </svg>
  )
}

function AuthScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignIn = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (signInError) {
      setError(signInError.message)
      return
    }
    onSignedIn()
  }

  return (
    <div className="app-shell min-h-screen app-noise">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <h1 className="text-4xl font-semibold text-black md:text-5xl">
              Ezyy Inventory
            </h1>
          </div>
          <div className="card-shadow rounded-3xl border border-black/10 bg-white p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white">
                <ShieldIcon />
              </div>
                <h2 className="text-2xl font-semibold text-black">Sign in</h2>
            </div>
            <form className="mt-8 space-y-4" onSubmit={handleSignIn}>
              <label className="block text-xs tracking-wide text-black/60">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@company.com"
                className="w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-black placeholder:text-black/40"
              />
              <label className="block text-xs tracking-wide text-black/60">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-black placeholder:text-black/40"
              />
              {error ? (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold tracking-wide text-white transition duration-200 hover:bg-black/90 active:scale-[0.98]"
              >
                {loading ? 'Signing in…' : 'Access Dashboard'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/devices" element={<RequireRole allowedRoles={ROLES_DEVICES_READ}><DevicesPage /></RequireRole>} />
      <Route path="/devices/new/:type" element={<RequireRole allowedRoles={ROLES_TECHNICIAN}><DeviceFormPage /></RequireRole>} />
      <Route path="/devices/:id" element={<RequireRole allowedRoles={ROLES_DEVICES_READ}><DeviceDetailPage /></RequireRole>} />
      <Route path="/devices/:id/edit" element={<RequireRole allowedRoles={ROLES_TECHNICIAN}><DeviceEditPage /></RequireRole>} />
      <Route path="/devices/groups" element={<RequireRole allowedRoles={ROLES_DEVICES_READ}><DeviceGroupsPage /></RequireRole>} />
      <Route path="/clients" element={<RequireRole allowedRoles={ROLES_CLIENTS_READ}><ClientsPage /></RequireRole>} />
      <Route path="/clients/new" element={<RequireRole allowedRoles={ROLES_FRONT_DESK}><ClientFormPage /></RequireRole>} />
      <Route path="/clients/:id" element={<RequireRole allowedRoles={ROLES_CLIENTS_READ}><ClientDetailPage /></RequireRole>} />
      <Route path="/clients/:id/edit" element={<RequireRole allowedRoles={ROLES_FRONT_DESK}><ClientFormPage /></RequireRole>} />
      <Route path="/subscriptions" element={<RequireRole allowedRoles={ROLES_CLIENTS_READ}><SubscriptionsPage /></RequireRole>} />
      <Route path="/plans" element={<RequireRole allowedRoles={ROLES_CLIENTS_READ}><PlansPage /></RequireRole>} />
      <Route path="/providers" element={<RequireRole allowedRoles={ROLES_CLIENTS_READ}><ProvidersPage /></RequireRole>} />
      <Route path="/invoices" element={<RequireRole allowedRoles={ROLES_CLIENTS_READ}><InvoicesPage /></RequireRole>} />
      <Route path="/invoices/:id" element={<RequireRole allowedRoles={ROLES_CLIENTS_READ}><InvoiceDetailPage /></RequireRole>} />
      <Route path="/provider-payments" element={<RequireRole allowedRoles={ROLES_CLIENTS_READ}><ProviderPaymentsPage /></RequireRole>} />
      <Route path="/reports" element={<RequireRole allowedRoles={ROLES_CLIENTS_READ}><ReportsPage /></RequireRole>} />
      <Route path="/alerts" element={<RequireRole allowedRoles={ROLES_CLIENTS_READ}><AlertsPage /></RequireRole>} />
      <Route path="/imports" element={<RequireRole allowedRoles={ROLES_FRONT_DESK}><ImportsPage /></RequireRole>} />
      <Route path="/settings" element={<RequireRole allowedRoles={ROLES_SUPER_ADMIN}><SettingsPage /></RequireRole>} />
      <Route path="/activity" element={<RequireRole allowedRoles={ROLES_ADMIN}><ActivityPage /></RequireRole>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return
        setSession(data.session)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      active = false
      void subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }
    void (async () => {
      try {
        const { data } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', session.user.id)
      .maybeSingle()
        setProfile(data ?? null)
      } catch {
        setProfile(null)
      }
    })()
  }, [session])

  if (loading) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center">
        <div className="rounded-3xl border border-black/10 bg-white px-8 py-6 text-sm font-semibold tracking-wide text-black">
          Loading inventory console…
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <AuthScreen
        onSignedIn={async () => {
          const { data } = await supabase.auth.getSession()
          setSession(data.session)
        }}
      />
    )
  }

  const role = (profile?.role ?? null) as UserRole | null

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <RoleProvider role={role}>
            <SearchProvider>
              <AppLayout profile={profile ?? {}}>
              <RouteErrorBoundary>
                <AppRoutes />
              </RouteErrorBoundary>
              </AppLayout>
            </SearchProvider>
          </RoleProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
