import { ChevronRight } from 'lucide-react'
import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import { ConfirmModal } from '../components/ConfirmModal'
import { QueryErrorBanner } from '../components/QueryErrorBanner'
import { StatusPill } from '../components/StatusPill'
import { useDevice } from '../hooks/useDevices'
import { useProviderPayments } from '../hooks/useProviders'
import { ClientSelector } from '../components/ClientSelector'
import { useAssignDevice, useUnassignDevice, useDeviceAssignmentHistory } from '../hooks/useAssignments'
import { useSubscriptionPlans, useDefaultPlansPerDeviceType } from '../hooks/useSubscriptionPlans'
import {
  useActiveDeviceProviderPlan,
  useAssignDeviceToProviderPlan,
  useUnassignDeviceFromProviderPlan,
} from '../hooks/useDeviceProviderPlans'
import { useProviderPlans } from '../hooks/useProviderPlans'
import { useRole } from '../context/RoleContext'
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

export function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [showAssign, setShowAssign] = useState(false)
  const [assignClientId, setAssignClientId] = useState('')
  const [assignPlanId, setAssignPlanId] = useState('')
  const [assignNotes, setAssignNotes] = useState('')
  const [showProviderPlanAssign, setShowProviderPlanAssign] = useState(false)
  const [providerPlanId, setProviderPlanId] = useState('')
  const [showUnassignConfirm, setShowUnassignConfirm] = useState(false)

  const { data: device, isLoading, isError, error, refetch } = useDevice(id ?? null)
  const { data: plans } = useSubscriptionPlans(device?.device_type as DeviceType)
  const { data: defaultPlansMap } = useDefaultPlansPerDeviceType()
  const { data: providerPayments } = useProviderPayments()
  const { data: assignmentHistory } = useDeviceAssignmentHistory(id ?? null)
  const { data: activeProviderPlan } = useActiveDeviceProviderPlan(id ?? null)
  const { data: providerPlans } = useProviderPlans(undefined, device?.device_type as DeviceType)
  const { isViewer } = useRole()
  const assignDevice = useAssignDevice()
  const unassignDevice = useUnassignDevice()
  const assignToProviderPlan = useAssignDeviceToProviderPlan()
  const unassignFromProviderPlan = useUnassignDeviceFromProviderPlan()

  if (isError) {
    return (
      <div className="space-y-6">
        <Link
          to="/devices"
          className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black"
        >
          <ChevronRight className="h-4 w-4 rotate-180" /> Back to inventory
        </Link>
        <QueryErrorBanner
          message={error?.message ?? 'Failed to load device.'}
          onRetry={() => void refetch()}
        />
      </div>
    )
  }

  if (isLoading || !device) {
    return (
      <div className="space-y-6">
        <Link
          to="/devices"
          className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black"
        >
          <ChevronRight className="h-4 w-4 rotate-180" /> Back to inventory
        </Link>
        <p className="py-12 text-center text-sm text-black/60">
          {isLoading ? 'Loading…' : 'Device not found.'}
        </p>
      </div>
    )
  }

  const assignment = device.assignment as {
    id: string
    clients?: { name: string }
    assigned_at: string
  } | null
  const clientName = assignment?.clients?.name ?? '—'
  const devicePayments = (providerPayments ?? []).filter((p) => p.device_id === device.id)

  const handleAssign = async () => {
    if (!assignClientId || !assignPlanId || !id) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await assignDevice.mutateAsync({
        deviceId: id,
        clientId: assignClientId,
        planId: assignPlanId,
        notes: assignNotes || undefined,
        assignedBy: user?.id,
      })
      setShowAssign(false)
      setAssignClientId('')
      setAssignPlanId('')
      setAssignNotes('')
    } catch (e) {
      console.error(e)
    }
  }

  const selectedPlan = plans?.find((p) => p.id === assignPlanId)

  const handleUnassign = async () => {
    if (!assignment || !id) return
    try {
      await unassignDevice.mutateAsync({ assignmentId: assignment.id, deviceId: id })
      setShowUnassignConfirm(false)
    } catch (e) {
      console.error(e)
    }
  }

  const handleAssignProviderPlan = async () => {
    if (!id || !providerPlanId) return
    try {
      await assignToProviderPlan.mutateAsync({ deviceId: id, providerPlanId })
      setShowProviderPlanAssign(false)
      setProviderPlanId('')
    } catch (e) {
      console.error(e)
    }
  }

  const handleRemoveProviderPlan = async () => {
    const dpp = (activeProviderPlan as { id: string } | null)
    if (!dpp) return
    if (!confirm('Remove this device from the provider plan?')) return
    try {
      await unassignFromProviderPlan.mutateAsync({ id: dpp.id })
    } catch (e) {
      console.error(e)
    }
  }

  const mutationError = assignDevice.error ?? unassignDevice.error ?? assignToProviderPlan.error ?? unassignFromProviderPlan.error

  return (
    <div className="space-y-6">
      {mutationError != null && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {mutationError.message}
        </div>
      )}
      <div className="flex items-center justify-between">
        <Link
          to="/devices"
          className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black"
        >
          <ChevronRight className="h-4 w-4 rotate-180" /> Back to inventory
        </Link>
        {!isViewer && (
          <Link
            to={`/devices/${id}/edit`}
            className="rounded-full border border-black/15 bg-white px-4 py-2 text-xs font-semibold tracking-wide whitespace-nowrap text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
          >
            Edit Device
          </Link>
        )}
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-black">
                {device.name ?? device.identifier ?? device.id}
              </h2>
              <p className="mt-1 text-xs text-black/60">
                {device.device_type.replace(/_/g, ' ')}
              </p>
            </div>
            <StatusPill value={device.status} />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <InfoCard label="Identifier" value={device.identifier ?? '—'} />
            <InfoCard label="Client" value={clientName} />
            <InfoCard label="Location" value={device.location ?? '—'} />
            <InfoCard
              label="Assigned At"
              value={
                assignment?.assigned_at
                  ? new Date(assignment.assigned_at).toLocaleDateString()
                  : '—'
              }
            />
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-black">Assignment</p>
              {!isViewer && (
                device.status === 'assigned' ? (
                  <button
                    type="button"
                    onClick={() => setShowUnassignConfirm(true)}
                    disabled={unassignDevice.isPending}
                    className="text-xs font-semibold tracking-wide text-red-600 hover:underline"
                  >
                    Unassign
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setAssignPlanId(device != null && defaultPlansMap?.[device.device_type] ? defaultPlansMap[device.device_type] ?? '' : '')
                      setShowAssign(true)
                    }}
                    className="rounded-full bg-black px-3 py-1.5 text-xs font-semibold tracking-wide whitespace-nowrap text-white transition duration-200 hover:bg-black/90 active:scale-[0.98]"
                  >
                    Assign to client
                  </button>
                )
              )}
            </div>
            {showAssign && !isViewer && (
              <div className="mt-4 rounded-2xl border border-black/10 bg-black/5 p-4">
                <label className="block text-xs tracking-wide text-black/60">Client</label>
                <div className="mt-1">
                  <ClientSelector
                    value={assignClientId}
                    onChange={(clientId) => {
                      setAssignClientId(clientId ?? '')
                      setAssignPlanId('')
                    }}
                    placeholder="Select client"
                    aria-label="Select client"
                  />
                </div>
                <label className="mt-3 block text-xs tracking-wide text-black/60">Plan</label>
                <select
                  value={assignPlanId}
                  onChange={(e) => setAssignPlanId(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-black"
                >
                  <option value="">Select plan</option>
                  {(plans ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — USD {p.amount.toLocaleString()} / {p.billing_cycle}
                    </option>
                  ))}
                </select>
                {selectedPlan && (
                  <p className="mt-2 text-xs text-black/60">
                    {selectedPlan.amount > 0
                      ? `Billing: ${selectedPlan.billing_cycle}, first invoice due in one cycle`
                      : 'Invoices will be generated at period end'}
                  </p>
                )}
                <label className="mt-3 block text-xs tracking-wide text-black/60">Notes (optional)</label>
                <textarea
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="Notes"
                  className="mt-1 w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-black"
                  rows={2}
                />
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleAssign}
                    disabled={!assignClientId || !assignPlanId || assignDevice.isPending}
                    className="rounded-2xl bg-black px-4 py-2 text-xs font-semibold tracking-wide whitespace-nowrap text-white transition duration-200 hover:bg-black/90 active:scale-[0.98] disabled:opacity-50"
                  >
                    Assign
                  </button>
                  <button
                    onClick={() => {
                      setShowAssign(false)
                      setAssignClientId('')
                      setAssignNotes('')
                    }}
                    className="rounded-2xl border border-black/15 bg-white px-4 py-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <div className="mt-4 space-y-3">
              {(assignmentHistory ?? []).map((a) => (
                <div
                  key={a.id}
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-black">
                      {(a as { clients?: { name: string } }).clients?.name ?? '—'}
                    </p>
                    <StatusPill
                      value={a.unassigned_at ? 'completed' : 'active'}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-black/60">
                    <span>Assigned {new Date(a.assigned_at).toLocaleDateString()}</span>
                    <span>
                      Unassigned {a.unassigned_at ? new Date(a.unassigned_at).toLocaleDateString() : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {device.notes ? (
            <div className="mt-6">
              <p className="text-sm font-semibold text-black">Notes</p>
              <p className="mt-1 text-sm text-black/70">{device.notes}</p>
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
            <h3 className="text-lg font-semibold text-black">Provider plan</h3>
            <div className="mt-5">
              {activeProviderPlan ? (
                <div className="rounded-2xl border border-black/10 bg-black/5 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-black">
                        {(activeProviderPlan as { provider_plans?: { name: string; providers?: { name: string } | null } })
                          .provider_plans?.name ?? '—'}
                      </p>
                      <p className="mt-1 text-xs text-black/60">
                        ({(activeProviderPlan as { provider_plans?: { providers?: { name: string } | null } })
                          .provider_plans?.providers?.name ?? '—'})
                      </p>
                    </div>
                    {!isViewer && (
                      <button
                        onClick={handleRemoveProviderPlan}
                        className="text-xs font-semibold tracking-wide text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-black/60">
                    Since{' '}
                    {(activeProviderPlan as { start_date: string }).start_date}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-black/60">No provider plan assigned.</p>
              )}
              {!isViewer && (
              <div className="mt-3">
                {showProviderPlanAssign ? (
                  <div className="rounded-2xl border border-black/10 bg-black/5 p-4">
                    <label className="block text-xs tracking-wide text-black/60">Provider plan</label>
                    <select
                      value={providerPlanId}
                      onChange={(e) => setProviderPlanId(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-black"
                    >
                      <option value="">Select plan</option>
                      {(providerPlans ?? []).map((p: { id: string; name: string; providers?: { name: string } | null }) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {(p as { providers?: { name: string } | null }).providers?.name ?? '—'}
                        </option>
                      ))}
                    </select>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={handleAssignProviderPlan}
                        disabled={!providerPlanId || assignToProviderPlan.isPending}
                        className="rounded-2xl bg-black px-4 py-2 text-xs font-semibold tracking-wide whitespace-nowrap text-white transition duration-200 hover:bg-black/90 active:scale-[0.98] disabled:opacity-50"
                      >
                        Assign
                      </button>
                      <button
                        onClick={() => { setShowProviderPlanAssign(false); setProviderPlanId('') }}
                        className="rounded-2xl border border-black/15 bg-white px-4 py-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowProviderPlanAssign(true)}
                    className="rounded-full border border-black/15 bg-white px-4 py-2 text-xs font-semibold tracking-wide whitespace-nowrap text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
                  >
                    {activeProviderPlan ? 'Change plan' : 'Assign plan'}
                  </button>
                )}
              </div>
              )}
            </div>
          </div>

          <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
            <h3 className="text-lg font-semibold text-black">Provider payments</h3>
            <div className="mt-5 space-y-4">
              {devicePayments.length === 0 ? (
                <p className="text-sm text-black/60">No provider payments linked.</p>
              ) : (
                devicePayments.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-black/10 bg-black/5 px-4 py-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-black">
                        {(p as { providers?: { name: string } }).providers?.name ?? '—'}
                      </p>
                      <StatusPill value={p.status} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-black/60">
                      <span>Due {p.due_at ?? '—'}</span>
                      <span>USD {p.amount?.toLocaleString() ?? '—'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <ConfirmModal
        open={showUnassignConfirm}
        title="Unassign device"
        body="Unassign this device from the client?"
        confirmLabel="Unassign"
        variant="danger"
        onConfirm={() => void handleUnassign()}
        onCancel={() => setShowUnassignConfirm(false)}
      />
    </div>
  )
}
