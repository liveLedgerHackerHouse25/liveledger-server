// src/services/blockchain-sync.service.ts
import { ethers } from "ethers";
import { prisma } from "../utils/database";
import { streamingCalculationService } from "./streaming-calculation.service";
import { 
  StreamStatus, 
  TransactionType 
} from "../types/stream.types";
import { BlockchainError } from "../errors/genericErrors";

/**
 * Service that synchronizes blockchain events with off-chain database
 * Handles real-time event listening and batch synchronization
 */
export class BlockchainSyncService {
  private provider: ethers.providers.JsonRpcProvider;
  private liveLedgerContract: ethers.Contract;
  private isListening: boolean = false;
  private lastSyncedBlock: number = 0;

  constructor() {
    const rpcUrl = process.env.ARBITRUM_RPC_URL;
    if (!rpcUrl) {
      throw new Error("ARBITRUM_RPC_URL environment variable is required");
    }
    
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    
    const contractAddress = process.env.LIVE_LEDGER_CONTRACT_ADDRESS;
    if (!contractAddress) {
      throw new Error("LIVE_LEDGER_CONTRACT_ADDRESS environment variable is required");
    }

    // Full ABI for event listening
    const abi = [
      "function getStream(uint256 streamId) external view returns (address payer, address recipient, address token, uint128 totalAmount, uint128 withdrawn, uint64 startTime, uint64 endTime, uint8 maxWithdrawalsPerDay, bool active)",
      "function getClaimable(uint256 streamId) external view returns (uint128)",
      "event StreamCreated(uint256 indexed streamId, address indexed payer, address indexed recipient, address token, uint128 totalAmount, uint128 ratePerSecond, uint64 startTime, uint64 endTime, uint8 maxWithdrawalsPerDay)",
      "event Withdraw(uint256 indexed streamId, address indexed recipient, uint128 amount, uint32 dayIndex, uint8 withdrawalsToday)",
      "event StreamCancelled(uint256 indexed streamId, address indexed payer, uint128 refundAmount, uint128 claimableAmount)"
    ];

    this.liveLedgerContract = new ethers.Contract(contractAddress, abi, this.provider);
  }

  /**
   * Start listening for blockchain events
   */
  async startEventListening(): Promise<void> {
    if (this.isListening) {
      console.log("Already listening for blockchain events");
      return;
    }

    try {
      console.log("Starting blockchain event listeners...");

      // Listen for new stream creation
      this.liveLedgerContract.on("StreamCreated", this.handleStreamCreated.bind(this));
      
      // Listen for withdrawals
      this.liveLedgerContract.on("Withdraw", this.handleWithdrawal.bind(this));
      
      // Listen for stream cancellations
      this.liveLedgerContract.on("StreamCancelled", this.handleStreamCancelled.bind(this));

      this.isListening = true;
      console.log("Blockchain event listeners started successfully");

    } catch (error) {
      throw new BlockchainError("Failed to start event listeners", error);
    }
  }

  /**
   * Stop listening for blockchain events
   */
  async stopEventListening(): Promise<void> {
    if (!this.isListening) {
      return;
    }

    try {
      this.liveLedgerContract.removeAllListeners("StreamCreated");
      this.liveLedgerContract.removeAllListeners("Withdraw");
      this.liveLedgerContract.removeAllListeners("StreamCancelled");
      
      this.isListening = false;
      console.log("Blockchain event listeners stopped");

    } catch (error) {
      console.error("Error stopping event listeners:", error);
    }
  }

