import { prisma } from "../utils/database";
import { Stream, StreamStatus } from "@prisma/client";

export interface StreamBalance {
  streamId: string;
  claimableAmount: string;
  totalEarned: string;
  streamingProgress: number;
  daysRemaining: number;
  lastUpdated: number;
}

export interface DashboardStream extends Stream {
  claimableAmount: string;
  totalEarned: string;
  streamingProgress: number;
  daysRemaining: number;
  currentBalance: string;
}

export class BalanceSimulationService {
  private static instance: BalanceSimulationService;

  private constructor() {}

  public static getInstance(): BalanceSimulationService {
    if (!BalanceSimulationService.instance) {
      BalanceSimulationService.instance = new BalanceSimulationService();
    }
    return BalanceSimulationService.instance;
  }

  /**
   * Calculate claimable amount for a stream based on time elapsed
   * This simulates the smart contract's getClaimable function off-chain
   */
  public calculateClaimableAmount(stream: Stream): string {
    if (stream.status !== StreamStatus.ACTIVE) {
      return "0";
    }

    const now = Math.floor(Date.now() / 1000);
    const startTime = Math.floor(stream.startTime.getTime() / 1000);
    const endTime = stream.endTime ? Math.floor(stream.endTime.getTime() / 1000) : null;

    if (now < startTime) {
      return "0";
    }

    // Calculate elapsed time in seconds
    const elapsed = endTime ? Math.min(now - startTime, endTime - startTime) : now - startTime;

    // Calculate rate per second from flowRate (assuming flowRate is tokens per second)
    const ratePerSecond = BigInt(stream.flowRate);
    const totalAccrued = ratePerSecond * BigInt(elapsed);
    const withdrawn = BigInt(stream.withdrawnAmount);

    const claimable = totalAccrued - withdrawn;
    return claimable > 0 ? claimable.toString() : "0";
  }

  /**
   * Calculate total earned amount (including withdrawn)
   */
  public calculateTotalEarned(stream: Stream): string {
    if (stream.status !== StreamStatus.ACTIVE) {
      return stream.withdrawnAmount;
    }

    const now = Math.floor(Date.now() / 1000);
    const startTime = Math.floor(stream.startTime.getTime() / 1000);
    const endTime = stream.endTime ? Math.floor(stream.endTime.getTime() / 1000) : null;

    if (now < startTime) {
      return stream.withdrawnAmount;
    }

    const elapsed = endTime ? Math.min(now - startTime, endTime - startTime) : now - startTime;
    const ratePerSecond = BigInt(stream.flowRate);
    const totalAccrued = ratePerSecond * BigInt(elapsed);
    const withdrawn = BigInt(stream.withdrawnAmount);

    return (totalAccrued + withdrawn).toString();
  }

  /**
   * Calculate streaming progress as percentage
   */
  public calculateStreamingProgress(stream: Stream): number {
    if (stream.status !== StreamStatus.ACTIVE || !stream.endTime) {
      return 0;
    }

    const now = Math.floor(Date.now() / 1000);
    const startTime = Math.floor(stream.startTime.getTime() / 1000);
    const endTime = Math.floor(stream.endTime.getTime() / 1000);

    if (now >= endTime) {
      return 100;
    }

    if (now < startTime) {
      return 0;
    }

    const totalDuration = endTime - startTime;
    const elapsed = now - startTime;

    return Math.min(100, (elapsed / totalDuration) * 100);
  }

  /**
   * Calculate days remaining for stream
   */
  public calculateDaysRemaining(stream: Stream): number {
    if (stream.status !== StreamStatus.ACTIVE || !stream.endTime) {
      return 0;
    }

    const now = Math.floor(Date.now() / 1000);
    const endTime = Math.floor(stream.endTime.getTime() / 1000);

    if (now >= endTime) {
      return 0;
    }

    const remainingSeconds = endTime - now;
    return Math.ceil(remainingSeconds / (24 * 60 * 60));
  }

  /**
   * Enhance stream with calculated balance information
   */
  public async enhanceStreamWithBalance(stream: Stream): Promise<DashboardStream> {
    const claimableAmount = this.calculateClaimableAmount(stream);
    const totalEarned = this.calculateTotalEarned(stream);
    const streamingProgress = this.calculateStreamingProgress(stream);
    const daysRemaining = this.calculateDaysRemaining(stream);

    return {
      ...stream,
      claimableAmount,
      totalEarned,
      streamingProgress,
      daysRemaining,
      currentBalance: claimableAmount,
    };
  }

  /**
   * Get real-time balance for multiple streams
   */
  public async getStreamBalances(streams: Stream[]): Promise<StreamBalance[]> {
    return streams.map(stream => ({
      streamId: stream.id,
      claimableAmount: this.calculateClaimableAmount(stream),
      totalEarned: this.calculateTotalEarned(stream),
      streamingProgress: this.calculateStreamingProgress(stream),
      daysRemaining: this.calculateDaysRemaining(stream),
      lastUpdated: Date.now(),
    }));
  }

  /**
   * Update stream balances in real-time (for WebSocket updates)
   */
  public async updateStreamBalances(streamIds: string[]): Promise<StreamBalance[]> {
    const streams = await prisma.stream.findMany({
      where: {
        id: { in: streamIds },
        status: StreamStatus.ACTIVE,
      },
    });

    return this.getStreamBalances(streams);
  }
}