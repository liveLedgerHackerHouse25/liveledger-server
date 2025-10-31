// services/stream.service.ts
import { prisma } from "../utils/database";
import {
  MockBlockchainService,
  MockPreparedTransaction,
} from "./mockBlockchain.service";
import { IStreamCreate, IWithdrawalRequest } from "../types/stream.types";
// import {
//   NotFoundError,
//   BadRequestError,
//   DatabaseError,
// } from "../errors/genericErrors";
import { NotFoundError, BadRequestError } from "../errors/genericErrors";
import { PreparedTransaction } from "../types/blockchain.types";
import {
  Stream,
  StreamStatus,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";

interface CreateStreamRequest {
  recipientAddress: string;
  tokenAddress: string;
  flowRate: string;
  totalAmount: string;
  duration?: number;
}

export class StreamService {
  private blockchainService: MockBlockchainService;

  constructor() {
    this.blockchainService = new MockBlockchainService();
  }

  /**
   * Create a new payment stream
   */
  async createStream(
    payerId: string,
    request: CreateStreamRequest
  ): Promise<{ stream: Stream; transaction: MockPreparedTransaction }> {
    try {
      // 1. Validate payer exists
      const payer = await prisma.user.findUnique({ where: { id: payerId } });
      if (!payer) throw new NotFoundError("User not found");

      // 2. Validate/find recipient
      let recipient = await prisma.user.findUnique({
        where: { walletAddress: request.recipientAddress.toLowerCase() },
      });
      if (!recipient) {
        recipient = await prisma.user.create({
          data: { walletAddress: request.recipientAddress.toLowerCase() },
        });
      }

      // 3. Create stream with PENDING status
      const stream = await prisma.stream.create({
        data: {
          payerId,
          recipientId: recipient.id,
          tokenAddress: request.tokenAddress.toLowerCase(),
          flowRate: request.flowRate,
          totalAmount: request.totalAmount,
          withdrawnAmount: "0",
          status: StreamStatus.PENDING,
          startTime: new Date(),
          escrowConfirmed: false,
        },
      });

      // 4. Prepare escrow deposit transaction using mock service
      const escrowTx = await this.blockchainService.prepareEscrowDeposit(
        payer.walletAddress,
        request.totalAmount,
        stream.id,
        request.tokenAddress
      );

      // 5. Create pending transaction record
      await prisma.transaction.create({
        data: {
          type: TransactionType.DEPOSIT,
          amount: request.totalAmount,
          status: TransactionStatus.PENDING,
          fromAddress: payer.walletAddress,
          toAddress: process.env.ESCROW_CONTRACT_ADDRESS!,
          streamId: stream.id,
        },
      });

      return {
        stream,
        transaction: escrowTx, // Frontend will handle signing
      };
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof BadRequestError)
        throw error;
      throw new BadRequestError("Failed to create stream");
    }
  }

  // /**
  //  * Confirm stream creation after transaction is signed
  //  */
  async confirmStreamCreation(streamId: string): Promise<Stream> {
    try {
      // Simulate blockchain confirmation
      await this.blockchainService.confirmTransaction(streamId);

      // Update stream status in database
      const updatedStream = await prisma.stream.update({
        where: { id: streamId },
        data: {
          status: StreamStatus.ACTIVE,
          escrowConfirmed: true,
        },
      });

      // Update transaction status
      await prisma.transaction.updateMany({
        where: {
          streamId,
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.PENDING,
        },
        data: { status: TransactionStatus.CONFIRMED },
      });

      return updatedStream;
    } catch (error) {
      throw new BadRequestError("Failed to confirm stream creation");
    }
  }

  /**
   * Withdraw from an active stream
   */
  async withdrawFromStream(
    streamId: string,
    recipientId: string
  ): Promise<{ amount: string }> {
    try {
      const stream = await prisma.stream.findUnique({
        where: { id: streamId },
        include: { recipient: true },
      });

      if (!stream || stream.recipientId !== recipientId) {
        throw new NotFoundError("Stream not found or access denied");
      }

      if (stream.status !== StreamStatus.ACTIVE) {
        throw new BadRequestError("Stream is not active");
      }

      console.log("Withdrawal attempt:", {
        streamId,
        recipientId,
        streamRecipientId: stream?.recipientId,
        streamExists: !!stream,
      });

      if (!stream || stream.recipientId !== recipientId) {
        console.log("Access denied - stream:", {
          streamRecipientId: stream?.recipientId,
          providedRecipientId: recipientId,
          match: stream?.recipientId === recipientId,
        });
        throw new NotFoundError("Stream not found or access denied");
      }

      // Use mock blockchain service to perform withdrawal
      const result = await this.blockchainService.withdraw(
        streamId,
        stream.recipient.walletAddress
      );

      if (!result.success) {
        throw new BadRequestError("Withdrawal failed or no funds available");
      }

      // Update database with withdrawn amount
      const newWithdrawnAmount = (
        BigInt(stream.withdrawnAmount) + BigInt(result.amount)
      ).toString();

      await prisma.stream.update({
        where: { id: streamId },
        data: { withdrawnAmount: newWithdrawnAmount },
      });

      // Record withdrawal transaction
      await prisma.transaction.create({
        data: {
          type: TransactionType.WITHDRAWAL,
          amount: result.amount,
          status: TransactionStatus.CONFIRMED,
          fromAddress: process.env.ESCROW_CONTRACT_ADDRESS!,
          toAddress: stream.recipient.walletAddress,
          streamId: stream.id,
        },
      });

      return { amount: result.amount };
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof BadRequestError)
        throw error;
      throw new BadRequestError("Failed to withdraw from stream");
    }
  }

  /**
   * Get claimable amount for a stream
   */
  async getClaimableAmount(streamId: string): Promise<string> {
    try {
      const stream = await prisma.stream.findUnique({
        where: { id: streamId },
      });

      if (!stream) {
        throw new NotFoundError("Stream not found");
      }

      if (stream.status !== StreamStatus.ACTIVE) {
        return "0";
      }

      return await this.blockchainService.getClaimableAmount(streamId);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new BadRequestError("Failed to get claimable amount");
    }
  }

  /**
   * Cancel a stream and process refund
   */
  async cancelStream(
    streamId: string,
    payerId: string
  ): Promise<{ refundAmount: string }> {
    try {
      const stream = await prisma.stream.findUnique({
        where: { id: streamId },
        include: { payer: true },
      });

      if (!stream || stream.payerId !== payerId) {
        throw new NotFoundError("Stream not found or access denied");
      }

      const result = await this.blockchainService.cancelStream(
        streamId,
        stream.payer.walletAddress
      );

      if (!result.success) {
        throw new BadRequestError("Failed to cancel stream");
      }

      // Update stream status
      await prisma.stream.update({
        where: { id: streamId },
        data: { status: StreamStatus.STOPPED },
      });

      // Record refund transaction if any
      // if (result.refundAmount !== "0") {
      //   await prisma.transaction.create({
      //     data: {
      //       type: TransactionType.,
      //       amount: result.refundAmount,
      //       status: TransactionStatus.CONFIRMED,
      //       fromAddress: process.env.ESCROW_CONTRACT_ADDRESS!,
      //       toAddress: stream.payer.walletAddress,
      //       streamId: stream.id,
      //     },
      //   });
      // }

      return { refundAmount: result.refundAmount };
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof BadRequestError)
        throw error;
      throw new BadRequestError("Failed to cancel stream");
    }
  }

  async getStream(streamId: string, userId: string): Promise<Stream> {
    const stream = await prisma.stream.findUnique({
      where: { id: streamId },
      include: { payer: true, recipient: true },
    });

    if (
      !stream ||
      (stream.payerId !== userId && stream.recipientId !== userId)
    ) {
      throw new NotFoundError("Stream not found");
    }

    return stream;
  }

  async getUserStreams(userId: string): Promise<Stream[]> {
    return await prisma.stream.findMany({
      where: {
        OR: [{ payerId: userId }, { recipientId: userId }],
      },
      include: {
        payer: { select: { id: true, name: true, walletAddress: true } },
        recipient: { select: { id: true, name: true, walletAddress: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
