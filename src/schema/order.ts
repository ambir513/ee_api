import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    paymentId: {
      type: String,
    },
    razorpayOrderId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
    },
    receipt: {
      type: String,
      required: true,
    },
    notes: {
      name: {
        type: String,
      },
      email: {
        type: String,
      },
      products: {
        type: Object,
      },
      offer: {
        type: String,
      },
      address: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Address",
      },
    },
  },
  { timestamps: true },
);

const Order = mongoose.model("Order", orderSchema);

export default Order;
