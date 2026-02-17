interface InfoCardProps {
  label: string
  value: string
}

/** Label + value card with wrapping so long text (e.g. email, phone) doesn’t truncate. */
export function InfoCard({ label, value }: InfoCardProps) {
  return (
    <div className="min-w-0 rounded-2xl border border-black/10 bg-black/5 p-4">
      <p className="text-xs tracking-wide text-black/60">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-black">{value}</p>
    </div>
  )
}
