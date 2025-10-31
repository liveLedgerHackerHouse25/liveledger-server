import { describe, it, expect, beforeEach } from "@jest/globals";
import { WithdrawalManagementService } from "../services/withdrawalManagement.service";
import { BadRequestError } from "../errors/genericErrors";

describe("WithdrawalManagementService", () => {
  let withdrawalService: WithdrawalManagementService;
  const testAddress = "0xTestAddress123456789012345678901234567890";

  beforeEach(() => {
    withdrawalService = WithdrawalManagementService.getInstance();
    // Reset daily limits for each test
    withdrawalService.resetDailyLimits();
  });

  describe("canWithdraw", () => {
    it("should allow withdrawal for new user", () => {
      const canWithdraw = withdrawalService.canWithdraw(testAddress, 2);
      expect(canWithdraw).toBe(true);
    });

    it("should allow withdrawal within daily limit", () => {
      withdrawalService.recordWithdrawal(testAddress);
      const canWithdraw = withdrawalService.canWithdraw(testAddress, 2);
      expect(canWithdraw).toBe(true);
    });

    it("should block withdrawal when daily limit is reached", () => {
      withdrawalService.recordWithdrawal(testAddress);
      withdrawalService.recordWithdrawal(testAddress);
      const canWithdraw = withdrawalService.canWithdraw(testAddress, 2);
      expect(canWithdraw).toBe(false);
    });

    it("should allow withdrawal with custom daily limit", () => {
      withdrawalService.recordWithdrawal(testAddress);
      withdrawalService.recordWithdrawal(testAddress);
      const canWithdraw = withdrawalService.canWithdraw(testAddress, 3);
      expect(canWithdraw).toBe(true);
    });

    it("should reset daily limit for new day", () => {
      // Simulate a withdrawal from yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = yesterday.toISOString().split("T")[0];

      // Manually set yesterday's data
      (withdrawalService as any).dailyWithdrawals.set(
        testAddress.toLowerCase(),
        {
          count: 2,
          lastReset: yesterdayKey,
        }
      );

      const canWithdraw = withdrawalService.canWithdraw(testAddress, 2);
      expect(canWithdraw).toBe(true);
    });
  });

  describe("getWithdrawalLimitInfo", () => {
    it("should return default withdrawal limit info", () => {
      const info = withdrawalService.getWithdrawalLimitInfo(testAddress, 2);

      expect(info.recipientAddress).toBe(testAddress.toLowerCase());
      expect(info.withdrawalsToday).toBe(0);
      expect(info.maxWithdrawalsPerDay).toBe(2);
      expect(info.nextWithdrawalAvailable).toBe(true);
    });

    it("should return correct info after withdrawals", () => {
      withdrawalService.recordWithdrawal(testAddress);
      withdrawalService.recordWithdrawal(testAddress);

      const info = withdrawalService.getWithdrawalLimitInfo(testAddress, 2);

      expect(info.withdrawalsToday).toBe(2);
      expect(info.nextWithdrawalAvailable).toBe(false);
    });

    it("should handle case-insensitive addresses", () => {
      const mixedCaseAddress = "0xTestAddress123456789012345678901234567890";
      withdrawalService.recordWithdrawal(mixedCaseAddress);

      const info = withdrawalService.getWithdrawalLimitInfo(
        testAddress.toUpperCase(),
        2
      );
      expect(info.withdrawalsToday).toBe(1);
    });
  });

  describe("recordWithdrawal", () => {
    it("should record first withdrawal", () => {
      withdrawalService.recordWithdrawal(testAddress);

      const info = withdrawalService.getWithdrawalLimitInfo(testAddress, 2);
      expect(info.withdrawalsToday).toBe(1);
    });

    it("should record multiple withdrawals", () => {
      withdrawalService.recordWithdrawal(testAddress);
      withdrawalService.recordWithdrawal(testAddress);
      withdrawalService.recordWithdrawal(testAddress);

      const info = withdrawalService.getWithdrawalLimitInfo(testAddress, 5);
      expect(info.withdrawalsToday).toBe(3);
    });
  });

  describe("validateWithdrawal", () => {
    it("should not throw for valid withdrawal", () => {
      expect(() => {
        withdrawalService.validateWithdrawal(testAddress, 2);
      }).not.toThrow();
    });

    it("should throw BadRequestError when daily limit is reached", () => {
      withdrawalService.recordWithdrawal(testAddress);
      withdrawalService.recordWithdrawal(testAddress);

      expect(() => {
        withdrawalService.validateWithdrawal(testAddress, 2);
      }).toThrow(BadRequestError);
    });

    it("should include correct error message", () => {
      withdrawalService.recordWithdrawal(testAddress);
      withdrawalService.recordWithdrawal(testAddress);

      expect(() => {
        withdrawalService.validateWithdrawal(testAddress, 2);
      }).toThrow(
        "Daily withdrawal limit reached. Maximum 2 withdrawals per day allowed."
      );
    });
  });

  describe("getWithdrawalStats", () => {
    it("should return default stats when no withdrawals", async () => {
      const stats = await withdrawalService.getWithdrawalStats();

      expect(stats.totalWithdrawals).toBe(0);
      expect(stats.uniqueRecipients).toBe(0);
      expect(stats.averageWithdrawalsPerRecipient).toBe(0);
      expect(stats.dailyLimitHits).toBe(0);
    });

    it("should calculate stats correctly with withdrawals", async () => {
      withdrawalService.recordWithdrawal(testAddress);
      withdrawalService.recordWithdrawal("0xAnotherAddress");
      withdrawalService.recordWithdrawal(testAddress); // 2 for first address

      const stats = await withdrawalService.getWithdrawalStats();

      expect(stats.totalWithdrawals).toBe(3);
      expect(stats.uniqueRecipients).toBe(2);
      expect(stats.averageWithdrawalsPerRecipient).toBe(1.5);
      expect(stats.dailyLimitHits).toBe(1); // First address hit limit
    });
  });

  describe("resetDailyLimits", () => {
    it("should reset all daily limits", async () => {
      withdrawalService.recordWithdrawal(testAddress);
      withdrawalService.recordWithdrawal("0xAnotherAddress");

      withdrawalService.resetDailyLimits();

      const stats = await withdrawalService.getWithdrawalStats();
      expect(stats.totalWithdrawals).toBe(0);
      expect(stats.uniqueRecipients).toBe(0);
    });
  });

  describe("getWithdrawalHistory", () => {
    it("should return empty array when no history", async () => {
      const history = await withdrawalService.getWithdrawalHistory(
        testAddress,
        10
      );
      expect(history).toEqual([]);
    });
  });
});
