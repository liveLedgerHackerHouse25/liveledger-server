import { describe, it, expect, beforeAll, afterEach } from "@jest/globals";
import { prisma } from "../utils/database";
import request from "supertest";
import app from "../app";
import { ethers } from "ethers";

describe("Authentication API", () => {
  let testWallet: ethers.Wallet;

  beforeAll(async () => {
    testWallet = ethers.Wallet.createRandom();

    await prisma.transaction.deleteMany();
    await prisma.stream.deleteMany();
    await prisma.balance.deleteMany();
    await prisma.user.deleteMany();
  });

  afterEach(async () => {
    await prisma.transaction.deleteMany();
    await prisma.stream.deleteMany();
    await prisma.balance.deleteMany();
    await prisma.user.deleteMany();
  });

  describe("POST /api/auth/nonce", () => {
    it("should generate nonce for valid wallet address", async () => {
      const response = await request(app).post("/api/auth/nonce").send({
        walletAddress: testWallet.address,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.nonce).toBeDefined();
      expect(response.body.data.nonce).toHaveLength(64); // 32 bytes hex or 64 chars
      expect(response.body.data.expiresAt).toBeDefined();
      expect(new Date(response.body.data.expiresAt)).toBeInstanceOf(Date);
    });

    it("should return error for invalid wallet address", async () => {
      const response = await request(app).post("/api/auth/nonce").send({
        walletAddress: "invalid-address",
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain(
        "Valid Ethereum address required"
      );
    });

    it("should return error for missing wallet address", async () => {
      const response = await request(app).post("/api/auth/nonce").send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain(
        "Request body cannot be empty"
      );
    });
  });

  describe("POST /api/auth/wallet", () => {
    it("should authenticate wallet with valid signature", async () => {
      // First get nonce
      const nonceResponse = await request(app).post("/api/auth/nonce").send({
        walletAddress: testWallet.address,
      });

      const { nonce } = nonceResponse.body.data;

      // Create message to sign
      const message = `Welcome to LiveLedger!\n\nSign this message to authenticate your wallet.\n\nNonce: ${nonce}\n\nThis request will not trigger a blockchain transaction or cost any gas fees.`;

      // Sign message
      const signature = await testWallet.signMessage(message);

      // Authenticate
      const authResponse = await request(app).post("/api/auth/wallet").send({
        walletAddress: testWallet.address,
        signature,
        nonce,
      });

      expect(authResponse.status).toBe(200);
      expect(authResponse.body.success).toBe(true);
      expect(authResponse.body.data.token).toBeDefined();
      expect(authResponse.body.data.user).toBeDefined();
      expect(authResponse.body.data.user.walletAddress).toBe(
        testWallet.address
      );
      expect(authResponse.body.data.user.id).toBeDefined();
    });

    it("should return error for invalid signature", async () => {
      // First get nonce
      const nonceResponse = await request(app).post("/api/auth/nonce").send({
        walletAddress: testWallet.address,
      });

      const { nonce } = nonceResponse.body.data;

      // Authenticate with invalid signature
      const authResponse = await request(app).post("/api/auth/wallet").send({
        walletAddress: testWallet.address,
        signature: "0xinvalidsignature",
        nonce,
      });

      expect(authResponse.status).toBe(400);
      expect(authResponse.body.success).toBe(false);
      expect(authResponse.body.error.message).toContain(
        "Signature must be hexadecimal"
      );
    });

    it("should return error for wrong wallet address", async () => {
      // First get nonce
      const nonceResponse = await request(app).post("/api/auth/nonce").send({
        walletAddress: testWallet.address,
      });

      const { nonce } = nonceResponse.body.data;

      // Create message to sign
      const message = `Welcome to LiveLedger!\n\nSign this message to authenticate your wallet.\n\nNonce: ${nonce}\n\nThis request will not trigger a blockchain transaction or cost any gas fees.`;

      // Sign message
      const signature = await testWallet.signMessage(message);

      // Try to authenticate with different wallet address
      const otherWallet = ethers.Wallet.createRandom();
      const authResponse = await request(app).post("/api/auth/wallet").send({
        walletAddress: otherWallet.address,
        signature,
        nonce,
      });

      expect(authResponse.status).toBe(401);
      expect(authResponse.body.success).toBe(false);
      expect(authResponse.body.error.message).toContain(
        "Invalid or expired nonce"
      );
    });

    it("should return error for reused nonce", async () => {
      // First get nonce
      const nonceResponse = await request(app).post("/api/auth/nonce").send({
        walletAddress: testWallet.address,
      });

      const { nonce } = nonceResponse.body.data;

      // Create message to sign
      const message = `Welcome to LiveLedger!\n\nSign this message to authenticate your wallet.\n\nNonce: ${nonce}\n\nThis request will not trigger a blockchain transaction or cost any gas fees.`;

      // Sign message
      const signature = await testWallet.signMessage(message);

      // First authentication should succeed
      const firstAuthResponse = await request(app)
        .post("/api/auth/wallet")
        .send({
          walletAddress: testWallet.address,
          signature,
          nonce,
        });

      expect(firstAuthResponse.status).toBe(200);

      // Second authentication with same nonce should fail
      const secondAuthResponse = await request(app)
        .post("/api/auth/wallet")
        .send({
          walletAddress: testWallet.address,
          signature,
          nonce,
        });

      expect(secondAuthResponse.status).toBe(401);
      expect(secondAuthResponse.body.success).toBe(false);
      expect(secondAuthResponse.body.error.message).toContain(
        "Invalid or expired nonce"
      );
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return current user info with valid token", async () => {
      // First authenticate
      const nonceResponse = await request(app).post("/api/auth/nonce").send({
        walletAddress: testWallet.address,
      });

      const { nonce } = nonceResponse.body.data;
      const message = `Welcome to LiveLedger!\n\nSign this message to authenticate your wallet.\n\nNonce: ${nonce}\n\nThis request will not trigger a blockchain transaction or cost any gas fees.`;
      const signature = await testWallet.signMessage(message);

      const authResponse = await request(app).post("/api/auth/wallet").send({
        walletAddress: testWallet.address,
        signature,
        nonce,
      });

      const { token } = authResponse.body.data;

      // Get user info
      const meResponse = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.success).toBe(true);
      expect(meResponse.body.data.user).toBeDefined();
      expect(meResponse.body.data.user.walletAddress).toBe(testWallet.address);
      expect(meResponse.body.data.user.id).toBeDefined();
      console.log(meResponse.body);
      expect(meResponse.body.data.user.type).toEqual("RECIPIENT");
    });

    it("should return error without token", async () => {
      const response = await request(app).get("/api/auth/me");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain("No token provided");
    });

    it("should return error with invalid token", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain("Invalid or expired token");
    });
  });
});
