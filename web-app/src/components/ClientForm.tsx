import { useState, type FormEvent } from 'react'
import type { Client } from '../types'
import { clientFormSchema, type ClientFormValues } from '../lib/validations/client'
import type { ClientTag } from '../hooks/useClientTags'

const inputClass =
  'w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-black placeholder:text-black/40'
const inputErrorClass =
  'w-full rounded-2xl border border-red-300 bg-red-50/50 px-4 py-3 text-black placeholder:text-black/40'
const labelClass = 'block text-xs tracking-wide text-black/60'

interface ClientFormProps {
  initialValues?: Partial<Client>
  onSubmit: (data: Partial<Client>) => void
  onCancel: () => void
  isSubmitting?: boolean
  /** Tags to show in multi-select; when provided, tags section is shown */
  tags?: ClientTag[]
  selectedTagIds?: string[]
  onTagsChange?: (tagIds: string[]) => void
}

const defaultForm: ClientFormValues = {
  name: '',
  industry: '',
  contact_name: '',
  email: '',
  phone: '',
  address: '',
  billing_address: '',
  tax_number: '',
  notes: '',
}

export function ClientForm({
  initialValues = {},
  onSubmit,
  onCancel,
  isSubmitting = false,
  tags,
  selectedTagIds = [],
  onTagsChange,
}: ClientFormProps) {
  const [form, setForm] = useState<ClientFormValues>(() => {
    const from = { ...defaultForm }
    if (initialValues) {
      const keys: (keyof ClientFormValues)[] = ['name', 'industry', 'contact_name', 'email', 'phone', 'address', 'billing_address', 'tax_number', 'notes']
      for (const k of keys) {
        const v = initialValues[k as keyof typeof initialValues]
        from[k] = (v == null || v === '') ? '' : String(v)
      }
    }
    return from
  })
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ClientFormValues, string>>>({})

  const handleChange = (key: keyof ClientFormValues, value: string | null) => {
    setForm((p) => ({ ...p, [key]: value ?? '' }))
    if (fieldErrors[key]) {
      setFieldErrors((e) => ({ ...e, [key]: undefined }))
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const parsed = clientFormSchema.safeParse(form)
    if (!parsed.success) {
      const errors: Partial<Record<keyof ClientFormValues, string>> = {}
      for (const issue of parsed.error.issues) {
        const path = issue.path[0]
        if (typeof path === 'string' && path in defaultForm) {
          errors[path as keyof ClientFormValues] = issue.message
        }
      }
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    onSubmit(parsed.data as Partial<Client>)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-black/10 bg-white p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>Name *</label>
            <input
              type="text"
              value={form.name ?? ''}
              onChange={(e) => handleChange('name', e.target.value)}
              className={fieldErrors.name ? inputErrorClass : inputClass}
              placeholder="Company or client name"
              aria-invalid={!!fieldErrors.name}
              aria-describedby={fieldErrors.name ? 'name-error' : undefined}
            />
            {fieldErrors.name && (
              <p id="name-error" className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>Industry</label>
            <input
              type="text"
              value={form.industry ?? ''}
              onChange={(e) => handleChange('industry', e.target.value)}
              className={inputClass}
              placeholder="e.g. Logistics, Retail"
            />
          </div>
          <div>
            <label className={labelClass}>Contact name</label>
            <input
              type="text"
              value={form.contact_name ?? ''}
              onChange={(e) => handleChange('contact_name', e.target.value)}
              className={inputClass}
              placeholder="Primary contact"
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              value={form.email ?? ''}
              onChange={(e) => handleChange('email', e.target.value)}
              className={fieldErrors.email ? inputErrorClass : inputClass}
              placeholder="email@company.com"
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            />
            {fieldErrors.email && (
              <p id="email-error" className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input
              type="tel"
              value={form.phone ?? ''}
              onChange={(e) => handleChange('phone', e.target.value)}
              className={inputClass}
              placeholder="+263 ..."
            />
          </div>
          <div>
            <label className={labelClass}>Tax number</label>
            <input
              type="text"
              value={form.tax_number ?? ''}
              onChange={(e) => handleChange('tax_number', e.target.value)}
              className={inputClass}
              placeholder="VAT/TIN"
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Address</label>
            <input
              type="text"
              value={form.address ?? ''}
              onChange={(e) => handleChange('address', e.target.value)}
              className={inputClass}
              placeholder="Physical address"
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Billing address</label>
            <input
              type="text"
              value={form.billing_address ?? ''}
              onChange={(e) => handleChange('billing_address', e.target.value)}
              className={inputClass}
              placeholder="Billing address (if different)"
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Notes</label>
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              className={inputClass}
              rows={3}
              placeholder="Notes"
            />
          </div>
          {tags != null && onTagsChange != null && (
            <div className="md:col-span-2">
              <label className={labelClass}>Tags</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(tags ?? []).map((tag) => {
                  const selected = selectedTagIds?.includes(tag.id) ?? false
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => {
                        const next = selected
                          ? (selectedTagIds ?? []).filter((id) => id !== tag.id)
                          : [...(selectedTagIds ?? []), tag.id]
                        onTagsChange(next)
                      }}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                        selected
                          ? 'border-black bg-black text-white'
                          : 'border-black/20 bg-white text-black hover:border-black/40'
                      }`}
                    >
                      {tag.name}
                    </button>
                  )
                })}
                {tags.length === 0 && (
                  <span className="text-sm text-black/50">No tags yet. Add tags in the Clients list filter.</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

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
