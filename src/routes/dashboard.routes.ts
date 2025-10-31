import { Router } from "express";
import { DashboardController } from "../controllers/dashboard.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();
const dashboardController = new DashboardController();

/**
 * @swagger
 * /api/dashboard/payer/{address}:
 *   get:
 *     summary: Get payer dashboard data
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Ethereum address of the payer
 *     responses:
 *       200:
 *         description: Payer dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     activeStreams:
 *                       type: array
 *                       items:
 *                         type: object
 *                     totalStreamed:
 *                       type: string
 *                     totalLocked:
 *                       type: string
 *                     recentActivity:
 *                       type: array
 *                     upcomingCompletions:
 *                       type: array
 *                     stats:
 *                       type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get(
  "/payer/:address",
  authenticate,
  dashboardController.getPayerDashboard.bind(dashboardController)
);

/**
 * @swagger
 * /api/dashboard/recipient/{address}:
 *   get:
 *     summary: Get recipient dashboard data
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Ethereum address of the recipient
 *     responses:
 *       200:
 *         description: Recipient dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     activeStreams:
 *                       type: array
 *                       items:
 *                         type: object
 *                     totalEarned:
 *                       type: string
 *                     availableToWithdraw:
 *                       type: string
 *                     withdrawalLimitUsed:
 *                       type: number
 *                     recentWithdrawals:
 *                       type: array
 *                     stats:
 *                       type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get(
  "/recipient/:address",
  authenticate,
  dashboardController.getRecipientDashboard.bind(dashboardController)
);

/**
 * @swagger
 * /api/analytics/streams/active:
 *   get:
 *     summary: Get active streams analytics
 *     tags: [Analytics]
 *     responses:
 *       200:
 *         description: Analytics data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     activeStreams:
 *                       type: number
 *                     totalVolume:
 *                       type: string
 *                     dailyVolume:
 *                       type: string
 *                     withdrawalStats:
 *                       type: object
 */
router.get(
  "/analytics/streams/active",
  dashboardController.getActiveStreamsAnalytics.bind(dashboardController)
);

/**
 * @swagger
 * /api/analytics/volume/daily:
 *   get:
 *     summary: Get daily volume analytics
 *     tags: [Analytics]
 *     responses:
 *       200:
 *         description: Daily volume data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     dailyVolume:
 *                       type: string
 *                     activeStreams:
 *                       type: number
 *                     timestamp:
 *                       type: string
 */
router.get(
  "/analytics/volume/daily",
  dashboardController.getDailyVolumeAnalytics.bind(dashboardController)
);

/**
 * @swagger
 * /api/dashboard/streams/{streamIds}/balances:
 *   get:
 *     summary: Get real-time balances for multiple streams
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: streamIds
 *         required: true
 *         schema:
 *           type: string
 *         description: Comma-separated stream IDs
 *     responses:
 *       200:
 *         description: Real-time balances retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     balances:
 *                       type: array
 *                       items:
 *                         type: object
 *                     timestamp:
 *                       type: number
 */
router.get(
  "/streams/:streamIds/balances",
  authenticate,
  dashboardController.getRealTimeBalances.bind(dashboardController)
);

/**
 * @swagger
 * /api/dashboard/alerts/completions:
 *   get:
 *     summary: Get stream completion alerts
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Completion alerts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get(
  "/alerts/completions",
  dashboardController.getCompletionAlerts.bind(dashboardController)
);

/**
 * @swagger
 * /api/dashboard/alerts/withdrawals:
 *   get:
 *     summary: Get withdrawal limit alerts
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Withdrawal alerts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get(
  "/alerts/withdrawals",
  dashboardController.getWithdrawalAlerts.bind(dashboardController)
);

export default router;