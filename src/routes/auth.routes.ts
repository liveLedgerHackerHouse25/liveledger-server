import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { AuthValidators } from "../validators/auth.validators";
import {
  validateRequest,
  validateBodyNotEmpty,
} from "../middleware/validation.middleware";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();
const authController = new AuthController();

/**
 * @swagger
 * /api/auth/nonce:
 *   post:
 *     summary: Generate nonce for wallet authentication
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletAddress
 *             properties:
 *               walletAddress:
 *                 type: string
 *                 description: Ethereum wallet address
 *                 example: "0x1234567890123456789012345678901234567890"
 *     responses:
 *       200:
 *         description: Nonce generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     nonce:
 *                       type: string
 *                       description: Hexadecimal nonce to be signed
 *                       example: "a1b2c3d4e5f6..."
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                       description: Expiration time for the nonce
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post(
  "/nonce",
  validateBodyNotEmpty,
  validateRequest(AuthValidators.validateNonceRequest),
  authController.generateNonce
);

/**
 * @swagger
 * /api/auth/wallet:
 *   post:
 *     summary: Authenticate wallet with signature
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletAddress
 *               - signature
 *               - nonce
 *             properties:
 *               walletAddress:
 *                 type: string
 *                 description: Ethereum wallet address
 *                 example: "0x1234567890123456789012345678901234567890"
 *               signature:
 *                 type: string
 *                 description: Signed message signature
 *                 example: "0x..."
 *               nonce:
 *                 type: string
 *                 description: Nonce received from /nonce endpoint
 *                 example: "a1b2c3d4e5f6..."
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       description: JWT token for authenticated requests
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                     refreshToken:
 *                       type: string
 *                       description: Refresh token for obtaining new access tokens
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         walletAddress:
 *                           type: string
 *                         email:
 *                           type: string
 *                           nullable: true
 *                         name:
 *                           type: string
 *                           nullable: true
 *       401:
 *         description: Authentication failed
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post(
  "/wallet",
  validateBodyNotEmpty,
  validateRequest(AuthValidators.validateWalletAuth),
  authController.authenticateWallet
);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user information
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         walletAddress:
 *                           type: string
 *                         email:
 *                           type: string
 *                           nullable: true
 *                         name:
 *                           type: string
 *                           nullable: true
 *                         type:
 *                           type: UserType
 *                           nullable: true
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/me", authenticate, authController.getCurrentUser);

export default router;
