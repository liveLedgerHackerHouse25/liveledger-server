export type TransactionType = "STREAM_START" | "STREAM_STOP" | "WITHDRAWAL" | "DEPOSIT";

export type TransactionStatus = "PENDING" | "CONFIRMED" | "FAILED";

export interface IBlockchainTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasPrice?: string;
  gasLimit?: string;
  data?: string;
  nonce?: number;
}

export interface IEscrowDeposit {
  streamId: string;
  payerAddress: string;
  recipientAddress: string;
  tokenAddress: string;
  amount: string;
  txHash: string;
}

export interface IWithdrawalRequest {
  streamId: string;
  amount: string;
  recipientAddress: string;
  tokenAddress: string;
}