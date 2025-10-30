// src/types/blockchain.types.ts
import { BigNumberish } from "ethers";

export interface PreparedTransaction {
  to: string;
  data: string;
  value: string;
  gasLimit: string;
  chainId: number;
}

export interface EscrowDepositParams {
  payerAddress: string;
  amount: string;
  streamId: string;
  tokenAddress: string;
}

export interface EscrowWithdrawalParams {
  streamId: string;
  recipientAddress: string;
  amount: string;
}

export interface TransactionReceipt {
  transactionHash: string;
  status: number;
  gasUsed: string;
  blockNumber: number;
}

export interface EscrowEvent {
  streamId: string;
  from: string;
  to: string;
  amount: string;
  transactionHash: string;
  blockNumber: number;
}

export interface CreateStreamParams {
  payerAddress: string;
  recipient: string;
  token: string;
  totalAmount: string;
  ratePerSecond: string;
  duration: number; // in seconds
  maxWithdrawalsPerDay: number;
}

export interface WithdrawParams {
  recipientAddress: string;
  streamId: number; // Changed from string to number
}

export interface CancelStreamParams {
  payerAddress: string;
  streamId: number; // Changed from string to number
}

export interface StreamDetails {
  payer: string;
  recipient: string;
  token: string;
  totalAmount: string;
  withdrawn: string;
  startTime: number;
  endTime: number;
  maxWithdrawalsPerDay: number;
  active: boolean;
}
