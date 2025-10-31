# Manual Testing Guide for Blockchain Service

## Overview
This guide provides step-by-step instructions for manually testing the EnhancedBlockchainService integration with the LiveLedger smart contract on Arbitrum Sepolia.

## Prerequisites
1. Arbitrum Sepolia RPC URL (e.g., from Alchemy, Infura, or public RPC)
2. Test wallet with ETH for gas fees on Arbitrum Sepolia
3. USDC token on Arbitrum Sepolia (for testing token streams)
4. Contract address: `0xD454CCAE2E500ae984149Fa4CeC6E78f0145fD56`

## Environment Setup
```bash
# Set environment variables
export ARBITRUM_RPC_URL="https://sepolia-rollup.arbitrum.io/rpc"
export LIVE_LEDGER_CONTRACT_ADDRESS="0xD454CCAE2E500ae984149Fa4CeC6E78f0145fD56"
export PRIVATE_KEY="your_private_key_here" # For sending transactions
```

## Test Scenarios

### 1. Service Initialization Test
**Purpose**: Verify the service connects to Arbitrum Sepolia

```javascript
const { EnhancedBlockchainService } = require('./src/services/enhancedBlockchain.service');

// Test 1.1: Service creation
const service = new EnhancedBlockchainService();
console.log('Service created successfully');

// Test 1.2: Get current gas price
service.getGasPrice().then(price => {
  console.log('Current gas price:', price, 'wei');
});

// Test 1.3: Get current block timestamp
service.getBlockTimestamp().then(timestamp => {
  console.log('Current block timestamp:', timestamp);
  console.log('Current time:', new Date(timestamp * 1000).toISOString());
});
```

### 2. Stream Creation Test
**Purpose**: Test preparing a stream creation transaction

```javascript
const createStreamParams = {
  payerAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2", // Your address
  recipient: "0x5aAeb6053f3E94C9b9A09f33669435E7Ef1BeAed", // Recipient address
  token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC on Arbitrum Sepolia
  totalAmount: "1000000", // 1 USDC (6 decimals)
  ratePerSecond: "10", // 10 tokens per second
  duration: 100000, // 100,000 seconds
  maxWithdrawalsPerDay: 24
};

// Test 2.1: Prepare create stream transaction
service.prepareCreateStream(createStreamParams).then(tx => {
  console.log('Create stream transaction prepared:');
  console.log('- To:', tx.to);
  console.log('- Data:', tx.data);
  console.log('- Gas limit:', tx.gasLimit);
  console.log('- Chain ID:', tx.chainId);
}).catch(err => {
  console.error('Error preparing transaction:', err.message);
});
```

### 3. Stream Query Test
**Purpose**: Test reading stream data from the contract

```javascript
const streamId = 1; // Use an existing stream ID

// Test 3.1: Get stream details
service.getStreamDetails(streamId).then(details => {
  console.log('Stream details:');
  console.log('- Payer:', details.payer);
  console.log('- Recipient:', details.recipient);
  console.log('- Token:', details.token);
  console.log('- Total amount:', details.totalAmount);
  console.log('- Withdrawn:', details.withdrawn);
  console.log('- Active:', details.active);
}).catch(err => {
  console.error('Stream not found or error:', err.message);
});

// Test 3.2: Get claimable amount
service.getClaimableAmount(streamId).then(amount => {
  console.log('Claimable amount:', amount, 'USDC');
}).catch(err => {
  console.error('Error getting claimable amount:', err.message);
});
```

### 4. Withdrawal Test
**Purpose**: Test preparing a withdrawal transaction

```javascript
const withdrawParams = {
  recipientAddress: "0x5aAeb6053f3E94C9b9A09f33669435E7Ef1BeAed", // Must be stream recipient
  streamId: 1
};

// Test 4.1: Prepare withdraw transaction
service.prepareWithdraw(withdrawParams).then(tx => {
  console.log('Withdraw transaction prepared:');
  console.log('- To:', tx.to);
  console.log('- Data:', tx.data);
  console.log('- Gas limit:', tx.gasLimit);
}).catch(err => {
  console.error('Error preparing withdraw:', err.message);
});
```

