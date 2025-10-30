// import { Router } from "express";
// import { body } from "express-validator";
// import { StreamController } from "../controllers/stream.controller";
// import { authenticate } from "../middleware/auth.middleware";
// import { validateRequest, validateBodyNotEmpty } from "../middleware/validation.middleware";
// import { StreamValidators } from "../validators/stream.validators";

// const router = Router();
// const streamController = new StreamController();

// /**
//  * @swagger
//  * components:
//  *   schemas:
//  *     StreamCreate:
//  *       type: object
//  *       required:
//  *         - recipientAddress
//  *         - tokenAddress
//  *         - flowRate
//  *         - totalAmount
//  *       properties:
//  *         recipientAddress:
//  *           type: string
//  *           description: Ethereum address of the recipient
//  *           example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb9"
//  *         tokenAddress:
//  *           type: string
//  *           description: Ethereum address of the token
//  *           example: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
//  *         flowRate:
//  *           type: string
//  *           description: Flow rate per second in token units
//  *           example: "0.001"
//  *         totalAmount:
//  *           type: string
//  *           description: Total amount to escrow
//  *           example: "100"
//  *     StreamUpdate:
//  *       type: object
//  *       properties:
//  *         status:
//  *           type: string
//  *           enum: [ACTIVE, PAUSED, STOPPED]
//  *           description: New status for the stream
//  *     WithdrawalRequest:
//  *       type: object
//  *       required:
//  *         - streamId
//  *         - amount
//  *       properties:
//  *         streamId:
//  *           type: string
//  *           description: ID of the stream
//  *           example: "123e4567-e89b-12d3-a456-426614174000"
//  *         amount:
//  *           type: string
//  *           description: Amount to withdraw
//  *           example: "10.5"
//  *     StreamResponse:
//  *       type: object
//  *       properties:
//  *         success:
//  *           type: boolean
//  *         data:
//  *           type: object
//  *           properties:
//  *             stream:
//  *               $ref: '#/components/schemas/Stream'
//  *             transaction:
//  *               $ref: '#/components/schemas/Transaction'
//  *     Stream:
//  *       type: object
//  *       properties:
//  *         id:
//  *           type: string
//  *         payerId:
//  *           type: string
//  *         recipientId:
//  *           type: string
//  *         recipientAddress:
//  *           type: string
//  *         tokenAddress:
//  *           type: string
//  *         flowRate:
//  *           type: string
//  *         totalAmount:
//  *           type: string
//  *         status:
//  *           type: string
//  *           enum: [PENDING, ACTIVE, PAUSED, STOPPED, COMPLETED]
//  *         withdrawnAmount:
//  *           type: string
//  *         currentBalance:
//  *           type: string
//  *         availableBalance:
//  *           type: string
//  *         startTime:
//  *           type: string
//  *           format: date-time
//  *         endTime:
//  *           type: string
//  *           format: date-time
//  *         escrowConfirmed:
//  *           type: boolean
//  *         createdAt:
//  *           type: string
//  *           format: date-time
//  *         updatedAt:
//  *           type: string
//  *           format: date-time
//  *     Transaction:
//  *       type: object
//  *       properties:
//  *         id:
//  *           type: string
//  *         streamId:
//  *           type: string
//  *         type:
//  *           type: string
//  *           enum: [STREAM_START, STREAM_STOP, STREAM_PAUSE, STREAM_RESUME, WITHDRAWAL, DEPOSIT, ESCROW_DEPOSIT]
//  *         amount:
//  *           type: string
//  *         status:
//  *           type: string
//  *           enum: [PENDING, CONFIRMED, FAILED]
//  *         transactionHash:
//  *           type: string
//  *         createdAt:
//  *           type: string
//  *           format: date-time
//  */

// /**
//  * @swagger
//  * /api/streams:
//  *   post:
//  *     summary: Create a new payment stream
//  *     tags: [Streams]
//  *     security:
//  *       - bearerAuth: []
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             $ref: '#/components/schemas/StreamCreate'
//  *     responses:
//  *       201:
//  *         description: Stream created successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/StreamResponse'
//  *       400:
//  *         description: Validation error
//  *       401:
//  *         description: Unauthorized
//  *       409:
//  *         description: Conflict - active stream already exists
//  */
// router.post(
//   "/",
//   authenticate,
//   validateRequest(StreamValidators.validateStreamCreate),
//   streamController.createStream.bind(streamController)
// );

// /**
//  * @swagger
//  * /api/streams:
//  *   get:
//  *     summary: Get user's streams
//  *     tags: [Streams]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: query
//  *         name: status
//  *         schema:
//  *           type: string
//  *           enum: [PENDING, ACTIVE, PAUSED, STOPPED, COMPLETED]
//  *         description: Filter by stream status
//  *       - in: query
//  *         name: page
//  *         schema:
//  *           type: integer
//  *           minimum: 1
//  *           default: 1
//  *         description: Page number
//  *       - in: query
//  *         name: limit
//  *         schema:
//  *           type: integer
//  *           minimum: 1
//  *           maximum: 100
//  *           default: 10
//  *         description: Number of items per page
//  *     responses:
//  *       200:
//  *         description: Streams retrieved successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                 data:
//  *                   type: object
//  *                   properties:
//  *                     streams:
//  *                       type: array
//  *                       items:
//  *                         $ref: '#/components/schemas/Stream'
//  *                     total:
//  *                       type: integer
//  *                     page:
//  *                       type: integer
//  *                     totalPages:
//  *                       type: integer
//  *       401:
//  *         description: Unauthorized
//  */
// router.get(
//   "/",
//   authenticate,
//   validateRequest(StreamValidators.validateStreamQuery),
//   streamController.getUserStreams.bind(streamController)
// );

