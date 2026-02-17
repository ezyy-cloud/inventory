import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Pagination } from '../components/Pagination'
import { QueryErrorBanner } from '../components/QueryErrorBanner'
import { StatusPill } from '../components/StatusPill'
import { Modal } from '../components/Modal'
import { useRole } from '../context/RoleContext'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useClientsList, useUpdateClient } from '../hooks/useClients'
import { useClientTags, useCreateClientTag } from '../hooks/useClientTags'
import { useSavedViews, useSaveView } from '../hooks/useSavedViews'

const DEFAULT_PAGE_SIZE = 25

function parseClientListParams(searchParams: URLSearchParams) {
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(10, Number.parseInt(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE))
  const q = searchParams.get('q') ?? ''
  const sort = (searchParams.get('sort') ?? 'name') as 'name' | 'created_at' | 'updated_at'
  const order = (searchParams.get('order') ?? 'desc') as 'asc' | 'desc'
  const tagIds = searchParams.getAll('tag').filter(Boolean)
  const statusParam = searchParams.get('status') ?? 'active'
  const active: boolean | undefined =
    statusParam === 'all' ? undefined : statusParam === 'inactive' ? false : true
  return { page, pageSize, q, sort, order, tagIds, active, statusParam }
}

export function ClientsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { page, pageSize, q: searchQuery, sort: sortBy, order: sortOrder, tagIds: urlTagIds, active: activeFilter, statusParam } = parseClientListParams(searchParams)
  const [searchInput, setSearchInput] = useState(searchQuery)
  const [showTagModal, setShowTagModal] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [showSaveViewModal, setShowSaveViewModal] = useState(false)
  const [savedViewName, setSavedViewName] = useState('')
  const [savedViewDefault, setSavedViewDefault] = useState(false)
  const debouncedSearch = useDebouncedValue(searchInput, 350)
  const { data: savedViews = [] } = useSavedViews('clients')
  const saveView = useSaveView('clients')
  useEffect(() => {
    setSearchInput(searchQuery)
  }, [searchQuery])
  const setParams = useCallback(
    (updates: Record<string, string | number | undefined | string[]>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (updates.tagIds !== undefined) {
          next.delete('tag')
          const ids = updates.tagIds as string[]
          ids.forEach((id) => next.append('tag', id))
          next.set('page', '1')
        }
        for (const [k, v] of Object.entries(updates)) {
          if (k === 'tagIds') continue
          if (v === undefined || v === '' || (k === 'page' && v === 1) || (k === 'status' && v === 'active')) next.delete(k)
          else next.set(k, String(v))
        }
        if (!next.has('page')) next.set('page', '1')
        return next
      })
    },
    [setSearchParams]
  )
  useEffect(() => {
    if (debouncedSearch !== searchQuery) {
      setParams({ q: debouncedSearch.trim() || undefined, page: 1 })
    }
  }, [debouncedSearch, searchQuery, setParams])

  const { data: tags = [] } = useClientTags()
  const createTag = useCreateClientTag()
  const updateClient = useUpdateClient()
  const { data: clientsData, isLoading, isError, error, refetch } = useClientsList({
    page,
    pageSize,
    search: debouncedSearch.trim() || undefined,
    sortBy,
    sortOrder,
    tagIds: urlTagIds.length > 0 ? urlTagIds : undefined,
    active: activeFilter,
  })

  const { isViewer } = useRole()
  const { rows: clients, totalCount } = clientsData ?? { rows: [], totalCount: 0 }

  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      const urlQ = next.get('q') ?? ''
      const urlStatus = next.get('status') ?? 'active'
      if (urlQ !== searchQuery || urlStatus !== statusParam) next.set('page', '1')
      return next
    })
  }, [searchQuery, statusParam, setSearchParams])

  return (
    <div className="space-y-6">
      {isError && (
        <QueryErrorBanner
          message={error?.message ?? 'Failed to load clients.'}
          onRetry={() => void refetch()}
        />
      )}
      <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
        <div className="sticky top-16 z-20 -m-6 mb-4 rounded-t-3xl border-b border-black/10 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-black">Clients</h2>
          <div className="flex items-center gap-3">
            <input
              type="search"
              placeholder="Search…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-black placeholder:text-black/40"
            />
            <select
              aria-label="Page size"
              value={pageSize}
              onChange={(e) => setParams({ pageSize: Number(e.target.value), page: 1 })}
              className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <select
              aria-label="Filter by status"
              value={statusParam}
              onChange={(e) => setParams({ status: e.target.value as 'active' | 'inactive' | 'all', page: 1 })}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
            <select
              aria-label="Filter by tag"
              value=""
              onChange={(e) => {
                const tagId = e.target.value
                if (tagId) setParams({ tagIds: [...urlTagIds, tagId], page: 1 })
                e.target.value = ''
              }}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
            >
              <option value="">Tag filter</option>
              {tags.filter((t) => !urlTagIds.includes(t.id)).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <select
              aria-label="My views"
              value=""
              onChange={(e) => {
                const viewId = e.target.value
                if (!viewId) return
                const view = savedViews.find((v) => v.id === viewId)
                if (view?.params && typeof view.params === 'object') {
                  const p = view.params as Record<string, string | number | string[] | undefined>
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev)
                    if (p.pageSize != null) next.set('pageSize', String(p.pageSize))
                    if (p.page != null) next.set('page', String(p.page))
                    if (p.q != null && p.q !== '') next.set('q', String(p.q))
                    if (p.sort != null) next.set('sort', String(p.sort))
                    if (p.order != null) next.set('order', String(p.order))
                    if (p.status != null && p.status !== 'active') next.set('status', String(p.status))
                    else next.delete('status')
                    if (Array.isArray(p.tagIds)) p.tagIds.forEach((id) => next.append('tag', String(id)))
                    else next.delete('tag')
                    return next
                  })
                }
                e.target.value = ''
              }}
              className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
            >
              <option value="">My views</option>
              {savedViews.map((v) => (
                <option key={v.id} value={v.id}>{v.name}{v.is_default ? ' (default)' : ''}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowSaveViewModal(true)}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
            >
              Save view
            </button>
            {!isViewer && (
              <>
                <button
                  type="button"
                  onClick={() => setShowTagModal(true)}
                  className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
                >
                  Add tag
                </button>
                <Link
                  to="/clients/new"
                  className="rounded-full bg-black px-4 py-2 text-xs font-semibold tracking-wide whitespace-nowrap text-white transition duration-200 hover:bg-black/90 active:scale-[0.98]"
                >
                  Add Client
                </Link>
              </>
            )}
          </div>
        </div>
        {urlTagIds.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-black/60">Tags:</span>
            {urlTagIds.map((tagId) => {
              const tag = tags.find((t) => t.id === tagId)
              return (
                <span
                  key={tagId}
                  className="inline-flex items-center gap-1 rounded-full border border-black/20 bg-black/5 px-3 py-1 text-xs font-medium text-black"
                >
                  {tag?.name ?? tagId}
                  <button
                    type="button"
                    onClick={() => setParams({ tagIds: urlTagIds.filter((id) => id !== tagId), page: 1 })}
                    className="ml-1 hover:text-red-600"
                    aria-label={`Remove ${tag?.name ?? 'tag'} filter`}
                  >
                    ×
                  </button>
                </span>
              )
            })}
            <button
              type="button"
              onClick={() => setParams({ tagIds: [] })}
              className="text-xs font-semibold tracking-wide text-black/60 hover:text-black"
            >
              Clear tags
            </button>
          </div>
        )}
        </div>
        <div className="mt-6 space-y-4">
          {isLoading ? (
            <div className="space-y-2 py-8">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-2xl bg-black/10" />
              ))}
            </div>
          ) : clients.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-black/60">
                {searchQuery || urlTagIds.length > 0 || statusParam !== 'active' ? 'No clients match your filters.' : 'No clients yet.'}
              </p>
              {(searchQuery || urlTagIds.length > 0 || statusParam !== 'active') && (
                <button
                  type="button"
                  onClick={() => setParams({ q: undefined, tagIds: [], status: 'active', page: 1 })}
                  className="mt-3 text-xs font-semibold tracking-wide text-black underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              {clients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3 transition hover:bg-black/5"
                >
                  <Link
                    to={`/clients/${client.id}`}
                    className="min-w-0 flex-1"
                  >
                    <p className="text-sm font-semibold text-black">{client.name}</p>
                    <p className="text-xs text-black/60">{client.industry ?? '—'}</p>
                    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-4 break-words text-xs text-black/60">
                      <span className="min-w-0 break-words">{client.email ?? '—'}</span>
                      <span className="min-w-0 break-words">{client.phone ?? '—'}</span>
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusPill value={client.is_active !== false ? 'active' : 'inactive'} />
                    {!isViewer && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            updateClient.mutate({ id: client.id, is_active: !(client.is_active !== false) })
                          }}
                          disabled={updateClient.isPending}
                          className="rounded-lg border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold tracking-wide text-black hover:bg-black/5 disabled:opacity-50"
                        >
                          {client.is_active !== false ? 'Mark inactive' : 'Mark active'}
                        </button>
                        <Link
                          to={`/subscriptions?client=${client.id}`}
                          className="rounded-lg border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold tracking-wide text-black hover:bg-black/5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          New subscription
                        </Link>
                        <Link
                          to={`/clients/${client.id}/edit`}
                          className="rounded-lg border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold tracking-wide text-black hover:bg-black/5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Edit
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <Pagination
                page={page}
                pageSize={pageSize}
                totalCount={totalCount}
                onPageChange={(p) => setParams({ page: p })}
              />
            </>
          )}
        </div>
      </div>

      {showSaveViewModal && (
        <Modal title="Save view" onClose={() => { setShowSaveViewModal(false); setSavedViewName(''); setSavedViewDefault(false) }}>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const name = savedViewName.trim()
              if (!name) return
              try {
                await saveView.mutateAsync({
                  name,
                  params: { page: 1, pageSize, q: searchQuery, sort: sortBy, order: sortOrder, status: statusParam, tagIds: urlTagIds },
                  isDefault: savedViewDefault,
                })
                setShowSaveViewModal(false)
                setSavedViewName('')
                setSavedViewDefault(false)
              } catch (err) {
                console.error(err)
              }
            }}
            className="space-y-4"
          >
            <label htmlFor="saved-view-name" className="block text-xs tracking-wide text-black/60">View name</label>
            <input
              id="saved-view-name"
              type="text"
              value={savedViewName}
              onChange={(e) => setSavedViewName(e.target.value)}
              placeholder="e.g. VIP clients"
              className="w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-black placeholder:text-black/40"
              required
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={savedViewDefault}
                onChange={(e) => setSavedViewDefault(e.target.checked)}
                className="h-4 w-4 rounded border-black/20"
              />
              <span className="text-sm">Set as default view for Clients</span>
            </label>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={!savedViewName.trim() || saveView.isPending}
                className="rounded-2xl bg-black px-6 py-2 text-sm font-semibold tracking-wide text-white transition duration-200 hover:bg-black/90 active:scale-[0.98] disabled:opacity-50"
              >
                {saveView.isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => { setShowSaveViewModal(false); setSavedViewName(''); setSavedViewDefault(false) }}
                className="rounded-2xl border border-black/15 px-6 py-2 text-sm font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
      {showTagModal && (
        <Modal title="Add tag" onClose={() => { setShowTagModal(false); setNewTagName('') }}>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const name = newTagName.trim()
              if (!name) return
              try {
                await createTag.mutateAsync(name)
                setShowTagModal(false)
                setNewTagName('')
              } catch (err) {
                console.error(err)
              }
            }}
            className="space-y-4"
          >
            <label className="block text-xs tracking-wide text-black/60">Tag name</label>
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="e.g. VIP, Enterprise"
              className="w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-black placeholder:text-black/40"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={!newTagName.trim() || createTag.isPending}
                className="rounded-2xl bg-black px-6 py-2 text-sm font-semibold tracking-wide text-white transition duration-200 hover:bg-black/90 active:scale-[0.98] disabled:opacity-50"
              >
                {createTag.isPending ? 'Creating…' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => { setShowTagModal(false); setNewTagName('') }}
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
