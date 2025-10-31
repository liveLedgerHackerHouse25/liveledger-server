import { describe, it, expect } from "@jest/globals";
import { EnhancedBlockchainService } from "../services/enhancedBlockchain.service";
import { ValidationError } from "../errors/genericErrors";

describe("EnhancedBlockchainService - Simple Tests", () => {
  // Test service creation with environment variables
  describe("Service Creation", () => {
    it("should create service instance when environment variables are set", () => {
      // Ensure env vars are set
      process.env.ARBITRUM_RPC_URL = "https://sepolia-rollup.arbitrum.io/rpc";
      process.env.LIVE_LEDGER_CONTRACT_ADDRESS =
        "0xD454CCAE2E500ae984149Fa4CeC6E78f0145fD56";

      const service = new EnhancedBlockchainService();
      expect(service).toBeDefined();
      expect(service instanceof EnhancedBlockchainService).toBe(true);
    });

    it("should throw error when RPC URL is missing", () => {
      delete process.env.ARBITRUM_RPC_URL;
      delete process.env.ETHEREUM_RPC_URL;

      expect(() => new EnhancedBlockchainService()).toThrow(
        "ARBITRUM_RPC_URL or ETHEREUM_RPC_URL environment variable is required"
      );

      // Restore env var
      process.env.ARBITRUM_RPC_URL = "https://sepolia-rollup.arbitrum.io/rpc";
    });

    it("should throw error when contract address is missing", () => {
      delete process.env.LIVE_LEDGER_CONTRACT_ADDRESS;

      expect(() => new EnhancedBlockchainService()).toThrow(
        "LIVE_LEDGER_CONTRACT_ADDRESS environment variable is required"
      );

      // Restore env var
      process.env.LIVE_LEDGER_CONTRACT_ADDRESS =
        "0xD454CCAE2E500ae984149Fa4CeC6E78f0145fD56";
    });
  });

  // Test address validation logic
  describe("Address Validation", () => {
    let service: EnhancedBlockchainService;

    beforeAll(() => {
      process.env.ARBITRUM_RPC_URL = "https://sepolia-rollup.arbitrum.io/rpc";
      process.env.LIVE_LEDGER_CONTRACT_ADDRESS =
        "0xD454CCAE2E500ae984149Fa4CeC6E78f0145fD56";
      service = new EnhancedBlockchainService();
    });

    const validParams = {
      payerAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2",
      recipient: "0x5aAeb6053f3E94C9b9A09f33669435E7Ef1BeAed",
      token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      totalAmount: "1000000",
      ratePerSecond: "10",
      duration: 100000,
      maxWithdrawalsPerDay: 24,
    };

    it("should reject invalid payer address", async () => {
      const invalidParams = { ...validParams, payerAddress: "invalid-address" };

      await expect(service.prepareCreateStream(invalidParams)).rejects.toThrow(
        ValidationError
      );
      await expect(service.prepareCreateStream(invalidParams)).rejects.toThrow(
        "Invalid payer address"
      );
    });

    it("should reject invalid recipient address", async () => {
      const invalidParams = { ...validParams, recipient: "0x123" };

      await expect(service.prepareCreateStream(invalidParams)).rejects.toThrow(
        ValidationError
      );
      await expect(service.prepareCreateStream(invalidParams)).rejects.toThrow(
        "Invalid recipient address"
      );
    });

    it("should reject invalid token address", async () => {
      const invalidParams = { ...validParams, token: "not-an-address" };

      await expect(service.prepareCreateStream(invalidParams)).rejects.toThrow(
        ValidationError
      );
      await expect(service.prepareCreateStream(invalidParams)).rejects.toThrow(
        "Invalid token address"
      );
    });

    it("should reject invalid recipient in withdraw", async () => {
      await expect(
        service.prepareWithdraw({
          recipientAddress: "bad-address",
          streamId: 1,
        })
      ).rejects.toThrow(ValidationError);
    });

    it("should reject invalid payer in cancel stream", async () => {
      await expect(
        service.prepareCancelStream({
          payerAddress: "bad-address",
          streamId: 1,
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  // Test mock methods return expected structure
  describe("Mock Methods", () => {
    let service: EnhancedBlockchainService;

    beforeAll(() => {
      service = new EnhancedBlockchainService();
    });

    it("withdraw should return success response", async () => {
      const result = await service.withdraw(
        123,
        "0x5aAeb6053f3E94C9b9A09f33669435E7Ef1BeAed"
      );

      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("amount");
      expect(result).toHaveProperty("transactionHash");
      expect(result.success).toBe(true);
    });

    it("cancelStream should return success response", async () => {
      const result = await service.cancelStream(
        123,
        "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2"
      );

      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("refundAmount");
      expect(result).toHaveProperty("transactionHash");
      expect(result.success).toBe(true);
    });
  });

  // Test parameter validation
  describe("Parameter Validation", () => {
    let service: EnhancedBlockchainService;

    beforeAll(() => {
      service = new EnhancedBlockchainService();
    });

    it("should validate totalAmount equals ratePerSecond * duration", async () => {
      const invalidParams = {
        payerAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2",
        recipient: "0x5aAeb6053f3E94C9b9A09f33669435E7Ef1BeAed",
        token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        totalAmount: "2000000", // 2 USDC (should be 1 USDC)
        ratePerSecond: "10",
        duration: 100000,
        maxWithdrawalsPerDay: 24,
      };

      await expect(service.prepareCreateStream(invalidParams)).rejects.toThrow(
        ValidationError
      );
      await expect(service.prepareCreateStream(invalidParams)).rejects.toThrow(
        "Total amount must equal ratePerSecond * duration"
      );
    });
  });
});
