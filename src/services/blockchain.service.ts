// // src/services/blockchain.service.ts
// import { ethers } from "ethers";
// import {
//   PreparedTransaction,
//   CreateStreamParams, // Replace EscrowDepositParams
//   WithdrawParams, // Replace EscrowWithdrawalParams
//   CancelStreamParams, // New
//   TransactionReceipt,
//   EscrowEvent,
//   StreamDetails,
// } from "../types/blockchain.types";
// import { BlockchainError, ValidationError } from "../errors/genericErrors";
// import "dotenv/config";
// export class BlockchainService {
//   private provider: ethers.providers.JsonRpcProvider;
//   private liveLedgerContractAddress: string;

//   private liveLedgerContractABI = [
//     // Stream Management
//     "function createStream(address recipient, address token, uint128 totalAmount, uint128 ratePerSecond, uint64 duration, uint8 maxWithdrawalsPerDay) external returns (uint256 streamId)",
//     "function cancelStream(uint256 streamId) external",

//     // Withdrawals
//     "function withdraw(uint256 streamId) external",
//     "function getClaimable(uint256 streamId) external view returns (uint256)",

//     // Stream Data
//     "function getStream(uint256 streamId) external view returns (address payer, address recipient, address token, uint128 totalAmount, uint128 withdrawn, uint64 startTime, uint64 endTime, uint8 maxWithdrawalsPerDay, bool active)",

//     // Events
//     "event StreamCreated(uint256 indexed streamId, address indexed payer, address indexed recipient, address token, uint256 totalAmount, uint256 ratePerSecond, uint256 duration)",
//     "event Withdraw(uint256 indexed streamId, address indexed recipient, uint256 amount)",
//     "event StreamCancelled(uint256 indexed streamId, address indexed payer, uint256 refundAmount)",
//   ];

//   constructor() {
//     // Arbitrum mainnet or testnet RPC
//     const rpcUrl = process.env.ARBITRUM_RPC_URL;
//     if (!rpcUrl) {
//       throw new Error("ARBITRUM_RPC_URL environment variable is required");
//     }

//     this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
//     this.liveLedgerContractAddress = process.env.LIVE_LEDGER_CONTRACT_ADDRESS!;

//     // Minimal ABI for escrow interactions
//     // this.escrowContractABI = [
//     //   "function deposit(string memory streamId, uint256 amount) external",
//     //   "function withdraw(string memory streamId, address recipient, uint256 amount) external",
//     //   "function getStreamBalance(string memory streamId) external view returns (uint256)",
//     //   "event FundsDeposited(string indexed streamId, address indexed payer, uint256 amount)",
//     //   "event FundsWithdrawn(string indexed streamId, address indexed recipient, uint256 amount)",
//     // ];
//   }

//   /**
//    * Prepare create stream transaction for user signing
//    */
//   async prepareCreateStream(
//     params: CreateStreamParams
//   ): Promise<PreparedTransaction> {
//     try {
//       const {
//         payerAddress,
//         recipient,
//         token,
//         totalAmount,
//         ratePerSecond,
//         duration,
//         maxWithdrawalsPerDay,
//       } = params;

//       // Validate inputs
//       if (!ethers.utils.isAddress(payerAddress)) {
//         throw new ValidationError("Invalid payer address");
//       }
//       if (!ethers.utils.isAddress(recipient)) {
//         throw new ValidationError("Invalid recipient address");
//       }
//       if (!ethers.utils.isAddress(token)) {
//         throw new ValidationError("Invalid token address");
//       }

//       const liveLedgerContract = new ethers.Contract(
//         this.liveLedgerContractAddress,
//         this.liveLedgerContractABI,
//         this.provider
//       );

//       // Convert amounts to proper units (assuming USDC 6 decimals)
//       const totalAmountWei = ethers.utils.parseUnits(totalAmount, 6);
//       const ratePerSecondWei = ethers.utils.parseUnits(ratePerSecond, 6);

//       // Encode the createStream function call
//       const transactionData = liveLedgerContract.interface.encodeFunctionData(
//         "createStream",
//         [
//           recipient,
//           token,
//           totalAmountWei,
//           ratePerSecondWei,
//           duration,
//           maxWithdrawalsPerDay,
//         ]
//       );

//       // Estimate gas
//       const gasLimit = await this.estimateGas({
//         from: payerAddress,
//         to: this.liveLedgerContractAddress,
//         data: transactionData,
//       });

//       return {
//         to: this.liveLedgerContractAddress,
//         data: transactionData,
//         value: "0",
//         gasLimit: gasLimit.toString(),
//         chainId: 42161, // Arbitrum mainnet
//       };
//     } catch (error) {
//       if (error instanceof ValidationError) {
//         throw error;
//       }
//       throw new BlockchainError(
//         "Failed to prepare create stream transaction",
//         error
//       );
//     }
//   }

//   /**
//    * Prepare withdrawal transaction from stream
//    */
//   async prepareWithdraw(params: WithdrawParams): Promise<PreparedTransaction> {
//     try {
//       const { recipientAddress, streamId } = params;

//       if (!ethers.utils.isAddress(recipientAddress)) {
//         throw new ValidationError("Invalid recipient address");
//       }

//       const liveLedgerContract = new ethers.Contract(
//         this.liveLedgerContractAddress,
//         this.liveLedgerContractABI,
//         this.provider
//       );

//       // Encode the withdraw function call
//       const transactionData = liveLedgerContract.interface.encodeFunctionData(
//         "withdraw",
//         [streamId]
//       );

//       const gasLimit = await this.estimateGas({
//         from: recipientAddress, // Recipient must be the caller
//         to: this.liveLedgerContractAddress,
//         data: transactionData,
//       });

