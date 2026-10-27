// models/productModel.js - product with variant-level SKU/stock, money in paise.
import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, trim: true, uppercase: true },
    size: { type: String, required: true, trim: true, enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
    color: { type: String, required: true, trim: true, maxlength: 30 },
    stock: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 }, // paise; falls back to parent price when omitted
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 140 },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    images: { type: [String], default: [] },
    category: { type: String, required: true, lowercase: true, trim: true, enum: ['jackets', 'dresses', 'shirts', 't-shirts', 'jeans', 'sweaters'] },
    brand: { type: String, required: true, default: 'THREAD', trim: true, maxlength: 60 },
    price: { type: Number, required: true, min: 0 }, // paise - selling price, derived server-side from mrp + discountPercent
    mrp: { type: Number, required: true, min: 0 }, // list price, must be >= price
    discountPercent: { type: Number, default: 0, min: 0, max: 90 }, // admin-entered % off
    variants: { type: [variantSchema], default: [] },
    variantImages: { type: [{ color: { type: String, trim: true }, images: { type: [String], default: [] } }], default: [] }, // colour-group photo links into the gallery
    colors: { type: [String], default: [] },
    sizes: { type: [String], default: [] },
    avgRating: { type: Number, min: 0, max: 5, default: 0 },
    ratingCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, toJSON: { versionKey: false } },
);

productSchema.index({ isActive: 1, category: 1 });
productSchema.index({ isActive: 1, brand: 1 });
productSchema.index({ isActive: 1, price: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ isFeatured: 1, isActive: 1 });
productSchema.index({ 'variants.sku': 1 }, { unique: true, sparse: true });

// weighted text index for the Mongo q-search fallback + admin list search
// ($text drives productsDal.listAllAdmin) - one text index per collection
productSchema.index(
  { title: 'text', description: 'text', brand: 'text', colors: 'text' },
  { name: 'search_text', weights: { title: 5, brand: 3, colors: 2, description: 1 }, default_language: 'english' },
);

export const Product = mongoose.model('Product', productSchema);
