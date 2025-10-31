import { prisma } from "../utils/database";
import {
  MockBlockchainService,
  MockPreparedTransaction
} from "./mockBlockchain.service";
import { EnhancedBlockchainService } from "./enhancedBlockchain.service";
import { BalanceSimulationService } from "./balanceSimulation.service";
import { WithdrawalManagementService } from "./withdrawalManagement.service";
import { WebSocketService } from "./websocket.service";
import { IStreamCreate } from "../types/stream.types";
import { NotFoundError, BadRequestError } from "../errors/genericErrors";
import { PreparedTransaction, CreateStreamParams } from "../types/blockchain.types";
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
  maxWithdrawalsPerDay?: number;
}

export class EnhancedStreamService {
  private mockBlockchainService: MockBlockchainService;
  private enhancedBlockchainService: EnhancedBlockchainService;
  private balanceService: BalanceSimulationService | null = null;
  private withdrawalService: WithdrawalManagementService | null = null;
  private websocketService: WebSocketService | null = null;

  constructor() {
    this.mockBlockchainService = new MockBlockchainService();
    this.enhancedBlockchainService = new EnhancedBlockchainService();
  }

  private getBalanceService(): BalanceSimulationService {
    if (!this.balanceService) {
      this.balanceService = BalanceSimulationService.getInstance();
    }
    return this.balanceService;
  }

  private getWithdrawalService(): WithdrawalManagementService {
    if (!this.withdrawalService) {
      this.withdrawalService = WithdrawalManagementService.getInstance();
    }
    return this.withdrawalService;
  }

  private getWebSocketService(): WebSocketService {
    if (!this.websocketService) {
      this.websocketService = WebSocketService.getInstance();
    }
    return this.websocketService;
  }

