// src/services/real-time-worker.service.ts
import { WebSocket } from "ws";
import { prisma } from "../utils/database";
import { streamingCalculationService } from "./streaming-calculation.service";
import { blockchainSyncService } from "./blockchain-sync.service";
import { 
  StreamCalculation, 
  StreamDetails,
  StreamStatus 
} from "../types/stream.types";

/**
 * Background worker service that provides real-time stream calculations
 * Handles periodic updates, WebSocket connections, and notifications
 */
export class RealTimeWorkerService {
  private updateInterval: NodeJS.Timeout | null = null;
  private wsConnections: Map<string, Set<WebSocket>> = new Map(); // userId -> WebSocket connections
  private isRunning: boolean = false;
  private updateFrequency: number = 5000; // 5 seconds

  constructor() {
    // Start blockchain event listening on initialization
    this.initializeServices();
  }

  /**
   * Initialize all background services
   */
  private async initializeServices(): Promise<void> {
    try {
      // Start blockchain event listeners
      await blockchainSyncService.startEventListening();
      
      // Sync recent historical events
      await blockchainSyncService.syncHistoricalEvents();
      
      console.log("Real-time worker services initialized");
    } catch (error) {
      console.error("Failed to initialize real-time worker services:", error);
    }
  }

  /**
   * Start the real-time calculation worker
   */
  async startWorker(): Promise<void> {
    if (this.isRunning) {
      console.log("Real-time worker is already running");
      return;
    }

    console.log(`Starting real-time worker with ${this.updateFrequency}ms update frequency`);
    
    this.isRunning = true;
    this.updateInterval = setInterval(async () => {
      await this.performPeriodicUpdate();
    }, this.updateFrequency);

    console.log("Real-time worker started successfully");
  }

  /**
   * Stop the real-time calculation worker
   */
  async stopWorker(): Promise<void> {
    if (!this.isRunning) {
      console.log("Real-time worker is not running");
      return;
    }

    this.isRunning = false;

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Stop blockchain event listening
    await blockchainSyncService.stopEventListening();

    console.log("Real-time worker stopped");
  }

  /**
   * Perform periodic updates for all active streams
   */
  private async performPeriodicUpdate(): Promise<void> {
    try {
      // Get all active streams
      const activeStreams = await prisma.stream.findMany({
        where: {
          status: "ACTIVE",
          escrowConfirmed: true
        },
        include: {
          payer: true,
          recipient: true
        }
      });

      if (activeStreams.length === 0) {
        return;
      }

      console.log(`Updating ${activeStreams.length} active streams...`);

      // Calculate balances for all streams
      const streamIds = activeStreams.map((stream: any) => stream.id);
      const calculations = await streamingCalculationService.getBatchStreamCalculations(streamIds);

      // Process each stream
      for (const stream of activeStreams) {
        const calculation = calculations[stream.id];
        if (!calculation) continue;

        try {
          // Check if stream should be completed
          if (stream.endTime && new Date() > stream.endTime && stream.status === "ACTIVE") {
            await this.completeExpiredStream(stream.id);
            continue;
          }

          // Send real-time updates to connected clients
          await this.broadcastStreamUpdate(stream.payerId, calculation);
          await this.broadcastStreamUpdate(stream.recipientId, calculation);

          // Update balances for recipients
          await this.updateRecipientBalance(stream.recipientId, stream.tokenAddress, calculation);

        } catch (error) {
          console.error(`Error processing stream update ${stream.id}:`, error);
        }
      }

      // Periodic blockchain sync verification (every 10 minutes)
      if (Date.now() % 600000 < this.updateFrequency) {
        await this.performBlockchainSync();
      }

    } catch (error) {
      console.error("Error in periodic update:", error);
    }
  }

  /**
   * Complete expired streams
   */
  private async completeExpiredStream(streamId: string): Promise<void> {
    try {
      await prisma.stream.update({
        where: { id: streamId },
        data: {
          status: "COMPLETED" as StreamStatus,
          endTime: new Date()
        }
      });

      console.log(`Stream ${streamId} marked as completed`);

      // Notify connected users
      const stream = await prisma.stream.findUnique({
        where: { id: streamId },
        include: { payer: true, recipient: true }
      });

      if (stream) {
        const notification = {
          type: "STREAM_COMPLETED",
          streamId,
          message: "Stream has been completed",
          timestamp: Date.now()
        };

        this.sendNotificationToUser(stream.payerId, notification);
        this.sendNotificationToUser(stream.recipientId, notification);
      }

    } catch (error) {
      console.error(`Error completing stream ${streamId}:`, error);
    }
  }

