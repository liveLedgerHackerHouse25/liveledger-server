// src/services/streaming-calculation.service.ts
import { ethers } from "ethers";
import { prisma } from "../utils/database";
import { 
  StreamDetails, 
  StreamCalculation, 
  WithdrawalLimits 
} from "../types/stream.types";
import { BlockchainError } from "../errors/genericErrors";

/**
 * Service that handles real-time streaming payment calculations
 * Mirrors the smart contract logic for getClaimable calculations
 * Provides off-chain state management with periodic on-chain synchronization
 */
export class StreamingCalculationService {
  private provider: ethers.providers.JsonRpcProvider;
  private liveLedgerContractAddress: string;
  private liveLedgerContractABI = [
    "function getClaimable(uint256 streamId) external view returns (uint128)",
    "function getStream(uint256 streamId) external view returns (address payer, address recipient, address token, uint128 totalAmount, uint128 withdrawn, uint64 startTime, uint64 endTime, uint8 maxWithdrawalsPerDay, bool active)",
    "function getWithdrawalsPerDay(uint256 streamId, uint32 dayIndex) external view returns (uint8)",
    "event StreamCreated(uint256 indexed streamId, address indexed payer, address indexed recipient, address token, uint128 totalAmount, uint128 ratePerSecond, uint64 startTime, uint64 endTime, uint8 maxWithdrawalsPerDay)",
    "event Withdraw(uint256 indexed streamId, address indexed recipient, uint128 amount, uint32 dayIndex, uint8 withdrawalsToday)",
    "event StreamCancelled(uint256 indexed streamId, address indexed payer, uint128 refundAmount, uint128 claimableAmount)"
  ];

  constructor() {
    const rpcUrl = process.env.ARBITRUM_RPC_URL;
    if (!rpcUrl) {
      throw new Error("ARBITRUM_RPC_URL environment variable is required");
    }
    
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.liveLedgerContractAddress = process.env.LIVE_LEDGER_CONTRACT_ADDRESS!;
  }

  /**
   * Calculate real-time stream balance using off-chain logic
   * Mirrors smart contract getClaimable function exactly
   */
  async calculateStreamBalance(streamId: string, onChainStreamId?: number): Promise<StreamCalculation> {
    try {
      // Get stream from database
      const stream = await prisma.stream.findUnique({
        where: { id: streamId },
        include: {
          payer: true,
          recipient: true
        }
      });

      if (!stream) {
        throw new Error(`Stream not found: ${streamId}`);
      }

      const now = Math.floor(Date.now() / 1000); // Current timestamp in seconds
      const startTime = Math.floor(new Date(stream.startTime).getTime() / 1000);
      const endTime = stream.endTime ? Math.floor(new Date(stream.endTime).getTime() / 1000) : null;

      // If stream hasn't started yet
      if (now < startTime) {
        return {
          streamId,
          currentBalance: "0",
          claimableAmount: "0",
          totalStreamed: "0",
          withdrawnAmount: stream.withdrawnAmount,
          progress: 0,
          isActive: stream.status === "ACTIVE",
          ratePerSecond: stream.flowRate,
          startTime,
          endTime,
          lastCalculated: now
        };
      }

      // Calculate elapsed time (capped at stream duration if endTime exists)
      let elapsedTime: number;
      if (endTime && now >= endTime) {
        elapsedTime = endTime - startTime;
      } else {
        elapsedTime = now - startTime;
      }

      // Calculate total accrued amount using rate per second
      const ratePerSecond = parseFloat(stream.flowRate);
      const totalStreamed = ratePerSecond * elapsedTime;
      
      // Calculate claimable amount (total streamed - already withdrawn)
      const withdrawnAmount = parseFloat(stream.withdrawnAmount);
      const claimableAmount = Math.max(0, totalStreamed - withdrawnAmount);
      
      // Calculate progress (if total amount is set)
      const totalAmount = parseFloat(stream.totalAmount);
      const progress = totalAmount > 0 ? Math.min(100, (totalStreamed / totalAmount) * 100) : 0;

      return {
        streamId,
        currentBalance: totalStreamed.toFixed(6),
        claimableAmount: claimableAmount.toFixed(6),
        totalStreamed: totalStreamed.toFixed(6),
        withdrawnAmount: stream.withdrawnAmount,
        progress,
        isActive: stream.status === "ACTIVE",
        ratePerSecond: stream.flowRate,
        startTime,
        endTime,
        lastCalculated: now
      };

    } catch (error) {
      throw new BlockchainError("Failed to calculate stream balance", error);
    }
  }

  /**
   * Calculate withdrawal limits based on daily restrictions
   * Mirrors smart contract withdrawal limit logic
   */
  async calculateWithdrawalLimits(streamId: string, onChainStreamId?: number): Promise<WithdrawalLimits> {
    try {
      const stream = await prisma.stream.findUnique({
        where: { id: streamId }
      });

      if (!stream) {
        throw new Error(`Stream not found: ${streamId}`);
      }

      // For MVP, we'll use a default of 3 withdrawals per day
      // In production, this would come from the smart contract
      const maxWithdrawalsPerDay = 3;
      
      // Calculate current day index (days since stream start)
      const startTime = new Date(stream.startTime).getTime();
      const now = Date.now();
      const dayIndex = Math.floor((now - startTime) / (24 * 60 * 60 * 1000));

      // Count withdrawals for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const withdrawalsToday = await prisma.transaction.count({
        where: {
          streamId,
          type: "WITHDRAWAL",
          status: "CONFIRMED",
          completedAt: {
            gte: today,
            lt: tomorrow
          }
        }
      });

