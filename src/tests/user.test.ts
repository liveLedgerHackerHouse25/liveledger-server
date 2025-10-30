import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { prisma } from "../utils/database";
import request from "supertest";
import app from "../app";
import { ethers } from "ethers";
import jwt from "jsonwebtoken";

describe("User API", () => {
  let testUser: any;
  let authToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    // Clean up database
    await prisma.transaction.deleteMany();
    await prisma.stream.deleteMany();
    await prisma.balance.deleteMany();
    await prisma.user.deleteMany();

    // Create test user
    testUser = await prisma.user.create({
      data: {
        walletAddress: "0x1234567890123456789012345678901234567890",
        email: "test@example.com",
        name: "Test User",
      },
    });

    // Generate auth token
    const payload = {
      userId: testUser.id,
      walletAddress: testUser.walletAddress,
    };

    authToken = jwt.sign(payload, process.env.JWT_SECRET || "your-secret-key", {
      expiresIn: "7d",
    });

    // Generate refresh token
    refreshToken = jwt.sign(
      { userId: testUser.id },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "30d" }
    );
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany();
    await prisma.stream.deleteMany();
    await prisma.balance.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  describe("GET /api/users/profile", () => {
    it("should get current user profile", async () => {
      const response = await request(app)
        .get("/api/users/profile")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.id).toBe(testUser.id);
      expect(response.body.data.user.walletAddress).toBe(
        testUser.walletAddress
      );
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user.name).toBe(testUser.name);
    });

    it("should return 401 without authentication", async () => {
      const response = await request(app).get("/api/users/profile");

      expect(response.status).toBe(401);
    });

    it("should return 401 with invalid token", async () => {
      const response = await request(app)
        .get("/api/users/profile")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
    });
  });

  describe("PUT /api/users/profile", () => {
    it("should update user profile", async () => {
      const updateData = {
        email: "updated@example.com",
        name: "Updated Name",
      };

      const response = await request(app)
        .put("/api/users/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData);
      console.log(response.error);
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(updateData.email);
      expect(response.body.data.user.name).toBe(updateData.name);

      // Verify update in database
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      expect(updatedUser?.email).toBe(updateData.email);
      expect(updatedUser?.name).toBe(updateData.name);
    });

    it("should update only email", async () => {
      const updateData = {
        email: "email-only@example.com",
      };

      const response = await request(app)
        .put("/api/users/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.data.user.email).toBe(updateData.email);
      expect(response.body.data.user.name).toBe("Updated Name"); // Should remain unchanged
    });

    it("should update only name", async () => {
      const updateData = {
        name: "Name Only",
      };

      const response = await request(app)
        .put("/api/users/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.data.user.name).toBe(updateData.name);
      expect(response.body.data.user.email).toBe("email-only@example.com"); // Should remain unchanged
    });

    it("should return 400 for invalid email", async () => {
      const updateData = {
        email: "invalid-email",
      };

      const response = await request(app)
        .put("/api/users/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(400);
    });

    it("should return 409 for duplicate email", async () => {
      // Create another user with different email
      const otherUser = await prisma.user.create({
        data: {
          walletAddress: "0x0987654321098765432109876543210987654321",
          email: "other@example.com",
        },
      });

      const updateData = {
        email: "other@example.com", // Try to use existing email
      };

      const response = await request(app)
        .put("/api/users/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(409);

      // Clean up
      await prisma.user.delete({ where: { id: otherUser.id } });
    });

    it("should return 401 without authentication", async () => {
      const response = await request(app)
        .put("/api/users/profile")
        .send({ email: "test@example.com" });

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/users/wallet/:walletAddress", () => {
    it("should get user by wallet address", async () => {
      const response = await request(app)
        .get(`/api/users/wallet/${testUser.walletAddress}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.id).toBe(testUser.id);
      expect(response.body.data.user.walletAddress).toBe(
        testUser.walletAddress
      );
    });

    it("should return 404 for non-existent wallet address", async () => {
      const response = await request(app)
        .get("/api/users/wallet/0x0000000000000000000000000000000000000000")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    it("should return 400 for invalid wallet address", async () => {
      const response = await request(app)
        .get("/api/users/wallet/invalid-address")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });

    it("should work without authentication", async () => {
      const response = await request(app).get(
        `/api/users/wallet/${testUser.walletAddress}`
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
    });
  });

  describe("GET /api/users/stats", () => {
    it("should get user statistics", async () => {
      const response = await request(app)
        .get("/api/users/stats")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.stats).toBeDefined();
      expect(response.body.data.stats.totalStreamsCreated).toBe(0);
      expect(response.body.data.stats.totalStreamsReceived).toBe(0);
      expect(response.body.data.stats.activeStreamsCreated).toBe(0);
      expect(response.body.data.stats.activeStreamsReceived).toBe(0);
      expect(response.body.data.stats.totalWithdrawn).toBe("0");
      expect(response.body.data.stats.totalReceived).toBe("0");
    });

    it("should return 401 without authentication", async () => {
      const response = await request(app).get("/api/users/stats");

      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/users/refresh-token", () => {
    it("should refresh JWT token", async () => {
      const response = await request(app)
        .post("/api/users/refresh-token")
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.id).toBe(testUser.id);

      // Verify new token is valid
      const decoded = jwt.verify(
        response.body.data.token,
        process.env.JWT_SECRET || "your-secret-key"
      ) as any;
      expect(decoded.userId).toBe(testUser.id);
    });

    it("should return 400 without refresh token", async () => {
      const response = await request(app).post("/api/users/refresh-token");

      expect(response.status).toBe(400);
    });

    it("should return 400 with invalid refresh token", async () => {
      const response = await request(app)
        .post("/api/users/refresh-token")
        .send({ refreshToken: "invalid-token" });

      expect(response.status).toBe(400);
    });

    it("should return 400 with expired refresh token", async () => {
      // Create expired refresh token
      const expiredToken = jwt.sign(
        { userId: testUser.id },
        process.env.JWT_SECRET || "your-secret-key",
        { expiresIn: "-1s" } // Already expired
      );

      const response = await request(app)
        .post("/api/users/refresh-token")
        .send({ refreshToken: expiredToken });

      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/users/generate-refresh-token", () => {
    it("should generate refresh token", async () => {
      const response = await request(app)
        .post("/api/users/generate-refresh-token")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.refreshToken).toBeDefined();

      // Verify generated token is valid
      const decoded = jwt.verify(
        response.body.data.refreshToken,
        process.env.JWT_SECRET || "your-secret-key"
      ) as any;
      expect(decoded.userId).toBe(testUser.id);
    });

    it("should return 401 without authentication", async () => {
      const response = await request(app).post(
        "/api/users/generate-refresh-token"
      );

      expect(response.status).toBe(401);
    });
  });
});
