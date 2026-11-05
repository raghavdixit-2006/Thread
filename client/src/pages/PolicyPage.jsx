// pages/PolicyPage.jsx - one legal document, server markdown rendered safely (escape-first).
import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useGetPolicyQuery, useListPoliciesQuery } from '../services/policiesApi.js';
import ErrorNote from '../components/common/ErrorNote.jsx';
import { markdownToHtml } from '../utils/markdown.js';
import { formatDate } from '../utils/format.js';

export default function PolicyPage() {
  const { slug } = useParams();
  const policy = useGetPolicyQuery(slug);
  const policies = useListPoliciesQuery();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  return (
    <div className="container">
      <nav className="breadcrumbs" aria-label="Breadcrumb" style={{ paddingTop: 32 }}>
        <Link to="/policies">Policies</Link> /
        <span>{policy.data?.title || slug}</span>
      </nav>

      <div className="policy-layout">
        <nav className="policy-nav" aria-label="Other policies">
          {(policies.data?.items || []).map((entry) => (
            <Link key={entry.slug} to={`/policies/${entry.slug}`}>{entry.title}</Link>
          ))}
        </nav>

        <div style={{ paddingBottom: 80 }}>
          {policy.isLoading && <p className="result-count">Loading policy</p>}
          {policy.error && <ErrorNote error={policy.error} onRetry={policy.refetch} />}
          {policy.data && (
            <article className="prose">
              <h1>{policy.data.title}</h1>
              <p className="result-count">
                Version {policy.data.version} - effective {formatDate(policy.data.effectiveDate || policy.data.updatedAt)}
              </p>
              <div dangerouslySetInnerHTML={{ __html: markdownToHtml(policy.data.bodyMarkdown) }} />
              <p className="policy-version">Published from the THREAD API. Questions? Contact support.</p>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
