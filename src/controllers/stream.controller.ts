// import { Request, Response, NextFunction } from "express";
// import { prisma } from "../utils/database";
// import { StreamService } from "../services/stream.service";
// import {
//   IStreamCreate,
//   IStreamUpdate,
//   IWithdrawalRequest,
// } from "../types/stream.types";

// export class StreamController {
//   private streamService: StreamService;

//   constructor() {
//     this.streamService = new StreamService();
//   }

//   /**
//    * Create a new payment stream
//    * POST /api/streams
//    */
//   createStream = async (
//     req: Request,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> => {
//     try {
//       const streamData: IStreamCreate = req.body;
//       const result = await this.streamService.createStream(
//         req.user.id,
//         streamData
//       );

//       res.status(201).json({
//         success: true,
//         data: result,
//       });
//     } catch (error) {
//       next(error);
//     }
//   };

//   /**
//    * Get stream by ID
//    * GET /api/streams/:streamId
//    */
//   getStreamById = async (
//     req: Request,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> => {
//     try {
//       const { streamId } = req.params;
//       const stream = await this.streamService.getStreamById(
//         streamId,
//         req.user.id
//       );

//       res.status(200).json({
//         success: true,
//         data: stream,
//       });
//     } catch (error) {
//       next(error);
//     }
//   };

//   /**
//    * Get user's streams
//    * GET /api/streams
//    */
//   getUserStreams = async (
//     req: Request,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> => {
//     try {
//       const { status, page = "1", limit = "10" } = req.query;

//       const pageNum = parseInt(page as string, 10);
//       const limitNum = parseInt(limit as string, 10);

//       const result = await this.streamService.getUserStreams(
//         req.user.id,
//         status as string,
//         pageNum,
//         limitNum
//       );

//       res.status(200).json({
//         success: true,
//         data: result,
//       });
//     } catch (error) {
//       next(error);
//     }
//   };

//   /**
//    * Update stream status
//    * PATCH /api/streams/:streamId/status
//    */
//   updateStreamStatus = async (
//     req: Request,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> => {
//     try {
//       const { streamId } = req.params;
//       const updateData: IStreamUpdate = req.body;

//       const updatedStream = await this.streamService.updateStreamStatus(
//         streamId,
//         req.user.id,
//         updateData
//       );

//       res.status(200).json({
//         success: true,
//         data: updatedStream,
//       });
//     } catch (error) {
//       next(error);
//     }
//   };

//   /**
//    * Process withdrawal request
//    * POST /api/streams/withdraw
//    */
//   processWithdrawal = async (
//     req: Request,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> => {
//     try {
//       const withdrawalRequest: IWithdrawalRequest = req.body;

//       const transaction = await this.streamService.processWithdrawal(
//         req.user.id,
//         withdrawalRequest
//       );

//       res.status(201).json({
//         success: true,
//         data: transaction,
//       });
//     } catch (error) {
//       next(error);
//     }
//   };

//   /**
//    * Confirm escrow deposit
//    * POST /api/streams/:streamId/confirm-escrow
//    */
//   confirmEscrowDeposit = async (
//     req: Request,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> => {
//     try {
//       const { streamId } = req.params;
//       const { transactionHash } = req.body;

//       const updatedStream = await this.streamService.confirmEscrowDeposit(
//         streamId,
//         transactionHash
//       );

//       res.status(200).json({
//         success: true,
//         data: updatedStream,
//       });
//     } catch (error) {
//       next(error);
//     }
//   };

//   /**
//    * Get stream activity (transactions)
//    * GET /api/streams/:streamId/activity
//    */
//   getStreamActivity = async (
//     req: Request,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> => {
//     try {
//       const { streamId } = req.params;
//       const { page = "1", limit = "20" } = req.query;

//       const pageNum = parseInt(page as string, 10);
//       const limitNum = parseInt(limit as string, 10);
//       const skip = (pageNum - 1) * limitNum;

//       // First verify the user has access to this stream
//       await this.streamService.getStreamById(streamId, req.user.id);

//       // Get transactions for this stream
//       const [transactions, total] = await Promise.all([
//         prisma.transaction.findMany({
//           where: { streamId },
//           orderBy: { createdAt: "desc" },
//           skip,
//           take: limitNum,
//         }),
//         prisma.transaction.count({ where: { streamId } }),
//       ]);

//       res.status(200).json({
//         success: true,
//         data: {
//           transactions,
//           total,
//           page: pageNum,
//           totalPages: Math.ceil(total / limitNum),
//         },
//       });
//     } catch (error) {
//       next(error);
//     }
//   };

//   /**
//    * Get active streams for real-time monitoring
//    * GET /api/streams/active
//    */
//   getActiveStreams = async (
//     req: Request,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> => {
//     try {
//       const { tokenAddress } = req.query;

//       const where: any = {
//         status: "ACTIVE",
//       };

//       if (tokenAddress) {
//         where.tokenAddress = tokenAddress;
//       }

//       const streams = await prisma.stream.findMany({
//         where,
//         include: {
//           payer: true,
//           recipient: true,
//         },
//         orderBy: { createdAt: "desc" },
//       });

//       const streamsWithBalance = streams.map((stream) => {
//         const currentBalance = this.calculateCurrentBalance(stream);
//         const availableBalance = this.calculateAvailableBalance(
//           stream,
//           currentBalance
//         );

//         return {
//           ...stream,
//           currentBalance,
//           availableBalance,
//         };
//       });

//       res.status(200).json({
//         success: true,
//         data: streamsWithBalance,
//       });
//     } catch (error) {
//       next(error);
//     }
//   };

//   /**
//    * Helper method to calculate current balance (duplicated from service for controller use)
//    */
//   private calculateCurrentBalance(stream: any): string {
//     if (stream.status === "PENDING") {
//       return "0";
//     }

//     const now = new Date();
//     const startTime = new Date(stream.startTime || stream.createdAt);
//     const endTime =
//       stream.endTime &&
//       (stream.status === "STOPPED" || stream.status === "COMPLETED")
//         ? new Date(stream.endTime)
//         : now;

//     const elapsedSeconds = Math.floor(
//       (endTime.getTime() - startTime.getTime()) / 1000
//     );
//     const flowRate = parseFloat(stream.flowRate);
//     const balance = flowRate * elapsedSeconds;

//     return balance.toFixed(6);
//   }

//   /**
//    * Helper method to calculate available balance (duplicated from service for controller use)
//    */
//   private calculateAvailableBalance(
//     stream: any,
//     currentBalance: string
//   ): string {
//     const balance = parseFloat(currentBalance);
//     const withdrawn = parseFloat(stream.withdrawnAmount);
//     const totalAmount = parseFloat(stream.totalAmount);

//     const availableFromBalance = balance - withdrawn;
//     const availableFromEscrow = totalAmount - withdrawn;

//     return Math.min(availableFromBalance, availableFromEscrow).toFixed(6);
//   }
// }
