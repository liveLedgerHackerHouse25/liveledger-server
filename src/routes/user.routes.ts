import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { UserValidators } from '../validators/user.validators';
import { validateRequest, validateBodyNotEmpty } from '../middleware/validation.middleware';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const userController = new UserController();

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
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
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get('/profile', authenticate, userController.getProfile);

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *                 example: "user@example.com"
 *               name:
 *                 type: string
 *                 description: User display name
 *                 example: "John Doe"
 *     responses:
 *       200:
 *         description: User profile updated successfully
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
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       409:
 *         description: Email already in use
 *       500:
 *         description: Server error
 */
router.put(
  '/profile',
  authenticate,
  validateBodyNotEmpty,
  validateRequest(UserValidators.validateProfileUpdate),
  userController.updateProfile
);

/**
 * @swagger
 * /api/users/wallet/{walletAddress}:
 *   get:
 *     summary: Get user by wallet address
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: walletAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: Ethereum wallet address
 *         example: "0x1234567890123456789012345678901234567890"
 *     responses:
 *       200:
 *         description: User found successfully
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
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *       404:
 *         description: User not found
 *       400:
 *         description: Invalid wallet address
 *       500:
 *         description: Server error
 */
router.get(
  '/wallet/:walletAddress',
  validateRequest(UserValidators.validateWalletAddress),
  userController.getUserByWallet
);

/**
 * @swagger
 * /api/users/stats:
 *   get:
 *     summary: Get user statistics
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User statistics retrieved successfully
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
 *                     stats:
 *                       type: object
 *                       properties:
 *                         totalStreamsCreated:
 *                           type: integer
 *                           description: Total number of streams created by the user
 *                         totalStreamsReceived:
 *                           type: integer
 *                           description: Total number of streams received by the user
 *                         activeStreamsCreated:
 *                           type: integer
 *                           description: Number of active streams created by the user
 *                         activeStreamsReceived:
 *                           type: integer
 *                           description: Number of active streams received by the user
 *                         totalWithdrawn:
 *                           type: string
 *                           description: Total amount withdrawn (placeholder)
 *                         totalReceived:
 *                           type: string
 *                           description: Total amount received (placeholder)
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/stats', authenticate, userController.getUserStats);

/**
 * @swagger
 * /api/users/refresh-token:
 *   post:
 *     summary: Refresh JWT token
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: Token refreshed successfully
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
 *                       description: New JWT access token
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
 *       400:
 *         description: Invalid refresh token
 *       401:
 *         description: Refresh token expired or invalid
 *       500:
 *         description: Server error
 */
router.post(
  '/refresh-token',
  validateBodyNotEmpty,
  validateRequest(UserValidators.validateRefreshToken),
  userController.refreshToken
);

/**
 * @swagger
 * /api/users/generate-refresh-token:
 *   post:
 *     summary: Generate refresh token for current user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Refresh token generated successfully
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
 *                     refreshToken:
 *                       type: string
 *                       description: Refresh token for token refresh
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/generate-refresh-token', authenticate, userController.generateRefreshToken);

/**
 * @swagger
 * /api/users/balance:
 *   get:
 *     summary: Get user token balance
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User balance retrieved successfully
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
 *                     balance:
 *                       type: object
 *                       properties:
 *                         totalBalance:
 *                           type: string
 *                           description: Total token balance
 *                         availableBalance:
 *                           type: string
 *                           description: Available balance for streaming
 *                         pendingBalance:
 *                           type: string
 *                           description: Balance locked in active streams
 *                         tokenAddress:
 *                           type: string
 *                           description: Token contract address
 *                         tokenSymbol:
 *                           type: string
 *                           description: Token symbol
 *                         tokenDecimals:
 *                           type: integer
 *                           description: Token decimals
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/balance', authenticate, userController.getUserBalance);

export default router;