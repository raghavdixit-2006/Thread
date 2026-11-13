// pages/WishlistPage.jsx - legacy .wishlist-grid of .card tiles; heart toggles, quick add.
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useGetWishlistQuery } from '../services/wishlistApi.js';
import { useLazyGetProductQuery } from '../services/productsApi.js';
import { addToCart } from '../store/cartSlice.js';
import useAuth from '../hooks/useSessionSync.js';
import EmptyState from '../components/common/EmptyState.jsx';
import ErrorNote from '../components/common/ErrorNote.jsx';
import WishlistHeart from '../components/features/WishlistHeart.jsx';
import Stars from '../components/common/Stars.jsx';
import { productImageUrl } from '../utils/images.js';
import { formatINR, discountPercent } from '../utils/format.js';

export default function WishlistPage() {
  const { isAuthed } = useAuth();
  const wishlist = useGetWishlistQuery(undefined, { skip: !isAuthed });
  const items = wishlist.data?.items || [];

  if (!isAuthed) {
    return (
      <div className="container page-head">
        <h1>Wishlist</h1>
        <EmptyState icon="heart" title="Sign in to see your wishlist" description="Saved pieces follow you on every new session.">
          <Link to="/auth?next=/wishlist" className="btn">Sign in</Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-head">
        <h1>Wishlist</h1>
        <p>
          {items.length
            ? `${items.length} piece${items.length === 1 ? '' : 's'} saved for later.`
            : 'Heart anything you like on the shelf.'}
        </p>
      </div>

      {wishlist.isLoading && <p className="result-count">Loading wishlist</p>}
      {wishlist.error && <ErrorNote error={wishlist.error} onRetry={wishlist.refetch} />}
      {!wishlist.isLoading && !wishlist.error && items.length === 0 && (
        <EmptyState icon="heart" title="Nothing saved yet" description="Tap the heart on any product to keep it here.">
          <Link to="/shop" className="btn">Browse the shop</Link>
        </EmptyState>
      )}

      <div className="wishlist-grid grid">
        {items.map((product) => (
          <WishCard key={product._id} product={product} />
        ))}
      </div>
    </div>
  );
}

function WishCard({ product }) {
  const discount = discountPercent(product.price, product.mrp);
  const image = product.image || (product.images && product.images[0]);
  return (
    <article className="card">
      <Link to={`/product/${product.slug}`} className="card-media" aria-label={product.title}>
        {image ? (
          <img src={productImageUrl(image)} alt={product.title} loading="lazy" />
        ) : (
          <span className="placeholder-block" style={{ width: '100%', height: '100%' }} />
        )}
        {discount && <span className="card-flag">{discount}</span>}
        <span className="card-flag-wish"><WishlistHeart productId={product._id} /></span>
      </Link>
      <h3><Link to={`/product/${product.slug}`}>{product.title}</Link></h3>
      <p className="card-brand">{product.brand}</p>
      <p className="price">
        {formatINR(product.price)}
        {discount && <span className="price-was">{formatINR(product.mrp)}</span>}
      </p>
      <Stars value={product.avgRating} count={product.ratingCount} />
      <AddFirstToBag slug={product.slug} />
    </article>
  );
}

/**
 * "Add to bag" shortcut: a size is required server-side, so this fetches the
 * full detail, picks the first in-stock variant, adds it, then moves to the bag.
 */
function AddFirstToBag({ slug }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [fetchDetail, { isFetching }] = useLazyGetProductQuery();
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');

  async function handleAdd() {
    setWorking(true);
    setNotice('');
    try {
      const product = await fetchDetail(slug).unwrap();
      const variant = (product.variants || []).find((v) => v.stock > 0);
      if (!variant) {
        setNotice('Sold out in every size right now');
        return;
      }
      await dispatch(
        addToCart({
          productId: product._id,
          sku: variant.sku,
          qty: 1,
          product: {
            slug: product.slug,
            title: product.title,
            brand: product.brand,
            category: product.category,
            image: product.image || product.images?.[0] || '',
            unitPrice: variant.price ?? product.price,
            mrp: product.mrp,
            size: variant.size,
            color: variant.color,
            stock: variant.stock,
          },
        }),
      );
      navigate('/cart');
    } catch {
      setNotice('Could not add - try from the product page');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button
        type="button"
        className="btn ghost block"
        disabled={working || isFetching}
        onClick={handleAdd}
      >
        <i className="bi bi-bag-plus" aria-hidden="true" /> {working || isFetching ? 'Adding' : 'Add to bag'}
      </button>
      {notice && <p className="cart-note" style={{ marginTop: 8 }}>{notice}</p>}
    </div>
  );
}
