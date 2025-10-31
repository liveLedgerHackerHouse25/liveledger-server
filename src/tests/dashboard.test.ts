import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "@jest/globals";
import { prisma } from "../utils/database";
import request from "supertest";
import app from "../app";
import jwt from "jsonwebtoken";

describe("Dashboard API", () => {
  let payerUser: any;
  let recipientUser: any;
  let payerToken: string;
  let recipientToken: string;
  let testStream: any;

  beforeAll(async () => {
    // Clean up and create test users
    await prisma.transaction.deleteMany();
    await prisma.stream.deleteMany();
    await prisma.user.deleteMany();

    payerUser = await prisma.user.create({
      data: {
        walletAddress: "0xPayerAddress123456789012345678901234567890",
        email: "payer@example.com",
        name: "Test Payer",
        type: "PAYER",
      },
    });

    recipientUser = await prisma.user.create({
      data: {
        walletAddress: "0xRecipientAddress123456789012345678901234",
        email: "recipient@example.com",
        name: "Test Recipient",
        type: "RECIPIENT",
      },
    });

    // Generate auth tokens
    payerToken = jwt.sign(
      { userId: payerUser.id, walletAddress: payerUser.walletAddress },
      process.env.JWT_SECRET || "test-secret",
      { expiresIn: "7d" }
    );

    recipientToken = jwt.sign(
      { userId: recipientUser.id, walletAddress: recipientUser.walletAddress },
      process.env.JWT_SECRET || "test-secret",
      { expiresIn: "7d" }
    );

    // Create a test stream
    testStream = await prisma.stream.create({
      data: {
        payerId: payerUser.id,
        recipientId: recipientUser.id,
        tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        flowRate: "3858024691358", // $1000 / 30 days in USDC units
        totalAmount: "1000000000", // $1000 USDC (6 decimals)
        withdrawnAmount: "0",
        status: "ACTIVE",
        escrowConfirmed: true,
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      },
    });
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany();
    await prisma.stream.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  describe("Payer Dashboard", () => {
    it("should get payer dashboard data", async () => {
      const response = await request(app)
        .get(`/api/dashboard/payer/${payerUser.walletAddress}`)
        .set("Authorization", `Bearer ${payerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("activeStreams");
      expect(response.body.data).toHaveProperty("totalStreamed");
      expect(response.body.data).toHaveProperty("totalLocked");
      expect(response.body.data).toHaveProperty("recentActivity");
      expect(response.body.data).toHaveProperty("upcomingCompletions");
      expect(response.body.data).toHaveProperty("stats");
      expect(response.body.data.activeStreams).toHaveLength(1);
      expect(response.body.data.stats.totalStreams).toBe(1);
    });

    it("should reject unauthorized access to payer dashboard", async () => {
      const response = await request(app)
        .get(`/api/dashboard/payer/${payerUser.walletAddress}`)
        .set("Authorization", `Bearer ${recipientToken}`); // Wrong token

      expect(response.status).toBe(401);
    });

    it("should reject access without authentication", async () => {
      const response = await request(app).get(
        `/api/dashboard/payer/${payerUser.walletAddress}`
      );

      expect(response.status).toBe(401);
    });
  });

  describe("Recipient Dashboard", () => {
    it("should get recipient dashboard data", async () => {
      const response = await request(app)
        .get(`/api/dashboard/recipient/${recipientUser.walletAddress}`)
        .set("Authorization", `Bearer ${recipientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("activeStreams");
      expect(response.body.data).toHaveProperty("totalEarned");
      expect(response.body.data).toHaveProperty("availableToWithdraw");
      expect(response.body.data).toHaveProperty("withdrawalLimitUsed");
      expect(response.body.data).toHaveProperty("recentWithdrawals");
      expect(response.body.data).toHaveProperty("stats");
      expect(response.body.data.activeStreams).toHaveLength(1);
      expect(response.body.data.stats.totalStreams).toBe(1);
    });

    it("should include withdrawal limit information", async () => {
      const response = await request(app)
        .get(`/api/dashboard/recipient/${recipientUser.walletAddress}`)
        .set("Authorization", `Bearer ${recipientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.withdrawalLimitUsed).toBe(0); // No withdrawals yet
      expect(response.body.data.activeStreams[0]).toHaveProperty(
        "withdrawalsToday"
      );
      expect(response.body.data.activeStreams[0]).toHaveProperty(
        "nextWithdrawalAvailable"
      );
    });
  });

  describe("Analytics Endpoints", () => {
    it("should get active streams analytics", async () => {
      const response = await request(app).get(
        "/api/dashboard/analytics/streams/active"
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("activeStreams");
      expect(response.body.data).toHaveProperty("totalVolume");
      expect(response.body.data).toHaveProperty("dailyVolume");
      expect(response.body.data).toHaveProperty("withdrawalStats");
      expect(response.body.data.activeStreams).toBe(1);
    });

    it("should get daily volume analytics", async () => {
      const response = await request(app).get(
        "/api/dashboard/analytics/volume/daily"
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("dailyVolume");
      expect(response.body.data).toHaveProperty("activeStreams");
      expect(response.body.data).toHaveProperty("timestamp");
    });
  });

  describe("Real-time Balance Updates", () => {
    it("should get real-time balances for multiple streams", async () => {
      const response = await request(app)
        .get(`/api/dashboard/streams/${testStream.id}/balances`)
        .set("Authorization", `Bearer ${recipientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("balances");
      expect(response.body.data).toHaveProperty("timestamp");
      expect(Array.isArray(response.body.data.balances)).toBe(true);
    });
  });

  describe("Alerts", () => {
    it("should get stream completion alerts", async () => {
      const response = await request(app).get(
        "/api/dashboard/alerts/completions"
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("should get withdrawal alerts", async () => {
      const response = await request(app).get(
        "/api/dashboard/alerts/withdrawals"
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});