  /**
   * Handle StreamCreated event
   */
  private async handleStreamCreated(
    streamId: ethers.BigNumber,
    payer: string,
    recipient: string,
    token: string,
    totalAmount: ethers.BigNumber,
    ratePerSecond: ethers.BigNumber,
    startTime: ethers.BigNumber,
    endTime: ethers.BigNumber,
    maxWithdrawalsPerDay: number,
    event: ethers.Event
  ): Promise<void> {
    try {
      console.log(`StreamCreated event: streamId=${streamId.toString()}, payer=${payer}, recipient=${recipient}`);

      // Find or create users
      const [payerUser, recipientUser] = await Promise.all([
        this.findOrCreateUser(payer.toLowerCase()),
        this.findOrCreateUser(recipient.toLowerCase())
      ]);

      // Calculate duration and rate per second
      const duration = endTime.sub(startTime).toNumber();
      const formattedRatePerSecond = ethers.utils.formatUnits(ratePerSecond, 6);
      const formattedTotalAmount = ethers.utils.formatUnits(totalAmount, 6);

      // Create or update stream in database
      const existingStream = await prisma.stream.findFirst({
        where: {
          payerId: payerUser.id,
          recipientId: recipientUser.id,
          tokenAddress: token.toLowerCase(),
          totalAmount: formattedTotalAmount,
          status: "PENDING"
        }
      });

      let stream;
      if (existingStream) {
        // Update existing pending stream
        stream = await prisma.stream.update({
          where: { id: existingStream.id },
          data: {
            status: "ACTIVE" as StreamStatus,
            escrowConfirmed: true,
            startTime: new Date(startTime.toNumber() * 1000),
            endTime: new Date(endTime.toNumber() * 1000),
            flowRate: formattedRatePerSecond
          }
        });
      } else {
        // Create new stream
        stream = await prisma.stream.create({
          data: {
            payerId: payerUser.id,
            recipientId: recipientUser.id,
            tokenAddress: token.toLowerCase(),
            flowRate: formattedRatePerSecond,
            totalAmount: formattedTotalAmount,
            status: "ACTIVE" as StreamStatus,
            escrowConfirmed: true,
            startTime: new Date(startTime.toNumber() * 1000),
            endTime: new Date(endTime.toNumber() * 1000)
          }
        });
      }

      // Create transaction record
      await prisma.transaction.create({
        data: {
          streamId: stream.id,
          type: "STREAM_START" as TransactionType,
          amount: formattedTotalAmount,
          status: "CONFIRMED",
          txHash: event.transactionHash,
          fromAddress: payer.toLowerCase(),
          toAddress: recipient.toLowerCase(),
          completedAt: new Date()
        }
      });

      console.log(`Stream ${stream.id} synced with blockchain stream ${streamId.toString()}`);

    } catch (error) {
      console.error("Error handling StreamCreated event:", error);
    }
  }

  /**
   * Handle Withdraw event
   */
  private async handleWithdrawal(
    streamId: ethers.BigNumber,
    recipient: string,
    amount: ethers.BigNumber,
    dayIndex: number,
    withdrawalsToday: number,
    event: ethers.Event
  ): Promise<void> {
    try {
      console.log(`Withdraw event: streamId=${streamId.toString()}, recipient=${recipient}, amount=${amount.toString()}`);

      // Find the stream by on-chain ID or by recipient
      const recipientUser = await prisma.user.findUnique({
        where: { walletAddress: recipient.toLowerCase() }
      });

      if (!recipientUser) {
        console.error(`Recipient user not found: ${recipient}`);
        return;
      }

      // Find the most recent active stream for this recipient
      // In production, you'd want to map on-chain stream IDs to database stream IDs
      const stream = await prisma.stream.findFirst({
        where: {
          recipientId: recipientUser.id,
          status: "ACTIVE"
        },
        orderBy: { createdAt: "desc" }
      });

      if (!stream) {
        console.error(`Active stream not found for recipient: ${recipient}`);
        return;
      }

      const formattedAmount = ethers.utils.formatUnits(amount, 6);

      // Update stream withdrawn amount
      const newWithdrawnAmount = (parseFloat(stream.withdrawnAmount) + parseFloat(formattedAmount)).toFixed(6);
      
      await prisma.stream.update({
        where: { id: stream.id },
        data: {
          withdrawnAmount: newWithdrawnAmount
        }
      });

      // Create withdrawal transaction record
      await prisma.transaction.create({
        data: {
          streamId: stream.id,
          type: "WITHDRAWAL" as TransactionType,
          amount: formattedAmount,
          status: "CONFIRMED",
          txHash: event.transactionHash,
          fromAddress: stream.tokenAddress, // Token contract address
          toAddress: recipient.toLowerCase(),
          completedAt: new Date()
        }
      });

      // Update user balance
      await this.updateUserBalance(recipientUser.id, stream.tokenAddress, formattedAmount);

      console.log(`Withdrawal processed: ${formattedAmount} tokens to ${recipient}`);

    } catch (error) {
      console.error("Error handling Withdraw event:", error);
    }
  }

