// components/common/Spinner.jsx - inline loading block used across pages.
export default function Spinner({ label = 'Loading' }) {
  return (
    <div className="thread-spinner" role="status" aria-live="polite">
      <div className="thread-spinner-ring" aria-hidden="true" />
      <span className="thread-spinner-label">{label}</span>
    </div>
  );
}
