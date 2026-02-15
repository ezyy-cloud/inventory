import { ChevronRight, Mail, Printer } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { QueryErrorBanner } from '../components/QueryErrorBanner'
import { StatusPill } from '../components/StatusPill'
import { useRole } from '../context/RoleContext'
import { useInvoice, useUpdateInvoice } from '../hooks/useInvoices'
import { sendInvoiceEmail } from '../lib/resend'

const inputClass = 'w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-black'
const labelClass = 'block text-xs tracking-wide text-black/60 mt-3 first:mt-0'

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: invoice, isLoading, isError, error, refetch } = useInvoice(id ?? null)
  const { isViewer } = useRole()
  const updateInv = useUpdateInvoice()
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ amount: 0, due_at: '', notes: '' })
  const [sendError, setSendError] = useState<string | null>(null)

  const handleEdit = () => {
    if (invoice) {
      setEditForm({
        amount: invoice.amount ?? 0,
        due_at: invoice.due_at ?? '',
        notes: invoice.notes ?? '',
      })
      setEditing(true)
    }
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    try {
      await updateInv.mutateAsync({
        id,
        amount: editForm.amount,
        due_at: editForm.due_at || null,
        notes: editForm.notes || null,
      })
      setEditing(false)
    } catch (err) {
      console.error(err)
    }
  }

  const handleSend = async () => {
    if (!id) return
    setSendError(null)
    try {
      const result = await sendInvoiceEmail(id)
      if ('error' in result) {
        setSendError(result.error)
        return
      }
      await updateInv.mutateAsync({
        id,
        status: 'sent',
        issued_at: new Date().toISOString().slice(0, 10),
      })
    } catch (err) {
      console.error(err)
      setSendError(err instanceof Error ? err.message : 'Failed to send')
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleMarkPaid = async () => {
    if (!id) return
    try {
      await updateInv.mutateAsync({
        id,
        status: 'paid',
        paid_at: new Date().toISOString().slice(0, 10),
      })
    } catch (err) {
      console.error(err)
    }
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <Link
          to="/invoices"
          className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black"
        >
          <ChevronRight className="h-4 w-4 rotate-180" /> Back
        </Link>
        <QueryErrorBanner
          message={error?.message ?? 'Failed to load invoice.'}
          onRetry={() => void refetch()}
        />
      </div>
    )
  }

  if (isLoading || !invoice) {
    return (
      <div className="space-y-6">
        <Link
          to="/invoices"
          className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black"
        >
          <ChevronRight className="h-4 w-4 rotate-180" /> Back
        </Link>
        <p className="text-sm text-black/60">{isLoading ? 'Loading…' : 'Invoice not found.'}</p>
      </div>
    )
  }

  const rawItems = (invoice as { client_invoice_items?: Array<{ id?: string; description: string | null; quantity: number; unit_price: number; total: number }> })
    .client_invoice_items
  const items = Array.isArray(rawItems) ? rawItems : []
  const displayTotal = items.length > 0
    ? items.reduce((s, i) => s + (i.total ?? 0), 0)
    : invoice.amount ?? 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <Link
          to="/invoices"
          className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-black"
        >
          <ChevronRight className="h-4 w-4 rotate-180" /> Back
        </Link>
        <div className="flex items-center gap-3">
          <StatusPill value={invoice.status} />
          {!isViewer && invoice.status === 'draft' && (
            <>
              {sendError && (
                <p className="text-sm text-red-600">{sendError}</p>
              )}
              <button
                onClick={handleEdit}
                className="rounded-full border border-black/15 px-4 py-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
              >
                Edit
              </button>
            </>
          )}
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-full border border-black/15 px-4 py-2 text-xs font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          {!isViewer && invoice.status === 'draft' && (
            <button
              onClick={handleSend}
              disabled={updateInv.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-xs font-semibold tracking-wide whitespace-nowrap text-white transition duration-200 hover:bg-black/90 active:scale-[0.98] disabled:opacity-50"
            >
              <Mail className="h-4 w-4" />
              Send
            </button>
          )}
          {!isViewer && (invoice.status === 'sent' || invoice.status === 'overdue') && (
            <button
              onClick={handleMarkPaid}
              disabled={updateInv.isPending}
              className="rounded-full bg-black px-4 py-2 text-xs font-semibold tracking-wide whitespace-nowrap text-white transition duration-200 hover:bg-black/90 active:scale-[0.98] disabled:opacity-50"
            >
              Mark paid
            </button>
          )}
        </div>
      </div>

      {editing && !isViewer ? (
        <form onSubmit={handleSaveEdit} className="card-shadow rounded-3xl border border-black/10 bg-white p-6 print:hidden">
          <h2 className="text-lg font-semibold text-black">Edit invoice</h2>
          <label className={labelClass}>Amount</label>
          <input
            type="number"
            step="0.01"
            value={editForm.amount || ''}
            onChange={(e) => setEditForm((p) => ({ ...p, amount: Number.parseFloat(e.target.value) || 0 }))}
            className={inputClass}
            required
          />
          <label className={labelClass}>Due date</label>
          <input
            type="date"
            value={editForm.due_at}
            onChange={(e) => setEditForm((p) => ({ ...p, due_at: e.target.value }))}
            className={inputClass}
          />
          <label className={labelClass}>Notes</label>
          <textarea
            value={editForm.notes}
            onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
            className={inputClass}
            rows={3}
          />
          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={updateInv.isPending}
              className="rounded-2xl bg-black px-6 py-2 text-sm font-semibold tracking-wide text-white transition duration-200 hover:bg-black/90 active:scale-[0.98] disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-2xl border border-black/15 px-6 py-2 text-sm font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="card-shadow rounded-3xl border border-black/10 bg-white p-6 print:shadow-none print:border-black/20">
          <h2 className="text-xl font-semibold text-black">{invoice.invoice_number}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs tracking-wide text-black/60">Client</p>
              <p className="mt-1 text-sm font-semibold text-black">
                {(invoice as { clients?: { name: string } }).clients?.name ?? '—'}
              </p>
              <p className="text-xs text-black/60">
                {(invoice as { clients?: { email: string | null } }).clients?.email ?? ''}
              </p>
            </div>
            <div>
              <p className="text-xs tracking-wide text-black/60">Plan</p>
              <p className="mt-1 text-sm font-semibold text-black">
                {(invoice as { subscription_plans?: { name: string } }).subscription_plans?.name ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs tracking-wide text-black/60">Device</p>
              <p className="mt-1 text-sm font-semibold text-black">
                {(invoice as { devices?: { name: string | null; identifier: string | null } }).devices?.name ??
                  (invoice as { devices?: { identifier: string | null } }).devices?.identifier ??
                  '—'}
              </p>
            </div>
            <div>
              <p className="text-xs tracking-wide text-black/60">Due date</p>
              <p className="mt-1 text-sm font-semibold text-black">{invoice.due_at ?? '—'}</p>
            </div>
          </div>

          {items.length > 0 ? (
            <div className="mt-6">
              <p className="text-xs tracking-wide text-black/60">Line items</p>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b border-black/10">
                    <th className="py-2 text-left font-semibold text-black">Description</th>
                    <th className="py-2 text-right font-semibold text-black">Qty</th>
                    <th className="py-2 text-right font-semibold text-black">Unit price</th>
                    <th className="py-2 text-right font-semibold text-black">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={(item as { id?: string }).id ?? idx} className="border-b border-black/5">
                      <td className="py-2 text-black">{item.description ?? '—'}</td>
                      <td className="py-2 text-right text-black">{item.quantity}</td>
                      <td className="py-2 text-right text-black">
                        {(item.unit_price ?? 0).toLocaleString()}
                      </td>
                      <td className="py-2 text-right text-black">{(item.total ?? 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="mt-6 flex justify-end border-t border-black/10 pt-4">
            <div className="text-right">
              <p className="text-xs tracking-wide text-black/60">Total</p>
              <p className="text-lg font-semibold text-black">
                {invoice.currency ?? 'USD'} {displayTotal.toLocaleString()}
              </p>
            </div>
          </div>

          {invoice.notes ? (
            <div className="mt-6">
              <p className="text-xs tracking-wide text-black/60">Notes</p>
              <p className="mt-1 text-sm text-black/80">{invoice.notes}</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
