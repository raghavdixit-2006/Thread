// components/common/Stars.jsx - Bootstrap Icons star row (read-only display).
import { titleize } from '../../utils/format.js';

export default function Stars({ value = 0, count = null }) {
  const safe = Number(value) || 0;
  return (
    <span className="stars" aria-label={`Rated ${safe} of 5`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <i
          key={step}
          className={`bi ${safe >= step ? 'bi-star-fill' : safe >= step - 0.5 ? 'bi-star-half' : 'bi-star'}`}
          aria-hidden="true"
        />
      ))}
      {Number.isFinite(safe) && safe > 0 && <span className="stars-value">{safe.toFixed(1)}</span>}
      {count != null && count > 0 && <span className="stars-count">({count} {count === 1 ? 'review' : 'reviews'})</span>}
    </span>
  );
}

export function StarsLegend({ children }) {
  return <span className="stars-legend">{children || 'No ratings yet'}</span>;
}

export function VerifiedBadge({ verified }) {
  if (!verified) return null;
  return (
    <span className="badge-verified" title="Verified purchase">
      <i className="bi bi-patch-check-fill" aria-hidden="true" /> {titleize('verified-purchase')}
    </span>
  );
}
