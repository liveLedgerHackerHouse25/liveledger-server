export type StreamStatus = "ACTIVE" | "PAUSED" | "STOPPED" | "COMPLETED";

export type IStreamCreate = {
  recipientAddress: string;
  tokenAddress: string;
  flowRate: string;
  totalAmount: string;
};

export type IStream = IStreamCreate & {
  id: string;
  payerId: string;
  recipientId: string;
  status: StreamStatus;
  withdrawnAmount: string;
  startTime: Date;
  endTime?: Date;
  escrowConfirmed: boolean;
};