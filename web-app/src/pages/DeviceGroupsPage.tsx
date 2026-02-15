import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '../components/Modal'
import { QueryErrorBanner } from '../components/QueryErrorBanner'
import { useRole } from '../context/RoleContext'
import {
  useDeviceGroups,
  useCreateDeviceGroup,
  useDeleteDeviceGroup,
  useDevicesByGroup,
  useRemoveDevicesFromGroup,
} from '../hooks/useDeviceGroups'

export function DeviceGroupsPage() {
  const { isViewer } = useRole()
  const { data: groups = [], isLoading, isError, error, refetch } = useDeviceGroups()
  const createGroup = useCreateDeviceGroup()
  const deleteGroup = useDeleteDeviceGroup()
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    try {
      await createGroup.mutateAsync({ name, description: newDescription.trim() || undefined })
      setShowModal(false)
      setNewName('')
      setNewDescription('')
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/devices"
          className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black"
        >
          <ChevronRight className="h-4 w-4 rotate-180" /> Inventory
        </Link>
        <h2 className="text-xl font-semibold text-black">Device groups</h2>
      </div>

      {isError && (
        <QueryErrorBanner
          message={error?.message ?? 'Failed to load groups.'}
          onRetry={() => void refetch()}
        />
      )}
      {(createGroup.isError ?? deleteGroup.isError) && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {(createGroup.error ?? deleteGroup.error)?.message ?? 'Action failed.'}
        </div>
      )}

      {!isViewer && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="rounded-full bg-black px-4 py-2 text-xs font-semibold tracking-wide whitespace-nowrap text-white transition duration-200 hover:bg-black/90 active:scale-[0.98]"
          >
            New group
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2 py-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-black/10" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-black/60">No device groups yet. Create one to organize devices.</p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <GroupRow
              key={group.id}
              group={group}
              isViewer={isViewer}
              expanded={expandedId === group.id}
              onToggle={() => setExpandedId((id) => (id === group.id ? null : group.id))}
              onDelete={() => {
                if (window.confirm(`Delete group "${group.name}"? Devices will not be deleted.`)) {
                  deleteGroup.mutate(group.id)
                }
              }}
            />
          ))}
        </div>
      )}

      {showModal && (
        <Modal title="New group" onClose={() => { setShowModal(false); setNewName(''); setNewDescription('') }}>
          <form onSubmit={handleCreate} className="space-y-4">
            <label htmlFor="group-name" className="block text-xs tracking-wide text-black/60">Name</label>
            <input
              id="group-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Batch 2024-01"
              className="w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-black placeholder:text-black/40"
              required
            />
            <label htmlFor="group-desc" className="block text-xs tracking-wide text-black/60">Description (optional)</label>
            <input
              id="group-desc"
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-black placeholder:text-black/40"
            />
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={!newName.trim() || createGroup.isPending}
                className="rounded-2xl bg-black px-6 py-2 text-sm font-semibold tracking-wide text-white transition duration-200 hover:bg-black/90 active:scale-[0.98] disabled:opacity-50"
              >
                {createGroup.isPending ? 'Creating…' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => { setShowModal(false); setNewName(''); setNewDescription('') }}
                className="rounded-2xl border border-black/15 px-6 py-2 text-sm font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function GroupRow({
  group,
  isViewer,
  expanded,
  onToggle,
  onDelete,
}: {
  group: { id: string; name: string; description: string | null }
  isViewer: boolean
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  const { data: devices = [], isLoading } = useDevicesByGroup(expanded ? group.id : null)
  const removeFromGroup = useRemoveDevicesFromGroup()

  return (
    <div className="rounded-2xl border border-black/10 bg-white overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-black/5"
      >
        <div>
          <p className="text-sm font-semibold text-black">{group.name}</p>
          {group.description && (
            <p className="mt-0.5 text-xs text-black/60">{group.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isViewer && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="text-xs font-semibold tracking-wide text-red-600 hover:underline"
            >
              Delete
            </button>
          )}
          <ChevronRight
            className={`h-4 w-4 text-black/50 transition ${expanded ? 'rotate-90' : ''}`}
          />
        </div>
      </button>
      {expanded && (
        <div className="border-t border-black/10 bg-black/5 px-4 py-3">
          {isLoading ? (
            <p className="text-sm text-black/60">Loading devices…</p>
          ) : devices.length === 0 ? (
            <p className="text-sm text-black/60">No devices in this group. Select devices on Inventory and use “Add to group”.</p>
          ) : (
            <ul className="space-y-2">
              {devices.map((d: { id: string; name?: string | null; identifier?: string | null; device_type?: string; status?: string }) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm"
                >
                  <Link
                    to={`/devices/${d.id}`}
                    className="font-medium text-black hover:underline"
                  >
                    {d.name ?? d.identifier ?? d.id}
                  </Link>
                  <span className="text-xs text-black/60">{d.device_type?.replace(/_/g, ' ')} · {d.status}</span>
                  {!isViewer && (
                    <button
                      type="button"
                      onClick={() => removeFromGroup.mutate({ groupId: group.id, deviceIds: [d.id] })}
                      className="text-xs font-semibold tracking-wide text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
