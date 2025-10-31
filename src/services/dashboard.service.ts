import { prisma } from "../utils/database";
import { BalanceSimulationService, DashboardStream } from "./balanceSimulation.service";
import { WithdrawalManagementService } from "./withdrawalManagement.service";
import { StreamStatus } from "@prisma/client";

export interface PayerDashboard {
  activeStreams: DashboardStream[];
  totalStreamed: string;
  totalLocked: string;
  recentActivity: any[];
  upcomingCompletions: DashboardStream[];
  stats: {
    totalStreams: number;
    activeStreams: number;
    completedStreams: number;
    totalVolume: string;
  };
}

export interface RecipientDashboard {
  activeStreams: DashboardStream[];
  totalEarned: string;
  availableToWithdraw: string;
  withdrawalLimitUsed: number;
  recentWithdrawals: any[];
  stats: {
    totalStreams: number;
    activeStreams: number;
    totalWithdrawn: string;
    averageStreamValue: string;
  };
}

export class DashboardService {
  private static instance: DashboardService;
  private balanceService: BalanceSimulationService | null = null;
  private withdrawalService: WithdrawalManagementService | null = null;

  private constructor() {}

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

  public static getInstance(): DashboardService {
    if (!DashboardService.instance) {
      DashboardService.instance = new DashboardService();
    }
    return DashboardService.instance;
  }

