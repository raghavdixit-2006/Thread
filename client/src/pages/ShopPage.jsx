// pages/ShopPage.jsx - legacy shop language: search toolbar, chips row, meta, grid, pager.
// ES facets when q is present, Mongo filters otherwise; all state lives in the URL.
// Categories are independent toggles: any combination of two or more filters stays clickable.
// Price inputs are debounced so typing does not fire a request per keystroke.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useGetCategoriesQuery, useGetProductsQuery } from '../services/productsApi.js';
import ProductGrid from '../components/features/ProductGrid.jsx';
import SearchBox from '../components/features/SearchBox.jsx';
import Pagination from '../components/common/Pagination.jsx';
import useDebounce from '../hooks/useDebounce.js';
import { PRODUCT_SORTS, PRODUCT_SIZES } from '../utils/constants.js';
import { formatINR } from '../utils/format.js';

const PAGE_SIZE = 12;

export default function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const categories = useGetCategoriesQuery();

  const params = useMemo(() => {
    const query = {};
    for (const key of ['q', 'category', 'categories', 'brand', 'sizes', 'colors', 'minPrice', 'maxPrice', 'minRating', 'featured', 'sort']) {
      const value = searchParams.get(key);
      if (value) query[key] = value;
    }
    query.page = searchParams.get('page') || '1';
    query.limit = String(PAGE_SIZE);
    return query;
  }, [searchParams]);

  const search = useGetProductsQuery(params, { refetchOnMountOrArgChange: true });

  const meta = search.data?.meta;
  const categoriesList = categories.data?.items || [];
  const normalizedCategories = categoriesList.map((entry) => entry.slug || entry.category || entry);

  function patchParams(next) {
    const merged = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') merged.delete(key);
      else merged.set(key, String(value));
    });
    if (!('page' in next)) merged.set('page', '1');
    setSearchParams(merged);
  }

  // selected categories across BOTH param shapes (legacy single + new multi-select csv)
  const activeCategories = [
    ...(params.categories || '').toString().split(',').filter(Boolean),
    ...(params.category ? [params.category] : []),
  ];
  const activeSizes = (params.sizes || '').split(',').filter(Boolean);
  const activeColors = (params.colors || '').split(',').filter(Boolean);

  const facets = search.data?.facets;
  const facetBrands = facets?.brands?.map((b) => b.key || b) || [];
  const facetColors = facets?.colors?.map((c) => c.key || c) || [];
  const hasFacets = Boolean(params.q && facets);

  function toggleMulti(key, values, value) {
    const set = new Set(values);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    patchParams({ [key]: set.size ? Array.from(set).join(',') : '' });
  }

  /** categories are independent toggles writing one csv; the legacy key is retired on click */
  function toggleCategory(category) {
    const set = new Set(activeCategories.map(String));
    if (set.has(category)) set.delete(category);
    else set.add(category);
    patchParams({ category: '', categories: set.size ? Array.from(set).join(',') : '' });
  }

  const activeFilterCount =
    activeCategories.length +
    activeSizes.length +
    activeColors.length +
    (params.brand ? 1 : 0) +
    (params.minRating ? 1 : 0) +
    (params.minPrice ? 1 : 0) +
    (params.maxPrice ? 1 : 0);

  function clearAllFilters() {
    patchParams({ category: '', categories: '', brand: '', sizes: '', colors: '', minRating: '', minPrice: '', maxPrice: '' });
  }

  // ---- debounced price range -------------------------------------------------
  const [minInput, setMinInput] = useState('');
  const [maxInput, setMaxInput] = useState('');
  const debouncedMin = useDebounce(minInput, 450);
  const debouncedMax = useDebounce(maxInput, 450);
  const appliedPrice = useRef({ min: '', max: '' });

  // URL -> inputs (clear-all and shared links keep the fields honest)
  useEffect(() => {
    const nextMin = params.minPrice ? String(Number(params.minPrice) / 100) : '';
    const nextMax = params.maxPrice ? String(Number(params.maxPrice) / 100) : '';
    setMinInput((current) => (current === nextMin ? current : nextMin));
    setMaxInput((current) => (current === nextMax ? current : nextMax));
    appliedPrice.current = { min: params.minPrice || '', max: params.maxPrice || '' };
  }, [params.minPrice, params.maxPrice]);

  // inputs -> URL, only after the pause
  useEffect(() => {
    const minRupees = Number(debouncedMin);
    const maxRupees = Number(debouncedMax);
    const min = Number.isFinite(minRupees) && minRupees > 0 ? String(minRupees * 100) : '';
    const max = Number.isFinite(maxRupees) && maxRupees > 0 ? String(maxRupees * 100) : '';
    if (min === appliedPrice.current.min && max === appliedPrice.current.max) return;
    appliedPrice.current = { min, max };
    patchParams({ minPrice: min, maxPrice: max });
  }, [debouncedMin, debouncedMax]);

  const activeChips = useMemo(() => {
    const chips = [];
    activeCategories.forEach((value) => chips.push({ key: `cat-${value}`, label: value, onRemove: () => toggleCategory(value) }));
    activeSizes.forEach((value) => chips.push({ key: `size-${value}`, label: `Size ${value}`, onRemove: () => toggleMulti('sizes', activeSizes, value) }));
    activeColors.forEach((value) => chips.push({ key: `color-${value}`, label: value, onRemove: () => toggleMulti('colors', activeColors, value) }));
    if (params.brand) chips.push({ key: 'brand', label: params.brand, onRemove: () => patchParams({ brand: '' }) });
    if (params.minRating) chips.push({ key: 'rating', label: `${params.minRating}+ stars`, onRemove: () => patchParams({ minRating: '' }) });
    if (params.minPrice || params.maxPrice) {
      const low = params.minPrice ? formatINR(Number(params.minPrice)) : 'Any';
      const high = params.maxPrice ? formatINR(Number(params.maxPrice)) : 'Any';
      chips.push({ key: 'price', label: `${low} to ${high}`, onRemove: () => patchParams({ minPrice: '', maxPrice: '' }) });
    }
    return chips;
  }, [params.categories, params.category, params.sizes, params.colors, params.brand, params.minRating, params.minPrice, params.maxPrice]);

  return (
    <div className="container shop-page">
      <section className="page-head">
        <h1>The shop</h1>
        <p>
          {params.q
            ? `Showing matches for "${params.q}". Refine with the filter panel.`
            : 'Every piece with honest variant stock. Combine categories, sizes, ratings and price in the filter panel.'}
        </p>
      </section>

      <div className="shop-toolbar">
        <SearchBox />
        <span className="sort-box">
          <span>Sort by</span>
          <select aria-label="Sort products" value={params.sort || 'featured'} onChange={(event) => patchParams({ sort: event.target.value })}>
            {PRODUCT_SORTS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </span>

        <button
          type="button"
          className={`filter-icon ${filtersOpen || activeFilterCount > 0 ? 'engaged' : ''}`}
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          aria-controls="shop-filter-panel"
          aria-label={filtersOpen ? 'Hide filters' : 'Show filters'}
          title={filtersOpen ? 'Hide filters' : 'Show filters'}
        >
          <i className="bi bi-funnel" aria-hidden="true" />
          {activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}
        </button>
        <button
          type="button"
          className="filter-icon"
          onClick={clearAllFilters}
          disabled={activeFilterCount === 0}
          aria-label="Clear every filter"
          title="Clear every filter"
        >
          <i className="bi bi-x-circle" aria-hidden="true" />
        </button>
      </div>

      {activeChips.length > 0 && (
        <div className="active-filters" aria-label="Active filters">
          {activeChips.map((chip) => (
            <button key={chip.key} type="button" className="active-chip" onClick={chip.onRemove}>
              {chip.label}
              <i className="bi bi-x" aria-hidden="true" />
              <span className="sr-only">Remove filter</span>
            </button>
          ))}
          <button type="button" className="text-link" onClick={clearAllFilters}>Clear all</button>
        </div>
      )}

      {filtersOpen && (
        <section id="shop-filter-panel" className="shop-filter-panel" aria-label="Filters">
          <div className="filter-group">
            <p className="filter-label">Category</p>
            <div className="filters">
              {normalizedCategories.length === 0 && <span className="result-count">Categories appear once the catalogue is grouped.</span>}
              {normalizedCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`chip ${activeCategories.includes(category) ? 'active' : ''}`}
                  aria-pressed={activeCategories.includes(category)}
                  onClick={() => toggleCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <p className="filter-label">Size and rating</p>
            <div className="filters">
              {PRODUCT_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={`chip ${activeSizes.includes(size) ? 'active' : ''}`}
                  aria-pressed={activeSizes.includes(size)}
                  onClick={() => toggleMulti('sizes', activeSizes, size)}
                >
                  {size}
                </button>
              ))}
              <span className="filter-divider" aria-hidden="true" />
              {[4, 3, 2].map((min) => (
                <button
                  key={min}
                  type="button"
                  className={`chip ${params.minRating === String(min) ? 'active' : ''}`}
                  aria-pressed={params.minRating === String(min)}
                  onClick={() => patchParams({ minRating: params.minRating === String(min) ? '' : min })}
                >
                  {min}+ stars
                </button>
              ))}
            </div>
          </div>

          {hasFacets && facetColors.length > 0 && (
            <div className="filter-group">
              <p className="filter-label">Colour</p>
              <div className="filters">
                {facetColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`chip ${activeColors.map((c) => c.toLowerCase()).includes(String(color).toLowerCase()) ? 'active' : ''}`}
                    aria-pressed={activeColors.map((c) => c.toLowerCase()).includes(String(color).toLowerCase())}
                    onClick={() => toggleMulti('colors', activeColors, color)}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasFacets && facetBrands.length > 0 && (
            <div className="filter-group">
              <p className="filter-label">Brand</p>
              <div className="filters">
                {facetBrands.map((brand) => (
                  <button
                    key={brand}
                    type="button"
                    className={`chip ${params.brand === brand ? 'active' : ''}`}
                    aria-pressed={params.brand === brand}
                    onClick={() => patchParams({ brand: params.brand === brand ? '' : brand })}
                  >
                    {brand}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="filter-group">
            <p className="filter-label">Price in rupees</p>
            <div className="price-fields">
              <span className="field">
                <label htmlFor="shop-min">Minimum</label>
                <input
                  id="shop-min"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="0"
                  value={minInput}
                  onChange={(event) => setMinInput(event.target.value)}
                />
              </span>
              <span className="field">
                <label htmlFor="shop-max">Maximum</label>
                <input
                  id="shop-max"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="Any"
                  value={maxInput}
                  onChange={(event) => setMaxInput(event.target.value)}
                />
              </span>
            </div>
          </div>
        </section>
      )}

      <div className="shop-meta">
        <span className="result-count">
          {meta ? `${meta.total} piece${meta.total === 1 ? '' : 's'}` : 'Counting pieces'}
        </span>
        {params.q && (
          <Link className="text-link" to="/shop">
            Clear search <i className="bi bi-x" aria-hidden="true" />
          </Link>
        )}
      </div>

      <ProductGrid
        className={`grid shop-grid ${search.isFetching && !search.isLoading ? 'is-busy' : ''}`}
        items={search.data?.items}
        isLoading={search.isLoading}
        error={search.error}
        onRetry={() => search.refetch()}
        emptyTitle="No matches"
        emptyText={params.q ? 'Nothing came back for that search. Try fewer or different words.' : 'Filters carved out everything. Clear a chip or two to widen the shop.'}
        emptyLink="/shop"
        emptyLinkLabel="Clear search and filters"
      />

      <Pagination meta={meta} onNavigate={(nextPage) => patchParams({ page: nextPage })} />
    </div>
  );
}
