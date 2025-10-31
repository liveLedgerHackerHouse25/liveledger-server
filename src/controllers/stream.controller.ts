import { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/database";
import { StreamService } from "../services/stream.service";
import { EnhancedStreamService } from "../services/enhancedStream.service";
import {
  IStreamCreate,
  IStreamUpdate,
  IWithdrawalRequest,
} from "../types/stream.types";
import { UnauthorizedError } from "../errors/genericErrors";

export class StreamController {
  private streamService: StreamService;
  private enhancedStreamService: EnhancedStreamService;

  constructor() {
    this.streamService = new StreamService();
    this.enhancedStreamService = new EnhancedStreamService();
  }

  /**
   * Create a new payment stream
   * POST /api/streams
   */
  createStream = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const streamData: IStreamCreate = req.body;
      if (!req.user) {
        throw new UnauthorizedError("User not authenticated");
      }
      const result = await this.enhancedStreamService.createStream(
        req.user.id,
        streamData
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  confirmStream = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const stream = await this.enhancedStreamService.confirmStreamCreation(id);

      res.status(200).json({
        success: true,
        data: stream,
      });
    } catch (error) {
      next(error);
    }
  };

  withdrawFromStream = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      if (!req.user) {
        throw new UnauthorizedError("User not authenticated");
      }
      const result = await this.enhancedStreamService.withdrawFromStream(
        id,
        req.user.id
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get claimable amount for a stream
   * GET /api/streams/:id/claimable
   */
  getClaimableAmount = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const claimable = await this.enhancedStreamService.getClaimableAmount(id);

      res.status(200).json({
        success: true,
        data: { claimable },
      });
    } catch (error) {
      next(error);
    }
  };

  cancelStream = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      if (!req.user) {
        throw new UnauthorizedError("User not authenticated");
      }
      const result = await this.enhancedStreamService.cancelStream(id, req.user.id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getStream = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      if (!req.user) {
        throw new UnauthorizedError("User not authenticated");
      }
      const stream = await this.enhancedStreamService.getStream(id, req.user.id);

      res.status(200).json({
        success: true,
        data: stream,
      });
    } catch (error) {
      next(error);
    }
  };

  getUserStreams = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("User not authenticated");
      }
      const streams = await this.enhancedStreamService.getUserStreams(req.user.id);

      res.status(200).json({
        success: true,
        data: streams,
      });
    } catch (error) {
      next(error);
    }
  };
}
