import { ChevronRight } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { DeviceForm } from '../components/DeviceForm'
import { QueryErrorBanner } from '../components/QueryErrorBanner'
import { useDevice, useUpdateDevice } from '../hooks/useDevices'

export function DeviceEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: device, isLoading, isError, error, refetch } = useDevice(id ?? null)
  const updateDevice = useUpdateDevice(device?.device_type ?? 'car_tracker')

  if (isError) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/devices/type/car_tracker')}
          className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black"
        >
          <ChevronRight className="h-4 w-4 rotate-180" /> Back
        </button>
        <QueryErrorBanner
          message={error?.message ?? 'Failed to load device.'}
          onRetry={() => void refetch()}
        />
      </div>
    )
  }

  if (isLoading || !device) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/devices/type/car_tracker')}
          className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black"
        >
          <ChevronRight className="h-4 w-4 rotate-180" /> Back
        </button>
        <p className="text-sm text-black/60">{isLoading ? 'Loading…' : 'Device not found.'}</p>
      </div>
    )
  }

  const initialValues = {
    name: device.name ?? '',
    identifier: device.identifier ?? '',
    status: device.status,
    location: device.location ?? '',
    latitude: device.latitude,
    longitude: device.longitude,
    environment: device.environment ?? '',
    notes: device.notes ?? '',
    ...(device.car_tracker ?? {}),
    ...(device.ip_camera ?? {}),
    ...(device.starlink ?? {}),
    ...(device.wifi_access_point ?? {}),
    ...(device.tv ?? {}),
    ...(device.drone ?? {}),
    ...(device.printer ?? {}),
    ...(device.websuite ?? {}),
    ...(device.isp_link ?? {}),
  }

  const handleSubmit = async (data: Record<string, unknown>) => {
    try {
      await updateDevice.mutateAsync({ id: device.id, ...data })
      navigate(`/devices/${device.id}`)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="space-y-6">
      {updateDevice.isError && updateDevice.error != null && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {updateDevice.error.message}
        </div>
      )}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/devices/${device.id}`)}
          className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black"
        >
          <ChevronRight className="h-4 w-4 rotate-180" /> Back
        </button>
        <h2 className="text-xl font-semibold text-black">
          Edit {device.name ?? device.identifier ?? 'Device'}
        </h2>
      </div>

      <DeviceForm
        type={device.device_type}
        initialValues={initialValues}
        deviceId={device.id}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/devices/${device.id}`)}
        isSubmitting={updateDevice.isPending}
      />
    </div>
  )
}
