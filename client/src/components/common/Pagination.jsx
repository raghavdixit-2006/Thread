// components/common/Pagination.jsx - legacy numeric pager (.page-arrow/.page-number).
export default function Pagination({ meta, onNavigate }) {
  if (!meta || meta.pages <= 1) return null;
  const current = meta.page || 1;
  const pages = meta.pages;

  const windowStart = Math.max(1, Math.min(current - 2, pages - 4));
  const windowPages = Array.from({ length: Math.min(5, pages) }, (_, index) => windowStart + index);

  const go = (page) => {
    if (page >= 1 && page <= pages && page !== current) onNavigate(page);
  };

  return (
    <nav className="pagination" aria-label="Catalog pages">
      <button type="button" className="page-arrow" disabled={current <= 1} onClick={() => go(current - 1)} aria-label="Previous page">
        <i className="bi bi-chevron-left" aria-hidden="true" />
      </button>
      {windowPages.map((page) => (
        <button
          key={page}
          type="button"
          className={`page-number ${page === current ? 'active' : ''}`}
          onClick={() => go(page)}
          aria-current={page === current ? 'page' : undefined}
        >
          {page}
        </button>
      ))}
      <button type="button" className="page-arrow" disabled={current >= pages} onClick={() => go(current + 1)} aria-label="Next page">
        <i className="bi bi-chevron-right" aria-hidden="true" />
      </button>
      <span className="page-total">
        {meta.total} {meta.total === 1 ? 'piece' : 'pieces'}
      </span>
    </nav>
  );
}
