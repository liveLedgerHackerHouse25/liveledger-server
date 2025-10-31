// import { ethers } from "ethers";
import {
  PreparedTransaction,
  CreateStreamParams,
  WithdrawParams,
  CancelStreamParams,
  TransactionReceipt,
  StreamDetails,
} from "../types/blockchain.types";
import { BlockchainError, ValidationError } from "../errors/genericErrors";
import "dotenv/config";
import { ethers } from "ethers";

export class EnhancedBlockchainService {
  private provider: ethers.providers.JsonRpcProvider;
  private liveLedgerContractAddress: string;

  private liveLedgerContractABI = [
    // Stream Management
    "function createStream(address recipient, address token, uint128 totalAmount, uint128 ratePerSecond, uint64 duration, uint8 maxWithdrawalsPerDay) external returns (uint256 streamId)",
    "function cancelStream(uint256 streamId) external",

    // Withdrawals
    "function withdraw(uint256 streamId) external",
    "function getClaimable(uint256 streamId) external view returns (uint256)",

    // Stream Data
    "function getStream(uint256 streamId) external view returns (address payer, address recipient, address token, uint128 totalAmount, uint128 withdrawn, uint64 startTime, uint64 endTime, uint8 maxWithdrawalsPerDay, bool active)",

    // Events
    "event StreamCreated(uint256 indexed streamId, address indexed payer, address indexed recipient, address token, uint256 totalAmount, uint256 ratePerSecond, uint256 duration)",
    "event Withdraw(uint256 indexed streamId, address indexed recipient, uint256 amount)",
    "event StreamCancelled(uint256 indexed streamId, address indexed payer, uint256 refundAmount)",
  ];

  constructor() {
    // Use environment variable for RPC URL
    const rpcUrl = 
    process.env.ARBITRUM_RPC_URL ||
    process.env.ARBITRUM_SEPOLIA_RPC_URL ||
    process.env.ETHEREUM_RPC_URL;
    if (!rpcUrl) {
      throw new Error(
        "ARBITRUM_RPC_URL or ETHEREUM_RPC_URL environment variable is required"
      );
    }

    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.liveLedgerContractAddress = process.env.LIVE_LEDGER_CONTRACT_ADDRESS!;

    if (!this.liveLedgerContractAddress) {
      throw new Error(
        "LIVE_LEDGER_CONTRACT_ADDRESS environment variable is required"
      );
    }
  }

