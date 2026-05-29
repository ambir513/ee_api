import mongoose from "mongoose";
import validator from "validator";
import { UserDocument, UserModel } from "./types.js";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema<UserDocument, UserModel>(
  {
    avatar: { type: String, default: "avatar.png" },
    name: {
      type: String,
      minLength: [3, "Name must be at least 3 characters"],
      maxLength: [30, "Name cannot be more than 30 characters"],
      trim: true,
      required: true,
      index: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      index: true,
      lowercase: true,
      minLength: [1, "Email must be at least 1 character"],
      maxLength: [50, "Email cannot be more than 50 characters"],
      validate: {
        validator: function (v: string) {
          return validator.isEmail(v);
        },
        message: (props: any) => `${props.value} is not a valid email!`,
      },
    },
    password: {
      type: String,
      required: true,
      minLength: [8, "Password must be at least 8 characters"],
      maxLength: [100, "Password cannot be more than 100 characters"],
      validate: {
        validator: function (v: string) {
          return validator.isStrongPassword(v);
        },
        message: (props: any) =>
          `Password is not strong enough! It should contain at least 8 characters, including uppercase, lowercase, number, and symbol.`,
      },
    },
    role: {
      type: String,
      enum: ["USER", "ADMIN"],
      default: "USER",
    },
  },
  { timestamps: true },
);

userSchema.statics.isUserExists = async function (email: string): Promise<any> {
  const user = await this.findOne({ email }).select(
    "password avatar name email role",
  );
  return user;
};

userSchema.statics.hashPassword = async function (
  password: string,
): Promise<string> {
  const hashedPassword = await bcrypt.hash(password, 10);
  return hashedPassword;
};

userSchema.statics.comparePassword = async function (
  plainPassword: string,
  hashedPassword: string,
): Promise<boolean> {
  const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
  return isMatch;
};

userSchema.statics.updatePassword = async function (
  email: string,
  newPassword: string,
): Promise<any> {
  const updatedUser = await this.findOneAndUpdate(
    { email },
    { password: newPassword },
    { new: true },
  );
  return updatedUser;
};
const User = mongoose.model<UserDocument, UserModel>("User", userSchema);

export default User;
