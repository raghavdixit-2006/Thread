// components/common/ConfirmDialog.jsx - styled replacement for window.confirm.
// Focus lands on cancel by default (destructive actions should not be one Enter away),
// Escape and backdrop clicks cancel, and the dialog is labelled by its title.
import { useEffect, useRef } from 'react';

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();
    function onKeyDown(event) {
      if (event.key === 'Escape') onCancel?.();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel?.(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby={description ? 'dialog-desc' : undefined}>
        <h2 id="dialog-title">{title}</h2>
        {description && <p id="dialog-desc">{description}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn ghost" ref={cancelRef} onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className={`btn ${tone === 'danger' ? 'btn-danger' : ''}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
