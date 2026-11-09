// hooks/useProductForm.js - admin product form state: base fields, ordered image
// gallery (with colour links), colour groups with per-size stock.
// Money: the admin enters MRP + discount % (blank = 0) and the SERVER derives the
// selling price from them - no selling-price field is ever sent. Variant colour groups
// and per-size overrides stay absolute rupees (blank inherits the derived price).
// Photos: the gallery is the single ordered store of images; each entry may carry a
// colour tag ({url, color}). Tags group into the variantImages payload sent to the
// server, which validates them against the variant colours. Renaming or removing a
// colour group remaps its tags so the payload can never reference a deleted colour.
import { useCallback, useState } from 'react';
import { PRODUCT_CATEGORIES, PRODUCT_SIZES } from '../utils/constants.js';

export const MAX_IMAGES = 8;

const blankRow = (size = PRODUCT_SIZES[0]) => ({ size, stock: '', price: '' });
const blankGroup = (size) => ({ color: '', price: '', sizes: [blankRow(size)] });

const BLANK = {
  title: '',
  description: '',
  category: PRODUCT_CATEGORIES[0],
  brand: 'THREAD',
  mrpRupees: '',
  discountPercent: '', // blank = 0% off; 0-90, entered by the admin
  images: [], // [{url, color}] - color '' means shared across all colours
  isFeatured: false,
  isActive: true,
  groups: [blankGroup(PRODUCT_SIZES[2])],
};

const rupeesToPaise = (value) => {
  const digits = String(value).replace(/[^\d.]/g, '');
  if (!digits || digits === '.') return null;
  const paise = Math.round(Number(digits) * 100);
  return Number.isFinite(paise) && paise > 0 ? paise : null;
};

/** mirrors the server's derivedPrice: selling price always round(mrp x (100 - pct) / 100) */
export function derivedPricePaise(mrpRupees, discountInput) {
  const mrp = rupeesToPaise(mrpRupees);
  if (!mrp) return null;
  const pct = Number(String(discountInput).replace(/\D/g, '') || 0);
  return Math.round((mrp * (100 - pct)) / 100);
}

/** legacy rows were stored without a percent - solve it so their % off survives an edit */
function solvedPercent(price, mrp) {
  return mrp > 0 && price > 0 && mrp > price ? Math.min(90, Math.round(((mrp - price) / mrp) * 100)) : 0;
}

/** edit mode: rebuild form state from the stored product */
function fromProduct(source) {
  // url -> owning colour, so gallery photos load with their colour links intact
  const owner = new Map();
  for (const link of source.variantImages || []) {
    for (const url of link.images || []) owner.set(url, link.color);
  }
  const order = [];
  const byColor = new Map();
  for (const variant of source.variants || []) {
    if (!byColor.has(variant.color)) {
      byColor.set(variant.color, { color: variant.color, price: '', sizes: [] });
      order.push(variant.color);
    }
    byColor.get(variant.color).sizes.push({
      size: variant.size,
      stock: String(variant.stock ?? 0),
      price: variant.price != null ? String(variant.price / 100) : '', // rupees shown, paise submitted
    });
  }
  // group price prefill: when every row of a colour shares one price it becomes the
  // group price (rows blank); mixed prices stay row-level so a save round-trips exactly
  const groups = order.map((color) => {
    const group = byColor.get(color);
    const prices = [...new Set(group.sizes.map((row) => row.price))];
    if (prices.length === 1 && prices[0] !== '') {
      group.price = prices[0];
      group.sizes = group.sizes.map((row) => ({ ...row, price: '' }));
    }
    return group;
  });
  return {
    title: source.title || '',
    description: source.description || '',
    category: PRODUCT_CATEGORIES.includes(source.category) ? source.category : PRODUCT_CATEGORIES[0],
    brand: source.brand || 'THREAD',
    mrpRupees: source.mrp != null ? String(source.mrp / 100) : '',
    discountPercent: String(source.discountPercent ?? solvedPercent(source.price, source.mrp)),
    images: [...(source.images || [])].map((url) => ({ url, color: owner.get(url) || '' })),
    isFeatured: Boolean(source.isFeatured),
    isActive: source.isActive !== false,
    groups: groups.length ? groups : [blankGroup()],
  };
}