  /**
   * Prepare create stream transaction for user signing
   * Follows LiveLedger smart contract pattern exactly
   */
  async prepareCreateStream(
    params: CreateStreamParams
  ): Promise<PreparedTransaction> {
    try {
      const {
        payerAddress,
        recipient,
        token,
        totalAmount,
        ratePerSecond,
        duration,
        maxWithdrawalsPerDay,
      } = params;

      // Validate inputs
      if (!ethers.utils.isAddress(payerAddress)) {
        throw new ValidationError("Invalid payer address");
      }
      if (!ethers.utils.isAddress(recipient)) {
        throw new ValidationError("Invalid recipient address");
      }
      if (!ethers.utils.isAddress(token)) {
        throw new ValidationError("Invalid token address");
      }

      // Validate business logic
      const totalAmountWei = ethers.utils.parseUnits(totalAmount, 6); // USDC 6 decimals
      const ratePerSecondWei = ethers.utils.parseUnits(ratePerSecond, 6);
      const expectedTotal = ratePerSecondWei.mul(duration);

      if (!totalAmountWei.eq(expectedTotal)) {
        throw new ValidationError(
          `Total amount must equal ratePerSecond * duration. Expected: ${ethers.utils.formatUnits(
            expectedTotal,
            6
          )}, Got: ${totalAmount}`
        );
      }

      const liveLedgerContract = new ethers.Contract(
        this.liveLedgerContractAddress,
        this.liveLedgerContractABI,
        this.provider
      );

      // Encode the createStream function call
      const transactionData = liveLedgerContract.interface.encodeFunctionData(
        "createStream",
        [
          recipient,
          token,
          totalAmountWei,
          ratePerSecondWei,
          duration,
          maxWithdrawalsPerDay,
        ]
      );

      // Estimate gas
      const gasLimit = await this.estimateGas({
        from: payerAddress,
        to: this.liveLedgerContractAddress,
        data: transactionData,
      });

      return {
        to: this.liveLedgerContractAddress,
        data: transactionData,
        value: "0",
        gasLimit: gasLimit.toString(),
        chainId: await this.getChainId(),
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new BlockchainError(
        "Failed to prepare create stream transaction",
        error
      );
    }
  }

  /**
   * Prepare withdrawal transaction from stream
   * Only recipient can call this function
   */
  async prepareWithdraw(params: WithdrawParams): Promise<PreparedTransaction> {
    try {
      const { recipientAddress, streamId } = params;

      if (!ethers.utils.isAddress(recipientAddress)) {
        throw new ValidationError("Invalid recipient address");
      }

      const liveLedgerContract = new ethers.Contract(
        this.liveLedgerContractAddress,
        this.liveLedgerContractABI,
        this.provider
      );

      // Encode the withdraw function call
      const transactionData = liveLedgerContract.interface.encodeFunctionData(
        "withdraw",
        [streamId]
      );

      const gasLimit = await this.estimateGas({
        from: recipientAddress, // Recipient must be the caller
        to: this.liveLedgerContractAddress,
        data: transactionData,
      });

      return {
        to: this.liveLedgerContractAddress,
        data: transactionData,
        value: "0",
        gasLimit: gasLimit.toString(),
        chainId: await this.getChainId(),
      };
    } catch (error) {
      // If it's already a ValidationError, re-throw it
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new BlockchainError(
        "Failed to prepare withdrawal transaction",
        error
      );
    }
  }

  /**
   * Prepare stream cancellation transaction
   * Only payer can call this function
   */
  async prepareCancelStream(
    params: CancelStreamParams
  ): Promise<PreparedTransaction> {
    try {
      const { payerAddress, streamId } = params;

      if (!ethers.utils.isAddress(payerAddress)) {
        throw new ValidationError("Invalid payer address");
      }

      const liveLedgerContract = new ethers.Contract(
        this.liveLedgerContractAddress,
        this.liveLedgerContractABI,
        this.provider
      );

      // Encode the cancelStream function call
      const transactionData = liveLedgerContract.interface.encodeFunctionData(
        "cancelStream",
        [streamId]
      );

      const gasLimit = await this.estimateGas({
        from: payerAddress, // Only payer can cancel
        to: this.liveLedgerContractAddress,
        data: transactionData,
      });

      return {
        to: this.liveLedgerContractAddress,
        data: transactionData,
        value: "0",
        gasLimit: gasLimit.toString(),
        chainId: await this.getChainId(),
      };
    } catch (error) {
      // If it's already a ValidationError, re-throw it
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new BlockchainError(
        "Failed to prepare cancel stream transaction",
        error
      );
    }
  }

  /**
   * Get stream details from blockchain (view function - no gas)
   */
  async getStreamDetails(streamId: number): Promise<StreamDetails> {
    try {
      const liveLedgerContract = new ethers.Contract(
        this.liveLedgerContractAddress,
        this.liveLedgerContractABI,
        this.provider
      );

      const streamData = await liveLedgerContract.getStream(streamId);

      return {
        payer: streamData.payer,
        recipient: streamData.recipient,
        token: streamData.token,
        totalAmount: ethers.utils.formatUnits(streamData.totalAmount, 6),
        withdrawn: ethers.utils.formatUnits(streamData.withdrawn, 6),
        startTime: streamData.startTime.toNumber(),
        endTime: streamData.endTime.toNumber(),
        maxWithdrawalsPerDay: streamData.maxWithdrawalsPerDay,
        active: streamData.active,
      };
    } catch (error) {
      throw new BlockchainError("Failed to get stream details", error);
    }
  }

  /**
   * Simulate withdrawal from stream (mock implementation)
   */
  async withdraw(
    _streamId: number,
    _recipientAddress: string
  ): Promise<{ success: boolean; amount: string; transactionHash?: string }> {
    try {
      // In a real implementation, this would call the blockchain
      // For now, return a mock success response
      return {
        success: true,
        amount: "1000000", // Mock amount
        transactionHash: "0xmock_transaction_hash",
      };
    } catch (error) {
      throw new BlockchainError("Failed to withdraw from stream", error);
    }
  }

  /**
   * Simulate stream cancellation (mock implementation)
   */
  async cancelStream(
    _streamId: number,
    _payerAddress: string
  ): Promise<{
    success: boolean;
    refundAmount: string;
    transactionHash?: string;
  }> {
    try {
      // In a real implementation, this would call the blockchain
      // For now, return a mock success response
      return {
        success: true,
        refundAmount: "500000", // Mock refund amount
        transactionHash: "0xmock_cancel_transaction_hash",
      };
    } catch (error) {
      throw new BlockchainError("Failed to cancel stream", error);
    }
  }

  /**
   * Get claimable amount from blockchain (view function - no gas)
   */
  async getClaimableAmount(streamId: number): Promise<string> {
    try {
      const liveLedgerContract = new ethers.Contract(
        this.liveLedgerContractAddress,
        this.liveLedgerContractABI,
        this.provider
      );

      const claimableWei = await liveLedgerContract.getClaimable(streamId);
      return ethers.utils.formatUnits(claimableWei, 6);
    } catch (error) {
      throw new BlockchainError("Failed to get claimable amount", error);
    }
  }

  /**
   * Verify transaction receipt and check for success
   */
  async verifyTransaction(
    transactionHash: string
  ): Promise<TransactionReceipt> {
    try {
      const receipt = await this.provider.getTransactionReceipt(
        transactionHash
      );

      if (!receipt) {
        throw new BlockchainError("Transaction not found");
      }

      return {
        transactionHash: receipt.transactionHash,
        status: receipt.status === 1 ? 1 : 0,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      throw new BlockchainError("Failed to verify transaction", error);
    }
  }

  /**
   * Listen for stream events
   */
  async listenForStreamEvents(callback: (event: any) => void): Promise<void> {
    try {
      const liveLedgerContract = new ethers.Contract(
        this.liveLedgerContractAddress,
        this.liveLedgerContractABI,
        this.provider
      );

      // Listen for StreamCreated events
      liveLedgerContract.on(
        "StreamCreated",
        (
          streamId,
          payer,
          recipient,
          token,
          totalAmount,
          ratePerSecond,
          duration,
          event
        ) => {
          callback({
            eventType: "StreamCreated",
            streamId: streamId.toString(),
            payer,
            recipient,
            token,
            totalAmount: ethers.utils.formatUnits(totalAmount, 6),
            ratePerSecond: ethers.utils.formatUnits(ratePerSecond, 6),
            duration: duration.toString(),
            transactionHash: event.transactionHash,
            blockNumber: event.blockNumber,
          });
        }
      );

      // Listen for Withdraw events
      liveLedgerContract.on(
        "Withdraw",
        (streamId, recipient, amount, event) => {
          callback({
            eventType: "Withdraw",
            streamId: streamId.toString(),
            recipient,
            amount: ethers.utils.formatUnits(amount, 6),
            transactionHash: event.transactionHash,
            blockNumber: event.blockNumber,
          });
        }
      );

      // Listen for StreamCancelled events
      liveLedgerContract.on(
        "StreamCancelled",
        (streamId, payer, refundAmount, event) => {
          callback({
            eventType: "StreamCancelled",
            streamId: streamId.toString(),
            payer,
            refundAmount: ethers.utils.formatUnits(refundAmount, 6),
            transactionHash: event.transactionHash,
            blockNumber: event.blockNumber,
          });
        }
      );
    } catch (error) {
      throw new BlockchainError("Failed to listen for stream events", error);
    }
  }

  /**
   * Estimate gas for a transaction
   */
  private async estimateGas(
    transaction: ethers.providers.TransactionRequest
  ): Promise<ethers.BigNumber> {
    try {
      return await this.provider.estimateGas(transaction);
    } catch (error) {
      // Return a safe default if estimation fails
      return ethers.BigNumber.from(300000);
    }
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<string> {
    try {
      const gasPrice = await this.provider.getGasPrice();
      return gasPrice.toString();
    } catch (error) {
      throw new BlockchainError("Failed to get gas price", error);
    }
  }

  /**
   * Get current chain ID
   */
  private async getChainId(): Promise<number> {
    try {
      const network = await this.provider.getNetwork();
      return network.chainId;
    } catch (error) {
      // Default to Arbitrum mainnet
      return 42161;
    }
  }

  /**
   * Get current block timestamp
   */
  async getBlockTimestamp(): Promise<number> {
    try {
      const block = await this.provider.getBlock("latest");
      return block.timestamp;
    } catch (error) {
      throw new BlockchainError("Failed to get block timestamp", error);
    }
  }
}

// Export singleton instance - LAZY INITIALIZATION to avoid issues during import
// let _singletonInstance: EnhancedBlockchainService | null = null;

// export const enhancedBlockchainService = {
//   getInstance(): EnhancedBlockchainService {
//     if (!_singletonInstance) {
//       _singletonInstance = new EnhancedBlockchainService();
//     }
//     return _singletonInstance;
//   }
// };
