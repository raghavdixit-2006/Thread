// models/categoryModel.js
import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 60 },
    description: { type: String, default: '', maxlength: 300 },
    order: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: { versionKey: false } },
);

categorySchema.index({ order: 1 });

export const Category = mongoose.model('Category', categorySchema);
