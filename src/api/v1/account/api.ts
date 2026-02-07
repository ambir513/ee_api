import express from "express";
import checkCookies from "../../../utils/m-check-cookies.js";
import asyncHandler from "../../../utils/async-handler.js";
import User from "../../../schema/user.js";
import response from "../../../utils/response.js";
import Address from "../../../schema/address.js";
import InputSensitization from "../../../utils/m-input-sensitization.js";

const router = express.Router();

// get current user account
router.get(
  "/me",
  checkCookies,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req?._id!).select(
      "-password -__v -createdAt -updatedAt",
    );
    return response.success(res, "User fetched successfully", 200, user);
  }),
);

// edit user account
router.patch(
  "/edit",
  checkCookies,
  asyncHandler(async (req, res) => {
    if (req.body.password) {
      return response.failure(
        res,
        "Password cannot be changed here",
        400,
        null,
      );
    }

    if (req.body.email) {
      return response.failure(res, "Email cannot be changed here", 400, null);
    }
    if (req.body.role) {
      return response.failure(res, "Role cannot be changed here", 400, null);
    }

    const updateUser = await User.findByIdAndUpdate(
      req?._id!,
      {
        $set: { name: req.body.name, avatar: req.body.avatar },
      },
      { new: true },
    ).select("-password -__v -createdAt -updatedAt -role");
    return response.success(res, "User updated successfully", 200, updateUser);
  }),
);

// create address for user
router.post(
  "/address/create",
  checkCookies,
  InputSensitization,
  asyncHandler(async (req, res) => {
    const addressCount = await Address.countDocuments({ userId: req._id });

    if (addressCount === 2) {
      return response.failure(res, "Maximum of 2 addresses allowed", 400, null);
    }

    const newAddress = await Address.create({
      ...req.body,
      userId: req._id,
    });

    return response.success(
      res,
      "Address created successfully",
      201,
      newAddress,
    );
  }),
);

// edit address for user
router.patch(
  "/address/edit/:addressId",
  checkCookies,
  asyncHandler(async (req, res) => {
    const addressId = req.params.addressId;

    if (!addressId) {
      return response.failure(res, "Address ID is required", 400, null);
    }

    const updatedAddress = await Address.findOneAndUpdate(
      {
        $and: [{ _id: addressId }, { userId: req._id }],
      },
      { $set: req.body },
      { new: true },
    );

    if (!updatedAddress) {
      return response.failure(res, "Address not found", 404, null);
    }

    return response.success(
      res,
      "Address updated successfully",
      200,
      updatedAddress,
    );
  }),
);

// delete address for user
router.delete(
  "/address/delete/:addressId",
  checkCookies,
  asyncHandler(async (req, res) => {
    const addressId = req.params.addressId;

    if (!addressId) {
      return response.failure(res, "Address ID is required", 400, null);
    }

    const deletedAddress = await Address.findOneAndDelete({
      $and: [{ _id: addressId }, { userId: req._id }],
    });

    if (!deletedAddress) {
      return response.failure(res, "Address not found", 404, null);
    }

    return response.success(
      res,
      "Address deleted successfully",
      200,
      deletedAddress,
    );
  }),
);
export default router;
