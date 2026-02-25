import express from "express";
import asyncHandler from "../../../utils/async-handler.js";
import response from "../../../utils/response.js";
import Product from "../../../schema/product.js";
import AddToCart from "../../../schema/addtocart.js";
import checkCookies from "../../../utils/m-check-cookies.js";

const router = express.Router();

// Add to cart — POST /create/:productId  body: { color, size }
router.post(
  "/create/:productId",
  checkCookies,
  asyncHandler(async (req, res) => {
    const productId = req.params.productId;
    const { color, size } = req.body;

    if (!productId) {
      return response.failure(res, "Product ID is required", 404);
    }
    if (!color || !size) {
      return response.failure(res, "Color and size are required", 400);
    }

    const productExist = await Product.findById(productId).lean() as any;

    if (!productExist) {
      return response.failure(res, "Product not found", 404);
    }

    // Check stock for the specific variant + size
    const variant = productExist.variants?.find((v: any) => v.color === color);
    if (!variant) {
      return response.failure(res, "Variant not found", 404);
    }
    const sizeEntry = variant.size?.find((s: any) => s.size === size);
    if (!sizeEntry || sizeEntry.stock <= 0) {
      return response.failure(res, "Selected size is out of stock", 400);
    }

    // Check if the same product+color+size already exists in user's cart
    const existingCart = await AddToCart.findOne({
      userId: req?._id!,
      "items.productId": productExist._id,
      "items.color": color,
      "items.size": size,
    });

    if (existingCart) {
      return response.failure(res, "Product already in cart", 400);
    }

    // Check if user already has a cart document, if so push to items array
    const userCart = await AddToCart.findOne({ userId: req?._id! });

    if (userCart) {
      userCart.items.push({
        productId: productExist._id,
        color,
        size,
        quantity: 1,
        totalPrice: productExist.price,
      });
      await userCart.save();

      return response.success(
        res,
        "Product added to cart successfully",
        202,
        userCart,
      );
    }

    // Create a new cart
    const addToCart = await AddToCart.create({
      userId: req?._id!,
      items: [
        {
          productId: productExist._id,
          color,
          size,
          quantity: 1,
          totalPrice: productExist.price,
        },
      ],
    });

    return response.success(
      res,
      "Product added to cart successfully",
      202,
      addToCart,
    );
  }),
);

// Update quantity — POST /update/:itemId  body: { quantity }
router.post(
  "/update/:itemId",
  checkCookies,
  asyncHandler(async (req, res) => {
    const itemId = req.params.itemId;

    if (!itemId) {
      return response.failure(res, "Item ID is required", 404);
    }

    const quantity = Math.max(1, req.body.quantity);

    const cart = await AddToCart.findOne({
      userId: req?._id!,
      "items._id": itemId,
    }).populate("items.productId");

    if (!cart) {
      return response.failure(res, "Item not found in cart", 404);
    }

    const cartItem = cart.items.find(
      (i: any) => i._id.toString() === itemId,
    ) as any;

    if (!cartItem) {
      return response.failure(res, "Item not found in cart", 404);
    }

    const product = cartItem.productId as any;

    // Check stock for the specific variant + size
    const variant = product.variants?.find(
      (v: any) => v.color === cartItem.color,
    );
    const sizeEntry = variant?.size?.find(
      (s: any) => s.size === cartItem.size,
    );
    const maxStock = sizeEntry?.stock ?? 0;

    if (quantity > maxStock) {
      return response.failure(
        res,
        `Only ${maxStock} items available in stock`,
        400,
      );
    }

    const updatedCart = await AddToCart.findOneAndUpdate(
      {
        userId: req?._id!,
        "items._id": itemId,
      },
      {
        $set: {
          "items.$.quantity": quantity,
          "items.$.totalPrice": quantity * product.price,
        },
      },
      { new: true },
    );

    return response.success(
      res,
      "Product quantity updated successfully",
      202,
      updatedCart,
    );
  }),
);

// Get all cart items — GET /all
router.get(
  "/all",
  checkCookies,
  asyncHandler(async (req, res) => {
    const cart = await AddToCart.findOne({
      userId: req._id!,
    })
      .populate("items.productId")
      .lean();

    if (!cart) {
      return response.failure(res, "Cart is empty", 404);
    }

    return response.success(
      res,
      "Add to cart get successfully",
      200,
      cart.items,
    );
  }),
);

// Delete cart item — DELETE /delete/:itemId
router.delete(
  "/delete/:itemId",
  checkCookies,
  asyncHandler(async (req, res) => {
    const itemId = req.params.itemId;

    if (!itemId) {
      return response.failure(res, "Item ID is required", 404);
    }

    const cart = await AddToCart.findOne({
      userId: req?._id!,
      "items._id": itemId,
    });

    if (!cart) {
      return response.failure(res, "Item not found in cart", 404);
    }

    // Remove the specific item from items array
    cart.items = cart.items.filter(
      (i: any) => i._id.toString() !== itemId,
    ) as any;

    // If no items left, delete the cart document
    if (cart.items.length === 0) {
      await AddToCart.findByIdAndDelete(cart._id);
    } else {
      await cart.save();
    }

    return response.success(
      res,
      "Product removed from cart successfully",
      202,
    );
  }),
);

export default router;
