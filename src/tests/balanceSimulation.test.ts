import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { BalanceSimulationService } from "../services/balanceSimulation.service";
import { prisma } from "../utils/database";
import { StreamStatus } from "@prisma/client";

describe("BalanceSimulationService", () => {
  let balanceService: BalanceSimulationService;
  let testStream: any;

  beforeAll(async () => {
    balanceService = BalanceSimulationService.getInstance();

    // Clean up and create test data
    await prisma.stream.deleteMany();
    await prisma.user.deleteMany();

    const payer = await prisma.user.create({
      data: {
        walletAddress: "0xPayerTest123456789012345678901234567890",
        email: "payer@test.com",
        name: "Test Payer",
        type: "PAYER",
      },
    });

    const recipient = await prisma.user.create({
      data: {
        walletAddress: "0xRecipientTest123456789012345678901234",
        email: "recipient@test.com",
        name: "Test Recipient",
        type: "RECIPIENT",
      },
    });

    // Create a test stream that started 1 hour ago
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const endTime = new Date(Date.now() + 29 * 24 * 60 * 60 * 1000); // 29 days from now

    testStream = await prisma.stream.create({
      data: {
        payerId: payer.id,
        recipientId: recipient.id,
        tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        flowRate: "1000000", // 1 USDC per second for easy calculation
        totalAmount: "2592000000", // 30 days * 24 hours * 60 minutes * 60 seconds * 1000000
        withdrawnAmount: "0",
        status: StreamStatus.ACTIVE,
        escrowConfirmed: true,
        startTime: oneHourAgo,
        endTime: endTime,
      },
    });
  });

  afterAll(async () => {
    await prisma.stream.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  describe("calculateClaimableAmount", () => {
    it("should calculate claimable amount for active stream", () => {
      const claimable = balanceService.calculateClaimableAmount(testStream);

      // Should be approximately 1 hour * 60 minutes * 60 seconds * 1000000 = 3600000000
      expect(BigInt(claimable)).toBeGreaterThan(BigInt(3500000000));
      expect(BigInt(claimable)).toBeLessThan(BigInt(3700000000));
    });

    it("should return 0 for non-active stream", async () => {
      const inactiveStream = { ...testStream, status: StreamStatus.STOPPED };
      const claimable = balanceService.calculateClaimableAmount(inactiveStream);

      expect(claimable).toBe("0");
    });

    it("should return 0 for stream that hasn't started yet", async () => {
      const futureStream = {
        ...testStream,
        startTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour in future
      };
      const claimable = balanceService.calculateClaimableAmount(futureStream);

      expect(claimable).toBe("0");
    });

    it("should account for already withdrawn amount", () => {
      const streamWithWithdrawal = {
        ...testStream,
        withdrawnAmount: "1000000000",
      };
      const claimable =
        balanceService.calculateClaimableAmount(streamWithWithdrawal);

      // Should be less than the original claimable amount
      const originalClaimable =
        balanceService.calculateClaimableAmount(testStream);
      expect(BigInt(claimable)).toBeLessThan(BigInt(originalClaimable));
    });
  });

  describe("calculateTotalEarned", () => {
    it("should calculate total earned amount including withdrawals", () => {
      const streamWithWithdrawal = {
        ...testStream,
        withdrawnAmount: "500000000",
      };
      const totalEarned =
        balanceService.calculateTotalEarned(streamWithWithdrawal);

      // Should be approximately 1 hour earnings + withdrawn amount
      expect(BigInt(totalEarned)).toBeGreaterThan(BigInt(4000000000));
      expect(BigInt(totalEarned)).toBeLessThan(BigInt(4200000000));
    });

    it("should return withdrawn amount for inactive stream", () => {
      const inactiveStream = {
        ...testStream,
        status: StreamStatus.STOPPED,
        withdrawnAmount: "1000000000",
      };
      const totalEarned = balanceService.calculateTotalEarned(inactiveStream);

      expect(totalEarned).toBe("1000000000");
    });
  });

  describe("calculateStreamingProgress", () => {
    it("should calculate streaming progress as percentage", () => {
      const progress = balanceService.calculateStreamingProgress(testStream);

      // Should be approximately 1/720 (1 hour out of 720 hours in 30 days) * 100
      expect(progress).toBeGreaterThan(0.1);
      expect(progress).toBeLessThan(0.2);
    });

    it("should return 100 for completed stream", () => {
      const completedStream = {
        ...testStream,
        endTime: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      };
      const progress =
        balanceService.calculateStreamingProgress(completedStream);

      expect(progress).toBe(100);
    });

    it("should return 0 for stream that hasn't started", () => {
      const futureStream = {
        ...testStream,
        startTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour in future
      };
      const progress = balanceService.calculateStreamingProgress(futureStream);

      expect(progress).toBe(0);
    });
  });

  describe("calculateDaysRemaining", () => {
    it("should calculate days remaining for active stream", () => {
      const daysRemaining = balanceService.calculateDaysRemaining(testStream);

      // Should be approximately 29 days (since 1 hour has passed)
      expect(daysRemaining).toBeGreaterThan(28);
      expect(daysRemaining).toBeLessThanOrEqual(29);
    });

    it("should return 0 for completed stream", () => {
      const completedStream = {
        ...testStream,
        endTime: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      };
      const daysRemaining =
        balanceService.calculateDaysRemaining(completedStream);

      expect(daysRemaining).toBe(0);
    });
  });

  describe("enhanceStreamWithBalance", () => {
    it("should enhance stream with all balance information", async () => {
      const enhancedStream = await balanceService.enhanceStreamWithBalance(
        testStream
      );

      expect(enhancedStream).toHaveProperty("claimableAmount");
      expect(enhancedStream).toHaveProperty("totalEarned");
      expect(enhancedStream).toHaveProperty("streamingProgress");
      expect(enhancedStream).toHaveProperty("daysRemaining");
      expect(enhancedStream).toHaveProperty("currentBalance");

      expect(enhancedStream.claimableAmount).toBeDefined();
      expect(enhancedStream.totalEarned).toBeDefined();
      expect(enhancedStream.streamingProgress).toBeGreaterThan(0);
      expect(enhancedStream.daysRemaining).toBeGreaterThan(0);
    });
  });

  describe("getStreamBalances", () => {
    it("should get balances for multiple streams", async () => {
      const balances = await balanceService.getStreamBalances([testStream]);

      expect(Array.isArray(balances)).toBe(true);
      expect(balances).toHaveLength(1);

      const balance = balances[0];
      expect(balance).toHaveProperty("streamId");
      expect(balance).toHaveProperty("claimableAmount");
      expect(balance).toHaveProperty("totalEarned");
      expect(balance).toHaveProperty("streamingProgress");
      expect(balance).toHaveProperty("daysRemaining");
      expect(balance).toHaveProperty("lastUpdated");

      expect(balance.streamId).toBe(testStream.id);
    });
  });
});
