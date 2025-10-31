// tests/stream.api.test.ts
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
import { ethers } from "ethers";
import jwt from "jsonwebtoken";
import { response } from "express";

describe("Stream API", () => {
  let payerUser: any;
  let recipientUser: any;
  let authToken: string;

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
        walletAddress:
          "0xRecipientAddress123456789012345678901234".toLowerCase(),
        email: "recipient@example.com",
        name: "Test Recipient",
        type: "RECIPIENT",
      },
    });

    // Generate auth token
    authToken = jwt.sign(
      { userId: payerUser.id, walletAddress: payerUser.walletAddress },
      process.env.JWT_SECRET || "test-secret",
      { expiresIn: "7d" }
    );
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany();
    await prisma.stream.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  describe("Stream Creation Flow", () => {
    it("should create, confirm, and allow withdrawals from a stream", async () => {
      // 1. Create stream
      const streamData = {
        recipientAddress: recipientUser.walletAddress, // Use exact wallet address from created user
        tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        flowRate: "3858024691358", // $1000 / 30 days in USDC units (6 decimals)
        totalAmount: "9999999999999936000", // Exact amount: flowRate * duration
        duration: 2592000, // 30 days in seconds
      };

      const createResponse = await request(app)
        .post("/api/streams")
        .set("Authorization", `Bearer ${authToken}`)
        .send(streamData);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.data.stream.status).toBe("PENDING");

      const streamId = createResponse.body.data.stream.id;

      // 2. Confirm stream
      const confirmResponse = await request(app)
        .post(`/api/streams/${streamId}/confirm`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(confirmResponse.status).toBe(200);
      expect(confirmResponse.body.data.status).toBe("ACTIVE");

      // 3. Check claimable amount
      const claimableResponse = await request(app)
        .get(`/api/streams/${streamId}/claimable`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(claimableResponse.status).toBe(200);
      expect(claimableResponse.body.data.claimable).toBeDefined();

      // 4. Withdraw from stream (as recipient)
      const recipientToken = jwt.sign(
        {
          userId: recipientUser.id,
          walletAddress: recipientUser.walletAddress,
        },
        process.env.JWT_SECRET || "test-secret",
        { expiresIn: "7d" }
      );

      const withdrawResponse = await request(app)
        .post(`/api/streams/${streamId}/withdraw`)
        .set("Authorization", `Bearer ${recipientToken}`);
      console.log(withdrawResponse.body);

      expect(withdrawResponse.status).toBe(200);
      expect(withdrawResponse.body.data.amount).toBeDefined();
    });

    it("should create recipient automatically if not exists", async () => {
      const newRecipientAddress =
        "0xNewRecipient123456789012345678901234567890";

      const flowRate = "1929012345679"; // tokens per second
      const duration = 259; // seconds
      const totalAmount = (BigInt(flowRate) * BigInt(duration)).toString();

      const response = await request(app)
        .post("/api/streams")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          recipientAddress: newRecipientAddress,
          tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          flowRate: flowRate,
          totalAmount: totalAmount,
          duration: duration,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.stream.recipientId).toBeDefined();
    });
  });

  describe("Stream Management", () => {
    it("should cancel an active stream", async () => {
      // Create and confirm a stream first
      const flowRate = "3858024691358"; // tokens per second
      const duration = 259; // seconds
      const totalAmount = (BigInt(flowRate) * BigInt(duration)).toString();

      const createResponse = await request(app)
        .post("/api/streams")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          recipientAddress: recipientUser.walletAddress,
          tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          flowRate: flowRate,
          totalAmount: totalAmount,
          duration: duration,
        });

      const streamId = createResponse.body.data.stream.id;

      await request(app)
        .post(`/api/streams/${streamId}/confirm`)
        .set("Authorization", `Bearer ${authToken}`);

      // Cancel the stream
      const cancelResponse = await request(app)
        .post(`/api/streams/${streamId}/cancel`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(cancelResponse.status).toBe(200);
      expect(cancelResponse.body.data.refundAmount).toBeDefined();
    });
  });
});