  /**
   * Handle StreamCancelled event
   */
  private async handleStreamCancelled(
    streamId: ethers.BigNumber,
    payer: string,
    refundAmount: ethers.BigNumber,
    claimableAmount: ethers.BigNumber,
    event: ethers.Event
  ): Promise<void> {
    try {
      console.log(`StreamCancelled event: streamId=${streamId.toString()}, payer=${payer}`);

      // Find the stream
      const payerUser = await prisma.user.findUnique({
        where: { walletAddress: payer.toLowerCase() }
      });

      if (!payerUser) {
        console.error(`Payer user not found: ${payer}`);
        return;
      }

      const stream = await prisma.stream.findFirst({
        where: {
          payerId: payerUser.id,
          status: "ACTIVE"
        },
        orderBy: { createdAt: "desc" }
      });

      if (!stream) {
        console.error(`Active stream not found for payer: ${payer}`);
        return;
      }

      // Update stream status to STOPPED
      await prisma.stream.update({
        where: { id: stream.id },
        data: {
          status: "STOPPED" as StreamStatus,
          endTime: new Date()
        }
      });

      // Create cancellation transaction record
      const formattedRefund = ethers.utils.formatUnits(refundAmount, 6);
      await prisma.transaction.create({
        data: {
          streamId: stream.id,
          type: "STREAM_STOP" as TransactionType,
          amount: formattedRefund,
          status: "CONFIRMED",
          txHash: event.transactionHash,
          fromAddress: stream.tokenAddress,
          toAddress: payer.toLowerCase(),
          completedAt: new Date()
        }
      });

      console.log(`Stream ${stream.id} cancelled and synced`);

    } catch (error) {
      console.error("Error handling StreamCancelled event:", error);
    }
  }

