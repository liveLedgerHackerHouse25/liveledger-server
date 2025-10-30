import { Request, Response, NextFunction } from "express";
import { UserService } from "../services/user.service";
import { asyncErrorHandler } from "../middleware/error.middleware";
import { IUserCreate } from "../types/user.types";
import { UnauthorizedError } from "../errors/genericErrors";

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  /**
   * Get current user profile
   * GET /api/users/profile
   */
  getProfile = asyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        throw new UnauthorizedError("User not authenticated");
      }

      const userId = req.user.id;

      const user = await this.userService.getUserById(userId);

      res.status(200).json({
        success: true,
        data: { user },
      });
    }
  );

  /**
   * Update current user profile
   * PUT /api/users/profile
   */
  updateProfile = asyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        throw new UnauthorizedError("user not authenticated");
      }
      const userId = req.user.id;
      const updateData: Partial<IUserCreate> = req.body;

      const allowedUpdates = {
        email: updateData.email,
        name: updateData.name,
        type: updateData.type,
      };

      const user = await this.userService.updateUserProfile(
        userId,
        allowedUpdates
      );

      res.status(200).json({
        success: true,
        data: { user },
      });
    }
  );

  /**
   * Get user by wallet address
   * GET /api/users/wallet/:walletAddress
   */
  getUserByWallet = asyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const { walletAddress } = req.params;

      const user = await this.userService.getUserByWalletAddress(walletAddress);

      res.status(200).json({
        success: true,
        data: { user },
      });
    }
  );

  /**
   * Get user statistics
   * GET /api/users/stats
   */
  getUserStats = asyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = (req as any).user.userId;

      const stats = await this.userService.getUserStats(userId);

      res.status(200).json({
        success: true,
        data: { stats },
      });
    }
  );

  /**
   * Refresh JWT token
   * POST /api/users/refresh-token
   */
  refreshToken = asyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: "Refresh token is required",
        });
      }

      const result = await this.userService.refreshToken(refreshToken);

      res.status(200).json({
        success: true,
        data: result,
      });
    }
  );

  /**
   * Generate refresh token for current user
   * POST /api/users/generate-refresh-token
   */
  generateRefreshToken = asyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        throw new UnauthorizedError("User not authenticated");
      }
      const userId = req.user.id;

      const refreshToken = this.userService.generateRefreshToken(userId);

      res.status(200).json({
        success: true,
        data: { refreshToken },
      });
    }
  );
}
