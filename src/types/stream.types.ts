export type StreamStatus =
  | "PENDING"
  | "ACTIVE"
  | "PAUSED"
  | "STOPPED"
  | "COMPLETED";
export type TransactionType =
  | "ESCROW_DEPOSIT"
  | "STREAM_START"
  | "STREAM_STOP"
  | "WITHDRAWAL"
  | "DEPOSIT";

export interface IStreamCreate {
  recipientAddress: string;
  tokenAddress: string;
  flowRate: string;
  totalAmount: string;
}

export interface IStream extends IStreamCreate {
  id: string;
  payerId: string;
  recipientId: string;
  status: StreamStatus;
  withdrawnAmount: string;
  startTime: Date;
  endTime?: Date;
  escrowConfirmed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStreamUpdate {
  status?: StreamStatus;
  endTime?: Date;
}

export interface IWithdrawalRequest {
  streamId: string;
  amount: string;
}

export interface IStreamWithBalance extends IStream {
  currentBalance: string;
  availableBalance: string;
}

export interface IStreamActivity {
  streamId: string;
  type: TransactionType;
  amount: string;
  timestamp: Date;
  transactionHash?: string;
}

export interface IEscrowDeposit {
  streamId: string;
  amount: string;
  transactionHash: string;
  status: "PENDING" | "CONFIRMED" | "FAILED";
}

// New types for streaming calculation engine
export interface StreamCalculation {
  streamId: string;
  currentBalance: string;
  claimableAmount: string;
  totalStreamed: string;
  withdrawnAmount: string;
  progress: number; // Percentage 0-100
  isActive: boolean;
  ratePerSecond: string;
  startTime: number; // Unix timestamp
  endTime: number | null; // Unix timestamp
  lastCalculated: number; // Unix timestamp
}

export interface WithdrawalLimits {
  maxWithdrawalsPerDay: number;
  withdrawalsUsedToday: number;
  remainingWithdrawals: number;
  canWithdraw: boolean;
  dayIndex: number; // Days since stream start
  nextWithdrawalTime: number | null; // Unix timestamp when next withdrawal is allowed
}

export interface StreamUser {
  id: string;
  walletAddress: string;
  name: string | null;
  email: string | null;
}

export interface StreamDetails {
  id: string;
  onChainStreamId?: number;
  payer: StreamUser;
  recipient: StreamUser;
  tokenAddress: string;
  totalAmount: string;
  status: StreamStatus;
  startTime: number; // Unix timestamp
  endTime: number | null; // Unix timestamp
  calculation: StreamCalculation;
  withdrawalLimits: WithdrawalLimits;
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
}
