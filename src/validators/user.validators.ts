import { ethers } from "ethers";
import { body, param } from "express-validator";

export const UserValidators = {
  /**
   * Validate wallet address parameter
   */
  validateWalletAddress: [
    param("walletAddress")
      .isEthereumAddress()
      .withMessage("Valid Ethereum address required")
      .customSanitizer((value: string) => {
        // Normalize to checksum address using ethers
        try {
          return ethers.utils.getAddress(value);
        } catch {
          return value; // Return original if normalization fails
        }
      }),
  ],

  /**
   * Validate user profile update
   */
  validateProfileUpdate: [
    body("email")
      .optional()
      .isEmail()
      .withMessage("Valid email required")
      .normalizeEmail(),
    body("name")
      .optional()
      .isString()
      .withMessage("Name must be a string")
      .isLength({ min: 1, max: 100 })
      .withMessage("Name must be between 1 and 100 characters")
      .trim(),
  ],

  /**
   * Validate refresh token request
   */
  validateRefreshToken: [
    body("refreshToken")
      .isString()
      .withMessage("Refresh token must be a string")
      .notEmpty()
      .withMessage("Refresh token is required"),
  ],
};
