import Dialog from './Dialog';

/**
 * @param {{ open: boolean, onClose: () => void, onConfirm: () => void, title: string, description?: string, confirmLabel?: string, tone?: 'default'|'danger', loading?: boolean }} props
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'default',
  loading = false,
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} size="sm">
      {description && <p className="text-sm text-base-content/70 mb-5">{description}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" disabled={loading}>
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`btn btn-sm ${tone === 'danger' ? 'btn-error' : 'btn-primary'}`}
        >
          {loading ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
