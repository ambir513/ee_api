import mongoose from "mongoose";

const AddToCartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: {
      type: [
        {
          productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
          },
          color: {
            type: String,
            required: true,
            trim: true,
          },
          size: {
            type: String,
            required: true,
            trim: true,
          },
          quantity: {
            type: Number,
            min: 1,
            default: 1,
          },
          totalPrice: {
            type: Number,
            required: true,
          },
        },
      ],
    },
  },
  { timestamps: true },
);

const AddToCart = mongoose.model("AddToCart", AddToCartSchema);
export default AddToCart;
