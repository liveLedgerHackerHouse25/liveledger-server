// import { prisma } from "../utils/database";
// import {
//   IStream,
//   IStreamCreate,
//   IStreamUpdate,
//   IStreamWithBalance,
//   IWithdrawalRequest,
// } from "../types/stream.types";
// import {
//   ConflictError,
//   NotFoundError,
//   BadRequestError,
//   InsufficientBalanceError,
// } from "../errors/genericErrors";
// import { TransactionType } from "../types/stream.types";

// export class StreamService {
//   /**
//    * Create a new payment stream
//    */
// async createStream(
//   payerId: string,
//   request: CreateStreamRequest
// ): Promise<{ stream: Stream; transaction: PreparedTransaction }> {
//   try {
//     // 1. Validate payer exists (your existing code)
//     const payer = await prisma.user.findUnique({ where: { id: payerId } });
//     if (!payer) throw new NotFoundError("User not found");

//     // 2. Validate/find recipient (your existing code)
//     let recipient = await prisma.user.findUnique({
//       where: { walletAddress: request.recipientAddress.toLowerCase() },
//     });
//     if (!recipient) {
//       recipient = await prisma.user.create({
//         data: { walletAddress: request.recipientAddress.toLowerCase() },
//       });
//     }

//     // 3. Create stream with PENDING status
//     const stream = await prisma.stream.create({
//       data: {
//         payerId,
//         recipientId: recipient.id,
//         tokenAddress: request.tokenAddress.toLowerCase(),
//         flowRate: request.flowRate,
//         totalAmount: request.totalAmount,
//         withdrawnAmount: "0",
//         status: StreamStatus.PENDING, // NOT ACTIVE
//         startTime: new Date(),
//         escrowConfirmed: false, // Funds not secured yet
//       },
//     });

//     // 4. Prepare escrow deposit transaction (NOT execute)
//     const escrowTx = await this.blockchainService.prepareEscrowDeposit(
//       payer.walletAddress,
//       request.totalAmount,
//       stream.id,
//       request.tokenAddress
//     );

//     // 5. Create pending transaction record
//     await prisma.transaction.create({
//       data: {
//         type: TransactionTypes.DEPOSIT,
//         amount: request.totalAmount,
//         status: TransactionStatus.PENDING,
//         fromAddress: payer.walletAddress,
//         toAddress: process.env.ESCROW_CONTRACT_ADDRESS!,
//         streamId: stream.id,
//       },
//     });

//     return {
//       stream,
//       transaction: escrowTx, // Frontend will handle signing
//     };

//   } catch (error) {
//     if (error instanceof AppError) throw error;
//     throw new DatabaseError('Failed to create stream', error);
//   }
// }

//   // /**
//   //  * Get stream by ID
//   //  */
//   // async getStreamById(streamId: string, userId?: string): Promise<IStreamWithBalance> {
//   //   const stream = await prisma.stream.findUnique({
//   //     where: { id: streamId },
//   //     include: {
//   //       payer: true,
//   //       recipient: true
//   //     }
//   //   });

//   //   if (!stream) {
//   //     throw new NotFoundError(`Stream not found: ${streamId}`);
//   //   }

//   //   // If userId is provided, check if user has access to this stream
//   //   if (userId && stream.payerId !== userId && stream.recipientId !== userId) {
//   //     throw new BadRequestError("You don't have access to this stream");
//   //   }

//   //   const currentBalance = this.calculateCurrentBalance(stream);
//   //   const availableBalance = this.calculateAvailableBalance(stream, currentBalance);

//   //   return {
//   //     ...this.mapPrismaStreamToIStream(stream),
//   //     currentBalance,
//   //     availableBalance
//   //   };
//   // }

//   // /**
//   //  * Get streams for a user (as payer or recipient)
//   //  */
//   // async getUserStreams(userId: string, status?: string, page: number = 1, limit: number = 10): Promise<{
//   //   streams: IStreamWithBalance[];
//   //   total: number;
//   //   page: number;
//   //   totalPages: number;
//   // }> {
//   //   const where: any = {
//   //     OR: [
//   //       { payerId: userId },
//   //       { recipientId: userId }
//   //     ]
//   //   };

//   //   if (status) {
//   //     where.status = status;
//   //   }

//   //   const skip = (page - 1) * limit;

//   //   const [streams, total] = await Promise.all([
//   //     prisma.stream.findMany({
//   //       where,
//   //       include: {
//   //         payer: true,
//   //         recipient: true
//   //       },
//   //       orderBy: { createdAt: 'desc' },
//   //       skip,
//   //       take: limit
//   //     }),
//   //     prisma.stream.count({ where })
//   //   ]);

//   //   const streamsWithBalance = streams.map(stream => {
//   //     const currentBalance = this.calculateCurrentBalance(stream);
//   //     const availableBalance = this.calculateAvailableBalance(stream, currentBalance);

