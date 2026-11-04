// components/common/ErrorNote.jsx - renders the API error envelope or any thrown error.
// Accepts { status, code, message, details } (RTK error) or axios `error.api`.
// Server validation details arrive as { field, issue: <zod issue object or string> } -
// pull the human message out instead of stringifying the object.

/** one validation detail -> "field: message" (tolerant of string or zod-issue shapes) */
export function detailText(detail) {
  if (!detail) return null;
  if (typeof detail === 'string') return detail;
  const raw = detail.message ?? detail.issue;
  const text = typeof raw === 'string' ? raw : raw?.message || (raw?.code === 'invalid_type' ? `Expected ${raw?.expected}` : null);
  if (!text) return null;
  return detail.field ? `${detail.field}: ${text}` : text;
}

export default function ErrorNote({ error, onRetry, compact = false }) {
  if (!error) return null;
  const message = error.message || error.error?.message || 'Something went wrong';
  const details = Array.isArray(error.details) ? error.details.map(detailText).filter(Boolean) : null;

  if (compact) {
    return (
      <p className="error-note error-note-compact" role="alert">
        <i className="bi bi-exclamation-circle" aria-hidden="true" /> {message}
        {details?.length > 0 && (
          <>
            <span className="sr-only">{details.join('; ')}</span>
            <span className="error-note-compact-detail" aria-hidden="true">{details[0]}</span>
          </>
        )}
      </p>
    );
  }

  return (
    <div className="error-note" role="alert">
      <p className="error-note-title">
        <i className="bi bi-exclamation-triangle" aria-hidden="true" /> {message}
      </p>
      {details?.length > 0 && (
        <ul className="error-note-details">
          {details.map((detail, index) => (
            <li key={index}>{detail}</li>
          ))}
        </ul>
      )}
      {onRetry && (
        <button type="button" className="text-link" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
