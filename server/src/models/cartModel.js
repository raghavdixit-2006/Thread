// models/cartModel.js - server cart (merges from guest local storage on login).
import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String, required: true, uppercase: true },
    qty: { type: Number, required: true, min: 1, max: 10 },
    priceAtAdd: { type: Number, required: true, min: 0 }, // paise, informational only
  },
  { _id: false },
);

const cartSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true, toJSON: { versionKey: false, transform: (doc, ret) => ret } },
);

export const Cart = mongoose.model('Cart', cartSchema);
