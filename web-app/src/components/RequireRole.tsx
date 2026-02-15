import { useRole } from '../context/RoleContext'
import type { UserRole } from '../types'

interface RequireRoleProps {
  allowedRoles: UserRole[]
  children: React.ReactNode
}

/**
 * Renders children only if the current user's role is in allowedRoles.
 * Otherwise shows an access-denied message or redirects to dashboard.
 */
export function RequireRole({ allowedRoles, children }: RequireRoleProps) {
  const { role } = useRole()

  if (role == null) {
    return (
      <div className="rounded-3xl border border-black/10 bg-white p-8 text-center">
        <p className="text-sm text-black/60">Checking access…</p>
      </div>
    )
  }

  const allowed = allowedRoles.length === 0 || allowedRoles.includes(role)
  if (!allowed) {
    return (
      <div className="card-shadow mx-auto max-w-md rounded-3xl border border-black/10 bg-white p-8 text-center">
        <h2 className="text-lg font-semibold text-black">Access denied</h2>
        <p className="mt-2 text-sm text-black/60">
          You don&apos;t have permission to view this page.
        </p>
        <a
          href="/"
          className="mt-6 inline-block rounded-2xl bg-black px-4 py-2 text-sm font-semibold tracking-wide text-white transition duration-200 hover:bg-black/90 active:scale-[0.98]"
        >
          Back to Dashboard
        </a>
      </div>
    )
  }

  return <>{children}</>
}
