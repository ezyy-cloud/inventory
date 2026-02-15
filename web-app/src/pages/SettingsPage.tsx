import { useState } from 'react'
import { CreditCard, Settings, Wrench } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { QueryErrorBanner } from '../components/QueryErrorBanner'
import { Modal } from '../components/Modal'
import { useRole } from '../context/RoleContext'
import { useToast } from '../context/ToastContext'
import { recordAudit } from '../lib/auditLog'
import { supabase } from '../lib/supabaseClient'
import type { UserRole } from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'front_desk', label: 'Front desk' },
  { value: 'technician', label: 'Technician' },
]

export function SettingsPage() {
  const queryClient = useQueryClient()
  const { isSuperAdmin } = useRole()
  const { addToast } = useToast()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('front_desk')

  const { data: profiles, isError, error, refetch } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name, role')
      if (error) throw error
      return data ?? []
    },
  })

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: UserRole }) => {
      const { error: err } = await supabase.from('profiles').update({ role }).eq('id', id)
      if (err) throw err
    },
    onSuccess: (_, variables) => {
      void recordAudit('profile.role_changed', 'profiles', variables.id, { role: variables.role })
      void queryClient.invalidateQueries({ queryKey: ['profiles'] })
    },
  })

  const inviteUser = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: UserRole }) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not signed in')
      const res = await fetch(`${supabaseUrl}/functions/v1/invite-user`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim(), role }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Invite failed')
      return json
    },
    onSuccess: () => {
      addToast('Invitation sent.', 'success')
      setInviteOpen(false)
      setInviteEmail('')
      setInviteRole('front_desk')
      void queryClient.invalidateQueries({ queryKey: ['profiles'] })
    },
    onError: (err: Error) => {
      addToast(err.message ?? 'Failed to send invite', 'error')
    },
  })

  const roles = [
    { role: 'Super Admin', value: 'super_admin', access: 'Full access' },
    { role: 'Admin', value: 'admin', access: 'Manage inventory, billing, reports' },
    { role: 'Front desk', value: 'front_desk', access: 'Clients, subscriptions, invoices' },
    { role: 'Technician/Field', value: 'technician', access: 'Devices, assignments' },
  ]

  const byRole = (profiles ?? []).reduce(
    (acc, p) => {
      const r = p.role ?? 'front_desk'
      acc[r] = (acc[r] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      {isError && (
        <QueryErrorBanner
          className="col-span-full"
          message={error?.message ?? 'Failed to load profiles.'}
          onRetry={() => void refetch()}
        />
      )}
      <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-black">Roles</h2>
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="rounded-full border border-black/20 bg-black px-4 py-2 text-xs font-semibold tracking-wide whitespace-nowrap text-white transition duration-200 hover:bg-black/90 active:scale-[0.98]"
            >
              Add User
            </button>
          )}
        </div>
        <div className="mt-6 space-y-4">
          {roles.map((r) => (
            <div
              key={r.value}
              className="rounded-2xl border border-black/10 bg-white px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-black">{r.role}</p>
                  <p className="text-xs text-black/60">{r.access}</p>
                </div>
                <span className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold tracking-wide text-black">
                  {byRole[r.value] ?? 0} users
                </span>
              </div>
            </div>
          ))}
        </div>
        {isSuperAdmin && (profiles ?? []).length > 0 && (
          <div className="mt-6 border-t border-black/10 pt-6">
            <h3 className="text-sm font-semibold text-black">Edit user roles</h3>
            <p className="mt-1 text-xs text-black/60">Only Super Admins can change roles.</p>
            <ul className="mt-4 space-y-3">
              {(profiles ?? []).map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-black/5 px-4 py-3"
                >
                  <span className="text-sm font-semibold text-black">{p.full_name ?? p.id.slice(0, 8)}</span>
                  <select
                    aria-label={`Role for ${p.full_name ?? p.id}`}
                    value={p.role ?? 'front_desk'}
                    onChange={(e) => {
                      const newRole = e.target.value as UserRole
                      if (newRole !== (p.role ?? 'front_desk')) {
                        updateRole.mutate({ id: p.id, role: newRole })
                      }
                    }}
                    disabled={updateRole.isPending}
                    className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-black"
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            {updateRole.isError && (
              <p className="mt-3 text-sm text-red-600">{updateRole.error?.message ?? 'Failed to update role.'}</p>
            )}
          </div>
        )}
      </div>

      {inviteOpen && (
      <Modal
        onClose={() => {
          if (!inviteUser.isPending) {
            setInviteOpen(false)
            setInviteEmail('')
            setInviteRole('front_desk')
          }
        }}
        title="Invite user"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!inviteEmail.trim()) return
            inviteUser.mutate({ email: inviteEmail.trim(), role: inviteRole })
          }}
        >
          <label htmlFor="invite-email" className="block text-xs tracking-wide text-black/60">Email</label>
          <input
            id="invite-email"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
            placeholder="colleague@company.com"
            className="w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-black placeholder:text-black/40"
          />
          <label htmlFor="invite-role" className="block text-xs tracking-wide text-black/60">Role (assigned when they accept)</label>
          <select
            id="invite-role"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as UserRole)}
            className="w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-black"
            aria-label="Invite role"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setInviteOpen(false)}
              disabled={inviteUser.isPending}
              className="rounded-2xl border border-black/15 bg-white px-4 py-2 text-sm font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={inviteUser.isPending || !inviteEmail.trim()}
              className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold tracking-wide text-white transition duration-200 hover:bg-black/90 active:scale-[0.98] disabled:opacity-50"
            >
              {inviteUser.isPending ? 'Sending…' : 'Send invite'}
            </button>
          </div>
        </form>
      </Modal>
      )}

      <div className="space-y-6">
        <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
          <h3 className="text-lg font-semibold text-black">Permissions</h3>
          <div className="mt-4 space-y-3 text-sm text-black/70">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Technicians can update device status and assignments.
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Front desk can manage subscriptions and payments.
            </div>
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Admins approve billing and provider invoices.
            </div>
          </div>
        </div>
        <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
          <h3 className="text-lg font-semibold text-black">Security</h3>
          <div className="mt-4 space-y-3 text-sm text-black/70">
            <p className="font-semibold text-black">Supabase Auth enabled</p>
            <p>Assign roles in the profiles table to control permissions.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
