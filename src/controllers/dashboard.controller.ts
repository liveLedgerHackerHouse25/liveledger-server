import { Request, Response, NextFunction } from "express";
import { DashboardService } from "../services/dashboard.service";
import { UnauthorizedError } from "../errors/genericErrors";

export class DashboardController {
  private dashboardService: DashboardService;

  constructor() {
    this.dashboardService = DashboardService.getInstance();
  }

  /**
   * Get payer dashboard data
   * GET /api/dashboard/payer/:address
   */
  getPayerDashboard = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { address } = req.params;

      if (!req.user) {
        throw new UnauthorizedError("User not authenticated");
      }

      // Verify the requested address belongs to the authenticated user
      if (req.user.walletAddress.toLowerCase() !== address.toLowerCase()) {
        throw new UnauthorizedError("Cannot access dashboard for different address");
      }

      const dashboard = await this.dashboardService.getPayerDashboard(address);

      res.status(200).json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get recipient dashboard data
   * GET /api/dashboard/recipient/:address
   */
  getRecipientDashboard = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { address } = req.params;

      if (!req.user) {
        throw new UnauthorizedError("User not authenticated");
      }

      // Verify the requested address belongs to the authenticated user
      if (req.user.walletAddress.toLowerCase() !== address.toLowerCase()) {
        throw new UnauthorizedError("Cannot access dashboard for different address");
      }

      const dashboard = await this.dashboardService.getRecipientDashboard(address);

      res.status(200).json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get analytics data (admin/aggregate view)
   * GET /api/analytics/streams/active
   */
  getActiveStreamsAnalytics = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const analytics = await this.dashboardService.getAnalytics();

      res.status(200).json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get daily volume analytics
   * GET /api/analytics/volume/daily
   */
  getDailyVolumeAnalytics = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // This could be expanded to include historical daily volume
      const analytics = await this.dashboardService.getAnalytics();

      res.status(200).json({
        success: true,
        data: {
          dailyVolume: analytics.dailyVolume,
          activeStreams: analytics.activeStreams,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get real-time stream balance updates
   * GET /api/dashboard/streams/:streamIds/balances
   */
  getRealTimeBalances = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { streamIds } = req.params;
      const streamIdArray = streamIds.split(',');

      if (!req.user) {
        throw new UnauthorizedError("User not authenticated");
      }

      const balances = await this.dashboardService.getRealTimeUpdates(streamIdArray);

      res.status(200).json({
        success: true,
        data: balances,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get stream completion alerts
   * GET /api/dashboard/alerts/completions
   */
  getCompletionAlerts = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const alerts = await this.dashboardService.getCompletionAlerts();

      res.status(200).json({
        success: true,
        data: alerts,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get withdrawal limit alerts
   * GET /api/dashboard/alerts/withdrawals
   */
  getWithdrawalAlerts = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const alerts = await this.dashboardService.getWithdrawalAlerts();

      res.status(200).json({
        success: true,
        data: alerts,
      });
    } catch (error) {
      next(error);
    }
  };
}