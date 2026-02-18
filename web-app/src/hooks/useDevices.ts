import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { recordAudit } from '../lib/auditLog'
import { supabase } from '../lib/supabaseClient'
import type { Device, DeviceStatus, DeviceType, DeviceWithDetails } from '../types'

const deviceTypeTable: Record<DeviceType, string> = {
  car_tracker: 'car_trackers',
  ip_camera: 'ip_cameras',
  starlink: 'starlinks',
  wifi_access_point: 'wifi_access_points',
  tv: 'tvs',
  drone: 'drones',
  printer: 'printers',
  websuite: 'websuites',
  isp_link: 'isp_links',
  pos_device: 'pos_devices',
  other: 'other',
}

/** Text columns on devices table used for search (any field). */
const DEVICE_SEARCH_COLUMNS = [
  'name',
  'identifier',
  'serial_number',
  'location',
  'environment',
  'notes',
] as const

function buildDeviceSearchFilter(searchTrim: string): string {
  const sanitized = searchTrim.replace(/,/g, ' ')
  const pattern = `%${sanitized}%`
  return DEVICE_SEARCH_COLUMNS.map((col) => `${col}.ilike.${pattern}`).join(',')
}

export type DevicesListParams = {
  type: DeviceType
  status?: DeviceStatus
  page?: number
  pageSize?: number
  search?: string
  sortBy?: 'name' | 'status' | 'updated_at'
  sortOrder?: 'asc' | 'desc'
}

export function useDevices(params: DevicesListParams) {
  const {
    type,
    status,
    page = 1,
    pageSize = 25,
    search,
    sortBy = 'name',
    sortOrder = 'desc',
  } = params

  return useQuery({
    queryKey: ['devices', type, status, page, pageSize, search ?? '', sortBy, sortOrder],
    queryFn: async () => {
      const from = (page - 1) * pageSize
      const searchTrim = search?.trim()
      const productTable = deviceTypeTable[type]

      const selectDeviceRows = (
        devices: Record<string, unknown>[],
        byDevice: Record<string, unknown>,
      ): DeviceWithDetails[] =>
        devices.map((d) => {
          const assignments = (d as { device_assignments?: { unassigned_at: string | null }[] })
            .device_assignments
          const activeAssignment = Array.isArray(assignments)
            ? assignments.find((a) => !a.unassigned_at) ?? null
            : null
          return {
            ...d,
            car_tracker: productTable === 'car_trackers' ? (byDevice[d.id as string] ?? null) : null,
            ip_camera: productTable === 'ip_cameras' ? (byDevice[d.id as string] ?? null) : null,
            starlink: productTable === 'starlinks' ? (byDevice[d.id as string] ?? null) : null,
            wifi_access_point:
              productTable === 'wifi_access_points' ? (byDevice[d.id as string] ?? null) : null,
            tv: productTable === 'tvs' ? (byDevice[d.id as string] ?? null) : null,
            drone: productTable === 'drones' ? (byDevice[d.id as string] ?? null) : null,
            printer: productTable === 'printers' ? (byDevice[d.id as string] ?? null) : null,
            websuite: productTable === 'websuites' ? (byDevice[d.id as string] ?? null) : null,
            isp_link: productTable === 'isp_links' ? (byDevice[d.id as string] ?? null) : null,
            pos_device: productTable === 'pos_devices' ? (byDevice[d.id as string] ?? null) : null,
            assignment: activeAssignment,
          } as DeviceWithDetails
        })

      if (searchTrim) {
        const { data: searchResult, error: searchError } = await supabase.rpc('get_devices_search', {
          p_device_type: type,
          p_search: searchTrim,
          p_status: status ?? null,
          p_sort_by: sortBy,
          p_sort_order: sortOrder,
          p_limit: pageSize,
          p_offset: from,
        })
        if (searchError) throw searchError
        const rowsWithCount = (searchResult ?? []) as { id: string; total_count: number }[]
        const ids = rowsWithCount.map((r) => r.id)
        const totalCount = rowsWithCount[0]?.total_count ?? 0
        if (ids.length === 0) {
          return { rows: [], totalCount: Number(totalCount) }
        }

        const { data: devices, error: devicesError } = await supabase
          .from('devices')
          .select(
            `
            *,
            device_assignments!left(id, client_id, assigned_at, unassigned_at, status, clients(id, name))
          `,
          )
          .in('id', ids)
        if (devicesError) throw devicesError

        if (!productTable || productTable === 'other') {
          const orderMap = new Map(ids.map((id, i) => [id, i]))
          const rows = selectDeviceRows((devices ?? []) as Record<string, unknown>[], {})
          rows.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))
          return { rows, totalCount: Number(totalCount) }
        }

        const { data: productData } = await supabase
          .from(productTable)
          .select('*')
          .in('device_id', ids)
        const byDevice = (productData ?? []).reduce(
          (acc, p) => ({ ...acc, [p.device_id]: p }),
          {} as Record<string, unknown>,
        )
        const orderMap = new Map(ids.map((id, i) => [id, i]))
        const rows = selectDeviceRows((devices ?? []) as Record<string, unknown>[], byDevice)
        rows.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))
        return { rows, totalCount: Number(totalCount) }
      }

      let query = supabase
        .from('devices')
        .select(
          `
          *,
          device_assignments!left(id, client_id, assigned_at, unassigned_at, status, clients(id, name))
        `,
          { count: 'exact' }
        )
        .eq('device_type', type)
        .order(sortBy, { ascending: sortOrder === 'asc', nullsFirst: false })
        .range(from, from + pageSize - 1)

      if (status) {
        query = query.eq('status', status)
      }

      if (searchTrim) {
        query = query.or(buildDeviceSearchFilter(searchTrim))
      }

      const { data: devices, error, count } = await query
      if (error) throw error

      if (!productTable || productTable === 'other') {
        return { rows: (devices ?? []) as DeviceWithDetails[], totalCount: count ?? 0 }
      }

      const ids = (devices ?? []).map((d) => d.id)
      const { data: productData } = await supabase
        .from(productTable)
        .select('*')
        .in('device_id', ids)

      const byDevice = (productData ?? []).reduce(
        (acc, p) => ({ ...acc, [p.device_id]: p }),
        {} as Record<string, unknown>,
      )

      const rows = selectDeviceRows((devices ?? []) as Record<string, unknown>[], byDevice)
      return { rows, totalCount: count ?? 0 }
    },
  })
}

