import mongoose from "mongoose";

const size = new mongoose.Schema({
  size: { type: String, required: true, trim: true },
  stock: { type: Number, required: true },
});

const variants = new mongoose.Schema({
  color: { type: String, required: true, trim: true },
  images: [{ type: String }],
  size: [size],
});

const productSchema = new mongoose.Schema(
  {
    category: { type: String, required: true, trim: true },
    subCategory: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true, unique: true },
    description: { type: String, required: true, trim: true },
    productInformation: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    price: { type: Number, required: true },
    design: {
      type: String,
      required: true,
      index: true,
    },
    label: { type: String, trim: true },
    averageRating: {
      type: Number,
      default: 0,
    },
    ratingCount: {
      type: Number,
      default: 0,
    },
    mrp: { type: Number, required: true },
    variants: {
      type: [variants],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

// Compound indexes for common query patterns
productSchema.index({ isActive: 1, createdAt: -1 }); // Latest products
productSchema.index({ isActive: 1, averageRating: -1, ratingCount: -1 }); // Popular products
productSchema.index({ category: 1, subCategory: 1, design: 1, price: 1 }); // Filter queries
productSchema.index({ name: "text", sku: "text", category: "text", subCategory: "text", design: "text" }); // Text search

const Product = mongoose.model("Product", productSchema);

export default Product;
