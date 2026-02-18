import { useState } from 'react'
import { Mail, Send, FileText, Plus, Pencil, Trash2 } from 'lucide-react'
import { ClientSelector } from '../components/ClientSelector'
import { Modal } from '../components/Modal'
import { QueryErrorBanner } from '../components/QueryErrorBanner'
import { useToast } from '../context/ToastContext'
import { useRole } from '../context/RoleContext'
import { supabase } from '../lib/supabaseClient'
import {
  useMailTemplates,
  useCreateMailTemplate,
  useUpdateMailTemplate,
  useDeleteMailTemplate,
} from '../hooks/useMailTemplates'
import { sendClientMail, sendBroadcastMail } from '../lib/clientMail'
import { recordAudit } from '../lib/auditLog'
import { useClientMailLog } from '../hooks/useClientMailLog'
import { DEVICE_TYPE_LABELS, type Client, type DeviceType, type MailTemplate } from '../types'

const BROADCAST_DEVICE_TYPES: DeviceType[] = [
  'car_tracker',
  'ip_camera',
  'starlink',
  'wifi_access_point',
  'tv',
  'drone',
  'printer',
  'websuite',
  'isp_link',
  'pos_device',
  'other',
]

const inputClass = 'w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-black'
const labelClass = 'block text-xs tracking-wide text-black/60 mt-3 first:mt-0'

type Tab = 'compose' | 'templates' | 'sent'

