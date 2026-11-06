// pages/HomePage.jsx - editorial home: hero slideshow, trust strip, featured grid,
// category tiles with photography, story band. Landing photography is bundled locally in
// client/public/landing (static brand assets); only the catalogue grid talks to the API.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGetFeaturedQuery, useGetCategoriesQuery } from '../services/productsApi.js';
import ProductGrid from '../components/features/ProductGrid.jsx';
import ErrorNote from '../components/common/ErrorNote.jsx';
import { titleize } from '../utils/format.js';

// bundled static art direction - replacing a file here changes the landing page,
// independent of whatever is in the product catalogue / Cloudinary
const LANDING = '/landing';
const HERO_SLIDES = [
  { src: `${LANDING}/hero-1.jpg`, alt: 'Beige tailored jacket from the winter drop' },
  { src: `${LANDING}/hero-2.jpg`, alt: 'Black relaxed jacket styled for the city' },
  { src: `${LANDING}/hero-3.jpg`, alt: 'Brown formal jacket from the THREAD collection' },
];
const CATEGORY_COVERS = {
  jackets: `${LANDING}/category-jackets.jpg`,
  shirts: `${LANDING}/category-shirts.jpg`,
  't-shirts': `${LANDING}/category-t-shirts.jpg`,
  default: `${LANDING}/category-fallback.jpg`,
};
const STORY_IMAGE = `${LANDING}/story.jpg`;
const coverFor = (slug) => {
  const key = String(slug || '').toLowerCase();
  if (!key) return CATEGORY_COVERS.default;
  if (CATEGORY_COVERS[key]) return CATEGORY_COVERS[key];
  // tolerate singular/plural catalogue labels (jacket <-> jackets, tee <-> t-shirts)
  const match = Object.keys(CATEGORY_COVERS).find(
    (name) => name !== 'default' && (key.includes(name) || name.includes(key)),
  );
  return match ? CATEGORY_COVERS[match] : CATEGORY_COVERS.default;
};

function CategoryTileSkeleton() {
  return (
    <div className="category-tile is-skeleton" aria-hidden="true">
      <div className="skeleton-block category-skeleton" />
    </div>
  );
}