const SELECT_ALL_DEVICES_LIMIT = 2000

/** Fetch device IDs matching the same filters as the list (for "Select all"). Capped at SELECT_ALL_DEVICES_LIMIT (2000). */
export function useDeviceIdsForFilters(
  params: DevicesListParams,
  options?: { limit?: number; enabled?: boolean },
) {
  const {
    type,
    status,
    search,
    sortBy = 'name',
    sortOrder = 'desc',
  } = params
  const limit = options?.limit ?? SELECT_ALL_DEVICES_LIMIT
  const enabled = options?.enabled ?? false

  return useQuery({
    queryKey: ['device-ids-for-filters', type, status, search ?? '', sortBy, sortOrder, limit],
    queryFn: async () => {
      const searchTrim = search?.trim()
      if (searchTrim) {
        const { data: searchResult, error: searchError } = await supabase.rpc('get_devices_search', {
          p_device_type: type,
          p_search: searchTrim,
          p_status: status ?? null,
          p_sort_by: sortBy,
          p_sort_order: sortOrder,
          p_limit: limit,
          p_offset: 0,
        })
        if (searchError) throw searchError
        return ((searchResult ?? []) as { id: string }[]).map((r) => r.id)
      }

      let query = supabase
        .from('devices')
        .select('id')
        .eq('device_type', type)
        .order(sortBy, { ascending: sortOrder === 'asc', nullsFirst: false })
        .range(0, limit - 1)

      if (status) {
        query = query.eq('status', status)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []).map((r) => r.id)
    },
    enabled,
  })
}

/** Devices assigned to a client (active assignments only) */
export function useClientDevices(clientId: string | null) {
  return useQuery({
    queryKey: ['client-devices', clientId],
    queryFn: async () => {
      if (!clientId) return []
      const { data, error } = await supabase
        .from('device_assignments')
        .select('device_id, devices(id, name, identifier, device_type)')
        .eq('client_id', clientId)
        .is('unassigned_at', null)
        .eq('status', 'active')
      if (error) throw error
      const devices = (data ?? []).map((r) => {
        const d = (r as Record<string, unknown>).devices
        if (Array.isArray(d) && d.length > 0) return d[0] as { id: string; name: string | null; identifier: string | null; device_type: string }
        if (d && typeof d === 'object' && 'id' in d) return d as { id: string; name: string | null; identifier: string | null; device_type: string }
        return null
      }).filter((d): d is { id: string; name: string | null; identifier: string | null; device_type: string } => d != null)
      const seen = new Set<string>()
      return devices.filter((d) => {
        if (seen.has(d.id)) return false
        seen.add(d.id)
        return true
      })
    },
    enabled: !!clientId,
  })
}

