# LiveLedger - Real-Time Payment Streaming Protocol

**LiveLedger** is a Web3 payment streaming protocol that converts lump-sum deposits into real-time micropayments, solving cash flow lag for creators, freelancers, and IoT services.

## 🎯 Problem & Solution

### The Problem

Traditional payroll and creator-payout systems suffer from:

- **Cash-flow lag**: Creators can't access funds as they earn them
- **High friction**: Transaction costs make small/continuous payments impractical
- **Centralized control**: Platforms hold funds and decide when to release them

### The Solution

LiveLedger provides a "money-tap" streaming payment contract where:

- Payers deposit lump-sum amounts (e.g., USDC)
- Contracts stream value continuously at defined rates
- Recipients can withdraw earned amounts anytime (with daily limits)
- Real-time balance updates happen off-chain for gas efficiency

## 🏗️ Architecture

### Core Contracts

#### `LiveLedger.sol` - Main Protocol Contract

- **Single registry + escrow**: Holds all funds and stream data
- **Time-based accrual**: Calculates claimable amounts on-demand
- **Daily withdrawal limits**: Prevents recipients from draining streams instantly
- **Payer controls**: Create, cancel, and manage streams

#### `ILiveLedger.sol` - Protocol Interface

- Defines all external functions and events
- Ensures stable API for frontend integration

#### `MockUSDC.sol` - Test Token

- 6-decimal USDC-compatible token for testing
- Mint/burn functionality for test scenarios

### Key Data Structures

```solidity
struct Stream {
    address payer;              // Who deposited the funds
    address recipient;          // Who can withdraw the funds
    address token;              // ERC20 token (e.g., USDC)
    uint128 totalAmount;        // Total deposited amount
    uint128 withdrawn;          // Amount already withdrawn
    uint64  startTime;          // When streaming begins
    uint64  endTime;            // When streaming ends
    uint8   maxWithdrawalsPerDay; // Daily withdrawal limit
    bool    active;             // Stream status
}
```

## 💰 Core Functions

### Stream Management

#### `createStream(recipient, token, totalAmount, ratePerSecond, duration, maxWDPerDay)`

- Deposits `totalAmount` from payer
- Sets up streaming at `ratePerSecond` for `duration` seconds
- Validates: `totalAmount == ratePerSecond * duration`
- Emits: `StreamCreated` event

#### `cancelStream(streamId)`

- **Payer-only**: Stops further accrual
- Refunds unaccrued portion to payer
- Leaves accrued-but-unwithdrawn available for recipient
- Emits: `StreamCancelled` event

### Withdrawal System

#### `withdraw(streamId)`

- **Recipient-only**: Claims available tokens
- Respects daily withdrawal limits
- Updates withdrawn amount
- Emits: `Withdraw` event

#### `getClaimable(streamId)` (view)

- Returns currently withdrawable amount
- Formula: `(elapsed_time * rate_per_second) - already_withdrawn`
- Caps at total stream amount

## 🔒 Security Features

### Access Control

- **Payer permissions**: Create, cancel, pause streams
- **Recipient permissions**: Withdraw from streams
- **No admin keys**: Fully decentralized protocol

### Reentrancy Protection

- `ReentrancyGuard` on all state-changing functions
- Pull-pattern withdrawals (recipient calls withdraw)

### Input Validation

- Zero-address checks
- Amount/rate consistency validation
- Active stream status verification

### Daily Limits

```solidity
// Day index calculation
dayIndex = (block.timestamp - startTime) / 1 days

// Daily withdrawal tracking
mapping(streamId => mapping(dayIndex => withdrawalCount))
```

## ⚡ Gas Optimization

### Efficient Storage

- Packed structs: `uint128`/`uint64`/`uint8` to minimize slots
- Minimal state updates: Only `withdrawn` and daily counters
- View functions for balance queries

### Off-Chain "Live" Display

- Frontend calculates real-time balances
- On-chain calculations only during actual withdrawals
- Reduces gas costs while maintaining UX

## 🚀 Usage Examples

### Creating a Freelancer Payment Stream

```solidity
// Payer deposits $1000 to stream over 30 days
uint256 totalAmount = 1000 * 1e6;  // 1000 USDC (6 decimals)
uint256 ratePerSecond = totalAmount / (30 days);
uint256 duration = 30 days;
uint8 maxWithdrawalsPerDay = 3;

liveLedger.createStream(
    freelancerAddress,
    usdcAddress,
    totalAmount,
    ratePerSecond,
    duration,
    maxWithdrawalsPerDay
);
```

### Recipient Withdrawal

```solidity
// After 10 days, freelancer can withdraw ~$333
liveLedger.withdraw(streamId);
```

### Real-Time Frontend Display

```javascript
// Calculate live balance (off-chain)
const elapsed = Math.floor(Date.now() / 1000) - stream.startTime;
const accrued = Math.min(elapsed * stream.ratePerSecond, stream.totalAmount);
const claimable = accrued - stream.withdrawn;

// Update UI every second
setInterval(updateBalance, 1000);
```

## 🧪 Testing

### Test Coverage

- ✅ Stream creation and validation
- ✅ Time-based accrual calculations
- ✅ Daily withdrawal limit enforcement
- ✅ Stream cancellation refund logic
- ✅ Edge cases (small rates, immediate withdrawals)
- ✅ Multi-stream scenarios

### Running Tests

```bash
npm install
npx hardhat compile
npx hardhat test
```

## 🌐 Deployment

### Local Development

```bash
# Start local node
npx hardhat node

# Deploy contracts
npx hardhat ignition deploy ignition/modules/LiveLedger.ts --network localhost
```

### Arbitrum Deployment

```bash
# Deploy to Arbitrum Sepolia testnet
npx hardhat ignition deploy ignition/modules/LiveLedger.ts --network sepolia

# Verify contracts
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

## 🔮 Future Enhancements

### MVP Extensions

- **Batch Operations**: Create multiple streams in one transaction
- **Pause/Resume**: Temporary stream halting
- **Top-up Streams**: Add funds to existing streams

### Advanced Features

- **Vesting Schedules**: Cliffs and graduated releases
- **NFT Ownership**: ERC-721 tokens representing streams
- **Multi-token Support**: Stream different ERC-20s simultaneously
- **IoT Integration**: Automatic streaming based on device activity

## 📊 Gas Estimates

| Function       | Gas Usage | Notes                     |
| -------------- | --------- | ------------------------- |
| `createStream` | ~120k     | Initial deposit + storage |
| `withdraw`     | ~80k      | Transfer + state update   |
| `cancelStream` | ~60k      | State update + refund     |
| `getClaimable` | 0         | View function             |

## 🛡️ Audit Considerations

### Key Security Areas

1. **Integer overflow protection** (Solidity 0.8+ built-in)
2. **Reentrancy guards** on all external calls
3. **Access control validation** for each function
4. **Rate/amount consistency** in stream creation
5. **Daily limit boundary conditions** around midnight

### Known Limitations

- **Gas costs**: Ethereum mainnet may be expensive for small streams
- **Block time dependency**: 12-15 second resolution for timing
- **No pausing**: Once created, streams run until cancelled or completed

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

---

**Built with ❤️ for the Web3 creator economy**
