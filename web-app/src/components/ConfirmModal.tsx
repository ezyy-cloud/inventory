import { Modal } from './Modal'

type ConfirmModalProps = {
  open: boolean
  title: string
  body: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm text-black/80">{body}</p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onConfirm}
          className={
            variant === 'danger'
              ? 'rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold tracking-wide text-white transition duration-200 hover:bg-red-700 active:scale-[0.98]'
              : 'rounded-2xl bg-black px-4 py-2 text-sm font-semibold tracking-wide text-white transition duration-200 hover:bg-black/90 active:scale-[0.98]'
          }
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-2xl border border-black/15 px-4 py-2 text-sm font-semibold tracking-wide text-black transition duration-200 hover:bg-black/5 active:scale-[0.98]"
        >
          {cancelLabel}
        </button>
      </div>
    </Modal>
  )
}
