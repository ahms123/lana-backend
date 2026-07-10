// models/User.js

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please provide name"],
    maxlength: 50,
    minlength: 3,
    unique: true,
  },
  email: {
    type: String,
    required: [true, "Please provide email"],
    lowercase: true, // <-- ensure emails are stored lowercased
    trim: true,
    match: [
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
      "Please provide a valid email",
    ],
    unique: true,
  },
  password: {
    type: String,
    required: [true, "Please provide password"],
    minlength: 6,
  },
  referralCode: {
    type: String,
    trim: true,
    lowercase: true,
    unique: true,
    sparse: true,
  },
});

// Only hash password when it was created/modified
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.createJWT = function () {
  const expiresIn =
    process.env.JWT_ACCESS_EXPIRES ||
    process.env.JWT_LIFETIME ||
    "15m";
  return jwt.sign(
    { userId: this._id.toString(), name: this.name },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

UserSchema.methods.comparePassword = async function (candidatePassword) {
  const isMatch = await bcrypt.compare(candidatePassword, this.password);
  return isMatch;
};

module.exports = mongoose.model("User", UserSchema);
