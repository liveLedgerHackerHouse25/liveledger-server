import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { BalanceSimulationService } from "./balanceSimulation.service";
import { DashboardService } from "./dashboard.service";
import { WithdrawalManagementService } from "./withdrawalManagement.service";

export interface StreamBalanceUpdate {
  streamId: string;
  claimableAmount: string;
  totalEarned: string;
  streamingProgress: number;
  timestamp: number;
}

export interface WithdrawalNotification {
  streamId: string;
  recipientAddress: string;
  amount: string;
  transactionHash?: string;
  timestamp: number;
}

export interface StreamCompletionAlert {
  streamId: string;
  payerAddress: string;
  recipientAddress: string;
  completionTime: Date;
  timeRemaining: number;
}

export class WebSocketService {
  private static instance: WebSocketService;
  private io: SocketIOServer | null = null;
  private balanceService: BalanceSimulationService;
  private dashboardService: DashboardService;
  private withdrawalService: WithdrawalManagementService;
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    this.balanceService = BalanceSimulationService.getInstance();
    this.dashboardService = DashboardService.getInstance();
    this.withdrawalService = WithdrawalManagementService.getInstance();
  }

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * Initialize WebSocket server
   */
  public initialize(server: HTTPServer): void {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    this.setupEventHandlers();
    this.startPeriodicUpdates();
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on("connection", (socket: any) => {
      console.log("Client connected:", socket.id);

      // Handle stream subscription
      socket.on("subscribe_to_streams", (streamIds: string[]) => {
        console.log("Client subscribed to streams:", streamIds);
        streamIds.forEach((streamId) => {
          socket.join(`stream_${streamId}`);
        });
      });

      // Handle user dashboard subscription
      socket.on("subscribe_to_dashboard", (userAddress: string) => {
        console.log("Client subscribed to dashboard:", userAddress);
        socket.join(`dashboard_${userAddress.toLowerCase()}`);
      });

      // Handle withdrawal notifications subscription
      socket.on("subscribe_to_withdrawals", (userAddress: string) => {
        console.log("Client subscribed to withdrawals:", userAddress);
        socket.join(`withdrawals_${userAddress.toLowerCase()}`);
      });

      // Handle disconnection
      socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
      });
    });
  }

  /**
   * Start periodic balance updates
   */
  private startPeriodicUpdates(): void {
    // Update stream balances every 5 seconds
    const balanceUpdateInterval = setInterval(async () => {
      await this.broadcastBalanceUpdates();
    }, 5000);

    // Check for stream completions every minute
    const completionCheckInterval = setInterval(async () => {
      await this.broadcastCompletionAlerts();
    }, 60000);

    this.updateIntervals.set("balance_updates", balanceUpdateInterval);
    this.updateIntervals.set("completion_checks", completionCheckInterval);
  }

  /**
   * Broadcast real-time balance updates to subscribed clients
   */
  private async broadcastBalanceUpdates(): Promise<void> {
    if (!this.io) return;

    try {
      // Get all active rooms that are stream subscriptions
      const streamRooms = Array.from(this.io.sockets.adapter.rooms.keys())
        .filter((room) => room.startsWith("stream_"))
        .map((room) => room.replace("stream_", ""));

      if (streamRooms.length === 0) return;

      // Get updated balances for all subscribed streams
      const balances = await this.balanceService.updateStreamBalances(streamRooms);

      // Broadcast updates to each stream room
      balances.forEach((balance) => {
        const update: StreamBalanceUpdate = {
          streamId: balance.streamId,
          claimableAmount: balance.claimableAmount,
          totalEarned: balance.totalEarned,
          streamingProgress: balance.streamingProgress,
          timestamp: Date.now(),
        };

        this.io?.to(`stream_${balance.streamId}`).emit("stream_balance_update", update);
      });
    } catch (error) {
      console.error("Error broadcasting balance updates:", error);
    }
  }

  /**
   * Broadcast stream completion alerts
   */
  private async broadcastCompletionAlerts(): Promise<void> {
    if (!this.io) return;

    try {
      const alerts = await this.dashboardService.getCompletionAlerts();

      alerts.forEach((alert) => {
        const completionAlert: StreamCompletionAlert = {
          streamId: alert.streamId,
          payerAddress: alert.payerAddress,
          recipientAddress: alert.recipientAddress,
          completionTime: alert.completionTime,
          timeRemaining: alert.timeRemaining,
        };

        // Send to both payer and recipient
        this.io?.to(`dashboard_${alert.payerAddress.toLowerCase()}`)
          .emit("stream_completion_alert", completionAlert);
        this.io?.to(`dashboard_${alert.recipientAddress.toLowerCase()}`)
          .emit("stream_completion_alert", completionAlert);
      });
    } catch (error) {
      console.error("Error broadcasting completion alerts:", error);
    }
  }

  /**
   * Notify about successful withdrawal
   */
  public async notifyWithdrawal(
    streamId: string,
    recipientAddress: string,
    amount: string,
    transactionHash?: string
  ): Promise<void> {
    if (!this.io) return;

    const notification: WithdrawalNotification = {
      streamId,
      recipientAddress,
      amount,
      transactionHash,
      timestamp: Date.now(),
    };

    // Send to recipient
    this.io.to(`withdrawals_${recipientAddress.toLowerCase()}`)
      .emit("withdrawal_processed", notification);

    // Send to stream subscribers
    this.io.to(`stream_${streamId}`)
      .emit("withdrawal_processed", notification);
  }

  /**
   * Notify about stream creation
   */
  public async notifyStreamCreated(
    streamId: string,
    payerAddress: string,
    recipientAddress: string
  ): Promise<void> {
    if (!this.io) return;

    const notification = {
      streamId,
      payerAddress,
      recipientAddress,
      timestamp: Date.now(),
    };

    // Send to both payer and recipient dashboards
    this.io.to(`dashboard_${payerAddress.toLowerCase()}`)
      .emit("stream_created", notification);
    this.io.to(`dashboard_${recipientAddress.toLowerCase()}`)
      .emit("stream_created", notification);
  }

  /**
   * Notify about stream cancellation
   */
  public async notifyStreamCancelled(
    streamId: string,
    payerAddress: string,
    recipientAddress: string,
    refundAmount: string
  ): Promise<void> {
    if (!this.io) return;

    const notification = {
      streamId,
      payerAddress,
      recipientAddress,
      refundAmount,
      timestamp: Date.now(),
    };

    // Send to both payer and recipient dashboards
    this.io.to(`dashboard_${payerAddress.toLowerCase()}`)
      .emit("stream_cancelled", notification);
    this.io.to(`dashboard_${recipientAddress.toLowerCase()}`)
      .emit("stream_cancelled", notification);
  }

  /**
   * Broadcast withdrawal limit warnings
   */
  public async notifyWithdrawalLimitWarning(
    userAddress: string,
    withdrawalsToday: number,
    maxWithdrawalsPerDay: number
  ): Promise<void> {
    if (!this.io) return;

    const warning = {
      userAddress,
      withdrawalsToday,
      maxWithdrawalsPerDay,
      remainingWithdrawals: maxWithdrawalsPerDay - withdrawalsToday,
      timestamp: Date.now(),
    };

    this.io.to(`withdrawals_${userAddress.toLowerCase()}`)
      .emit("withdrawal_limit_warning", warning);
  }

  /**
   * Stop all periodic updates
   */
  public stopPeriodicUpdates(): void {
    this.updateIntervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.updateIntervals.clear();
  }

  /**
   * Get connected clients count
   */
  public getConnectedClientsCount(): number {
    if (!this.io) return 0;
    return this.io.engine.clientsCount;
  }

  /**
   * Get active subscriptions
   */
  public getActiveSubscriptions(): {
    streams: string[];
    dashboards: string[];
    withdrawals: string[];
  } {
    if (!this.io) {
      return { streams: [], dashboards: [], withdrawals: [] };
    }

    const rooms = Array.from(this.io.sockets.adapter.rooms.keys());

    return {
      streams: rooms
        .filter((room: any) => room.startsWith("stream_"))
        .map((room: any) => room.replace("stream_", "")),
      dashboards: rooms
        .filter((room: any) => room.startsWith("dashboard_"))
        .map((room: any) => room.replace("dashboard_", "")),
      withdrawals: rooms
        .filter((room: any) => room.startsWith("withdrawals_"))
        .map((room: any) => room.replace("withdrawals_", "")),
    };
  }
}