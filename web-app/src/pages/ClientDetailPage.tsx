import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useRole } from '../context/RoleContext'
import { QueryErrorBanner } from '../components/QueryErrorBanner'
import { useClient } from '../hooks/useClients'
import { useSubscriptionsByClient } from '../hooks/useSubscriptions'
import { useInvoicesByClient } from '../hooks/useInvoices'
import { useAssignDevice } from '../hooks/useAssignments'
import { useSubscriptionPlans } from '../hooks/useSubscriptionPlans'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { DeviceType } from '../types'

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-black/5 p-4">
      <p className="text-xs tracking-wide text-black/60">{label}</p>
      <p className="mt-2 text-sm font-semibold text-black">{value}</p>
    </div>
  )
}

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [showAssign, setShowAssign] = useState(false)
  const [assignDeviceId, setAssignDeviceId] = useState('')
  const [assignPlanId, setAssignPlanId] = useState('')

  const { data: client, isLoading, isError, error, refetch } = useClient(id ?? null)
  const { data: clientSubs = [] } = useSubscriptionsByClient(id ?? null)
  const { data: clientInvoices = [] } = useInvoicesByClient(id ?? null)
  const { isViewer } = useRole()
  const assignDevice = useAssignDevice()
  const { data: availableDevices } = useQuery({
    queryKey: ['devices-in-stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('id, name, identifier, device_type')
        .eq('status', 'in_stock')
        .order('name', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    enabled: showAssign,
  })
  const selectedDevice = availableDevices?.find((d) => d.id === assignDeviceId)
  const { data: plans } = useSubscriptionPlans(selectedDevice?.device_type as DeviceType | undefined)

  if (isError) {
    return (
      <div className="space-y-6">
        <Link
          to="/clients"
          className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black"
        >
          <ChevronRight className="h-4 w-4 rotate-180" /> Back
        </Link>
        <QueryErrorBanner
          message={error?.message ?? 'Failed to load client.'}
          onRetry={() => void refetch()}
        />
      </div>
    )
  }

  if (isLoading || !client) {
    return (
      <div className="space-y-6">
        <Link
          to="/clients"
          className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black"
        >
          <ChevronRight className="h-4 w-4 rotate-180" /> Back
        </Link>
        <p className="text-sm text-black/60">{isLoading ? 'Loading…' : 'Client not found.'}</p>
      </div>
    )
  }

  const mutationError = assignDevice.error

  return (
    <div className="space-y-6">
      {mutationError != null && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {mutationError.message}
        </div>
      )}
      <div className="flex items-center justify-between">
        <Link
          to="/clients"
          className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black"
        >
          <ChevronRight className="h-4 w-4 rotate-180" /> Back
        </Link>
        {!isViewer && (
          <Link
            to={`/clients/${client.id}/edit`}
            className="rounded-full bg-black px-4 py-2 text-xs font-semibold tracking-wide whitespace-nowrap text-white transition duration-200 hover:bg-black/90 active:scale-[0.98]"
          >
            Edit Client
          </Link>
        )}
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
          <h2 className="text-xl font-semibold text-black">{client.name}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <InfoCard label="Industry" value={client.industry ?? '—'} />
            <InfoCard label="Contact" value={client.contact_name ?? '—'} />
            <InfoCard label="Email" value={client.email ?? '—'} />
            <InfoCard label="Phone" value={client.phone ?? '—'} />
            <InfoCard label="Address" value={client.address ?? '—'} />
            <InfoCard label="Tax number" value={client.tax_number ?? '—'} />
          </div>
          {client.notes ? (
            <div className="mt-6">
              <p className="text-sm font-semibold text-black">Notes</p>
              <p className="mt-1 text-sm text-black/70">{client.notes}</p>
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-black">Subscriptions</h3>
              {!isViewer && (
                <button
                  onClick={() => setShowAssign(true)}
                  className="rounded-full bg-black px-3 py-1.5 text-xs font-semibold tracking-wide whitespace-nowrap text-white transition duration-200 hover:bg-black/90 active:scale-[0.98]"
                >
                  Assign device
                </button>
              )}
            </div>
            {!isViewer && showAssign && id && (
              <div className="mt-4 rounded-2xl border border-black/10 bg-black/5 p-4">
                <label className="block text-xs tracking-wide text-black/60">Device</label>
                <select
                  value={assignDeviceId}
                  onChange={(e) => {
                    setAssignDeviceId(e.target.value)
                    setAssignPlanId('')
                  }}
                  className="mt-1 w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-black"
                >
                  <option value="">Select device</option>
                  {(availableDevices ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name ?? d.identifier ?? d.id} ({d.device_type.replace(/_/g, ' ')})
                    </option>
                  ))}
                </select>
                <label className="mt-3 block text-xs tracking-wide text-black/60">Plan</label>
                <select
                  value={assignPlanId}
                  onChange={(e) => setAssignPlanId(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-black"
                  disabled={!assignDeviceId}
                >
                  <option value="">Select plan</option>
                  {(plans ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — USD {p.amount.toLocaleString()} / {p.billing_cycle}
                    </option>
                  ))}
                </select>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={async () => {
                      if (!assignDeviceId || !assignPlanId || !id) return
                      try {
                        const { data: { user } } = await supabase.auth.getUser()
                        await assignDevice.mutateAsync({
                          deviceId: assignDeviceId,
                          clientId: id,
                          planId: assignPlanId,
                          assignedBy: user?.id,
                        })
                        setShowAssign(false)
                        setAssignDeviceId('')
                        setAssignPlanId('')
                      } catch (e) {
                        console.error(e)
                      }
                    }}
                    disabled={!assignDeviceId || !assignPlanId || assignDevice.isPending}
                    className="rounded-2xl bg-black px-4 py-2 text-xs font-semibold tracking-wide text-white transition duration-200 hover:bg-black/90 active:scale-[0.98] disabled:opacity-50"
                  >
                    Assign
                  </button>
                  <button
                    onClick={() => {
                      setShowAssign(false)
                      setAssignDeviceId('')
                      setAssignPlanId('')
                    }}
                    className="rounded-2xl border border-black/15 bg-white px-4 py-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <div className="mt-4 space-y-3">
              {clientSubs.length === 0 ? (
                <p className="text-sm text-black/60">No subscriptions or assigned devices.</p>
              ) : (
                clientSubs.map((s) => {
                  const sub = s as typeof s & { devices?: { id: string; name: string | null; identifier: string | null } | null }
                  const deviceId = sub.device_id ?? sub.devices?.id
                  const deviceLabel = sub.devices?.name ?? sub.devices?.identifier ?? (deviceId ? 'View device' : null)
                  return (
                    <div
                      key={s.id}
                      className="rounded-2xl border border-black/10 bg-black/5 px-4 py-3"
                    >
                      <p className="text-sm font-semibold text-black">{s.plan_name}</p>
                      <p className="text-xs text-black/60">
                        USD {s.amount?.toLocaleString()} · {s.status}
                      </p>
                      {deviceId && (
                        <p className="mt-1 text-xs text-black/70">
                          Device:{' '}
                          <Link
                            to={`/devices/${deviceId}`}
                            className="font-medium text-black underline hover:no-underline"
                          >
                            {deviceLabel}
                          </Link>
                        </p>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
          <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
            <h3 className="text-lg font-semibold text-black">Invoices</h3>
            <div className="mt-4 space-y-3">
              {clientInvoices.slice(0, 5).map((inv) => (
                <Link
                  key={inv.id}
                  to={`/invoices/${inv.id}`}
                  className="block rounded-2xl border border-black/10 bg-black/5 px-4 py-3 transition hover:bg-black/10"
                >
                  <p className="text-sm font-semibold text-black">{inv.invoice_number}</p>
                  <p className="text-xs text-black/60">
                    USD {inv.amount?.toLocaleString()} · {inv.status}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