export function useDevice(id: string | null) {
  return useQuery({
    queryKey: ['device', id],
    queryFn: async () => {
      if (!id) return null
      const { data: device, error } = await supabase
        .from('devices')
        .select(
          '*, device_assignments!left(id, client_id, assigned_at, unassigned_at, status, clients(id, name))',
        )
        .eq('id', id)
        .single()

      if (error) throw error
      if (!device) return null

      const type = device.device_type as DeviceType
      const productTable = deviceTypeTable[type]
      if (!productTable || productTable === 'other') {
        return { ...device, assignment: null } as DeviceWithDetails
      }

      const { data: productData } = await supabase
        .from(productTable)
        .select('*')
        .eq('device_id', id)
        .maybeSingle()

      const productKey =
        productTable === 'car_trackers'
          ? 'car_tracker'
          : productTable === 'ip_cameras'
            ? 'ip_camera'
            : productTable === 'starlinks'
              ? 'starlink'
              : productTable === 'wifi_access_points'
                ? 'wifi_access_point'
                : productTable === 'tvs'
                  ? 'tv'
                  : productTable === 'drones'
                    ? 'drone'
                    : productTable === 'printers'
                      ? 'printer'
                      : productTable === 'websuites'
                        ? 'websuite'
                        : productTable === 'pos_devices'
                          ? 'pos_device'
                          : 'isp_link'

      const assignments = (device as { device_assignments?: { unassigned_at: string | null }[] })
        .device_assignments
      const activeAssignment = Array.isArray(assignments)
        ? assignments.find((a) => !a.unassigned_at) ?? null
        : null

      return {
        ...device,
        [productKey]: productData ?? null,
        assignment: activeAssignment,
      } as DeviceWithDetails
    },
    enabled: !!id,
  })
}

export function useCreateDevice(type: DeviceType) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (device: Partial<Device> & Record<string, unknown>) => {
      const { data: inserted, error: devError } = await supabase
        .from('devices')
        .insert({
          device_type: type,
          name: device.name ?? null,
          status: device.status ?? 'in_stock',
          serial_number: device.serial_number ?? null,
          identifier: device.identifier ?? null,
          location: device.location ?? null,
          latitude: device.latitude ?? null,
          longitude: device.longitude ?? null,
          environment: device.environment ?? null,
          notes: device.notes ?? null,
        })
        .select()
        .single()

      if (devError) throw devError

      const table = deviceTypeTable[type]
      if (table && table !== 'other') {
        const baseFields = [
          'name',
          'status',
          'serial_number',
          'identifier',
          'location',
          'latitude',
          'longitude',
          'environment',
          'notes',
        ]
        const typePayload = Object.fromEntries(
          Object.entries(device).filter(
            ([k]) => !baseFields.includes(k) && !['id', 'device_type', 'created_at', 'updated_at'].includes(k),
          ),
        )
        const payload: Record<string, unknown> = {
          device_id: inserted.id,
          ...typePayload,
        }
        const { error: lineError } = await supabase.from(table).insert(payload)
        if (lineError) throw lineError
      }

      return inserted as Device
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['devices', type] })
    },
  })
}

export function useUpdateDevice(type: DeviceType) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: Partial<Device> & { id: string } & Record<string, unknown>) => {
      const baseFields = [
        'name',
        'status',
        'serial_number',
        'identifier',
        'location',
        'latitude',
        'longitude',
        'environment',
        'notes',
      ]
      const basePayload = Object.fromEntries(
        Object.entries(payload).filter(([k]) => baseFields.includes(k)),
      )
      const { error: devError } = await supabase
        .from('devices')
        .update(basePayload)
        .eq('id', id)

      if (devError) throw devError

      const table = deviceTypeTable[type]
      if (table && table !== 'other') {
        const linePayload = Object.fromEntries(
          Object.entries(payload).filter(([k]) => !baseFields.includes(k) && k !== 'device_id'),
        )
        if (Object.keys(linePayload).length > 0) {
          const { error: lineError } = await supabase
            .from(table)
            .update(linePayload)
            .eq('device_id', id)
          if (lineError) throw lineError
        }
      }

      return { id, ...payload }
    },
    onSuccess: (_, variables) => {
      if (variables.status != null) {
        void recordAudit('device.status_changed', 'devices', variables.id, { status: variables.status })
      }
      void queryClient.invalidateQueries({ queryKey: ['devices', type] })
      void queryClient.invalidateQueries({ queryKey: ['device', variables.id] })
    },
  })
}

export function useDeleteDevice(type: DeviceType) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('devices').delete().eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['devices', type] })
    },
  })
}

export function useBulkUpdateDeviceStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      ids,
      status,
    }: {
      ids: string[]
      status: DeviceStatus
    }) => {
      if (ids.length === 0) return { count: 0 }
      const { error } = await supabase
        .from('devices')
        .update({ status })
        .in('id', ids)
      if (error) throw error
      return { count: ids.length }
    },
    onSuccess: (_, variables) => {
      void recordAudit('device.status_changed', 'devices', null, {
        count: variables.ids.length,
        status: variables.status,
        ids: variables.ids,
      })
      void queryClient.invalidateQueries({ queryKey: ['devices'] })
    },
  })
}
