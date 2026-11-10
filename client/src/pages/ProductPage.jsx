// pages/ProductPage.jsx - product page: gallery + thumbs (crop views), option groups,
// stock note, CTA, trust list, detail tabs; reviews and related grids keep the same vocabulary.
import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useGetProductQuery, useGetRelatedQuery } from '../services/productsApi.js';
import { useGetReviewsQuery, useAddReviewMutation } from '../services/reviewsApi.js';
import { addToCart, selectCartSnapshot } from '../store/cartSlice.js';
import useAuth from '../hooks/useSessionSync.js';
import Stars from '../components/common/Stars.jsx';
import Spinner from '../components/common/Spinner.jsx';
import ErrorNote from '../components/common/ErrorNote.jsx';
import ProductGrid from '../components/features/ProductGrid.jsx';
import WishlistHeart from '../components/features/WishlistHeart.jsx';
import QuantityStepper from '../components/common/QuantityStepper.jsx';
import { productImageUrl } from '../utils/images.js';
import { formatINR, discountPercent, formatDate, titleize } from '../utils/format.js';
import { useSelector, useDispatch } from 'react-redux';

const RATING_STEPS = [1, 2, 3, 4, 5];

function RatingInput({ value, onChange }) {
  function onKeyDown(event) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      onChange(Math.min(5, value + 1));
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      onChange(Math.max(1, value - 1));
    }
  }

  return (
    <div className="rating-input" role="radiogroup" aria-label="Rating" onKeyDown={onKeyDown}>
      {RATING_STEPS.map((step) => (
        <button
          key={step}
          type="button"
          role="radio"
          aria-checked={value === step}
          aria-label={`${step} star${step > 1 ? 's' : ''}`}
          tabIndex={value === step ? 0 : -1}
          className="rating-star"
          onClick={() => onChange(step)}
        >
          <i className={`bi ${value >= step ? 'bi-star-fill lit' : 'bi-star'}`} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

function ReviewsSection({ slug, summary }) {
  const { isAuthed } = useAuth();
  const [page, setPage] = useState(1);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const reviews = useGetReviewsQuery({ slug, page, limit: 6 });
  const [addReview, { isLoading: submitting, error: submitError, isSuccess }] = useAddReviewMutation();

  async function submitReview(event) {
    event.preventDefault();
    try {
      await addReview({ slug, rating, title, body }).unwrap();
    } catch {
      // panel shows the server error envelope
    }
  }

  return (
    <section className="reviews-section" aria-label="Reviews">
      <div className="section-head">
        <h2>Reviews</h2>
        {reviews.data?.meta && (
          <span className="result-count">
            {reviews.data.meta.total} review{reviews.data.meta.total === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {summary && (
        <div className="review-summary">
          <div className="review-score">
            <strong>{summary.avgRating ? Number(summary.avgRating).toFixed(1) : '-'}</strong>
            <Stars value={summary.avgRating} />
            <span>{summary.ratingCount || 0} ratings</span>
          </div>
          <p>Reviews come from signed-in customers. Verified purchases are marked.</p>
        </div>
      )}

      <div>
        {reviews.isLoading && <Spinner label="Loading reviews" />}
        {reviews.error && <ErrorNote error={reviews.error} onRetry={reviews.refetch} />}
        {reviews.data?.items?.map((review) => (
          <article key={review._id} className="review-card">
            <div className="review-head">
              <Stars value={review.rating} />
              {Boolean(review.verifiedPurchase) && (
                <span className="badge-verified"><i className="bi bi-patch-check-fill" aria-hidden="true" /> Verified purchase</span>
              )}
            </div>
            {review.title && <p className="review-title">{review.title}</p>}
            <p className="review-body">{review.body}</p>
            <p className="review-date">- {review.authorName}, {formatDate(review.createdAt)}</p>
          </article>
        ))}
        {!reviews.isLoading && !reviews.data?.items?.length && (
          <p className="result-count">No reviews yet - yours would be the first.</p>
        )}
        {reviews.data?.meta?.pages > 1 && (
          <div className="pagination pagination-start">
            <button type="button" className="text-link" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
            <span className="result-count">Page {page} of {reviews.data.meta.pages}</span>
            <button type="button" className="text-link" disabled={page >= reviews.data.meta.pages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        )}
      </div>

      <div className="panel review-form">
        <h3>Write a review</h3>
        {!isAuthed ? (
          <p className="result-count">
            <Link to={`/auth?next=/product/${slug}`} className="link">Sign in</Link> to review this piece.
          </p>
        ) : (
          <form onSubmit={submitReview} noValidate>
            <div className="field review-rating-field">
              <span className="option-label">Your rating</span>
              <RatingInput value={rating} onChange={setRating} />
            </div>
            <div className="field">
              <label htmlFor="review-title">Headline (optional)</label>
              <input id="review-title" value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="Great fit, slightly long sleeves" />
            </div>
            <div className="field">
              <label htmlFor="review-body">Review</label>
              <textarea id="review-body" rows={4} value={body} maxLength={2000} onChange={(event) => setBody(event.target.value)} placeholder="How did it fit, how is the fabric?" required minLength={5} />
            </div>
            {submitError && <ErrorNote error={submitError} compact />}
            {isSuccess && <p className="coupon-ok"><i className="bi bi-check-circle" aria-hidden="true" /> Thanks - your review is live.</p>}
            <button type="submit" className="btn" disabled={submitting || body.trim().length < 5}>
              {submitting ? 'Posting' : 'Post review'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

export default function ProductPage() {
  const { slug } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthed } = useAuth();
  const product = useGetProductQuery(slug);
  const related = useGetRelatedQuery(slug);
  const snap = useSelector(selectCartSnapshot);

  const [size, setSize] = useState(null);
  const [color, setColor] = useState(null);
  const [qty, setQty] = useState(1);
  const [lastSize, setLastSize] = useState(null);
  const [addedNote, setAddedNote] = useState(false);
  const [view, setView] = useState(0); // gallery crop view, legacy style
  const [tab, setTab] = useState('description');

  const data = product.data;
  const variants = data?.variants || [];

  useEffect(() => {
    if (!variants.length) return;
    const firstInStock = variants.find((variant) => variant.stock > 0) || variants[0];
    setColor(firstInStock.color);
    setSize(firstInStock.size);
    setLastSize(firstInStock.size);
    setView(0);
  }, [variants]);

  // colour-aware gallery: photos linked to the selected colour win, otherwise the
  // whole shareable gallery is shown (colour links come from admin variantImages)
  const galleryImages = useMemo(() => {
    const linked = (data?.variantImages || []).find((entry) => entry.color === color);
    return linked?.images?.length ? linked.images : data?.images || [];
  }, [data, color]);

  const colors = useMemo(() => {
    if (!variants.length) return [];
    const map = new Map();
    variants.forEach((variant) => {
      if (!map.has(variant.color)) map.set(variant.color, { count: 0, inStock: false });
      const entry = map.get(variant.color);
      entry.count += 1;
      entry.inStock = entry.inStock || variant.stock > 0;
    });
    return Array.from(map.entries()).map(([name, meta]) => ({ name, ...meta }));
  }, [variants]);

  const sizes = useMemo(() => {
    if (!variants.length) return [];
    const map = new Map();
    variants.forEach((variant) => {
      map.set(variant.size, { inStock: (map.get(variant.size)?.inStock || false) || variant.stock > 0 });
    });
    return Array.from(map.entries()).map(([name, meta]) => ({ name, ...meta }));
  }, [variants]);

  function pickSize(nextSize) {
    setSize(nextSize);
    setLastSize(nextSize);
    const sameSizes = variants.filter((variant) => variant.size === nextSize);
    const stillThere = sameSizes.find((variant) => variant.color === color);
    if (!stillThere) {
      const options = variants.filter((variant) => variant.size === nextSize && variant.stock > 0);
      if (options.length) setColor(options[0].color);
    }
    setQty(1);
    setAddedNote(false);
  }

  function pickColor(nextColor) {
    setColor(nextColor);
    const sameColors = variants.filter((variant) => variant.color === nextColor);
    if (!sameColors.some((variant) => variant.size === size)) {
      const sizesInColor = sameColors.map((variant) => variant.size);
      const fallback = lastSize && sizesInColor.includes(lastSize) ? lastSize : sizesInColor[0];
      setSize(fallback);
      setLastSize(fallback);
    }
    setView(0); // the gallery belongs to the colour - restart from its first photo
    setQty(1);
    setAddedNote(false);
  }

  const selectedSku = useMemo(() => {
    if (!size || !color) return null;
    return variants.find((variant) => variant.size === size && variant.color === color) || null;
  }, [variants, size, color]);

  const inCart = selectedSku ? snap.items.find((line) => line.item?.sku === selectedSku.sku) : null;

  async function handleAdd(buyNow = false) {
    if (!selectedSku) return;
    setAddedNote(false);
    const action = await dispatch(
      addToCart({
        productId: data._id,
        sku: selectedSku.sku,
        qty,
        product: {
          slug: data.slug,
          title: data.title,
          brand: data.brand,
          category: data.category,
          image: galleryImages[0] || data.images?.[0] || '', // the colour's photo leads
          unitPrice: selectedSku.price ?? data.price,
          mrp: data.mrp,
          size: selectedSku.size,
          color: selectedSku.color,
          stock: selectedSku.stock,
        },
      }),
    );
    // stock/limit conflicts surface from the server cart; never fake success on reject
    if (action.error) return;
    if (buyNow) {
      navigate(isAuthed ? '/checkout' : `/auth?next=${encodeURIComponent('/checkout')}`);
      return;
    }
    setAddedNote(true);
  }

  if (product.isLoading) return <Spinner label="Loading product" />;
  if (product.error || !data) {
    return (
      <div className="page-wrap">
        <ErrorNote error={product.error || { message: 'Product not found' }} onRetry={product.refetch} />
        <Link to="/shop" className="btn">Back to shop</Link>
      </div>
    );
  }

  // the selected variant's price wins (colour-group or per-size override), so the % off
  // shown is computed against that money - not the product-level derived price
  const shownPrice = selectedSku ? selectedSku.price ?? data.price : data.price;
  const discount = discountPercent(shownPrice, data.mrp);
  const soldOut = !selectedSku || selectedSku.stock <= 0;
  const qtyCap = selectedSku ? Math.max(1, Math.min(10, selectedSku.stock)) : 10;
  const cropMode = galleryImages.length <= 1; // a single photo keeps the legacy 3-crop view
  const safeView = Math.min(view, galleryImages.length - 1);
  const colourList = (data.colors || colors.map((entry) => entry.name)).filter(Boolean);

  return (
    <div className="container product-page">
      <nav className="breadcrumbs product-breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link> /
        <Link to={`/shop?category=${data.category}`}>{titleize(data.category)}</Link> /
        <span>{data.title}</span>
      </nav>

      <div className="product-gallery">
        <div className="product-main-image">
          <span className="card-media-fallback" aria-hidden="true">{(data.title || 'T').trim().charAt(0).toUpperCase()}</span>
          {galleryImages.length > 0 && (
            <img
              src={productImageUrl(cropMode ? galleryImages[0] : galleryImages[safeView])}
              alt={data.title}
              width="900"
              height="900"
              fetchpriority="high"
              style={cropMode ? { objectPosition: `center ${view * 18}%` } : undefined}
              onError={(event) => event.currentTarget.classList.add('img-failed')}
            />
          )}
          {discount && <span className="card-flag">{discount}</span>}
        </div>
        <div className="product-thumbs">
          {(cropMode ? [0, 1, 2] : galleryImages.map((_entry, at) => at)).map((index) => (
            <button
              key={index}
              type="button"
              className={`product-thumb ${cropMode && view === index ? 'active' : ''} ${!cropMode && safeView === index ? 'active' : ''}`}
              onClick={() => setView(index)}
              aria-label={`${data.title} view ${index + 1}`}
            >
              {cropMode ? (
                <img
                  src={productImageUrl(galleryImages[0])}
                  alt=""
                  style={{ objectPosition: `center ${index * 18}%` }}
                  onError={(event) => event.currentTarget.classList.add('img-failed')}
                />
              ) : (
                <img
                  src={productImageUrl(galleryImages[index])}
                  alt=""
                  onError={(event) => event.currentTarget.classList.add('img-failed')}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="product-detail">
        <p className="eyebrow">{titleize(data.category)} &middot; {data.brand}</p>
        <h1>{data.title}</h1>
        <div className="product-rating">
          <Stars value={data.avgRating} count={data.ratingCount} />
        </div>
        <p className="product-price">
          {formatINR(shownPrice)}
          {discount && <span className="price-was">{formatINR(data.mrp)}</span>}
        </p>
        <p className="product-desc">{data.description}</p>

        <div className="buy-form">
          <div className="option-group">
            <span className="option-label">Colour</span>
            <div className="size-options">
              {colors.map((entry) => (
                <button
                  key={entry.name}
                  type="button"
                  className={`size-chip ${color === entry.name ? 'active' : ''}`}
                  disabled={!entry.inStock}
                  aria-pressed={color === entry.name}
                  onClick={() => pickColor(entry.name)}
                >
                  {entry.name}
                </button>
              ))}
            </div>
          </div>

          <div className="option-group">
            <span className="option-label">Size</span>
            <div className="size-options">
              {sizes.map((entry) => (
                <button
                  key={entry.name}
                  type="button"
                  className={`size-chip ${size === entry.name ? 'active' : ''}`}
                  disabled={!entry.inStock}
                  aria-pressed={size === entry.name}
                  onClick={() => pickSize(entry.name)}
                >
                  {entry.name}
                </button>
              ))}
            </div>
          </div>

          {selectedSku ? (
            <p className={`stock-note ${selectedSku.stock <= 0 ? 'out' : selectedSku.stock <= 3 ? 'low' : 'ok'}`}>
              {selectedSku.stock <= 0
                ? 'This size and colour are sold out'
                : selectedSku.stock <= 3
                  ? `Only ${selectedSku.stock} left in ${selectedSku.size} - ${selectedSku.color}`
                  : 'In stock and ready to ship'}
            </p>
          ) : (
            <p className="stock-note">Pick a colour and size to check stock</p>
          )}

          <div className="pdp-cta">
            <QuantityStepper value={qty} max={selectedSku ? qtyCap : 1} onChange={(next) => setQty(Math.min(qtyCap, Math.max(1, next)))} />
            <button type="button" className="btn ghost" onClick={() => handleAdd(false)} disabled={soldOut}>
              Add to bag
            </button>
            <button type="button" className="btn" onClick={() => handleAdd(true)} disabled={soldOut}>
              Buy now
            </button>
            <WishlistHeart productId={data._id} large />
          </div>

          {addedNote && (
            <p className="coupon-ok" role="status">
              <i className="bi bi-check-circle" aria-hidden="true" />
              {inCart ? `Added - bag now holds ${inCart.item.qty} of ${selectedSku.size}` : 'Added to your bag'}
            </p>
          )}

          <ul className="trust-list">
            <li><i className="bi bi-cash-coin" aria-hidden="true" /> Cash on delivery available</li>
            <li><i className="bi bi-truck" aria-hidden="true" /> Free standard shipping over Rs 2,000</li>
            <li><i className="bi bi-arrow-repeat" aria-hidden="true" /> 7-day returns on unused pieces</li>
          </ul>
        </div>
      </div>

      <section className="product-tabs" aria-label="Piece details">
        <div className="tab-buttons" role="tablist" aria-label="Piece details">
          {[['description', 'Description'], ['details', 'Fabric and fit'], ['delivery', 'Delivery and returns']].map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`tab-${key}`}
              aria-selected={tab === key}
              aria-controls={`panel-${key}`}
              className={tab === key ? 'active' : ''}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="tab-panel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === 'description' && <p>{data.description || 'A quiet essential cut for everyday wear.'}</p>}
          {tab === 'details' && (
            <dl className="spec-list">
              <div><dt>Category</dt><dd>{titleize(data.category)}</dd></div>
              <div><dt>Brand</dt><dd>{data.brand || 'THREAD'}</dd></div>
              <div><dt>Colours</dt><dd>{colourList.length ? colourList.join(', ') : 'As shown'}</dd></div>
              <div><dt>Sizes</dt><dd>{sizes.length ? sizes.map((entry) => entry.name).join(', ') : 'One size'}</dd></div>
              <div><dt>Care</dt><dd>Cold wash, inside out. Line dry in shade.</dd></div>
            </dl>
          )}
          {tab === 'delivery' && (
            <>
              <p>Free standard shipping on orders over Rs 2,000. Orders under that ship at the standard courier rate shown at checkout.</p>
              <p>Cash on delivery is available across India. Online payment by UPI, card or netbanking runs through Razorpay.</p>
              <p>Unused pieces can be returned within 7 days of delivery. Start from the order page and keep the tags on.</p>
            </>
          )}
        </div>
      </section>

      <ReviewsSection slug={slug} summary={{ avgRating: data.avgRating, ratingCount: data.ratingCount }} />

      <section className="related-section" aria-label="Related products">
        <div className="section-head">
          <h2>Pairs well with</h2>
          <Link to={`/shop?category=${data.category}`} className="text-link">
            More {titleize(data.category)} <i className="bi bi-arrow-right" aria-hidden="true" />
          </Link>
        </div>
        <ProductGrid
          className="grid"
          items={related.data?.items}
          isLoading={related.isLoading}
          error={related.error}
          onRetry={related.refetch}
          emptyTitle="No related pieces yet"
        />
      </section>
    </div>
  );
}
