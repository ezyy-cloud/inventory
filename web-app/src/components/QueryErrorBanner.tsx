import { AlertCircle, RefreshCw } from 'lucide-react'

interface QueryErrorBannerProps {
  message?: string
  onRetry?: () => void
  className?: string
}

export function QueryErrorBanner({
  message = 'Something went wrong loading this data.',
  onRetry,
  className = '',
}: QueryErrorBannerProps) {
  return (
    <div
      role="alert"
      className={`flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 ${className}`}
    >
      <span className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {message}
      </span>
      {onRetry != null && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold tracking-wide text-red-900 transition duration-200 hover:bg-red-100 active:scale-[0.98]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      )}
    </div>
  )
}
