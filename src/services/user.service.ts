import { prisma } from "../utils/database";
import { IUser, IUserCreate } from "../types/user.types";
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from "../errors/genericErrors";
import jwt from "jsonwebtoken";
import "dotenv/config";

export class UserService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || "secret-key";
  private readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
  private readonly REFRESH_TOKEN_EXPIRES_IN =
    process.env.REFRESH_TOKEN_EXPIRES_IN || "30d";

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<IUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        walletAddress: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Convert null to undefined for consistency with IUser interface
    return {
      ...user,
      email: user.email || undefined,
      name: user.name || undefined,
    };
  }

  /**
   * Get user by wallet address
   */
  async getUserByWalletAddress(walletAddress: string): Promise<IUser> {
    // Normalize wallet address
    const normalizedAddress = walletAddress.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { walletAddress: normalizedAddress },
      select: {
        id: true,
        walletAddress: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Convert null to undefined for consistency with IUser interface
    return {
      ...user,
      email: user.email || undefined,
      name: user.name || undefined,
    };
  }

  /**
   * Update user profile
   */
  async updateUserProfile(
    userId: string,
    updateData: Partial<IUserCreate>
  ): Promise<IUser> {
    // Validate email if provided
    if (updateData.email && !this.isValidEmail(updateData.email)) {
      throw new ValidationError("Invalid email format");
    }

    // Check if email is already taken by another user
    if (updateData.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: updateData.email,
          NOT: { id: userId },
        },
      });

      if (existingUser) {
        throw new ConflictError("Email already in use");
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        email: updateData.email,
        name: updateData.name,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        walletAddress: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Convert null to undefined for consistency with IUser interface
    return {
      ...user,
      email: user.email || undefined,
      name: user.name || undefined,
    };
  }

  /**
   * Refresh JWT token
   */
  async refreshToken(
    refreshToken: string
  ): Promise<{ token: string; user: IUser }> {
    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, this.JWT_SECRET) as any;

      // Get user from database to ensure they still exist
      const user = await this.getUserById(payload.userId);

      // Generate new access token
      const newPayload = {
        userId: user.id,
        walletAddress: user.walletAddress,
      };

      const newToken = jwt.sign(newPayload, this.JWT_SECRET, {
        expiresIn: this.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
      });

      return {
        token: newToken,
        user,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new ValidationError("Refresh token has expired");
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new ValidationError("Invalid refresh token");
      }
      throw error;
    }
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(userId: string): string {
    const payload = { userId };
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.REFRESH_TOKEN_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    });
  }

  /**
   * Get user statistics (stream count, total earnings, etc.)
   */
  async getUserStats(userId: string): Promise<{
    totalStreamsCreated: number;
    totalStreamsReceived: number;
    activeStreamsCreated: number;
    activeStreamsReceived: number;
    totalWithdrawn: string;
    totalReceived: string;
  }> {
    // Get stream statistics
    const [
      totalStreamsCreated,
      totalStreamsReceived,
      activeStreamsCreated,
      activeStreamsReceived,
    ] = await Promise.all([
      // Total streams created by user
      prisma.stream.count({
        where: { payerId: userId },
      }),
      // Total streams received by user
      prisma.stream.count({
        where: { recipientId: userId },
      }),
      // Active streams created by user
      prisma.stream.count({
        where: { payerId: userId, status: "ACTIVE" },
      }),
      // Active streams received by user
      prisma.stream.count({
        where: { recipientId: userId, status: "ACTIVE" },
      }),
    ]);

    // Get balance statistics - these would need to be calculated based on your business logic
    // For now, returning placeholder values
    const totalWithdrawn = "0";
    const totalReceived = "0";

    return {
      totalStreamsCreated,
      totalStreamsReceived,
      activeStreamsCreated,
      activeStreamsReceived,
      totalWithdrawn,
      totalReceived,
    };
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