      const remainingWithdrawals = Math.max(0, maxWithdrawalsPerDay - withdrawalsToday);
      const canWithdraw = remainingWithdrawals > 0;

      // Calculate time until next withdrawal window (if at limit)
      let nextWithdrawalTime: number | null = null;
      if (!canWithdraw) {
        const tomorrowMidnight = new Date(tomorrow);
        nextWithdrawalTime = Math.floor(tomorrowMidnight.getTime() / 1000);
      }

      return {
        maxWithdrawalsPerDay,
        withdrawalsUsedToday: withdrawalsToday,
        remainingWithdrawals,
        canWithdraw,
        dayIndex,
        nextWithdrawalTime
      };

    } catch (error) {
      throw new BlockchainError("Failed to calculate withdrawal limits", error);
    }
  }

  /**
   * Get comprehensive stream details with real-time calculations
   */
  async getStreamDetails(streamId: string, onChainStreamId?: number): Promise<StreamDetails> {
    try {
      const [calculation, withdrawalLimits] = await Promise.all([
        this.calculateStreamBalance(streamId, onChainStreamId),
        this.calculateWithdrawalLimits(streamId, onChainStreamId)
      ]);

      const stream = await prisma.stream.findUnique({
        where: { id: streamId },
        include: {
          payer: true,
          recipient: true
        }
      });

      if (!stream) {
        throw new Error(`Stream not found: ${streamId}`);
      }

      return {
        id: streamId,
        onChainStreamId,
        payer: {
          id: stream.payer.id,
          walletAddress: stream.payer.walletAddress,
          name: stream.payer.name,
          email: stream.payer.email
        },
        recipient: {
          id: stream.recipient.id,
          walletAddress: stream.recipient.walletAddress,
          name: stream.recipient.name,
          email: stream.recipient.email
        },
        tokenAddress: stream.tokenAddress,
        totalAmount: stream.totalAmount,
        status: stream.status,
        startTime: calculation.startTime,
        endTime: calculation.endTime,
        calculation,
        withdrawalLimits,
        createdAt: Math.floor(new Date(stream.createdAt).getTime() / 1000),
        updatedAt: Math.floor(new Date(stream.updatedAt).getTime() / 1000)
      };

    } catch (error) {
      throw new BlockchainError("Failed to get stream details", error);
    }
  }

  /**
   * Sync on-chain stream state with off-chain calculations
   * Verifies our calculations match the smart contract
   */
  async syncStreamWithBlockchain(streamId: string, onChainStreamId: number): Promise<boolean> {
    try {
      const contract = new ethers.Contract(
        this.liveLedgerContractAddress,
        this.liveLedgerContractABI,
        this.provider
      );

      // Get on-chain stream data
      const onChainStream = await contract.getStream(onChainStreamId);
      const onChainClaimable = await contract.getClaimable(onChainStreamId);

      // Get off-chain calculation
      const offChainCalculation = await this.calculateStreamBalance(streamId, onChainStreamId);

      // Compare claimable amounts (allow small differences due to timing)
      const onChainClaimableNumber = parseFloat(ethers.utils.formatUnits(onChainClaimable, 6));
      const offChainClaimableNumber = parseFloat(offChainCalculation.claimableAmount);
      const tolerance = 0.000001; // 1 micro token tolerance

      const isInSync = Math.abs(onChainClaimableNumber - offChainClaimableNumber) <= tolerance;

      if (!isInSync) {
        console.warn(`Stream ${streamId} out of sync:`, {
          onChain: onChainClaimableNumber,
          offChain: offChainClaimableNumber,
          difference: Math.abs(onChainClaimableNumber - offChainClaimableNumber)
        });

        // Update database with on-chain state
        await prisma.stream.update({
          where: { id: streamId },
          data: {
            withdrawnAmount: ethers.utils.formatUnits(onChainStream.withdrawn, 6)
          }
        });
      }

      return isInSync;

    } catch (error) {
      console.error(`Failed to sync stream ${streamId}:`, error);
      return false;
    }
  }

  /**
   * Update stream balance in database (called by background worker)
   */
  async updateStreamBalance(streamId: string): Promise<StreamCalculation> {
    try {
      const calculation = await this.calculateStreamBalance(streamId);
      
      // Store calculation in cache or update stream metadata
      // For now, we just return the calculation
      // In production, you might want to cache this in Redis
      
      return calculation;

    } catch (error) {
      throw new BlockchainError("Failed to update stream balance", error);
    }
  }

  /**
   * Get multiple stream calculations efficiently
   */
  async getBatchStreamCalculations(streamIds: string[]): Promise<Record<string, StreamCalculation>> {
    try {
      const calculations = await Promise.all(
        streamIds.map(streamId => 
          this.calculateStreamBalance(streamId).catch(error => {
            console.error(`Failed to calculate stream ${streamId}:`, error);
            return null;
          })
        )
      );

      const result: Record<string, StreamCalculation> = {};
      streamIds.forEach((streamId, index) => {
        const calculation = calculations[index];
        if (calculation) {
          result[streamId] = calculation;
        }
      });

      return result;

    } catch (error) {
      throw new BlockchainError("Failed to get batch stream calculations", error);
    }
  }
}

// Export singleton instance
export const streamingCalculationService = new StreamingCalculationService();