import { Router } from "express";
import { body } from "express-validator";
import { StreamController } from "../controllers/stream.controller";
import { authenticate } from "../middleware/auth.middleware";
import {
  validateRequest,
  validateBodyNotEmpty,
} from "../middleware/validation.middleware";
import { StreamValidators } from "../validators/stream.validators";

const router = Router();
const streamController = new StreamController();

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
router.post(
  "/",
  authenticate,
  // validateRequest(StreamValidators.validateStreamCreate),
  streamController.createStream.bind(streamController)
);

router.post(
  "/:id/confirm",
  authenticate,
  streamController.confirmStream.bind(streamController)
);

router.get(
  "/:id/claimable",
  authenticate,
  streamController.getClaimableAmount.bind(streamController)
);

router.post(
  "/:id/withdraw",
  authenticate,
  streamController.withdrawFromStream.bind(streamController)
);

router.post(
  "/:id/cancel",
  authenticate,
  streamController.cancelStream.bind(streamController)
);

router.get(
  "/:id",
  authenticate,
  streamController.getStream.bind(streamController)
);

router.get(
  "/",
  authenticate,
  streamController.getUserStreams.bind(streamController)
);

export default router;