// /**
//  * @swagger
//  * /api/streams/{streamId}:
//  *   get:
//  *     summary: Get stream by ID
//  *     tags: [Streams]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: streamId
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: Stream ID
//  *     responses:
//  *       200:
//  *         description: Stream retrieved successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                 data:
//  *                   $ref: '#/components/schemas/Stream'
//  *       401:
//  *         description: Unauthorized
//  *       404:
//  *         description: Stream not found
//  */
// router.get(
//   "/:streamId",
//   authenticate,
//   validateRequest(StreamValidators.validateStreamId),
//   streamController.getStreamById.bind(streamController)
// );

// /**
//  * @swagger
//  * /api/streams/{streamId}/status:
//  *   patch:
//  *     summary: Update stream status
//  *     tags: [Streams]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: streamId
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: Stream ID
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             $ref: '#/components/schemas/StreamUpdate'
//  *     responses:
//  *       200:
//  *         description: Stream status updated successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                 data:
//  *                   $ref: '#/components/schemas/Stream'
//  *       400:
//  *         description: Invalid status transition
//  *       401:
//  *         description: Unauthorized
//  *       404:
//  *         description: Stream not found
//  */
// router.patch(
//   "/:streamId/status",
//   authenticate,
//   validateRequest(StreamValidators.validateStreamUpdate),
//   streamController.updateStreamStatus.bind(streamController)
// );

// /**
//  * @swagger
//  * /api/streams/withdraw:
//  *   post:
//  *     summary: Process withdrawal from stream
//  *     tags: [Streams]
//  *     security:
//  *       - bearerAuth: []
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             $ref: '#/components/schemas/WithdrawalRequest'
//  *     responses:
//  *       201:
//  *         description: Withdrawal processed successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                 data:
//  *                   $ref: '#/components/schemas/Transaction'
//  *       400:
//  *         description: Insufficient balance or invalid request
//  *       401:
//  *         description: Unauthorized
//  *       404:
//  *         description: Stream not found
//  */
// router.post(
//   "/withdraw",
//   authenticate,
//   validateRequest(StreamValidators.validateWithdrawalRequest),
//   streamController.processWithdrawal.bind(streamController)
// );

// /**
//  * @swagger
//  * /api/streams/{streamId}/confirm-escrow:
//  *   post:
//  *     summary: Confirm escrow deposit
//  *     tags: [Streams]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: streamId
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: Stream ID
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               transactionHash:
//  *                 type: string
//  *                 description: Blockchain transaction hash
//  *                 example: "0x123..."
//  *     responses:
//  *       200:
//  *         description: Escrow confirmed successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                 data:
//  *                   $ref: '#/components/schemas/Stream'
//  *       401:
//  *         description: Unauthorized
//  *       404:
//  *         description: Stream not found
//  */
// router.post(
//   "/:streamId/confirm-escrow",
//   authenticate,
//   validateRequest([
//     ...StreamValidators.validateStreamId,
//     body("transactionHash")
//       .isString()
//       .notEmpty()
//       .withMessage("Transaction hash is required")
//   ]),
//   streamController.confirmEscrowDeposit.bind(streamController)
// );

// /**
//  * @swagger
//  * /api/streams/{streamId}/activity:
//  *   get:
//  *     summary: Get stream activity (transactions)
//  *     tags: [Streams]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: streamId
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: Stream ID
//  *       - in: query
//  *         name: page
//  *         schema:
//  *           type: integer
//  *           minimum: 1
//  *           default: 1
//  *         description: Page number
//  *       - in: query
//  *         name: limit
//  *         schema:
//  *           type: integer
//  *           minimum: 1
//  *           maximum: 100
//  *           default: 20
//  *         description: Number of items per page
//  *     responses:
//  *       200:
//  *         description: Stream activity retrieved successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                 data:
//  *                   type: object
//  *                   properties:
//  *                     transactions:
//  *                       type: array
//  *                       items:
//  *                         $ref: '#/components/schemas/Transaction'
//  *                     total:
//  *                       type: integer
//  *                     page:
//  *                       type: integer
//  *                     totalPages:
//  *                       type: integer
//  *       401:
//  *         description: Unauthorized
//  *       404:
//  *         description: Stream not found
//  */
// router.get(
//   "/:streamId/activity",
//   authenticate,
//   validateRequest(StreamValidators.validateStreamId),
//   streamController.getStreamActivity.bind(streamController)
// );

// /**
//  * @swagger
//  * /api/streams/active:
//  *   get:
//  *     summary: Get active streams for monitoring
//  *     tags: [Streams]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: query
//  *         name: tokenAddress
//  *         schema:
//  *           type: string
//  *         description: Filter by token address
//  *     responses:
//  *       200:
//  *         description: Active streams retrieved successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                 data:
//  *                   type: array
//  *                   items:
//  *                     $ref: '#/components/schemas/Stream'
//  *       401:
//  *         description: Unauthorized
//  */
// router.get(
//   "/active",
//   authenticate,
//   streamController.getActiveStreams.bind(streamController)
// );

// export default router;
