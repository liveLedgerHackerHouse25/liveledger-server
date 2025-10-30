export type StreamStatus =
  | "PENDING"
  | "ACTIVE"
  | "PAUSED"
  | "STOPPED"
  | "COMPLETED";
export type TransactionType =
  | "STREAM_START"
  | "STREAM_STOP"
  | "STREAM_PAUSE"
  | "STREAM_RESUME"
  | "WITHDRAWAL"
  | "DEPOSIT"
  | "ESCROW_DEPOSIT";

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
