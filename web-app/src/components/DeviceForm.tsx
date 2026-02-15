import { useState, type FormEvent } from 'react'
import type { DeviceType } from '../types'

const inputClass =
  'w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-black placeholder:text-black/40'
const labelClass = 'block text-xs tracking-wide text-black/60'

type DeviceFormData = Record<string, string | number | boolean | null>

const DEVICE_TYPE_FIELDS: Record<
  DeviceType,
  { key: string; label: string; type: string; optional?: boolean }[]
> = {
  car_tracker: [
    { key: 'brand', label: 'Brand', type: 'text' },
    { key: 'model', label: 'Model', type: 'text' },
    { key: 'sim_number', label: 'SIM Number', type: 'text' },
    { key: 'user_tel', label: 'User Tel', type: 'text' },
    { key: 'vehicle_model', label: 'Vehicle Model', type: 'text' },
    { key: 'reg_number', label: 'Reg Number', type: 'text' },
    { key: 'color', label: 'Color', type: 'text' },
    { key: 'server', label: 'Server', type: 'text' },
    { key: 'port', label: 'Port', type: 'text' },
    { key: 'imei', label: 'IMEI', type: 'text' },
    { key: 'pwd', label: 'Password', type: 'password' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'install_date', label: 'Install Date', type: 'date' },
    { key: 'sms_notification', label: 'SMS Notification', type: 'checkbox' },
    { key: 'remote_cut_off', label: 'Remote Cut Off', type: 'checkbox' },
    { key: 'last_top_up', label: 'Last Top Up', type: 'date' },
  ],
  ip_camera: [
    { key: 'camera_type', label: 'Camera Type', type: 'text' },
    { key: 'range', label: 'Range', type: 'text' },
  ],
  starlink: [
    { key: 'account', label: 'Account', type: 'text' },
    { key: 'subscription', label: 'Subscription', type: 'text' },
    { key: 'amount', label: 'Amount', type: 'number' },
    { key: 'renewal_date', label: 'Renewal Date', type: 'date' },
    { key: 'registration_date', label: 'Registration Date', type: 'date' },
    { key: 'service_period', label: 'Service Period', type: 'text' },
  ],
  wifi_access_point: [
    { key: 'ap_type', label: 'Type', type: 'text' },
    { key: 'range', label: 'Range', type: 'text' },
    { key: 'console', label: 'Console', type: 'text' },
  ],
  tv: [
    { key: 'tv_type', label: 'Type', type: 'text' },
    { key: 'speakers', label: 'Speakers', type: 'text' },
  ],
  drone: [
    { key: 'drone_type', label: 'Type', type: 'text' },
    { key: 'range', label: 'Range', type: 'text' },
  ],
  printer: [
    { key: 'username', label: 'Username', type: 'text' },
    { key: 'password', label: 'Password', type: 'password' },
    { key: 'ip_address', label: 'IP Address', type: 'text' },
  ],
  websuite: [
    { key: 'package', label: 'Package', type: 'text' },
    { key: 'domain', label: 'Domain', type: 'text' },
  ],
  isp_link: [
    { key: 'link_type', label: 'Type', type: 'text' },
    { key: 'line_number', label: 'Line Number', type: 'text' },
    { key: 'wlan_pwd', label: 'WLAN Password', type: 'password' },
    { key: 'acc_pwd', label: 'Account Password', type: 'password' },
    { key: 'modem_user', label: 'Modem User', type: 'text' },
    { key: 'modem_pwd', label: 'Modem Password', type: 'password' },
    { key: 'ip_address', label: 'IP Address', type: 'text' },
  ],
  other: [],
}

interface DeviceFormProps {
  type: DeviceType
  initialValues?: DeviceFormData
  deviceId?: string
  onSubmit: (data: DeviceFormData) => void
  onCancel: () => void
  isSubmitting?: boolean
}


export function DeviceForm({
  type,
  initialValues = {},
  deviceId,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: DeviceFormProps) {
  const [form, setForm] = useState<DeviceFormData>(() => ({
    name: '',
    identifier: '',
    status: 'in_stock',
    location: '',
    latitude: null,
    longitude: null,
    environment: null,
    notes: '',
    ...initialValues,
  }))

  const handleChange = (key: string, value: string | number | boolean | null) => {
    setForm((p) => ({ ...p, [key]: value }))
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit(form)
  }

  const typeFields = DEVICE_TYPE_FIELDS[type] ?? []

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-black/10 bg-white p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>Name</label>
            <input
              type="text"
              value={String(form.name ?? '')}
              onChange={(e) => handleChange('name', e.target.value)}
              className={inputClass}
              placeholder="Device name"
            />
          </div>
          <div>
            <label className={labelClass}>Identifier</label>
            <input
              type="text"
              value={String(form.identifier ?? '')}
              onChange={(e) => handleChange('identifier', e.target.value)}
              className={inputClass}
              placeholder="e.g. CT-001"
            />
          </div>
          {!deviceId && (
            <div>
              <label className={labelClass}>Status</label>
              <select
                value={String(form.status ?? 'in_stock')}
                onChange={(e) => handleChange('status', e.target.value)}
                className={inputClass}
              >
                <option value="in_stock">In stock</option>
                <option value="assigned">Assigned</option>
                <option value="maintenance">Maintenance</option>
                <option value="retired">Retired</option>
                <option value="lost">Lost</option>
              </select>
            </div>
          )}
          <div>
            <label className={labelClass}>Location</label>
            <input
              type="text"
              value={String(form.location ?? '')}
              onChange={(e) => handleChange('location', e.target.value)}
              className={inputClass}
              placeholder="Location"
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Notes</label>
            <textarea
              value={String(form.notes ?? '')}
              onChange={(e) => handleChange('notes', e.target.value)}
              className={inputClass}
              rows={2}
              placeholder="Notes"
            />
          </div>
        </div>
      </div>

      {typeFields.length > 0 && (
        <div className="rounded-2xl border border-black/10 bg-white p-6">
          <div className="grid gap-4 md:grid-cols-2">
            {typeFields.map((f) => (
              <div key={f.key}>
                {f.type === 'checkbox' ? (
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={Boolean(form[f.key])}
                      onChange={(e) => handleChange(f.key, e.target.checked)}
                      className="h-4 w-4 rounded border-black/20"
                    />
                    <span className={labelClass}>{f.label}</span>
                  </label>
                ) : (
                  <>
                    <label className={labelClass}>{f.label}</label>
                    <input
                      type={f.type}
                      value={String(form[f.key] ?? '')}
                      onChange={(e) =>
                        handleChange(
                          f.key,
                          f.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value,
                        )
                      }
                      className={inputClass}
                      placeholder={f.label}
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-2xl bg-black px-6 py-3 text-sm font-semibold tracking-wide text-white transition duration-200 hover:bg-black/90 active:scale-[0.98] disabled:opacity-50"
        >
          {isSubmitting ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-2xl border border-black/15 bg-white px-6 py-3 text-sm font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
