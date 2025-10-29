import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { INonceRequest, IWalletAuthRequest } from '../types/auth.types';
import { asyncErrorHandler } from '../middleware/error.middleware';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Generate nonce for wallet authentication
   * POST /api/auth/nonce
   */
  generateNonce = asyncErrorHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { walletAddress }: INonceRequest = req.body;

    const result = await this.authService.generateNonce(walletAddress);

    res.status(200).json({
      success: true,
      data: result
    });
  });

  /**
   * Authenticate wallet with signature
   * POST /api/auth/wallet
   */
  authenticateWallet = asyncErrorHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authData: IWalletAuthRequest = req.body;

    const result = await this.authService.authenticateWallet(authData);

    res.status(200).json({
      success: true,
      data: result
    });
  });

  /**
   * Get current user info
   * GET /api/auth/me
   */
  getCurrentUser = asyncErrorHandler(async (req: Request, res: Response, next: NextFunction) => {
    // req.user is set by auth middleware
    const user = (req as any).user;

    res.status(200).json({
      success: true,
      data: {
        user
      }
    });
  });
}