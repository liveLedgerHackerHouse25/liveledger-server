import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service";
import { UnauthorizedError } from "../errors/genericErrors";
import { IAuthUser } from "../types/auth.types";
import { prisma } from "../utils/database";

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: IAuthUser;
    }
  }
}

const authService = new AuthService();

/**
 * Authentication middleware
 * Validates JWT token and adds user to request
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("No token provided");
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const payload = authService.verifyToken(token);

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    // Add user to request
    req.user = {
      id: user.id,
      walletAddress: user.walletAddress,
      email: user.email || undefined,
      name: user.name || undefined,
      type: user.type || "RECIPIENT",
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication middleware
 * Same as authenticate but doesn't fail if no token is provided
 */
export const optionalAuthenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(); // Continue without authentication
    }

    const token = authHeader.substring(7);

    try {
      const payload = authService.verifyToken(token);

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (user) {
        req.user = {
          id: user.id,
          walletAddress: user.walletAddress,
          email: user.email || undefined,
          name: user.name || undefined,
        };
      }
    } catch (error) {
      // Invalid token, but we don't fail - just continue without user
    }

    next();
  } catch (error) {
    next(error);
  }
};
