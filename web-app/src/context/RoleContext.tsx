import { createContext, useContext, type ReactNode } from 'react'
import type { UserRole } from '../types'

export type ProfileRole = UserRole | null

type RoleContextValue = {
  role: ProfileRole
  /** Same as DB: super_admin only */
  isSuperAdmin: boolean
  /** Same as DB: super_admin | admin */
  isAdmin: boolean
  /** Same as DB: super_admin | admin | front_desk */
  isFrontDesk: boolean
  /** Same as DB: super_admin | admin | technician */
  isTechnician: boolean
  /** Read-only role: no create/edit/delete */
  isViewer: boolean
}

const RoleContext = createContext<RoleContextValue | null>(null)

function roleToHelpers(role: ProfileRole): RoleContextValue {
  const isSuperAdmin = role === 'super_admin'
  const isAdmin = role === 'super_admin' || role === 'admin'
  const isFrontDesk = role === 'super_admin' || role === 'admin' || role === 'front_desk'
  const isTechnician = role === 'super_admin' || role === 'admin' || role === 'technician'
  const isViewer = role === 'viewer'
  return {
    role,
    isSuperAdmin,
    isAdmin,
    isFrontDesk,
    isTechnician,
    isViewer,
  }
}

export function RoleProvider({
  role,
  children,
}: {
  role: ProfileRole
  children: ReactNode
}) {
  const value = roleToHelpers(role)
  return (
    <RoleContext.Provider value={value}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  const ctx = useContext(RoleContext)
  return ctx ?? roleToHelpers(null)
}

/** Returns true if the current role is in the allowed list (or no role required when allowedRoles is empty). */
export function useHasRole(allowedRoles: UserRole[]): boolean {
  const { role } = useRole()
  if (allowedRoles.length === 0) return true
  return role != null && allowedRoles.includes(role)
}
