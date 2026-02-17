import { ChevronRight } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { DeviceForm } from '../components/DeviceForm'
import { useCreateDevice } from '../hooks/useDevices'
import { DEVICE_TYPE_LABELS, type DeviceType } from '../types'

const VALID_TYPES: DeviceType[] = [
  'car_tracker',
  'ip_camera',
  'starlink',
  'wifi_access_point',
  'tv',
  'drone',
  'printer',
  'websuite',
  'isp_link',
]

export function DeviceFormPage() {
  const { type } = useParams<{ type: string }>()
  const navigate = useNavigate()
  const deviceType = type as DeviceType | null

  const createDevice = useCreateDevice(deviceType ?? 'car_tracker')

  if (!deviceType || !VALID_TYPES.includes(deviceType as DeviceType)) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/devices/type/car_tracker')}
          className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black"
        >
          <ChevronRight className="h-4 w-4 rotate-180" /> Back
        </button>
        <p className="text-sm text-black/60">Invalid device type.</p>
      </div>
    )
  }

  const handleSubmit = async (data: Record<string, unknown>) => {
    try {
      await createDevice.mutateAsync(data as Parameters<typeof createDevice.mutateAsync>[0])
      navigate('/devices/type/car_tracker')
    } catch (e) {
      console.error(e)
    }
  }

  const title = `Add ${DEVICE_TYPE_LABELS[deviceType ?? 'car_tracker']}`

  return (
    <div className="space-y-6">
      {createDevice.isError && createDevice.error != null && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {createDevice.error.message}
        </div>
      )}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/devices/type/car_tracker')}
          className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black"
        >
          <ChevronRight className="h-4 w-4 rotate-180" /> Back
        </button>
        <h2 className="text-xl font-semibold text-black">{title}</h2>
      </div>

      <DeviceForm
        type={deviceType ?? 'car_tracker'}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/devices/type/car_tracker')}
        isSubmitting={createDevice.isPending}
      />
    </div>
  )
}
