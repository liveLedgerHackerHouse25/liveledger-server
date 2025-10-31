// services/mockBlockchain.service.ts

import { prisma } from "../utils/database";

export interface MockPreparedTransaction {
  to: string;
  data: string;
  value: string;
  gasLimit: string;
  gasPrice: string;
  nonce: string;
}

export class MockBlockchainService {
  private confirmedStreams: Set<string> = new Set();
  private streamData: Map<string, any> = new Map();

  /**
   * Prepare a mock escrow deposit transaction
   */
  async prepareEscrowDeposit(
    fromAddress: string,
    amount: string,
    streamId: string,
    tokenAddress: string
  ): Promise<MockPreparedTransaction> {
    // Simulate transaction data that would be sent to blockchain
    return {
      to: process.env.ESCROW_CONTRACT_ADDRESS || "0xMockEscrowContract",
      data: this.encodeDepositData(fromAddress, amount, streamId, tokenAddress),
      value: "0",
      gasLimit: "250000",
      gasPrice: "30000000000", // 30 gwei
      nonce: Math.floor(Math.random() * 1000).toString(),
    };
  }

  /**
   * Simulate transaction confirmation - this would be called after frontend signs
   */
  async confirmTransaction(streamId: string): Promise<void> {
    // Simulate blockchain confirmation delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Mark stream as confirmed in our mock
    this.confirmedStreams.add(streamId);

    // Initialize stream data for balance calculations using actual database data
    await this.initializeStreamData(streamId);
  }

  /**
   * Get claimable amount for a stream (simulates on-chain view function)
   */
  async getClaimableAmount(streamId: string): Promise<string> {
    console.log("MockBlockchainService.getClaimableAmount:", {
      streamId,
      streamDataKeys: Array.from(this.streamData.keys()),
    });

    const stream = this.streamData.get(streamId);
    console.log("Stream data found:", !!stream);

    if (!stream || !this.confirmedStreams.has(streamId)) {
      console.log("Returning 0 - stream not found or not confirmed");
      return "0";
    }

    const now = Math.floor(Date.now() / 1000);
    const startTime = stream.startTime;
    const endTime = stream.endTime;

    console.log("Calculation params:", {
      now,
      startTime,
      endTime,
      totalAmount: stream.totalAmount,
      duration: stream.duration,
      withdrawn: stream.withdrawn,
    });

    if (now < startTime) return "0";

    const elapsed = Math.min(now - startTime, endTime - startTime);
    const ratePerSecond = BigInt(stream.totalAmount) / BigInt(stream.duration);
    const accrued = ratePerSecond * BigInt(elapsed);
    const withdrawn = BigInt(stream.withdrawn);

    const claimable = accrued - withdrawn;
    const result = claimable > 0 ? claimable.toString() : "0";
    console.log("Calculated claimable:", result);
    return result;
  }

  /**
   * Simulate withdrawal on blockchain
   */
  async withdraw(
    streamId: string,
    recipient: string
  ): Promise<{ success: boolean; amount: string }> {
    console.log("MockBlockchainService.withdraw:", {
      streamId,
      recipient,
      confirmedStreams: Array.from(this.confirmedStreams),
    });

    if (!this.confirmedStreams.has(streamId)) {
      console.log("Stream not confirmed:", streamId);
      return { success: false, amount: "0" };
    }

    const claimable = await this.getClaimableAmount(streamId);
    console.log("Claimable amount:", claimable);
    if (claimable === "0") {
      return { success: false, amount: "0" };
    }

    // Update withdrawn amount in mock data
    const stream = this.streamData.get(streamId);
    if (stream) {
      stream.withdrawn = (
        BigInt(stream.withdrawn) + BigInt(claimable)
      ).toString();
      this.streamData.set(streamId, stream);
    }

    return { success: true, amount: claimable };
  }

  /**
   * Simulate stream cancellation
   */
  async cancelStream(
    streamId: string,
    payer: string
  ): Promise<{ success: boolean; refundAmount: string }> {
    if (!this.confirmedStreams.has(streamId)) {
      return { success: false, refundAmount: "0" };
    }

    const stream = this.streamData.get(streamId);
    if (!stream) {
      return { success: false, refundAmount: "0" };
    }

    const claimable = await this.getClaimableAmount(streamId);
    const totalAmount = BigInt(stream.totalAmount);
    const withdrawn = BigInt(stream.withdrawn);
    const refundAmount = totalAmount - BigInt(claimable) - withdrawn;

    // Mark stream as inactive
    this.confirmedStreams.delete(streamId);

    return {
      success: true,
      refundAmount: refundAmount > 0 ? refundAmount.toString() : "0",
    };
  }

  /**
   * Helper method to encode mock transaction data
   */
  private encodeDepositData(
    fromAddress: string,
    amount: string,
    streamId: string,
    tokenAddress: string
  ): string {
    // Simulate ABI-encoded data that would be sent to blockchain
    return `0x${Buffer.from(
      `deposit|${fromAddress}|${amount}|${streamId}|${tokenAddress}|${Date.now()}`
    ).toString("hex")}`;
  }

  /**
   * Initialize mock stream data for calculations
   */
  private async initializeStreamData(streamId: string): Promise<void> {
    // Fetch actual stream data from database
    const stream = await prisma.stream.findUnique({
      where: { id: streamId },
    });

    if (!stream) {
      throw new Error(`Stream ${streamId} not found in database`);
    }

    // Calculate rate per second from total amount and duration
    const durationSeconds = Math.floor(
      (stream.endTime!.getTime() - stream.startTime.getTime()) / 1000
    );
    const totalAmountWei = BigInt(stream.totalAmount);
    const ratePerSecond = totalAmountWei / BigInt(durationSeconds);

    // Initialize stream data with actual database values
    this.streamData.set(streamId, {
      startTime: Math.floor(stream.startTime.getTime() / 1000),
      endTime: Math.floor(stream.endTime!.getTime() / 1000),
      duration: durationSeconds,
      totalAmount: stream.totalAmount,
      withdrawn: stream.withdrawnAmount,
      ratePerSecond: ratePerSecond.toString(),
    });
  }
}