//   //     return {
//   //       ...this.mapPrismaStreamToIStream(stream),
//   //       currentBalance,
//   //       availableBalance
//   //     };
//   //   });

//   //   return {
//   //     streams: streamsWithBalance,
//   //     total,
//   //     page,
//   //     totalPages: Math.ceil(total / limit)
//   //   };
//   // }

//   // /**
//   //  * Update stream status
//   //  */
//   // async updateStreamStatus(streamId: string, userId: string, updateData: IStreamUpdate): Promise<IStream> {
//   //   const stream = await prisma.stream.findUnique({
//   //     where: { id: streamId },
//   //     include: {
//   //       payer: true,
//   //       recipient: true
//   //     }
//   //   });

//   //   if (!stream) {
//   //     throw new NotFoundError(`Stream not found: ${streamId}`);
//   //   }

//   //   // Only payer can update stream status
//   //   if (stream.payerId !== userId) {
//   //     throw new BadRequestError("Only the payer can update stream status");
//   //   }

//   //   // Validate status transitions
//   //   this.validateStatusTransition(stream.status, updateData.status!);

//   //   const updatedStream = await prisma.stream.update({
//   //     where: { id: streamId },
//   //     data: {
//   //       status: updateData.status,
//   //       endTime: updateData.status === "STOPPED" || updateData.status === "COMPLETED" ? new Date() : undefined
//   //     },
//   //     include: {
//   //       payer: true,
//   //       recipient: true
//   //     }
//   //   });

//   //   // Create transaction record for status change
//   //   const transactionType = this.getTransactionTypeForStatus(updateData.status!);
//   //   if (transactionType) {
//   //     await prisma.transaction.create({
//   //       data: {
//   //         streamId: stream.id,
//   //         type: transactionType,
//   //         amount: "0",
//   //         status: "CONFIRMED",
//   //         fromAddress: stream.payer.walletAddress,
//   //         toAddress: stream.recipient.walletAddress,
//   //         tokenAddress: stream.tokenAddress
//   //       }
//   //     });
//   //   }

//   //   return this.mapPrismaStreamToIStream(updatedStream);
//   // }

//   // /**
//   //  * Process withdrawal request
//   //  */
//   // async processWithdrawal(userId: string, withdrawalRequest: IWithdrawalRequest): Promise<any> {
//   //   const { streamId, amount } = withdrawalRequest;

//   //   const stream = await prisma.stream.findUnique({
//   //     where: { id: streamId },
//   //     include: {
//   //       payer: true,
//   //       recipient: true
//   //     }
//   //   });

//   //   if (!stream) {
//   //     throw new NotFoundError(`Stream not found: ${streamId}`);
//   //   }

//   //   // Only recipient can withdraw
//   //   if (stream.recipientId !== userId) {
//   //     throw new BadRequestError("Only the recipient can withdraw from this stream");
//   //   }

//   //   // Check stream status
//   //   if (stream.status !== "ACTIVE" && stream.status !== "PAUSED") {
//   //     throw new BadRequestError("Can only withdraw from active or paused streams");
//   //   }

//   //   // Calculate current balance
//   //   const currentBalance = this.calculateCurrentBalance(stream);
//   //   const availableBalance = this.calculateAvailableBalance(stream, currentBalance);

//   //   // Check if withdrawal amount is valid
//   //   const withdrawalAmount = parseFloat(amount);
//   //   const availableAmount = parseFloat(availableBalance);

//   //   if (withdrawalAmount > availableAmount) {
//   //     throw new InsufficientBalanceError(amount, availableBalance, stream.tokenAddress);
//   //   }

//   //   // Create withdrawal transaction
//   //   const transaction = await prisma.transaction.create({
//   //     data: {
//   //       streamId: stream.id,
//   //       type: "WITHDRAWAL" as TransactionType,
//   //       amount,
//   //       status: "PENDING",
//   //       fromAddress: stream.payer.walletAddress,
//   //       toAddress: stream.recipient.walletAddress,
//   //       tokenAddress: stream.tokenAddress
//   //     }
//   //   });

//   //   // Update withdrawn amount
//   //   const newWithdrawnAmount = (parseFloat(stream.withdrawnAmount) + withdrawalAmount).toString();
//   //   await prisma.stream.update({
//   //     where: { id: streamId },
//   //     data: {
//   //       withdrawnAmount: newWithdrawnAmount
//   //     }
//   //   });

//   //   return transaction;
//   // }

//   // /**
//   //  * Confirm escrow deposit
//   //  */
//   // async confirmEscrowDeposit(streamId: string, transactionHash: string): Promise<IStream> {
//   //   const stream = await prisma.stream.findUnique({
//   //     where: { id: streamId },
//   //     include: {
//   //       payer: true,
//   //       recipient: true
//   //     }
//   //   });

//   //   if (!stream) {
//   //     throw new NotFoundError(`Stream not found: ${streamId}`);
//   //   }

