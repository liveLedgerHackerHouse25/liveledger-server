import { ethers } from "ethers";
import jwt from "jsonwebtoken";
import { prisma } from "../utils/database";
import {
  INonceRequest,
  INonceResponse,
  IWalletAuthRequest,
  IWalletAuthResponse,
  IJwtPayload,
} from "../types/auth.types";
import {
  ConflictError,
  UnauthorizedError,
  ValidationError,
} from "../errors/genericErrors";
import { UserService } from "./user.service";

export class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
  private readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
  private readonly NONCE_EXPIRES_IN = 5 * 60 * 1000; // 5 minutes
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  /**
   * Generate a nonce for wallet authentication
   */
  async generateNonce(walletAddress: string): Promise<INonceResponse> {
    // Validate wallet address
    if (!ethers.utils.isAddress(walletAddress)) {
      throw new ValidationError("Invalid Ethereum address");
    }

    // Normalize wallet address
    const normalizedAddress = ethers.utils.getAddress(walletAddress);

    // Generate random nonce
    // const nonce = ethers.utils.randomBytes(32).toString();
    const nonce = ethers.utils.hexlify(ethers.utils.randomBytes(32)).slice(2);

    const expiresAt = new Date(Date.now() + this.NONCE_EXPIRES_IN);

    // Store nonce in database with expiration
    await prisma.user.upsert({
      where: { walletAddress: normalizedAddress },
      update: {
        // Update existing user with new nonce
        // This ensures we always have a fresh nonce
      },
      create: {
        walletAddress: normalizedAddress,
      },
    });

    // For now, we'll store nonces in memory (in production, use Redis)
    // This is a simplified implementation
    const nonceData = {
      nonce,
      walletAddress: normalizedAddress,
      expiresAt,
    };

    // Store in memory (in production, use Redis or similar)
    if (!(global as any).authNonces) {
      (global as any).authNonces = new Map();
    }
    (global as any).authNonces.set(normalizedAddress, nonceData);

    // Clean up expired nonces periodically
    this.cleanupExpiredNonces();

    return {
      nonce,
      expiresAt,
    };
  }

  /**
   * Authenticate wallet with signature
   */
  async authenticateWallet(
    authData: IWalletAuthRequest
  ): Promise<IWalletAuthResponse> {
    const { walletAddress, signature, nonce } = authData;

    // Validate wallet address
    if (!ethers.utils.isAddress(walletAddress)) {
      throw new ValidationError("Invalid Ethereum address");
    }

    const normalizedAddress = ethers.utils.getAddress(walletAddress);

    // Get stored nonce
    const nonceData = (global as any).authNonces?.get(normalizedAddress);
    if (!nonceData || nonceData.nonce !== nonce) {
      throw new UnauthorizedError("Invalid or expired nonce");
    }

    // Check if nonce has expired
    if (new Date() > nonceData.expiresAt) {
      (global as any).authNonces.delete(normalizedAddress);
      throw new UnauthorizedError("Nonce has expired");
    }

    // Verify signature
    const message = this.getSignMessage(nonce);
    const recoveredAddress = await this.recoverAddress(message, signature);

    if (recoveredAddress.toLowerCase() !== normalizedAddress.toLowerCase()) {
      throw new UnauthorizedError("Invalid signature");
    }

    // Clean up used nonce
    (global as any).authNonces.delete(normalizedAddress);

    // Get or create user
    let user = await prisma.user.findUnique({
      where: { walletAddress: normalizedAddress },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { walletAddress: normalizedAddress },
      });
    }

    // Generate JWT token
    const payload: IJwtPayload = {
      userId: user.id,
      walletAddress: user.walletAddress,
    };

    const token = jwt.sign(payload, this.JWT_SECRET as string, {
      expiresIn: this.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    });

    // Generate refresh token
    const refreshToken = this.userService.generateRefreshToken(user.id);

    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        email: user.email || undefined,
        name: user.name || undefined,
        type: user.type,
      },
    };
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): IJwtPayload {
    try {
      return jwt.verify(token, this.JWT_SECRET) as IJwtPayload;
    } catch (error) {
      throw new UnauthorizedError("Invalid or expired token");
    }
  }

  /**
   * Get the message to be signed by the wallet
   */
  private getSignMessage(nonce: string): string {
    return `Welcome to LiveLedger!\n\nSign this message to authenticate your wallet.\n\nNonce: ${nonce}\n\nThis request will not trigger a blockchain transaction or cost any gas fees.`;
  }

  /**
   * Recover address from signature
   */
  private async recoverAddress(
    message: string,
    signature: string
  ): Promise<string> {
    try {
      return ethers.utils.verifyMessage(message, signature);
    } catch (error) {
      throw new UnauthorizedError("Invalid signature format");
    }
  }

  /**
   * Clean up expired nonces from memory
   */
  private cleanupExpiredNonces(): void {
    if (!(global as any).authNonces) {
      return;
    }

    const now = new Date();
    const nonces = (global as any).authNonces as Map<string, any>;

    for (const [address, nonceData] of nonces.entries()) {
      if (now > nonceData.expiresAt) {
        nonces.delete(address);
      }
    }
  }
}