  /**
   * Update recipient balance in database
   */
  private async updateRecipientBalance(
    recipientId: string, 
    tokenAddress: string, 
    calculation: StreamCalculation
  ): Promise<void> {
    try {
      const existingBalance = await prisma.balance.findUnique({
        where: {
          userId_tokenAddress: {
            userId: recipientId,
            tokenAddress: tokenAddress.toLowerCase()
          }
        }
      });

      const totalEarned = calculation.totalStreamed;
      const totalWithdrawn = calculation.withdrawnAmount;
      const availableBalance = calculation.claimableAmount;

      if (existingBalance) {
        await prisma.balance.update({
          where: {
            userId_tokenAddress: {
              userId: recipientId,
              tokenAddress: tokenAddress.toLowerCase()
            }
          },
          data: {
            totalEarned,
            totalWithdrawn,
            availableBalance
          }
        });
      } else {
        await prisma.balance.create({
          data: {
            userId: recipientId,
            tokenAddress: tokenAddress.toLowerCase(),
            totalEarned,
            totalWithdrawn,
            availableBalance
          }
        });
      }

    } catch (error) {
      console.error(`Error updating balance for user ${recipientId}:`, error);
    }
  }

  /**
   * Perform blockchain synchronization
   */
  private async performBlockchainSync(): Promise<void> {
    try {
      console.log("Performing blockchain sync verification...");
      const syncResult = await blockchainSyncService.verifyStreamSync();
      
      if (syncResult.outOfSync > 0) {
        console.warn(`Found ${syncResult.outOfSync} streams out of sync with blockchain`);
        // In production, you might want to trigger alerts or automatic fixes
      }

    } catch (error) {
      console.error("Error during blockchain sync:", error);
    }
  }

  /**
   * Register WebSocket connection for a user
   */
  registerWebSocketConnection(userId: string, ws: WebSocket): void {
    if (!this.wsConnections.has(userId)) {
      this.wsConnections.set(userId, new Set());
    }
    
    this.wsConnections.get(userId)!.add(ws);

    // Handle connection cleanup
    ws.on("close", () => {
      this.unregisterWebSocketConnection(userId, ws);
    });

    ws.on("error", (error) => {
      console.error(`WebSocket error for user ${userId}:`, error);
      this.unregisterWebSocketConnection(userId, ws);
    });

    console.log(`WebSocket registered for user ${userId}`);
  }

  /**
   * Unregister WebSocket connection
   */
  private unregisterWebSocketConnection(userId: string, ws: WebSocket): void {
    const userConnections = this.wsConnections.get(userId);
    if (userConnections) {
      userConnections.delete(ws);
      if (userConnections.size === 0) {
        this.wsConnections.delete(userId);
      }
    }
  }

  /**
   * Broadcast stream update to user's WebSocket connections
   */
  private async broadcastStreamUpdate(userId: string, calculation: StreamCalculation): Promise<void> {
    const connections = this.wsConnections.get(userId);
    if (!connections || connections.size === 0) {
      return;
    }

    const message = JSON.stringify({
      type: "STREAM_UPDATE",
      data: calculation,
      timestamp: Date.now()
    });

    for (const ws of connections) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      } catch (error) {
        console.error(`Error sending WebSocket message to user ${userId}:`, error);
        this.unregisterWebSocketConnection(userId, ws);
      }
    }
  }

  /**
   * Send notification to user
   */
  private sendNotificationToUser(userId: string, notification: any): void {
    const connections = this.wsConnections.get(userId);
    if (!connections || connections.size === 0) {
      return;
    }

    const message = JSON.stringify({
      type: "NOTIFICATION",
      data: notification,
      timestamp: Date.now()
    });

    for (const ws of connections) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      } catch (error) {
        console.error(`Error sending notification to user ${userId}:`, error);
        this.unregisterWebSocketConnection(userId, ws);
      }
    }
  }

  /**
   * Get real-time stream details for a user
   */
  async getUserStreamDetails(userId: string): Promise<StreamDetails[]> {
    try {
      const streams = await prisma.stream.findMany({
        where: {
          OR: [
            { payerId: userId },
            { recipientId: userId }
          ],
          status: { in: ["ACTIVE", "PAUSED"] }
        },
        include: {
          payer: true,
          recipient: true
        }
      });

      const streamDetails = await Promise.all(
        streams.map((stream: any) => 
          streamingCalculationService.getStreamDetails(stream.id)
            .catch(error => {
              console.error(`Error getting details for stream ${stream.id}:`, error);
              return null;
            })
        )
      );

      return streamDetails.filter((details: any) => details !== null) as StreamDetails[];

    } catch (error) {
      console.error(`Error getting user stream details for ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get connected users count for monitoring
   */
  getConnectedUsersCount(): number {
    return this.wsConnections.size;
  }

  /**
   * Get worker status
   */
  getWorkerStatus() {
    return {
      isRunning: this.isRunning,
      updateFrequency: this.updateFrequency,
      connectedUsers: this.getConnectedUsersCount(),
      syncStatus: blockchainSyncService.getSyncStatus()
    };
  }

  /**
   * Update worker frequency (for dynamic adjustment)
   */
  setUpdateFrequency(frequency: number): void {
    this.updateFrequency = Math.max(1000, frequency); // Minimum 1 second
    
    if (this.isRunning) {
      this.stopWorker();
      this.startWorker();
    }
  }
}

// Export singleton instance
export const realTimeWorkerService = new RealTimeWorkerService();