export function MailPage() {
  const [tab, setTab] = useState<Tab>('compose')
  const [clientId, setClientId] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [subject, setSubject] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [broadcastActiveOnly, setBroadcastActiveOnly] = useState(true)
  const [broadcastDeviceTypes, setBroadcastDeviceTypes] = useState<string[]>([])
  const [showBroadcastConfirm, setShowBroadcastConfirm] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState<{ sent: number; failed: number; errors?: string[] } | null>(null)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MailTemplate | null>(null)
  const [templateForm, setTemplateForm] = useState({ name: '', subject: '', body_html: '' })
  const [sending, setSending] = useState(false)

  const { addToast } = useToast()
  const { isViewer } = useRole()
  const { data: templates = [], isLoading: templatesLoading, isError: templatesError, error: templatesErrorObj, refetch: refetchTemplates } = useMailTemplates()
  const createTemplate = useCreateMailTemplate()
  const updateTemplate = useUpdateMailTemplate()
  const deleteTemplate = useDeleteMailTemplate()
  const { data: sentLog = [], isLoading: sentLoading } = useClientMailLog(20, null)

  const handleUseTemplate = (id: string | null) => {
    setTemplateId(id)
    if (!id) return
    const t = templates.find((x) => x.id === id)
    if (t) {
      setSubject(t.subject)
      setBodyHtml(t.body_html)
    }
  }

  const handleSendSingle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId?.trim()) {
      addToast('Select a client.', 'error')
      return
    }
    if (!selectedClient?.email?.trim()) {
      addToast('Selected client has no email address.', 'error')
      return
    }
    if (!subject.trim() || !bodyHtml.trim()) {
      addToast('Subject and message are required.', 'error')
      return
    }
    setSending(true)
    try {
      const result = templateId
        ? await sendClientMail({ clientId, templateId })
        : await sendClientMail({ clientId, subject, bodyHtml })
      if ('error' in result) {
        addToast(result.error, 'error')
      } else {
        // Record audit + log + notification
        void recordAudit('client_mail.sent', 'clients', clientId, {
          template_id: templateId ?? undefined,
          subject: subject.slice(0, 100),
        })
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user?.id) {
          const safeSubject = subject || (templateId != null ? '(from template)' : '')
          const email = selectedClient?.email ?? null
          await supabase
            .from('client_mail_log')
            .insert({
              sent_by: user.id,
              client_id: clientId,
              template_id: templateId,
              subject: safeSubject,
              outcome: 'sent',
              recipient_email: email,
            })
          await supabase.from('notifications').insert({
            user_id: user.id,
            type: 'client_mail_sent',
            title: 'Email sent',
            body: selectedClient?.name && email ? `${selectedClient.name} (${email})` : email ?? selectedClient?.name ?? null,
            entity_type: 'client',
            entity_id: clientId,
          })
        }
        addToast('Email sent.')
        setSubject('')
        setBodyHtml('')
        setClientId('')
        setSelectedClient(null)
        setTemplateId(null)
      }
    } finally {
      setSending(false)
    }
  }

  const handleBroadcastConfirm = async () => {
    if (!subject.trim() || !bodyHtml.trim()) {
      addToast('Subject and message are required.', 'error')
      return
    }
    setSending(true)
    setShowBroadcastConfirm(false)
    try {
      const deviceTypes = broadcastDeviceTypes.length > 0 ? broadcastDeviceTypes : undefined
      const result = templateId
        ? await sendBroadcastMail({ templateId, activeOnly: broadcastActiveOnly, deviceTypes })
        : await sendBroadcastMail({ subject, bodyHtml, activeOnly: broadcastActiveOnly, deviceTypes })
      if ('error' in result) {
        addToast(result.error, 'error')
      } else {
        setBroadcastResult({ sent: result.sent, failed: result.failed, errors: result.errors })
        void recordAudit('client_mail.broadcast', 'clients', null, {
          template_id: templateId ?? undefined,
          sent: result.sent,
          failed: result.failed,
          active_only: broadcastActiveOnly,
        })
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user?.id) {
          const safeSubject = subject || (templateId != null ? '(from template)' : '')
          const recipientCount = (result.sent ?? 0) + (result.failed ?? 0)
          await supabase
            .from('client_mail_log')
            .insert({
              sent_by: user.id,
              client_id: null,
              template_id: templateId,
              subject: safeSubject,
              outcome: result.sent > 0 && result.failed > 0 ? 'sent' : 'sent',
              recipient_count: recipientCount,
              sent_count: result.sent,
              failed_count: result.failed,
              active_only: broadcastActiveOnly,
            })
          await supabase.from('notifications').insert({
            user_id: user.id,
            type: 'client_mail_broadcast',
            title: 'Broadcast complete',
            body: `${result.sent} sent, ${result.failed} failed`,
            entity_type: 'mail_broadcast',
            entity_id: null,
          })
        }
        addToast(`Broadcast complete: ${result.sent} sent, ${result.failed} failed.`)
      }
    } finally {
      setSending(false)
    }
  }

  const openNewTemplate = () => {
    setEditingTemplate(null)
    setTemplateForm({ name: '', subject: '', body_html: '' })
    setShowTemplateModal(true)
  }

  const openEditTemplate = (t: MailTemplate) => {
    setEditingTemplate(t)
    setTemplateForm({ name: t.name, subject: t.subject, body_html: t.body_html })
    setShowTemplateModal(true)
  }

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!templateForm.name.trim() || !templateForm.subject.trim() || !templateForm.body_html.trim()) {
      addToast('Name, subject and body are required.', 'error')
      return
    }
    try {
      if (editingTemplate) {
        await updateTemplate.mutateAsync({
          id: editingTemplate.id,
          name: templateForm.name,
          subject: templateForm.subject,
          body_html: templateForm.body_html,
        })
        addToast('Template updated.')
      } else {
        await createTemplate.mutateAsync(templateForm)
        addToast('Template created.')
      }
      setShowTemplateModal(false)
    } catch (err) {
      console.error(err)
      addToast('Failed to save template.', 'error')
    }
  }

  const handleDeleteTemplate = (t: MailTemplate) => {
    if (!window.confirm(`Delete template "${t.name}"?`)) return
    deleteTemplate.mutate(t.id, {
      onSuccess: () => addToast('Template deleted.'),
      onError: () => addToast('Failed to delete template.', 'error'),
    })
  }

  const canSend = !isViewer

  return (
    <div className="space-y-6">
      {templatesError && (
        <QueryErrorBanner
          message={templatesErrorObj?.message ?? 'Failed to load templates.'}
          onRetry={() => void refetchTemplates()}
        />
      )}

      <div className="flex gap-2 border-b border-black/10">
        <button
          type="button"
          onClick={() => setTab('compose')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
            tab === 'compose'
              ? 'border-black text-black'
              : 'border-transparent text-black/60 hover:text-black'
          }`}
        >
          <Mail className="h-4 w-4" />
          Compose
        </button>
        <button
          type="button"
          onClick={() => setTab('templates')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
            tab === 'templates'
              ? 'border-black text-black'
              : 'border-transparent text-black/60 hover:text-black'
          }`}
        >
          <FileText className="h-4 w-4" />
          Templates
        </button>
        <button
          type="button"
          onClick={() => setTab('sent')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
            tab === 'sent'
              ? 'border-black text-black'
              : 'border-transparent text-black/60 hover:text-black'
          }`}
        >
          <Send className="h-4 w-4" />
          Sent
        </button>
      </div>

      {tab === 'compose' && (
        <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
          <h2 className="text-lg font-semibold text-black">Send email</h2>
          <p className="mt-1 text-sm text-black/60">
            Use a template or write a custom message. Placeholders: <code className="rounded bg-black/10 px-1">{'{{client_name}}'}</code>, <code className="rounded bg-black/10 px-1">{'{{client_email}}'}</code>
          </p>

          <form onSubmit={handleSendSingle} className="mt-6 space-y-4">
            <div>
              <label className={labelClass}>To (one client)</label>
              <ClientSelector
                value={clientId}
                onChange={(id, client) => {
                  setClientId(id ?? '')
                  setSelectedClient(client ?? null)
                }}
                placeholder="Select client…"
                aria-label="Select client"
              />
            </div>

            <div>
              <label className={labelClass}>Use template (optional)</label>
              <select
                value={templateId ?? ''}
                onChange={(e) => handleUseTemplate(e.target.value || null)}
                className={inputClass}
                aria-label="Template"
              >
                <option value="">Custom message</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={inputClass}
                placeholder="Email subject"
                required
              />
            </div>

            <div>
              <label className={labelClass}>Message (HTML)</label>
              <textarea
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                className={inputClass}
                rows={8}
                placeholder="Email body. You can use basic HTML."
                required
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={sending || !canSend}
                className="inline-flex items-center gap-2 rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-black/90 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                Send to selected client
              </button>
            </div>
          </form>

          <hr className="my-8 border-black/10" />

          <h2 className="text-lg font-semibold text-black">Broadcast</h2>
          <p className="mt-1 text-sm text-black/60">
            Send the same message to all clients that have an email address.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={broadcastActiveOnly}
                onChange={(e) => setBroadcastActiveOnly(e.target.checked)}
                className="rounded border-black/20"
              />
              <span className="text-sm text-black">Active clients only</span>
            </label>
            <button
              type="button"
              disabled={sending || !canSend || !subject.trim() || !bodyHtml.trim()}
              onClick={() => setShowBroadcastConfirm(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-black/20 bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-black/5 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              Send to all
            </button>
          </div>
          <div className="mt-4">
            <p className={labelClass}>Limit to clients with devices</p>
            <p className="mt-1 text-xs text-black/50">Leave empty to include all clients.</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
              {BROADCAST_DEVICE_TYPES.map((dt) => (
                <label key={dt} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={broadcastDeviceTypes.includes(dt)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setBroadcastDeviceTypes((prev) => [...prev, dt])
                      } else {
                        setBroadcastDeviceTypes((prev) => prev.filter((t) => t !== dt))
                      }
                    }}
                    className="rounded border-black/20"
                  />
                  <span className="text-sm text-black">{DEVICE_TYPE_LABELS[dt]}</span>
                </label>
              ))}
            </div>
          </div>
          {broadcastResult != null && (
            <div className="mt-4 rounded-2xl border border-black/10 bg-black/5 p-4 text-sm">
              <p className="font-medium text-black">Last broadcast: {broadcastResult.sent} sent, {broadcastResult.failed} failed.</p>
              {broadcastResult.errors != null && broadcastResult.errors.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-black/70">
                  {broadcastResult.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {broadcastResult.errors.length > 5 && (
                    <li>…and {broadcastResult.errors.length - 5} more</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'templates' && (
        <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-black">Mail templates</h2>
            {canSend && (
              <button
                type="button"
                onClick={openNewTemplate}
                className="inline-flex items-center gap-2 rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/90"
              >
                <Plus className="h-4 w-4" />
                New template
              </button>
            )}
          </div>
          <p className="mt-1 text-sm text-black/60">
            Use placeholders <code className="rounded bg-black/10 px-1">{'{{client_name}}'}</code> and <code className="rounded bg-black/10 px-1">{'{{client_email}}'}</code> in subject and body.
          </p>
          {templatesLoading ? (
            <p className="mt-6 text-sm text-black/60">Loading templates…</p>
          ) : templates.length === 0 ? (
            <p className="mt-6 text-sm text-black/60">No templates yet. Create one to reuse subject and body.</p>
          ) : (
            <ul className="mt-6 space-y-3">
              {templates.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-black/5 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-black">{t.name}</p>
                    <p className="text-sm text-black/60">{t.subject}</p>
                    <p className="mt-1 truncate text-xs text-black/50">
                      {t.body_html.replace(/<[^>]+>/g, ' ').slice(0, 120)}…
                    </p>
                  </div>
                  {canSend && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditTemplate(t)}
                        className="rounded-full p-2 text-black/60 transition hover:bg-black/10 hover:text-black"
                        aria-label="Edit template"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(t)}
                        className="rounded-full p-2 text-black/60 transition hover:bg-red-100 hover:text-red-700"
                        aria-label="Delete template"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'sent' && (
        <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6">
          <h2 className="text-lg font-semibold text-black">Sent mail</h2>
          <p className="mt-1 text-sm text-black/60">
            Recent emails sent from the Mail feature.
          </p>
          {sentLoading ? (
            <div className="mt-4 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-2xl bg-black/5" />
              ))}
            </div>
          ) : sentLog.length === 0 ? (
            <p className="mt-4 text-sm text-black/60">No emails have been sent yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {sentLog.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/10 bg-black/5 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-semibold text-black">
                      {entry.client_name ?? (entry.client_id ? 'Client' : 'Broadcast')}
                    </p>
                    <p className="text-xs text-black/60">
                      {new Date(entry.sent_at).toLocaleString()}
                      {entry.recipient_email
                        ? ` · ${entry.recipient_email}`
                        : entry.recipient_count != null
                          ? ` · ${entry.sent_count ?? 0} sent, ${entry.failed_count ?? 0} failed`
                          : null}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showBroadcastConfirm && (
        <Modal title="Confirm broadcast" onClose={() => setShowBroadcastConfirm(false)}>
          <p className="text-sm text-black/80">
            Send this message to all clients that have an email address
            {broadcastActiveOnly ? ' (active clients only)' : ''}?
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowBroadcastConfirm(false)}
              className="rounded-2xl border border-black/20 px-4 py-2 text-sm font-semibold text-black"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleBroadcastConfirm}
              className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/90"
            >
              Send to all
            </button>
          </div>
        </Modal>
      )}

      {showTemplateModal && (
        <Modal
          title={editingTemplate ? 'Edit template' : 'New template'}
          onClose={() => setShowTemplateModal(false)}
        >
          <form onSubmit={handleSaveTemplate} className="space-y-4">
            <div>
              <label className={labelClass}>Name</label>
              <input
                type="text"
                value={templateForm.name}
                onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))}
                className={inputClass}
                placeholder="e.g. Welcome"
                required
              />
            </div>
            <div>
              <label className={labelClass}>Subject</label>
              <input
                type="text"
                value={templateForm.subject}
                onChange={(e) => setTemplateForm((f) => ({ ...f, subject: e.target.value }))}
                className={inputClass}
                placeholder="Email subject"
                required
              />
            </div>
            <div>
              <label className={labelClass}>Body (HTML)</label>
              <textarea
                value={templateForm.body_html}
                onChange={(e) => setTemplateForm((f) => ({ ...f, body_html: e.target.value }))}
                className={inputClass}
                rows={6}
                placeholder="Email body. Use {{client_name}} and {{client_email}}."
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="rounded-2xl border border-black/20 px-4 py-2 text-sm font-semibold text-black"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/90"
              >
                {editingTemplate ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