  /**
   * Create a new payment stream following LiveLedger patterns
   */
  async createStream(
    payerId: string,
    request: CreateStreamRequest
  ): Promise<{ stream: Stream; transaction: MockPreparedTransaction | PreparedTransaction }> {
    try {
      // 1. Validate payer exists
      const payer = await prisma.user.findUnique({
        where: { id: payerId }
      });
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

      // 3. Calculate duration if not provided (based on totalAmount / flowRate)
      const totalAmountWei = BigInt(request.totalAmount);
      const flowRateWei = BigInt(request.flowRate);
      const duration = request.duration || Math.floor(Number(totalAmountWei) / Number(flowRateWei));

      // 4. Validate business logic (totalAmount == flowRate * duration)
      const expectedTotal = flowRateWei * BigInt(duration);
      if (totalAmountWei !== expectedTotal) {
        throw new BadRequestError(
          `Total amount must equal flowRate * duration. Expected: ${expectedTotal.toString()}, Got: ${request.totalAmount}`
        );
      }

      // 5. Create stream with PENDING status
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
          endTime: new Date(Date.now() + duration * 1000), // Calculate end time
          escrowConfirmed: false,
        },
      });

      // 6. Prepare blockchain transaction
      let blockchainTx: MockPreparedTransaction | PreparedTransaction;

      if (process.env.USE_REAL_BLOCKCHAIN === "true") {
        const createStreamParams: CreateStreamParams = {
          payerAddress: payer.walletAddress,
          recipient: request.recipientAddress,
          token: request.tokenAddress,
          totalAmount: request.totalAmount,
          ratePerSecond: request.flowRate,
          duration,
          maxWithdrawalsPerDay: request.maxWithdrawalsPerDay || 2,
        };
        blockchainTx = await this.enhancedBlockchainService.prepareCreateStream(createStreamParams);
      } else {
        // Use mock blockchain service
        blockchainTx = await this.mockBlockchainService.prepareEscrowDeposit(
          payer.walletAddress,
          request.totalAmount,
          stream.id,
          request.tokenAddress
        );
      }

      // 7. Create pending transaction record
      await prisma.transaction.create({
        data: {
          type: TransactionType.DEPOSIT,
          amount: request.totalAmount,
          status: TransactionStatus.PENDING,
          fromAddress: payer.walletAddress,
          toAddress: process.env.ESCROW_CONTRACT_ADDRESS || "0xLiveLedgerContract",
          streamId: stream.id,
        },
      });

      // 8. Notify WebSocket clients
      this.getWebSocketService().notifyStreamCreated(
        stream.id,
        payer.walletAddress,
        recipient.walletAddress
      );

      return {
        stream,
        transaction: blockchainTx,
      };
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof BadRequestError)
        throw error;
      throw new BadRequestError("Failed to create stream");
    }
  }

  /**
   * Confirm stream creation after blockchain transaction
   */
  async confirmStreamCreation(streamId: string): Promise<Stream> {
    try {
      // Simulate blockchain confirmation
      if (process.env.USE_REAL_BLOCKCHAIN === "true") {
        // In real implementation, verify transaction on blockchain
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        await this.mockBlockchainService.confirmTransaction(streamId);
      }

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
   * Withdraw from an active stream with daily limit enforcement
   */
  async withdrawFromStream(
    streamId: string,
    recipientId: string
  ): Promise<{ amount: string; transactionHash?: string }> {
    try {
      const stream = await prisma.stream.findUnique({
        where: { id: streamId },
        include: { recipient: true },
      });

      if (!stream || stream.recipientId !== recipientId) {
        console.log("Stream access check:", {
          streamFound: !!stream,
          streamRecipientId: stream?.recipientId,
          requestedRecipientId: recipientId,
          match: stream?.recipientId === recipientId
        });
        throw new NotFoundError("Stream not found or access denied");
      }

      if (stream.status !== StreamStatus.ACTIVE) {
        throw new BadRequestError("Stream is not active");
      }

      // Check daily withdrawal limits
      this.getWithdrawalService().validateWithdrawal(stream.recipient.walletAddress, 2);

      // Calculate claimable amount using off-chain simulation
      const claimableAmount = this.getBalanceService().calculateClaimableAmount(stream);

      console.log("Withdrawal check:", {
        streamId,
        recipientId,
        claimableAmount,
        streamStatus: stream.status,
        startTime: stream.startTime,
        currentTime: new Date()
      });

      if (claimableAmount === "0") {
        throw new BadRequestError("No funds available for withdrawal");
      }

      // Perform withdrawal on blockchain
      let withdrawalResult: { success: boolean; amount: string; transactionHash?: string };

      if (process.env.USE_REAL_BLOCKCHAIN === "true") {
        // Use enhanced blockchain service
        const streamIdNum = parseInt(streamId);
        withdrawalResult = await this.enhancedBlockchainService.withdraw(streamIdNum, stream.recipient.walletAddress);
      } else {
        // Use mock blockchain service
        console.log("Calling mock blockchain withdraw:", { streamId, claimableAmount });
        withdrawalResult = await this.mockBlockchainService.withdraw(streamId, stream.recipient.walletAddress);
        console.log("Mock blockchain withdraw result:", withdrawalResult);
      }

      if (!withdrawalResult.success) {
        throw new BadRequestError("Withdrawal failed or no funds available");
      }

      console.log("Withdrawal successful, updating database...");

      // Update database with withdrawn amount
      const newWithdrawnAmount = (
        BigInt(stream.withdrawnAmount) + BigInt(withdrawalResult.amount)
      ).toString();

      await prisma.stream.update({
        where: { id: streamId },
        data: { withdrawnAmount: newWithdrawnAmount },
      });

      // Ensure escrow contract user exists for transaction recording
      const escrowAddress = process.env.ESCROW_CONTRACT_ADDRESS || "0xLiveLedgerContract";
      let escrowUser = await prisma.user.findUnique({
        where: { walletAddress: escrowAddress.toLowerCase() },
      });

      if (!escrowUser) {
        escrowUser = await prisma.user.create({
          data: {
            walletAddress: escrowAddress.toLowerCase(),
            name: "LiveLedger Escrow Contract",
            type: "RECIPIENT",
          },
        });
      }

      // Record withdrawal transaction
      await prisma.transaction.create({
        data: {
          type: TransactionType.WITHDRAWAL,
          amount: withdrawalResult.amount,
          status: TransactionStatus.CONFIRMED,
          fromAddress: escrowAddress.toLowerCase(),
          toAddress: stream.recipient.walletAddress,
          streamId: stream.id,
          txHash: withdrawalResult.transactionHash,
        },
      });

      // Record withdrawal for daily limit tracking
      this.getWithdrawalService().recordWithdrawal(stream.recipient.walletAddress);

      // Notify WebSocket clients
      this.getWebSocketService().notifyWithdrawal(
        streamId,
        stream.recipient.walletAddress,
        withdrawalResult.amount,
        withdrawalResult.transactionHash
      );

      return {
        amount: withdrawalResult.amount,
        transactionHash: withdrawalResult.transactionHash,
      };
    } catch (error) {
      console.log("Withdrawal error:", error);
      if (error instanceof NotFoundError || error instanceof BadRequestError)
        throw error;
      throw new BadRequestError("Failed to withdraw from stream");
    }
  }

  /**
   * Get claimable amount for a stream (off-chain simulation)
   */
  async getClaimableAmount(streamId: string): Promise<string> {
    try {
      const stream = await prisma.stream.findUnique({
        where: { id: streamId },
      });

      if (!stream) {
        throw new NotFoundError("Stream not found");
      }

      // Use off-chain balance simulation instead of blockchain call
      return this.getBalanceService().calculateClaimableAmount(stream);
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
  ): Promise<{ refundAmount: string; transactionHash?: string }> {
    try {
      const stream = await prisma.stream.findUnique({
        where: { id: streamId },
        include: { payer: true },
      });

      if (!stream || stream.payerId !== payerId) {
        throw new NotFoundError("Stream not found or access denied");
      }

      let cancelResult: { success: boolean; refundAmount: string; transactionHash?: string };

      if (process.env.USE_REAL_BLOCKCHAIN === "true") {
        const streamIdNum = parseInt(streamId);
        cancelResult = await this.enhancedBlockchainService.cancelStream(streamIdNum, stream.payer.walletAddress);
      } else {
        cancelResult = await this.mockBlockchainService.cancelStream(streamId, stream.payer.walletAddress);
      }

      if (!cancelResult.success) {
        throw new BadRequestError("Failed to cancel stream");
      }

      // Update stream status
      await prisma.stream.update({
        where: { id: streamId },
        data: { status: StreamStatus.STOPPED },
      });

      // Record refund transaction if any
      if (cancelResult.refundAmount !== "0") {
        // Ensure escrow contract user exists for transaction recording
        const escrowAddress = process.env.ESCROW_CONTRACT_ADDRESS || "0xLiveLedgerContract";
        let escrowUser = await prisma.user.findUnique({
          where: { walletAddress: escrowAddress.toLowerCase() },
        });

        if (!escrowUser) {
          escrowUser = await prisma.user.create({
            data: {
              walletAddress: escrowAddress.toLowerCase(),
              name: "LiveLedger Escrow Contract",
              type: "RECIPIENT",
            },
          });
        }

        await prisma.transaction.create({
          data: {
            type: TransactionType.STREAM_STOP,
            amount: cancelResult.refundAmount,
            status: TransactionStatus.CONFIRMED,
            fromAddress: escrowAddress.toLowerCase(),
            toAddress: stream.payer.walletAddress,
            streamId: stream.id,
            txHash: cancelResult.transactionHash,
          },
        });
      }

      // Notify WebSocket clients
      const recipient = await prisma.user.findUnique({
        where: { id: stream.recipientId }
      });

      this.getWebSocketService().notifyStreamCancelled(
        streamId,
        stream.payer.walletAddress,
        recipient?.walletAddress || "",
        cancelResult.refundAmount
      );

      return {
        refundAmount: cancelResult.refundAmount,
        transactionHash: cancelResult.transactionHash,
      };
    } catch (error) {
      console.log("Cancel stream error:", error);
      if (error instanceof NotFoundError || error instanceof BadRequestError)
        throw error;
      throw new BadRequestError("Failed to cancel stream");
    }
  }

  /**
   * Get stream with enhanced balance information
   */
  async getStream(streamId: string, userId: string): Promise<any> {
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

    // Enhance with balance information
    const enhancedStream = await this.getBalanceService().enhanceStreamWithBalance(stream);

    // Add withdrawal limit info for recipients
    if (stream.recipientId === userId) {
      const withdrawalInfo = this.getWithdrawalService().getWithdrawalLimitInfo(stream.recipient.walletAddress);
      return {
        ...enhancedStream,
        withdrawalsToday: withdrawalInfo.withdrawalsToday,
        nextWithdrawalAvailable: withdrawalInfo.nextWithdrawalAvailable,
      };
    }

    return enhancedStream;
  }

  /**
   * Get user's streams with enhanced balance information
   */
  async getUserStreams(userId: string): Promise<any[]> {
    const streams = await prisma.stream.findMany({
      where: {
        OR: [{ payerId: userId }, { recipientId: userId }],
      },
      include: {
        payer: { select: { id: true, name: true, walletAddress: true } },
        recipient: { select: { id: true, name: true, walletAddress: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Enhance all streams with balance information
    const enhancedStreams = await Promise.all(
      streams.map(async (stream) => {
        const enhanced = await this.getBalanceService().enhanceStreamWithBalance(stream);

        // Add withdrawal limit info for recipients
        if (stream.recipientId === userId) {
          const withdrawalInfo = this.getWithdrawalService().getWithdrawalLimitInfo(stream.recipient.walletAddress);
          return {
            ...enhanced,
            withdrawalsToday: withdrawalInfo.withdrawalsToday,
            nextWithdrawalAvailable: withdrawalInfo.nextWithdrawalAvailable,
          };
        }

        return enhanced;
      })
    );

    return enhancedStreams;
  }

  /**
   * Get withdrawal limit information for a user
   */
  async getWithdrawalLimitInfo(userAddress: string) {
    return this.getWithdrawalService().getWithdrawalLimitInfo(userAddress);
  }
}