### 5. Stream Cancellation Test
**Purpose**: Test preparing a stream cancellation

```javascript
const cancelParams = {
  payerAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2", // Must be stream payer
  streamId: 1
};

// Test 5.1: Prepare cancel stream transaction
service.prepareCancelStream(cancelParams).then(tx => {
  console.log('Cancel stream transaction prepared:');
  console.log('- To:', tx.to);
  console.log('- Data:', tx.data);
  console.log('- Gas limit:', tx.gasLimit);
}).catch(err => {
  console.error('Error preparing cancel:', err.message);
});
```

### 6. Transaction Verification Test
**Purpose**: Test transaction receipt verification

```javascript
const txHash = "0x123..."; // Use a real transaction hash

// Test 6.1: Verify transaction
service.verifyTransaction(txHash).then(receipt => {
  console.log('Transaction receipt:');
  console.log('- Hash:', receipt.transactionHash);
  console.log('- Status:', receipt.status === 1 ? 'Success' : 'Failed');
  console.log('- Gas used:', receipt.gasUsed);
  console.log('- Block number:', receipt.blockNumber);
}).catch(err => {
  console.error('Transaction not found:', err.message);
});
```

### 7. Event Listening Test
**Purpose**: Test event monitoring

```javascript
// Test 7.1: Set up event listeners
console.log('Setting up event listeners...');
service.listenForStreamEvents((event) => {
  console.log('New event:', event);
});

console.log('Event listeners active. Create/withdraw/cancel streams to see events.');
```

## Validation Rules to Test

1. **Address Validation**
   - Must be valid Ethereum addresses (0x + 40 hex chars)
   - Test with: "0x123", "invalid", "", null

2. **Stream Parameters**
   - totalAmount must equal ratePerSecond * duration
   - Test with mismatched values

3. **Access Control**
   - Only recipient can withdraw
   - Only payer can cancel stream

4. **Token Support**
   - USDC (6 decimals): 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
   - Test with other ERC20 tokens

## Common Issues and Solutions

1. **"Transaction reverted"**
   - Check you have sufficient token balance
   - Verify you're the authorized caller (payer/recipient)
   - Ensure stream exists and is active

2. **"Gas estimation failed"**
   - Check contract has sufficient logic for the operation
   - Verify parameters are valid

3. **"Stream not found"**
   - Verify stream ID exists
   - Check you're querying the correct contract

4. **"Invalid address"**
   - Ensure addresses are checksummed
   - Verify 42-character length with 0x prefix

## Testing Checklist

- [ ] Service connects to Arbitrum Sepolia
- [ ] Can prepare create stream transaction
- [ ] Can query existing stream details
- [ ] Can get claimable amount
- [ ] Can prepare withdraw transaction
- [ ] Can prepare cancel transaction
- [ ] Can verify transaction receipts
- [ ] Events are captured correctly
- [ ] All validation rules work as expected

## Next Steps

After manual testing:
1. Document any issues found
2. Verify gas costs for each operation
3. Test edge cases (max values, zero amounts)
4. Test with different ERC20 tokens
5. Monitor event emissions during operations

## Tools for Manual Testing

1. **Arbiscan**: View transactions and contract state
   - https://sepolia.arbiscan.io/address/0xD454CCAE2E500ae984149Fa4CeC6E78f0145fD56

2. **Foundry/Cast**: Command-line interaction
   ```bash
   cast call 0xD454CCAE2E500ae984149Fa4CeC6E78f0145fD56 "getStream(uint256)" 1
   ```

3. **Etherscan API**: Programmatic access to transaction data

4. **MetaMask**: Manual transaction signing and sending

Remember to fund your test wallet with ETH on Arbitrum Sepolia for gas fees!