//   //   // Update stream status to ACTIVE
//   //   const updatedStream = await prisma.stream.update({
//   //     where: { id: streamId },
//   //     data: {
//   //       status: "ACTIVE",
//   //       escrowConfirmed: true,
//   //       startTime: new Date()
//   //     },
//   //     include: {
//   //       payer: true,
//   //       recipient: true
//   //     }
//   //   });

//   //   // Update escrow transaction
//   //   await prisma.transaction.updateMany({
//   //     where: {
//   //       streamId: streamId,
//   //       type: "ESCROW_DEPOSIT"
//   //     },
//   //     data: {
//   //       status: "CONFIRMED",
//   //       transactionHash
//   //     }
//   //   });

//   //   // Create stream start transaction
//   //   await prisma.transaction.create({
//   //     data: {
//   //       streamId: stream.id,
//   //       type: "STREAM_START" as TransactionType,
//   //       amount: "0",
//   //       status: "CONFIRMED",
//   //       transactionHash,
//   //       fromAddress: stream.payer.walletAddress,
//   //       toAddress: stream.recipient.walletAddress,
//   //       tokenAddress: stream.tokenAddress
//   //     }
//   //   });

//   //   return this.mapPrismaStreamToIStream(updatedStream);
//   // }

//   // /**
//   //  * Calculate current balance based on flow rate and elapsed time
//   //  */
//   // private calculateCurrentBalance(stream: any): string {
//   //   if (stream.status === "PENDING") {
//   //     return "0";
//   //   }

//   //   const now = new Date();
//   //   const startTime = new Date(stream.startTime || stream.createdAt);
//   //   const endTime = stream.endTime && (stream.status === "STOPPED" || stream.status === "COMPLETED")
//   //     ? new Date(stream.endTime)
//   //     : now;

//   //   // Calculate elapsed seconds
//   //   const elapsedSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

//   //   // Calculate balance: flowRate * elapsedSeconds
//   //   const flowRate = parseFloat(stream.flowRate);
//   //   const balance = flowRate * elapsedSeconds;

//   //   return balance.toFixed(6);
//   // }

//   // /**
//   //  * Calculate available balance (current balance - withdrawn amount)
//   //  */
//   // private calculateAvailableBalance(stream: any, currentBalance: string): string {
//   //   const balance = parseFloat(currentBalance);
//   //   const withdrawn = parseFloat(stream.withdrawnAmount);
//   //   const totalAmount = parseFloat(stream.totalAmount);

//   //   // Available balance is the minimum of:
//   //   // 1. Current balance minus withdrawn amount
//   //   // 2. Total escrow amount minus withdrawn amount
//   //   const availableFromBalance = balance - withdrawn;
//   //   const availableFromEscrow = totalAmount - withdrawn;

//   //   return Math.min(availableFromBalance, availableFromEscrow).toFixed(6);
//   // }

//   // /**
//   //  * Validate stream status transitions
//   //  */
//   // private validateStatusTransition(currentStatus: string, newStatus: string): void {
//   //   const validTransitions: { [key: string]: string[] } = {
//   //     "PENDING": ["ACTIVE", "STOPPED"],
//   //     "ACTIVE": ["PAUSED", "STOPPED"],
//   //     "PAUSED": ["ACTIVE", "STOPPED"],
//   //     "STOPPED": [],
//   //     "COMPLETED": []
//   //   };

//   //   const allowedTransitions = validTransitions[currentStatus] || [];
//   //   if (!allowedTransitions.includes(newStatus)) {
//   //     throw new BadRequestError(`Cannot transition from ${currentStatus} to ${newStatus}`);
//   //   }
//   // }

//   // /**
//   //  * Get transaction type for status change
//   //  */
//   // private getTransactionTypeForStatus(status: string): string | null {
//   //   const statusToTransactionType: { [key: string]: string } = {
//   //     "ACTIVE": "STREAM_START",
//   //     "PAUSED": "STREAM_PAUSE",
//   //     "STOPPED": "STREAM_STOP"
//   //   };

//   //   return statusToTransactionType[status] || null;
//   // }

//   // /**
//   //  * Map Prisma stream to IStream interface
//   //  */
//   // private mapPrismaStreamToIStream(prismaStream: any): IStream {
//   //   return {
//   //     id: prismaStream.id,
//   //     payerId: prismaStream.payerId,
//   //     recipientId: prismaStream.recipientId,
//   //     recipientAddress: prismaStream.recipient.walletAddress,
//   //     tokenAddress: prismaStream.tokenAddress,
//   //     flowRate: prismaStream.flowRate,
//   //     totalAmount: prismaStream.totalAmount,
//   //     status: prismaStream.status,
//   //     withdrawnAmount: prismaStream.withdrawnAmount,
//   //     startTime: prismaStream.startTime,
//   //     endTime: prismaStream.endTime,
//   //     escrowConfirmed: prismaStream.escrowConfirmed,
//   //     createdAt: prismaStream.createdAt,
//   //     updatedAt: prismaStream.updatedAt
//   //   };
//   // }
// }
