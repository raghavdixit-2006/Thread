// pages/PoliciesPage.jsx - legal index, published by the backend policy module.
import { Link } from 'react-router-dom';
import { useListPoliciesQuery } from '../services/policiesApi.js';
import ErrorNote from '../components/common/ErrorNote.jsx';
import { formatDate, titleize } from '../utils/format.js';

export default function PoliciesPage() {
  const policies = useListPoliciesQuery();

  return (
    <div className="container">
      <div className="page-head">
        <h1>Policies</h1>
        <p>Everything about privacy, shipping, returns and the fine print - versioned and published by the store.</p>
      </div>

      {policies.isLoading && <p className="result-count">Loading policies</p>}
      {policies.error && <ErrorNote error={policies.error} onRetry={policies.refetch} />}

      {policies.data && (
        <div className="orders-page" style={{ paddingBottom: 80 }}>
          {policies.data.items.map((policy) => (
            <article key={policy.slug} className="order-card">
              <div className="order-card-head">
                <div>
                  <p className="eyebrow">{titleize(policy.category)}</p>
                  <h3>{policy.title}</h3>
                </div>
              </div>
              <p className="result-count">
                v{policy.version} - effective {formatDate(policy.effectiveDate || policy.updatedAt)}
              </p>
              <Link to={`/policies/${policy.slug}`} className="text-link">
                Read policy <i className="bi bi-arrow-right" aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
