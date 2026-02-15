const statusClass: Record<string, string> = {
  active: 'bg-black text-white',
  assigned: 'bg-black text-white',
  paid: 'bg-black text-white',
  pending: 'bg-white text-black border border-black/15',
  scheduled: 'bg-white text-black border border-black/15',
  in_stock: 'bg-white text-black border border-black/15',
  maintenance: 'bg-neutral-200 text-black',
  overdue: 'bg-red-100 text-red-900 border border-red-200',
  due_soon: 'bg-amber-100 text-amber-900 border border-amber-200',
  completed: 'bg-neutral-200 text-black',
  needs_review: 'bg-neutral-100 text-black border border-black/10',
  retired: 'bg-neutral-200 text-black',
  lost: 'bg-red-50 text-red-800 border border-red-200',
  canceled: 'bg-neutral-200 text-black',
  expired: 'bg-neutral-200 text-black',
  void: 'bg-neutral-200 text-black',
}

export function StatusPill({ value }: { value: string }) {
  const className = statusClass[value] ?? 'bg-neutral-100 text-black'
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide ${className}`}
    >
      {value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  )
}