export default function HomePage() {
  const featured = useGetFeaturedQuery();
  const categories = useGetCategoriesQuery();
  const featuredItems = featured.data?.items || [];
  const slides = HERO_SLIDES;
  const slideCount = slides.length;
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );

  // auto-advance until the visitor pauses or takes the arrows
  useEffect(() => {
    if (slideCount < 2 || paused) return undefined;
    const timer = setInterval(() => setSlide((n) => (n + 1) % slideCount), 6000);
    return () => clearInterval(timer);
  }, [slideCount, paused]);

  const categoryTiles = useMemo(() => {
    const list = categories.data?.items || [];
    return list.slice(0, 3).map((category) => {
      const slug = category.slug || category.category || category;
      const name = category.name || titleize(String(slug));
      return { slug, name, image: coverFor(slug) };
    });
  }, [categories.data]);

  function heroStep(next) {
    setPaused(true);
    setSlide((current) => {
      if (slideCount < 2) return current;
      const value = current + next;
      if (value < 0) return slideCount - 1;
      if (value >= slideCount) return 0;
      return value;
    });
  }

  return (
    <>
      <section className="hero" aria-label="Featured drop">
        <div className="hero-copy">
          <p className="eyebrow">New season - Winter drop</p>
          <h1>Dress like the workload is light</h1>
          <p className="lead">
            Editorial jackets, relaxed shirts and soft cotton tees. Free standard shipping over
            Rs 2,000, cash on delivery across India.
          </p>
          <Link to="/shop" className="btn">Shop the winter drop</Link>
        </div>

        <div className="hero-media">
          {slides.map((entry, index) => (
            <img
              key={entry.src || index}
              className={`hero-slide ${index === slide ? 'active' : ''}`}
              src={entry.src}
              alt={entry.alt}
              width="960"
              height="1200"
              loading={index === 0 ? 'eager' : 'lazy'}
              fetchpriority={index === 0 ? 'high' : 'auto'}
            />
          ))}
          {slides.length === 0 && <span className="placeholder-block hero-placeholder" />}
          <div className="hero-controls">
            <button type="button" className="hero-arrow" onClick={() => heroStep(-1)} aria-label="Previous slide">
              <i className="bi bi-chevron-left" aria-hidden="true" />
            </button>
            <button type="button" className="hero-arrow" onClick={() => heroStep(1)} aria-label="Next slide">
              <i className="bi bi-chevron-right" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="hero-arrow"
              onClick={() => setPaused((value) => !value)}
              aria-label={paused ? 'Play the slideshow' : 'Pause the slideshow'}
              aria-pressed={paused}
            >
              <i className={`bi ${paused ? 'bi-play-fill' : 'bi-pause-fill'}`} aria-hidden="true" />
            </button>
          </div>
          <span className="hero-counter">
            <span data-hero-index>{String(slide + 1).padStart(2, '0')}</span> / {String(Math.max(1, slideCount)).padStart(2, '0')}
          </span>
        </div>
      </section>

      <div className="container">
        <div className="trust-strip">
          <div className="trust-item">
            <span className="trust-icon"><i className="bi bi-truck" aria-hidden="true" /></span>
            <div>
              <h3>Free shipping</h3>
              <p>On orders above Rs 2,000</p>
            </div>
          </div>
          <div className="trust-item">
            <span className="trust-icon"><i className="bi bi-arrow-repeat" aria-hidden="true" /></span>
            <div>
              <h3>Easy returns</h3>
              <p>7-day return window</p>
            </div>
          </div>
          <div className="trust-item">
            <span className="trust-icon"><i className="bi bi-shield-check" aria-hidden="true" /></span>
            <div>
              <h3>Pay on delivery</h3>
              <p>Cash when the parcel arrives</p>
            </div>
          </div>
        </div>

        <section className="section" aria-labelledby="featured-heading">
          <div className="section-head">
            <h2 id="featured-heading">Featured this week</h2>
            <Link to="/shop?sort=featured" className="text-link">
              View all <i className="bi bi-arrow-right" aria-hidden="true" />
            </Link>
          </div>
          <ProductGrid
            items={featuredItems}
            isLoading={featured.isLoading}
            error={featured.error}
            onRetry={featured.refetch}
            className="grid featured"
            emptyTitle="No featured pieces right now"
            emptyText="The editors are still picking. Check the full shop meanwhile."
            emptyLink="/shop"
          />
        </section>

        <section className="section" aria-labelledby="category-heading">
          <div className="section-head">
            <h2 id="category-heading">Shop by category</h2>
            <Link to="/shop" className="text-link">
              The full shop <i className="bi bi-arrow-right" aria-hidden="true" />
            </Link>
          </div>

          {categories.isLoading && (
            <div className="category-grid">
              {[0, 1, 2].map((key) => <CategoryTileSkeleton key={key} />)}
            </div>
          )}

          {categories.error && <ErrorNote error={categories.error} onRetry={categories.refetch} />}

          {!categories.isLoading && !categories.error && categoryTiles.length === 0 && (
            <div className="category-empty">
              <p>Categories appear here once the catalogue is grouped. The full shop is already open.</p>
              <Link to="/shop" className="text-link">
                Browse every piece <i className="bi bi-arrow-right" aria-hidden="true" />
              </Link>
            </div>
          )}

          {categoryTiles.length > 0 && (
            <div className="category-grid">
              {categoryTiles.map((tile) => (
                <Link key={tile.slug} to={`/shop?category=${tile.slug}`} className="category-tile">
                  <img src={tile.image} alt={`${tile.name} collection`} width="720" height="465" loading="lazy" />
                  <span className="category-label">{tile.name} <span aria-hidden="true">&rarr;</span></span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="story" aria-label="About THREAD">
          <div className="story-copy">
            <p className="eyebrow">Our story</p>
            <h2>A simpler wardrobe.</h2>
            <p>
              Honest fabric, square prices, and a catalog you can actually reach the end of.
              Every piece ships with its true stock and lands with the courier carrying the bill.
            </p>
            <Link to="/policies/shipping-policy" className="text-link">
              How delivery works <i className="bi bi-arrow-right" aria-hidden="true" />
            </Link>
          </div>
          <div className="story-media">
            <img src={STORY_IMAGE} alt="THREAD essentials" width="800" height="600" loading="lazy" />
          </div>
        </section>
      </div>
    </>
  );
}
