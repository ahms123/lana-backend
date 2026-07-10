// controllers/auth.js

const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { StatusCodes } = require("http-status-codes");
const {
  BadRequestError,
  UnauthenticatedError,
  NotFoundError,
} = require("../errors");
const refreshTokenService = require("../services/refreshTokenService");
const referralService = require("../services/referralService");
const { toPublicUser } = require("../utils/publicUser");

const RESET_TOKEN_PURPOSE = "password-reset";

function getResetJwtSecret() {
  return process.env.JWT_RESET_SECRET || process.env.JWT_SECRET;
}

function getResetTokenExpiresIn() {
  return process.env.JWT_RESET_EXPIRES || "15m";
}

function createPasswordResetToken(userId) {
  const secret = getResetJwtSecret();
  if (!secret) {
    throw new Error("JWT_RESET_SECRET or JWT_SECRET must be set");
  }
  return jwt.sign(
    { userId: userId.toString(), purpose: RESET_TOKEN_PURPOSE },
    secret,
    { expiresIn: getResetTokenExpiresIn() }
  );
}

function verifyPasswordResetToken(resetToken) {
  const secret = getResetJwtSecret();
  if (!secret) {
    return null;
  }
  try {
    const payload = jwt.verify(resetToken, secret);
    if (payload.purpose !== RESET_TOKEN_PURPOSE || !payload.userId) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

async function buildAuthResponse(user, deviceId = null) {
  const refreshToken = await refreshTokenService.issueRefreshToken(
    user._id,
    deviceId
  );
  return {
    token: user.createJWT(),
    refreshToken,
    user: toPublicUser(user),
  };
}

const register = async (req, res) => {
  const deviceId = req.body.deviceId || null;
  const { name, email, password, referralCode } = req.body;

  // Validate referral before creating the user (optional field; invalid → 400).
  await referralService.assertReferralCodeValidIfPresent(referralCode);

  const user = await User.create({ name, email, password });
  await referralService.ensureReferralCode(user._id);
  await referralService.attributeReferralOnRegister(user._id, referralCode);

  const body = await buildAuthResponse(user, deviceId);
  res.status(StatusCodes.CREATED).json(body);
};

const login = async (req, res) => {
  const { email, password, deviceId } = req.body;

  if (!email || !password) {
    throw new BadRequestError("Please provide email and password");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw new UnauthenticatedError("Invalid Credentials");
  }
  const isPasswordCorrect = await user.comparePassword(password);
  if (!isPasswordCorrect) {
    throw new UnauthenticatedError("Invalid Credentials");
  }

  const body = await buildAuthResponse(user, deviceId || null);
  res.status(StatusCodes.OK).json(body);
};

const refresh = async (req, res) => {
  const { refreshToken: raw } = req.body;
  if (!raw || typeof raw !== "string") {
    throw new BadRequestError("Please provide refreshToken");
  }

  const result = await refreshTokenService.validateAndRotateRefresh(raw);
  if (!result.ok) {
    throw new UnauthenticatedError("Invalid refresh token");
  }

  const { user, refreshToken } = result;
  res.status(StatusCodes.OK).json({
    token: user.createJWT(),
    refreshToken,
    user: toPublicUser(user),
  });
};

/**
 * POST /api/v1/auth/revoke — revoke this refresh session without a valid access JWT.
 * Body: { refreshToken }. Validates opaque token (bcrypt); 401 if invalid.
 * 200 { success: true } when revoked or already revoked (idempotent).
 * Use when access is expired and the client will not call /refresh before clearing storage.
 */
const revoke = async (req, res) => {
  const { refreshToken: raw } = req.body;
  if (!raw || typeof raw !== "string") {
    throw new BadRequestError("Please provide refreshToken");
  }

  const result = await refreshTokenService.revokeByOpaqueSession(raw);
  if (!result.ok) {
    throw new UnauthenticatedError("Invalid refresh token");
  }

  res.status(StatusCodes.OK).json({ success: true });
};

/**
 * POST /api/v1/auth/logout — requires valid Bearer access JWT.
 * Optional body { refreshToken }: revoke that session if owned by user; else revoke all refresh sessions for user.
 */
const logout = async (req, res) => {
  const userId = req.user.userId;
  const raw = req.body && req.body.refreshToken;

  if (raw && typeof raw === "string") {
    await refreshTokenService.revokeByOpaqueIfOwned(raw, userId);
  } else {
    await refreshTokenService.revokeAllForUser(userId);
  }

  res.status(StatusCodes.OK).json({ success: true });
};

/**
 * POST /api/v1/auth/forgot-password — verify email exists; issue short-lived reset token (no OTP/email yet).
 * Body: { email }. 404 if email not in database.
 */
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== "string") {
    throw new BadRequestError("Please provide email");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw new NotFoundError("Email does not exist");
  }

  const resetToken = createPasswordResetToken(user._id);
  res.status(StatusCodes.OK).json({ success: true, resetToken });
};

/**
 * POST /api/v1/auth/reset-password — set new password using reset token from forgot-password.
 * Body: { resetToken, newPassword }. Revokes all refresh sessions for the user.
 */
const resetPassword = async (req, res) => {
  const { resetToken, newPassword } = req.body;

  if (!resetToken || typeof resetToken !== "string") {
    throw new BadRequestError("Please provide resetToken");
  }
  if (!newPassword || typeof newPassword !== "string") {
    throw new BadRequestError("Please provide newPassword");
  }
  if (newPassword.length < 6) {
    throw new BadRequestError("Password must be at least 6 characters");
  }

  const payload = verifyPasswordResetToken(resetToken);
  if (!payload) {
    throw new UnauthenticatedError("Invalid or expired reset token");
  }

  const user = await User.findById(payload.userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  user.password = newPassword;
  await user.save();
  await refreshTokenService.revokeAllForUser(user._id);

  res.status(StatusCodes.OK).json({ success: true });
};

module.exports = {
  register,
  login,
  refresh,
  revoke,
  logout,
  forgotPassword,
  resetPassword,
};
