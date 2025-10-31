import { prisma } from "../utils/database";
import { BadRequestError } from "../errors/genericErrors";

export interface WithdrawalLimit {
  recipientAddress: string;
  withdrawalsToday: number;
  lastWithdrawalDate: string;
  maxWithdrawalsPerDay: number;
  nextWithdrawalAvailable: boolean;
}

export class WithdrawalManagementService {
  private static instance: WithdrawalManagementService;
  private dailyWithdrawals: Map<string, { count: number; lastReset: string }> = new Map();

  private constructor() {}

  public static getInstance(): WithdrawalManagementService {
    if (!WithdrawalManagementService.instance) {
      WithdrawalManagementService.instance = new WithdrawalManagementService();
    }
    return WithdrawalManagementService.instance;
  }

  /**
   * Get today's date key (YYYY-MM-DD format)
   */
  private getTodayKey(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Check if recipient can withdraw today
   */
  public canWithdraw(recipientAddress: string, maxWithdrawalsPerDay: number = 2): boolean {
    const today = this.getTodayKey();
    const userData = this.dailyWithdrawals.get(recipientAddress.toLowerCase());

    if (!userData || userData.lastReset !== today) {
      return true; // No withdrawals today or new day
    }

    return userData.count < maxWithdrawalsPerDay;
  }

  /**
   * Get withdrawal limit information for recipient
   */
  public getWithdrawalLimitInfo(recipientAddress: string, maxWithdrawalsPerDay: number = 2): WithdrawalLimit {
    const today = this.getTodayKey();
    const userData = this.dailyWithdrawals.get(recipientAddress.toLowerCase());

    let withdrawalsToday = 0;
    let lastWithdrawalDate = today;

    if (userData && userData.lastReset === today) {
      withdrawalsToday = userData.count;
    } else if (userData) {
      lastWithdrawalDate = userData.lastReset;
    }

    return {
      recipientAddress: recipientAddress.toLowerCase(),
      withdrawalsToday,
      lastWithdrawalDate,
      maxWithdrawalsPerDay,
      nextWithdrawalAvailable: withdrawalsToday < maxWithdrawalsPerDay,
    };
  }

  /**
   * Record a withdrawal and update daily limit
   */
  public recordWithdrawal(recipientAddress: string): void {
    const today = this.getTodayKey();
    const normalizedAddress = recipientAddress.toLowerCase();
    const userData = this.dailyWithdrawals.get(normalizedAddress);

    if (!userData || userData.lastReset !== today) {
      this.dailyWithdrawals.set(normalizedAddress, { count: 1, lastReset: today });
    } else {
      this.dailyWithdrawals.set(normalizedAddress, {
        count: userData.count + 1,
        lastReset: today
      });
    }
  }

  /**
   * Validate withdrawal request against daily limits
   */
  public validateWithdrawal(recipientAddress: string, maxWithdrawalsPerDay: number = 2): void {
    if (!this.canWithdraw(recipientAddress, maxWithdrawalsPerDay)) {
      throw new BadRequestError(
        `Daily withdrawal limit reached. Maximum ${maxWithdrawalsPerDay} withdrawals per day allowed.`
      );
    }
  }

  /**
   * Get all withdrawal statistics for analytics
   */
  public async getWithdrawalStats(): Promise<{
    totalWithdrawals: number;
    uniqueRecipients: number;
    averageWithdrawalsPerRecipient: number;
    dailyLimitHits: number;
  }> {
    const totalWithdrawals = Array.from(this.dailyWithdrawals.values())
      .reduce((sum, data) => sum + data.count, 0);

    const uniqueRecipients = this.dailyWithdrawals.size;
    const averageWithdrawalsPerRecipient = uniqueRecipients > 0 ? totalWithdrawals / uniqueRecipients : 0;

    // Count daily limit hits (users who hit their daily limit)
    const dailyLimitHits = Array.from(this.dailyWithdrawals.values())
      .filter(data => data.count >= 2).length;

    return {
      totalWithdrawals,
      uniqueRecipients,
      averageWithdrawalsPerRecipient,
      dailyLimitHits,
    };
  }

  /**
   * Reset daily limits (useful for testing or midnight cron job)
   */
  public resetDailyLimits(): void {
    this.dailyWithdrawals.clear();
  }

  /**
   * Get withdrawal history from database for a recipient
   */
  public async getWithdrawalHistory(recipientAddress: string, limit: number = 10) {
    return await prisma.transaction.findMany({
      where: {
        toAddress: recipientAddress.toLowerCase(),
        type: "WITHDRAWAL",
        status: "CONFIRMED",
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        stream: {
          select: {
            id: true,
            tokenAddress: true,
            payer: {
              select: { name: true, walletAddress: true },
            },
          },
        },
      },
    });
  }
}