export default function useProductForm(product) {
  const [form, setForm] = useState(product ? fromProduct(product) : BLANK);
  const [errors, setErrors] = useState({});

  const setField = useCallback((key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: null }));
  }, []);

  // ---- ordered gallery (index 0 = main image everywhere in the shop) ----
  const setImages = useCallback((images) => {
    setForm((current) => ({ ...current, images: images.slice(0, MAX_IMAGES) }));
    setErrors((current) => ({ ...current, images: null, photos: null }));
  }, []);
  const removeImage = useCallback((index) => {
    setForm((current) => ({ ...current, images: current.images.filter((_v, at) => at !== index) }));
  }, []);
  const makeMain = useCallback((index) => {
    setForm((current) => {
      if (index <= 0) return current;
      const images = [...current.images];
      const [picked] = images.splice(index, 1);
      return { ...current, images: [picked, ...images] };
    });
  }, []);
  /** tag gallery photos to colours: a colour backs at most one photo (tag moves) */
  const setPhotoColor = useCallback((index, color) => {
    setForm((current) => {
      const images = current.images.map((entry, at) =>
        at === index
          ? { ...entry, color }
          : entry.color && color && entry.color.toLowerCase() === color.toLowerCase()
            ? { ...entry, color: '' } // the tag moves; the previous owner loses it
            : entry,
      );
      return { ...current, images };
    });
    setErrors((current) => ({ ...current, photos: null }));
  }, []);

  // ---- colour groups ----
  const setGroupField = useCallback((groupIndex, key, value) => {
    setForm((current) => {
      if (key !== 'color') {
        return { ...current, groups: current.groups.map((group, at) => (at === groupIndex ? { ...group, [key]: value } : group)) };
      }
      // renaming a colour remaps its photo tags so links follow the rename
      const renamed = current.groups[groupIndex].color;
      const groups = current.groups.map((group, at) => (at === groupIndex ? { ...group, color: value } : group));
      const images = current.images.map((entry) => {
        const tag = entry.color.trim().toLowerCase();
        return tag && renamed.trim().toLowerCase() === tag ? { ...entry, color: value } : entry;
      });
      return { ...current, groups, images };
    });
    setErrors((current) => ({ ...current, [`g${groupIndex}-${key}`]: null, photos: null }));
  }, []);

  const addGroup = useCallback(() => {
    setForm((current) => ({ ...current, groups: [...current.groups, blankGroup()] }));
  }, []);

  const removeGroup = useCallback((groupIndex) => {
    setForm((current) => {
      const removed = current.groups[groupIndex].color.trim().toLowerCase();
      const images = current.images.map((entry) =>
        removed && entry.color.trim().toLowerCase() === removed ? { ...entry, color: '' } : entry,
      );
      return { ...current, groups: current.groups.filter((_g, at) => at !== groupIndex), images };
    });
  }, []);

  const addRow = useCallback((groupIndex) => {
    setForm((current) => ({
      ...current,
      groups: current.groups.map((group, at) => {
        if (at !== groupIndex) return group;
        const used = group.sizes.map((row) => row.size);
        const free = PRODUCT_SIZES.find((size) => !used.includes(size));
        return { ...group, sizes: [...group.sizes, blankRow(free || PRODUCT_SIZES[0])] };
      }),
    }));
    setErrors((current) => ({ ...current, [`g${groupIndex}-rows`]: null }));
  }, []);

  const setRow = useCallback((groupIndex, rowIndex, key, value) => {
    setForm((current) => ({
      ...current,
      groups: current.groups.map((group, at) =>
        at === groupIndex ? { ...group, sizes: group.sizes.map((row, at2) => (at2 === rowIndex ? { ...row, [key]: value } : row)) } : group,
      ),
    }));
    setErrors((current) => ({ ...current, [`g${groupIndex}-r${rowIndex}-${key}`]: null }));
  }, []);

  const removeRow = useCallback((groupIndex, rowIndex) => {
    setForm((current) => ({
      ...current,
      groups: current.groups.map((group, at) => (at === groupIndex ? { ...group, sizes: group.sizes.filter((_r, at2) => at2 !== rowIndex) } : group)),
    }));
  }, []);

  /** client-side shape check; the server schema remains the source of truth (422 -> ErrorNote) */
  function validate() {
    const issues = {};
    if (form.title.trim().length < 3) issues.title = 'At least 3 characters';
    if (form.description.trim().length < 10) issues.description = 'At least 10 characters';
    const mrp = rupeesToPaise(form.mrpRupees);
    if (!mrp) issues.mrpRupees = 'Enter an MRP in rupees';
    const discount = String(form.discountPercent).replace(/\D/g, '');
    if (discount && Number(discount) > 90) issues.discountPercent = 'A discount can be at most 90% off';
    if (form.images.length === 0) issues.images = 'Add at least one image - upload a file or paste an image URL';
    if (form.groups.length === 0) issues.groups = 'Add at least one colour variant';
    form.groups.forEach((group, gi) => {
      if (!group.color.trim()) issues[`g${gi}-color`] = 'Colour / variant name is needed';
      if (group.price && !rupeesToPaise(group.price)) issues[`g${gi}-price`] = 'Enter a price in rupees or leave blank';
      const used = new Set();
      group.sizes.forEach((row, ri) => {
        if (!row.size) issues[`g${gi}-r${ri}-size`] = 'Pick a size';
        if (used.has(row.size)) issues[`g${gi}-r${ri}-size`] = 'This size is already in the colour';
        used.add(row.size);
        if (!/^\d+$/.test(String(row.stock).trim())) issues[`g${gi}-r${ri}-stock`] = 'Stock is a whole number (0 allowed)';
      });
      if (group.sizes.length === 0) issues[`g${gi}-rows`] = 'Add at least one size row to this colour';
    });
    // colour links must point at a colour typed into the variant groups above
    const typed = new Set(form.groups.map((g) => g.color.trim().toLowerCase()).filter(Boolean));
    const stray = form.images.find((entry) => entry.color.trim() && !typed.has(entry.color.trim().toLowerCase()));
    if (stray) issues.photos = `Linked photo "${stray.url.slice(0, 60)}" has no matching colour above`;
    setErrors(issues);
    if (Object.keys(issues).length > 0) return null;
    // colour-photo links grouped in gallery order; untagged photos stay shared
    const linkMap = new Map();
    form.images.forEach(({ url, color }) => {
      const owner = color.trim();
      if (!owner) return;
      if (!linkMap.has(owner)) linkMap.set(owner, []);
      linkMap.get(owner).push(url);
    });
    // expand colour groups into the flat rows the API stores; SKU is derived server-side
    return {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      brand: form.brand.trim() || 'THREAD',
      mrp: rupeesToPaise(form.mrpRupees),
      discountPercent: Number(discount || 0), // selling price derives server-side from this
      images: form.images.map((entry) => entry.url), // ordered; index 0 is the main image
      isFeatured: Boolean(form.isFeatured),
      isActive: Boolean(form.isActive),
      ...(linkMap.size ? { variantImages: [...linkMap].map(([color, images]) => ({ color, images })) } : {}),
      variants: form.groups.flatMap((group) =>
        group.sizes.map((row) => ({
          size: row.size,
          color: group.color.trim(),
          stock: Number(String(row.stock).replace(/\D/g, '') || 0),
          // row override wins, then the group price, then the derived price (server fallback)
          price: rupeesToPaise(row.price) ?? rupeesToPaise(group.price) ?? undefined,
        })),
      ),
    };
  }

  return {
    form,
    errors,
    setField,
    setImages,
    removeImage,
    makeMain,
    setPhotoColor,
    setGroupField,
    addGroup,
    removeGroup,
    addRow,
    setRow,
    removeRow,
    validate,
  };
}

export { rupeesToPaise };