  /**
   * Get payer dashboard data
   */
  public async getPayerDashboard(payerAddress: string): Promise<PayerDashboard> {
    // First, let's find the user by wallet address
    const user = await prisma.user.findUnique({
      where: { walletAddress: payerAddress }
    });

    // If not found, try with different cases
    if (!user) {
      const userLower = await prisma.user.findUnique({
        where: { walletAddress: payerAddress.toLowerCase() }
      });

      if (userLower) {
        return this.getPayerDashboard(userLower.walletAddress);
      }
    }

    // Get all streams where user is payer using the user ID directly
    const streams = await prisma.stream.findMany({
      where: {
        payerId: user?.id,
        status: { in: [StreamStatus.ACTIVE, StreamStatus.PENDING] },
      },
      include: {
        recipient: { select: { name: true, walletAddress: true } },
        payer: { select: { name: true, walletAddress: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Enhance streams with balance information
    const enhancedStreams = await Promise.all(
      streams.map(stream => this.getBalanceService().enhanceStreamWithBalance(stream))
    );

    // Calculate totals
    const totalLocked = streams.reduce((sum, stream) => {
      return sum + BigInt(stream.totalAmount);
    }, BigInt(0)).toString();

    const totalStreamed = enhancedStreams.reduce((sum, stream) => {
      return sum + BigInt(stream.totalEarned);
    }, BigInt(0)).toString();

    // Get recent activity (last 10 transactions)
    const recentActivity = await prisma.transaction.findMany({
      where: {
        fromAddress: user?.walletAddress?.toLowerCase(),
        status: "CONFIRMED",
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        stream: {
          select: {
            id: true,
            recipient: { select: { name: true, walletAddress: true } },
          },
        },
      },
    });

    // Get upcoming completions (streams ending in next 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const upcomingCompletions = enhancedStreams.filter(stream => {
      return stream.endTime && stream.endTime <= sevenDaysFromNow && stream.status === StreamStatus.ACTIVE;
    });

    // Calculate stats
    const allPayerStreams = await prisma.stream.findMany({
      where: {
        payerId: user?.id,
      },
    });

    const stats = {
      totalStreams: allPayerStreams.length,
      activeStreams: allPayerStreams.filter(s => s.status === StreamStatus.ACTIVE).length,
      completedStreams: allPayerStreams.filter(s => s.status === StreamStatus.STOPPED).length,
      totalVolume: allPayerStreams.reduce((sum, stream) => sum + BigInt(stream.totalAmount), BigInt(0)).toString(),
    };

    return {
      activeStreams: enhancedStreams,
      totalStreamed,
      totalLocked,
      recentActivity,
      upcomingCompletions,
      stats,
    };
  }

  /**
   * Get recipient dashboard data
   */
  public async getRecipientDashboard(recipientAddress: string): Promise<RecipientDashboard> {
    // First, let's find the user by wallet address
    const user = await prisma.user.findUnique({
      where: { walletAddress: recipientAddress }
    });

    // If not found, try with different cases
    if (!user) {
      const userLower = await prisma.user.findUnique({
        where: { walletAddress: recipientAddress.toLowerCase() }
      });

      if (userLower) {
        return this.getRecipientDashboard(userLower.walletAddress);
      }
    }

    // Get all streams where user is recipient
    const streams = await prisma.stream.findMany({
      where: {
        recipientId: user?.id,
        status: { in: [StreamStatus.ACTIVE, StreamStatus.PENDING] },
      },
      include: {
        payer: { select: { name: true, walletAddress: true } },
        recipient: { select: { name: true, walletAddress: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Enhance streams with balance information
    const enhancedStreams = await Promise.all(
      streams.map(async (stream) => {
        const enhanced = await this.getBalanceService().enhanceStreamWithBalance(stream);
        const withdrawalInfo = this.getWithdrawalService().getWithdrawalLimitInfo(recipientAddress);

        return {
          ...enhanced,
          withdrawalsToday: withdrawalInfo.withdrawalsToday,
          nextWithdrawalAvailable: withdrawalInfo.nextWithdrawalAvailable,
        };
      })
    );

    // Calculate totals
    const totalEarned = enhancedStreams.reduce((sum, stream) => {
      return sum + BigInt(stream.totalEarned);
    }, BigInt(0)).toString();

    const availableToWithdraw = enhancedStreams.reduce((sum, stream) => {
      return sum + BigInt(stream.claimableAmount);
    }, BigInt(0)).toString();

    // Get withdrawal limit info
    const withdrawalLimitInfo = this.getWithdrawalService().getWithdrawalLimitInfo(recipientAddress);

    // Get recent withdrawals
    const recentWithdrawals = await this.getWithdrawalService().getWithdrawalHistory(recipientAddress, 10);

    // Calculate stats
    const allRecipientStreams = await prisma.stream.findMany({
      where: {
        recipientId: user?.id,
      },
    });

    const totalWithdrawn = "0"; // Simplified for now

    const stats = {
      totalStreams: allRecipientStreams.length,
      activeStreams: allRecipientStreams.filter(s => s.status === StreamStatus.ACTIVE).length,
      totalWithdrawn: totalWithdrawn,
      averageStreamValue: allRecipientStreams.length > 0
        ? (allRecipientStreams.reduce((sum, stream) => sum + BigInt(stream.totalAmount), BigInt(0)) / BigInt(allRecipientStreams.length)).toString()
        : "0",
    };

    return {
      activeStreams: enhancedStreams,
      totalEarned,
      availableToWithdraw,
      withdrawalLimitUsed: withdrawalLimitInfo.withdrawalsToday,
      recentWithdrawals,
      stats,
    };
  }

  /**
   * Get analytics data for all streams
   */
  public async getAnalytics() {
    const activeStreams = await prisma.stream.count({
      where: { status: StreamStatus.ACTIVE },
    });

    const totalVolume = "0"; // Simplified for now
    const dailyVolume = "0"; // Simplified for now

    const withdrawalStats = await this.getWithdrawalService().getWithdrawalStats();

    return {
      activeStreams,
      totalVolume,
      dailyVolume,
      withdrawalStats,
    };
  }

  /**
   * Get real-time updates for specific streams
   */
  public async getRealTimeUpdates(streamIds: string[]) {
    const balances = await this.getBalanceService().updateStreamBalances(streamIds);

    return {
      balances,
      timestamp: Date.now(),
    };
  }

  /**
   * Get stream completion alerts (for WebSocket notifications)
   */
  public async getCompletionAlerts(): Promise<any[]> {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    const completingStreams = await prisma.stream.findMany({
      where: {
        status: StreamStatus.ACTIVE,
        endTime: {
          lte: oneHourFromNow,
          gte: now,
        },
      },
      include: {
        payer: { select: { walletAddress: true } },
        recipient: { select: { walletAddress: true } },
      },
    });

    return completingStreams.map(stream => ({
      streamId: stream.id,
      payerAddress: stream.payer.walletAddress,
      recipientAddress: stream.recipient.walletAddress,
      completionTime: stream.endTime,
      timeRemaining: stream.endTime ? stream.endTime.getTime() - now.getTime() : 0,
    }));
  }

  /**
   * Get withdrawal alerts for users approaching daily limits
   */
  public async getWithdrawalAlerts(): Promise<any[]> {
    // This would check users who are at 1 withdrawal and have active streams
    // Implementation depends on specific business requirements
    return [];
  }
}