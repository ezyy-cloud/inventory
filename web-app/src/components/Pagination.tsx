import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  pageSize: number
  totalCount: number
  onPageChange: (page: number) => void
}

const MAX_VISIBLE_PAGES = 5

export function Pagination({ page, pageSize, totalCount, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const start = (page - 1) * pageSize
  const end = Math.min(start + pageSize, totalCount)
  const hasItems = totalCount > 0

  if (!hasItems || totalPages <= 1) return null

  const getPageNumbers = () => {
    if (totalPages <= MAX_VISIBLE_PAGES) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    const half = Math.floor(MAX_VISIBLE_PAGES / 2)
    let startPage = Math.max(1, page - half)
    const endPage = Math.min(totalPages, startPage + MAX_VISIBLE_PAGES - 1)
    if (endPage - startPage + 1 < MAX_VISIBLE_PAGES) {
      startPage = Math.max(1, endPage - MAX_VISIBLE_PAGES + 1)
    }
    return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i)
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4">
      <p className="text-sm text-black/60">
        {start + 1}–{end} of {totalCount}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 text-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-black/5"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {getPageNumbers().map((n) => (
          <button
            key={n}
            onClick={() => onPageChange(n)}
            className={`h-9 min-w-[2.25rem] rounded-xl px-2 text-sm font-medium transition ${
              n === page
                ? 'bg-black text-white'
                : 'border border-black/10 text-black hover:bg-black/5'
            }`}
          >
            {n}
          </button>
        ))}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 text-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-black/5"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