//       return {
//         to: this.liveLedgerContractAddress,
//         data: transactionData,
//         value: "0",
//         gasLimit: gasLimit.toString(),
//         chainId: 42161,
//       };
//     } catch (error) {
//       throw new BlockchainError(
//         "Failed to prepare withdrawal transaction",
//         error
//       );
//     }
//   }

//   /**
//    * Prepare stream cancellation transaction
//    */
//   async prepareCancelStream(
//     params: CancelStreamParams
//   ): Promise<PreparedTransaction> {
//     try {
//       const { payerAddress, streamId } = params;

//       if (!ethers.utils.isAddress(payerAddress)) {
//         throw new ValidationError("Invalid payer address");
//       }

//       const liveLedgerContract = new ethers.Contract(
//         this.liveLedgerContractAddress,
//         this.liveLedgerContractABI,
//         this.provider
//       );

//       // Encode the cancelStream function call
//       const transactionData = liveLedgerContract.interface.encodeFunctionData(
//         "cancelStream",
//         [streamId]
//       );

//       const gasLimit = await this.estimateGas({
//         from: payerAddress, // Only payer can cancel
//         to: this.liveLedgerContractAddress,
//         data: transactionData,
//       });

//       return {
//         to: this.liveLedgerContractAddress,
//         data: transactionData,
//         value: "0",
//         gasLimit: gasLimit.toString(),
//         chainId: 42161,
//       };
//     } catch (error) {
//       throw new BlockchainError(
//         "Failed to prepare cancel stream transaction",
//         error
//       );
//     }
//   }

//   // /**
//   //  * Get current balance of a stream in escrow
//   //  */
//   // async getEscrowBalance(streamId: string): Promise<string> {
//   //   try {
//   //     const escrowContract = new ethers.Contract(
//   //       this.escrowContractAddress,
//   //       this.escrowContractABI,
//   //       this.provider
//   //     );

//   //     const balanceWei = await escrowContract.getStreamBalance(streamId);
//   //     return ethers.utils.formatUnits(balanceWei, 6); // Convert back to token units
//   //   } catch (error) {
//   //     throw new BlockchainError("Failed to get escrow balance", error);
//   //   }
//   // }

//   /**
//    * Verify transaction receipt and check for success
//    */
//   async verifyTransaction(
//     transactionHash: string
//   ): Promise<TransactionReceipt> {
//     try {
//       const receipt = await this.provider.getTransactionReceipt(
//         transactionHash
//       );

//       if (!receipt) {
//         throw new BlockchainError("Transaction not found");
//       }

//       return {
//         transactionHash: receipt.transactionHash,
//         status: receipt.status === 1 ? 1 : 0,
//         gasUsed: receipt.gasUsed.toString(),
//         blockNumber: receipt.blockNumber,
//       };
//     } catch (error) {
//       throw new BlockchainError("Failed to verify transaction", error);
//     }
//   }

//   // /**
//   //  * Listen for escrow deposit events
//   //  */
//   // async listenForDepositEvents(
//   //   callback: (event: EscrowEvent) => void
//   // ): Promise<void> {
//   //   try {
//   //     const escrowContract = new ethers.Contract(
//   //       this.escrowContractAddress,
//   //       this.escrowContractABI,
//   //       this.provider
//   //     );

//   //     escrowContract.on("FundsDeposited", (streamId, payer, amount, event) => {
//   //       callback({
//   //         streamId,
//   //         from: payer,
//   //         to: this.escrowContractAddress,
//   //         amount: ethers.utils.formatUnits(amount, 6),
//   //         transactionHash: event.transactionHash,
//   //         blockNumber: event.blockNumber,
//   //       });
//   //     });
//   //   } catch (error) {
//   //     throw new BlockchainError("Failed to listen for deposit events", error);
//   //   }
//   // }

//   // /**
//   //  * Listen for withdrawal events
//   //  */
//   // async listenForWithdrawalEvents(
//   //   callback: (event: EscrowEvent) => void
//   // ): Promise<void> {
//   //   try {
//   //     const escrowContract = new ethers.Contract(
//   //       this.escrowContractAddress,
//   //       this.escrowContractABI,
//   //       this.provider
//   //     );

//   //     escrowContract.on(
//   //       "FundsWithdrawn",
//   //       (streamId, recipient, amount, event) => {
//   //         callback({
//   //           streamId,
//   //           from: this.escrowContractAddress,
//   //           to: recipient,
//   //           amount: ethers.utils.formatUnits(amount, 6),
//   //           transactionHash: event.transactionHash,
//   //           blockNumber: event.blockNumber,
//   //         });
//   //       }
//   //     );
//   //   } catch (error) {
//   //     throw new BlockchainError(
//   //       "Failed to listen for withdrawal events",
//   //       error
//   //     );
//   //   }
//   // }

//   /**
//    * Estimate gas for a transaction
//    */
//   private async estimateGas(
//     transaction: ethers.providers.TransactionRequest
//   ): Promise<ethers.BigNumber> {
//     try {
//       return await this.provider.estimateGas(transaction);
//     } catch (error) {
//       // Return a safe default if estimation fails
//       return ethers.BigNumber.from(300000);
//     }
//   }

//   /**
//    * Get current gas price from Arbitrum
//    */
//   async getGasPrice(): Promise<string> {
//     try {
//       const gasPrice = await this.provider.getGasPrice();
//       return gasPrice.toString();
//     } catch (error) {
//       throw new BlockchainError("Failed to get gas price", error);
//     }
//   }
// }

// // Export singleton instance
// export const blockchainService = new BlockchainService();
