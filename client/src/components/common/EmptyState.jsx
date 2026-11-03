// components/common/EmptyState.jsx - friendly empties (cart, wishlist, orders).
export default function EmptyState({ icon = 'bag', title, description, children }) {
  return (
    <div className="empty-state">
      <i className={`bi bi-${icon}`} aria-hidden="true" />
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {children}
    </div>
  );
}
