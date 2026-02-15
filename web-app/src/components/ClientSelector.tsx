import { useRef, useState, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { useClient, useClientsList } from '../hooks/useClients'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import type { Client } from '../types'

const SEARCH_PAGE_SIZE = 20
const DEBOUNCE_MS = 350

interface ClientSelectorProps {
  value: string
  onChange: (clientId: string | null, client: Client | null) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

export function ClientSelector({
  value,
  onChange,
  placeholder = 'Search clients…',
  disabled = false,
  className = '',
  'aria-label': ariaLabel = 'Select client',
}: ClientSelectorProps) {
  const [open, setOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const debouncedSearch = useDebouncedValue(searchInput.trim(), DEBOUNCE_MS)
  const [page, setPage] = useState(1)

  const { data: selectedClient } = useClient(value || null)
  const { data: listData, isLoading } = useClientsList({
    pageSize: SEARCH_PAGE_SIZE,
    page: open ? page : 1,
    search: open ? (debouncedSearch || undefined) : undefined,
    sortBy: 'name',
    sortOrder: 'asc',
  })

  const { rows: clients, totalCount } = listData ?? { rows: [], totalCount: 0 }
  const hasMore = clients.length < totalCount

  useEffect(() => {
    if (!open) {
      setPage(1)
      setSearchInput('')
    }
  }, [open])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current != null && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }
  }, [open])

  const handleSelect = (client: Client) => {
    onChange(client.id, client)
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null, null)
    setOpen(false)
  }

  const displayLabel = value && selectedClient ? selectedClient.name : null

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-black/15 bg-white px-4 py-3 text-left text-black disabled:opacity-50"
      >
        <span className={displayLabel ? 'font-medium' : 'text-black/40'}>
          {displayLabel ?? placeholder}
        </span>
        <span className="flex items-center gap-1">
          {value ? (
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-0.5 text-black/50 hover:bg-black/10 hover:text-black"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          <ChevronDown
            className={`h-4 w-4 text-black/50 transition ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-lg"
          role="listbox"
        >
          <div className="border-b border-black/10 p-2">
            <input
              type="search"
              autoFocus
              placeholder="Type to search…"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black placeholder:text-black/40"
              aria-label="Search clients"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {isLoading ? (
              <div className="py-6 text-center text-sm text-black/60">Loading…</div>
            ) : clients.length === 0 ? (
              <div className="py-6 text-center text-sm text-black/60">
                {debouncedSearch ? 'No clients match your search.' : 'No clients yet.'}
              </div>
            ) : (
              <>
                {clients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    role="option"
                    aria-selected={value === client.id}
                    onClick={() => handleSelect(client)}
                    className={`block w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                      value === client.id ? 'bg-black/10 font-medium' : 'hover:bg-black/5'
                    }`}
                  >
                    <span className="font-medium text-black">{client.name}</span>
                    {client.industry ?? client.email ? (
                      <span className="ml-2 text-xs text-black/60">
                        {[client.industry, client.email].filter(Boolean).join(' · ')}
                      </span>
                    ) : null}
                  </button>
                ))}
                {hasMore && (
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    className="mt-1 w-full rounded-xl px-3 py-2 text-center text-sm font-medium text-black/70 hover:bg-black/5"
                  >
                    Load more
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
