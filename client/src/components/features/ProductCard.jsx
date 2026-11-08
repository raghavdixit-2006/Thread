// components/features/ProductCard.jsx - catalog tile: media (with a second hover
// image), discount flag, wishlist toggle outside the link, stock signal, price.
import { Link } from 'react-router-dom';
import { formatINR, discountPercent } from '../../utils/format.js';
import { productImageUrl } from '../../utils/images.js';
import Stars from '../common/Stars.jsx';
import WishlistHeart from './WishlistHeart.jsx';

export default function ProductCard({ product, to }) {
  const href = to || `/product/${product.slug}`;
  const discount = discountPercent(product.price, product.mrp);
  const images = product.images || [];
  const image = product.image || images[0];
  const hoverImage = images[1] || null;
  const totalStock = (product.variants || []).reduce((sum, variant) => sum + (variant.stock || 0), 0);
  const stockLabel = totalStock <= 0 ? 'Sold out' : totalStock <= 3 ? 'Low stock' : null;

  return (
    <article className="card">
      <div className="card-media-wrap">
        <Link to={href} className="card-media" aria-label={product.title}>
          <span className="card-media-fallback" aria-hidden="true">{(product.title || 'T').trim().charAt(0).toUpperCase()}</span>
          {image ? (
            <>
              <img
                src={productImageUrl(image)}
                alt={product.title}
                width="480"
                height="600"
                loading="lazy"
                onError={(event) => event.currentTarget.classList.add('img-failed')}
              />
              {hoverImage && (
                <img
                  className="card-media-alt"
                  src={productImageUrl(hoverImage)}
                  alt=""
                  aria-hidden="true"
                  width="480"
                  height="600"
                  loading="lazy"
                  onError={(event) => event.currentTarget.classList.add('img-failed')}
                />
              )}
            </>
          ) : (
            <span className="placeholder-block card-placeholder" />
          )}
        </Link>
        {discount && <span className="card-flag">{discount}</span>}
        <span className="card-flag-wish">
          <WishlistHeart productId={product._id || product.productId} />
        </span>
      </div>
      <h3><Link to={href}>{product.title}</Link></h3>
      <p className="card-brand">{product.brand}</p>
      <p className="price">
        {formatINR(product.price)}
        {discount && <span className="price-was">{formatINR(product.mrp)}</span>}
      </p>
      <div className="card-meta">
        <Stars value={product.avgRating} count={product.ratingCount} />
        {stockLabel && <span className={`card-stock ${totalStock <= 0 ? 'is-out' : 'is-low'}`}>{stockLabel}</span>}
      </div>
    </article>
  );
}