  /**
   * Sync historical events from blockchain
   */
  async syncHistoricalEvents(fromBlock?: number): Promise<void> {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      const startBlock = fromBlock || Math.max(0, currentBlock - 10000); // Last ~10k blocks

      console.log(`Syncing historical events from block ${startBlock} to ${currentBlock}`);

      // Get all historical events
      const [streamCreatedEvents, withdrawEvents, cancelledEvents] = await Promise.all([
        this.liveLedgerContract.queryFilter("StreamCreated", startBlock, currentBlock),
        this.liveLedgerContract.queryFilter("Withdraw", startBlock, currentBlock),
        this.liveLedgerContract.queryFilter("StreamCancelled", startBlock, currentBlock)
      ]);

      // Process events in chronological order
      const allEvents = [
        ...streamCreatedEvents.map(e => ({ ...e, type: "StreamCreated" })),
        ...withdrawEvents.map(e => ({ ...e, type: "Withdraw" })),
        ...cancelledEvents.map(e => ({ ...e, type: "StreamCancelled" }))
      ].sort((a, b) => a.blockNumber - b.blockNumber);

      console.log(`Found ${allEvents.length} historical events to process`);

      for (const event of allEvents) {
        try {
          if (event.args) {
            if (event.type === "StreamCreated") {
              await this.handleStreamCreated(
                event.args[0], event.args[1], event.args[2], event.args[3], 
                event.args[4], event.args[5], event.args[6], event.args[7], 
                event.args[8], event
              );
            } else if (event.type === "Withdraw") {
              await this.handleWithdrawal(
                event.args[0], event.args[1], event.args[2], 
                event.args[3], event.args[4], event
              );
            } else if (event.type === "StreamCancelled") {
              await this.handleStreamCancelled(
                event.args[0], event.args[1], event.args[2], event.args[3], event
              );
            }
          }
        } catch (error) {
          console.error(`Error processing historical event ${event.transactionHash}:`, error);
        }
      }

      this.lastSyncedBlock = currentBlock;
      console.log(`Historical sync completed up to block ${currentBlock}`);

    } catch (error) {
      throw new BlockchainError("Failed to sync historical events", error);
    }
  }

  /**
   * Verify all active streams are in sync with blockchain
   */
  async verifyStreamSync(): Promise<{ inSync: number; outOfSync: number }> {
    try {
      const activeStreams = await prisma.stream.findMany({
        where: {
          status: "ACTIVE",
          escrowConfirmed: true
        }
      });

      let inSync = 0;
      let outOfSync = 0;

      for (const stream of activeStreams) {
        try {
          // For MVP, we'll assume streams are mapped 1:1 with their database ID
          // In production, you'd store the on-chain stream ID in the database
          const streamInSync = await streamingCalculationService.syncStreamWithBlockchain(
            stream.id, 
            parseInt(stream.id.slice(-6), 16) // Pseudo on-chain ID for demo
          );
          
          if (streamInSync) {
            inSync++;
          } else {
            outOfSync++;
          }
        } catch (error) {
          console.error(`Error verifying stream ${stream.id}:`, error);
          outOfSync++;
        }
      }

      console.log(`Stream sync verification: ${inSync} in sync, ${outOfSync} out of sync`);
      return { inSync, outOfSync };

    } catch (error) {
      throw new BlockchainError("Failed to verify stream sync", error);
    }
  }

  /**
   * Find or create user by wallet address
   */
  private async findOrCreateUser(walletAddress: string) {
    let user = await prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress: walletAddress.toLowerCase(),
          type: "RECIPIENT" // Default type, will be updated when they sign up
        }
      });
    }

    return user;
  }

  /**
   * Update user balance after withdrawal
   */
  private async updateUserBalance(userId: string, tokenAddress: string, withdrawalAmount: string) {
    const existingBalance = await prisma.balance.findUnique({
      where: {
        userId_tokenAddress: {
          userId,
          tokenAddress: tokenAddress.toLowerCase()
        }
      }
    });

    const withdrawalValue = parseFloat(withdrawalAmount);

    if (existingBalance) {
      const newTotalEarned = parseFloat(existingBalance.totalEarned) + withdrawalValue;
      const newTotalWithdrawn = parseFloat(existingBalance.totalWithdrawn) + withdrawalValue;
      
      await prisma.balance.update({
        where: {
          userId_tokenAddress: {
            userId,
            tokenAddress: tokenAddress.toLowerCase()
          }
        },
        data: {
          totalEarned: newTotalEarned.toFixed(6),
          totalWithdrawn: newTotalWithdrawn.toFixed(6),
          availableBalance: "0" // Assuming immediate withdrawal
        }
      });
    } else {
      await prisma.balance.create({
        data: {
          userId,
          tokenAddress: tokenAddress.toLowerCase(),
          totalEarned: withdrawalAmount,
          totalWithdrawn: withdrawalAmount,
          availableBalance: "0"
        }
      });
    }
  }

  /**
   * Get synchronization status
   */
  getSyncStatus() {
    return {
      isListening: this.isListening,
      lastSyncedBlock: this.lastSyncedBlock,
      contractAddress: this.liveLedgerContract.address,
      providerNetwork: this.provider.network
    };
  }
}

// Export singleton instance
// Export singleton instance
export const blockchainSyncService = new BlockchainSyncService();