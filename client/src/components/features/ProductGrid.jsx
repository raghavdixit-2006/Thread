// components/features/ProductGrid.jsx - legacy .grid loader with skeleton + gallery class prop.
import { Link } from 'react-router-dom';
import ErrorNote from '../common/ErrorNote.jsx';
import EmptyState from '../common/EmptyState.jsx';
import ProductCard from './ProductCard.jsx';

export function ProductCardSkeleton() {
  return (
    <div className="card is-skeleton" aria-hidden="true">
      <div className="card-media skeleton-block w-media" />
      <div className="skeleton-block w-70" />
      <div className="skeleton-block w-50" />
      <div className="skeleton-block w-40" />
    </div>
  );
}

export default function ProductGrid({
  items,
  isLoading,
  error,
  onRetry,
  className = 'grid',
  emptyTitle = 'Nothing here yet',
  emptyText = 'Try a different search or category.',
  emptyIcon = 'bag',
  emptyLink,
  emptyLinkLabel,
}) {
  if (isLoading) {
    return <div className={className}>{Array.from({ length: 8 }).map((_, index) => <ProductCardSkeleton key={index} />)}</div>;
  }
  if (error) {
    return <ErrorNote error={error} onRetry={onRetry} />;
  }
  if (!items?.length) {
    return (
      <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyText}>
        {emptyLink && <Link to={emptyLink} className="btn">{emptyLinkLabel || 'Browse the shop'}</Link>}
      </EmptyState>
    );
  }
  return <div className={className}>{items.map((product) => <ProductCard key={product._id || product.productId || product.slug} product={product} />)}</div>;
}
