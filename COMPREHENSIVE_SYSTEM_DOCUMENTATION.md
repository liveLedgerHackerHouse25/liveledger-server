# LiveLedger - Comprehensive System Documentation

## 🌟 Project Overview

**LiveLedger** is a decentralized real-time payment streaming platform that enables continuous, automated payments between parties. The system allows users to create payment streams that flow continuously over time, with recipients able to withdraw accumulated funds at any moment.

### Key Features
- **Real-time Payment Streaming**: Continuous payment flows measured per second
- **Instant Withdrawals**: Recipients can withdraw accumulated funds anytime
- **Smart Contract Security**: All payments secured by Ethereum smart contracts
- **Web3 Integration**: Full MetaMask wallet connectivity
- **Withdrawal Limits**: Configurable daily withdrawal restrictions
- **Real-time Updates**: Live balance calculations and WebSocket connections

---

## 🏗️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │ Smart Contract  │
│   (Next.js)     │◄──►│   (Node.js)     │◄──►│   (Solidity)    │
│                 │    │                 │    │                 │
│ • React UI      │    │ • Express API   │    │ • LiveLedger    │
│ • Web3 Hooks    │    │ • Prisma ORM    │    │ • MockUSDC      │
│ • MetaMask      │    │ • PostgreSQL    │    │ • Arbitrum      │
│ • WebSockets    │    │ • WebSockets    │    │   Sepolia       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 🎨 Frontend Architecture (Next.js + React)

### Core Components Structure

```
src/
├── app/
│   ├── layout.tsx                 # Root layout with providers
│   ├── page.tsx                   # Landing page
│   ├── recipient/
│   │   └── dashboard/
│   │       └── page.tsx           # Main recipient dashboard
│   └── payer/
│       └── dashboard/
│           └── page.tsx           # Payer dashboard
├── components/                    # Reusable UI components
├── contexts/
│   ├── Web3Context.tsx           # Wallet connection management
│   └── AuthContext.tsx           # Authentication state
├── hooks/
│   ├── useStreaming.ts           # Core streaming logic
│   ├── useSmartContract.ts       # Smart contract interactions
│   └── useWallet.ts              # Wallet connection logic
├── lib/
│   ├── api.ts                    # Backend API client
│   ├── smartContract.ts          # Smart contract service
│   └── constants.ts              # Configuration constants
└── styles/                       # CSS modules and global styles
```

### Key Frontend Features

#### 1. **Recipient Dashboard** (`/recipient/dashboard`)
- **Real-time Balance Display**: Live calculation of earned amounts
- **Withdrawal Interface**: One-click withdrawal with gas optimization
- **Stream Management**: View all incoming payment streams
- **Visual Analytics**: Progress bars and earning statistics

#### 2. **Enhanced UI Components**
- **Glassmorphism Design**: Modern blur effects and gradients
- **Real-time Animations**: Floating effects, shimmer animations
- **Success Feedback**: Celebration animations for successful withdrawals
- **Error Handling**: User-friendly error messages with retry options

#### 3. **Web3 Integration**
```typescript
// Example: Wallet Connection Hook
const useWallet = () => {
  const [account, setAccount] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });
      setAccount(accounts[0]);
      setIsConnected(true);
    }
  };
  
  return { account, isConnected, connectWallet };
};
```

#### 4. **Real-time Streaming Hook**
```typescript
// Core streaming logic with WebSocket integration
const useStreaming = () => {
  const [streams, setStreams] = useState<StreamData[]>([]);
  const [userBalance, setUserBalance] = useState<UserBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Real-time balance calculation
  const calculateCurrentEarned = (stream: StreamData) => {
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - stream.calculation.startTime;
    const ratePerSecond = parseFloat(stream.calculation.ratePerSecond);
    return Math.min(elapsed * ratePerSecond, parseFloat(stream.totalAmount));
  };
  
  return { streams, userBalance, calculateCurrentEarned };
};
```

---

## 🔧 Backend Architecture (Node.js + Express)

### Project Structure

```
src/
├── app.ts                        # Express app configuration
├── server.ts                     # Server entry point
├── controllers/
│   ├── auth.controller.ts        # Authentication logic
│   ├── stream.controller.ts      # Stream management
│   └── user.controller.ts        # User operations
├── services/
│   ├── auth.service.ts          # Auth business logic
│   ├── stream.service.ts        # Stream business logic
│   ├── blockchain.service.ts    # Smart contract integration
│   └── real-time-worker.service.ts # WebSocket handling
├── routes/
│   ├── auth.routes.ts           # Authentication endpoints
│   ├── stream.routes.ts         # Stream management endpoints
│   └── user.routes.ts           # User management endpoints
├── middleware/
│   ├── auth.middleware.ts       # JWT authentication
│   ├── validation.middleware.ts # Request validation
│   └── error.middleware.ts      # Error handling
├── types/
│   └── stream.types.ts          # TypeScript interfaces
└── prisma/
    ├── schema.prisma            # Database schema
    └── migrations/              # Database migrations
```

### Core Backend Features

#### 1. **Authentication System**
```typescript
// JWT-based authentication with wallet verification
const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    throw new Error('No token provided');
  }
  
  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId }
  });
  
  req.user = user;
  next();
};
```

#### 2. **Stream Management**
```typescript
// Stream creation and management
class StreamService {
  async createStream(userId: string, streamData: IStreamCreate) {
    // Create database record
    const stream = await prisma.stream.create({
      data: {
        payerId: userId,
        recipientId: streamData.recipientId,
        tokenAddress: streamData.tokenAddress,
        totalAmount: streamData.totalAmount,
        status: 'PENDING'
      }
    });
    
    // Interact with smart contract
    const onChainStreamId = await this.blockchainService.createStream({
      recipient: streamData.recipientAddress,
      totalAmount: streamData.totalAmount,
      startTime: streamData.startTime,
      endTime: streamData.endTime
    });
    
    // Update with on-chain ID
    return await prisma.stream.update({
      where: { id: stream.id },
      data: { onChainStreamId }
    });
  }
  
  async processWithdrawal(userId: string, request: IWithdrawalRequest) {
    // Validate withdrawal limits
    // Execute smart contract withdrawal
    // Update database records
    // Emit real-time updates
  }
}
```

#### 3. **Database Schema (Prisma)**
```prisma
model User {
  id            String   @id @default(cuid())
  walletAddress String   @unique
  name          String?
  email         String?
  type          String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  // Relations
  sentStreams     Stream[] @relation("Payer")
  receivedStreams Stream[] @relation("Recipient")
}

model Stream {
  id              String      @id @default(cuid())
  onChainStreamId Int?
  tokenAddress    String
  totalAmount     String
  status          StreamStatus @default(PENDING)
  startTime       DateTime?
  endTime         DateTime?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  
  // Relations
  payer       User @relation("Payer", fields: [payerId], references: [id])
  payerId     String
  recipient   User @relation("Recipient", fields: [recipientId], references: [id])
  recipientId String
}

enum StreamStatus {
  PENDING
  ACTIVE
  PAUSED
  STOPPED
  COMPLETED
}
```

#### 4. **Real-time Updates (WebSockets)**
```typescript
// WebSocket service for real-time updates
class RealTimeWorkerService {
  private wss: WebSocketServer;
  
  constructor() {
    this.wss = new WebSocketServer({ port: 8080 });
    this.setupWebSocketHandlers();
  }
  
  broadcastStreamUpdate(streamId: string, data: any) {
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'STREAM_UPDATE',
          streamId,
          data
        }));
      }
    });
  }
}
```

---

## ⛓️ Smart Contract Architecture (Solidity)

### Contract Structure

```
contracts/
├── LiveLedger.sol               # Main streaming contract
├── MockUSDC.sol                 # Test USDC token
└── ILiveLedger.sol             # Interface definition
```

### Core Smart Contracts

#### 1. **LiveLedger Contract**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LiveLedger is ReentrancyGuard, Ownable {
    struct Stream {
        address payer;
        address recipient;
        uint256 totalAmount;
        uint256 withdrawn;
        uint256 startTime;
        uint256 endTime;
        bool active;
        uint8 maxWithdrawalsPerDay;
        mapping(uint256 => uint8) dailyWithdrawals; // dayIndex => count
    }
    
    IERC20 public immutable token;
    mapping(uint256 => Stream) public streams;
    uint256 public nextStreamId;
    
    // Events
    event StreamCreated(uint256 indexed streamId, address indexed payer, 
                       address indexed recipient, uint256 totalAmount);
    event Withdrawal(uint256 indexed streamId, address indexed recipient, 
                    uint256 amount);
    event StreamCancelled(uint256 indexed streamId);
    
    constructor(address _token) {
        token = IERC20(_token);
    }
    
    function createStream(
        address recipient,
        uint256 totalAmount,
        uint256 startTime,
        uint256 endTime,
        uint8 maxWithdrawalsPerDay
    ) external returns (uint256 streamId) {
        require(recipient != address(0), "Invalid recipient");
        require(totalAmount > 0, "Amount must be positive");
        require(endTime > startTime, "Invalid time range");
        
        // Transfer tokens to contract
        token.transferFrom(msg.sender, address(this), totalAmount);
        
        streamId = nextStreamId++;
        Stream storage stream = streams[streamId];
        stream.payer = msg.sender;
        stream.recipient = recipient;
        stream.totalAmount = totalAmount;
        stream.startTime = startTime;
        stream.endTime = endTime;
        stream.active = true;
        stream.maxWithdrawalsPerDay = maxWithdrawalsPerDay;
        
        emit StreamCreated(streamId, msg.sender, recipient, totalAmount);
    }
    
    function withdraw(uint256 streamId) external nonReentrant {
        Stream storage stream = streams[streamId];
        require(stream.active, "Stream not active");
        require(msg.sender == stream.recipient, "Not authorized");
        
        uint256 available = getAvailableAmount(streamId);
        require(available > 0, "No funds available");
        
        // Check daily withdrawal limits
        uint256 dayIndex = block.timestamp / 86400; // seconds per day
        require(
            stream.dailyWithdrawals[dayIndex] < stream.maxWithdrawalsPerDay,
            "Daily withdrawal limit reached"
        );
        
        stream.withdrawn += available;
        stream.dailyWithdrawals[dayIndex]++;
        
        token.transfer(stream.recipient, available);
        
        emit Withdrawal(streamId, stream.recipient, available);
    }
    
    function getAvailableAmount(uint256 streamId) public view returns (uint256) {
        Stream storage stream = streams[streamId];
        if (!stream.active || block.timestamp < stream.startTime) {
            return 0;
        }
        
        uint256 elapsed = block.timestamp - stream.startTime;
        uint256 duration = stream.endTime - stream.startTime;
        
        if (elapsed >= duration) {
            return stream.totalAmount - stream.withdrawn;
        }
        
        uint256 earned = (stream.totalAmount * elapsed) / duration;
        return earned > stream.withdrawn ? earned - stream.withdrawn : 0;
    }
}
```

#### 2. **MockUSDC Contract** (For Testing)
```solidity
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    uint8 private _decimals = 6;
    
    constructor() ERC20("Mock USDC", "USDC") {}
    
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
```

### Deployment Configuration

```typescript
// Hardhat deployment script
import { ethers } from "hardhat";

async function main() {
  // Deploy MockUSDC
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.deployed();
  
  // Deploy LiveLedger
  const LiveLedger = await ethers.getContractFactory("LiveLedger");
  const liveLedger = await LiveLedger.deploy(mockUSDC.address);
  await liveLedger.deployed();
  
  console.log("MockUSDC deployed to:", mockUSDC.address);
  console.log("LiveLedger deployed to:", liveLedger.address);
}
```

---

## 🔄 Data Flow & Integration

### 1. **Stream Creation Flow**
```
User (Frontend) → Backend API → Smart Contract → Database Update → WebSocket Broadcast
```

1. **Frontend**: User fills stream creation form
2. **Backend**: Validates request, creates database record
3. **Smart Contract**: Executes `createStream()` function
4. **Database**: Updates stream with on-chain ID
5. **Real-time**: Broadcasts update to connected clients

### 2. **Withdrawal Flow**
```
User (Frontend) → Smart Contract Direct → Database Sync → UI Update
```

1. **Frontend**: User clicks withdraw button
2. **Validation**: Check withdrawal limits and available balance
3. **Smart Contract**: Execute `withdraw()` function directly
4. **UI Update**: Immediate feedback with success animations
5. **Backend Sync**: Delayed sync for database consistency

### 3. **Real-time Balance Updates**
```
WebSocket Connection → Periodic Calculation → UI Refresh
```

1. **WebSocket**: Maintains real-time connection
2. **Calculation**: Frontend calculates earned amounts per second
3. **UI Updates**: Live balance display with animations
4. **Sync**: Periodic backend synchronization

---

## 🛡️ Security Features

### 1. **Smart Contract Security**
- **ReentrancyGuard**: Prevents reentrancy attacks
- **Access Control**: Only recipients can withdraw from their streams
- **Withdrawal Limits**: Daily withdrawal restrictions
- **Input Validation**: Comprehensive parameter validation

### 2. **Backend Security**
- **JWT Authentication**: Secure token-based authentication
- **Input Validation**: Joi-based request validation
- **SQL Injection Protection**: Prisma ORM prevents SQL injection
- **Rate Limiting**: API rate limiting to prevent abuse

### 3. **Frontend Security**
- **Wallet Verification**: Cryptographic signature verification
- **Input Sanitization**: XSS prevention measures
- **Error Handling**: Secure error messages without sensitive data
- **Environment Variables**: Secure configuration management

---

## 🚀 Deployment & Configuration

### Environment Configuration

#### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:8080
NEXT_PUBLIC_LIVE_LEDGER_ADDRESS=0x...
NEXT_PUBLIC_USDC_ADDRESS=0x...
NEXT_PUBLIC_NETWORK_NAME=arbitrum-sepolia
```

#### Backend (.env)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/liveledger
JWT_SECRET=your-jwt-secret
PORT=3000
WS_PORT=8080
LIVE_LEDGER_ADDRESS=0x...
USDC_ADDRESS=0x...
```

### Network Configuration
- **Blockchain**: Arbitrum Sepolia Testnet
- **RPC URL**: https://sepolia-rollup.arbitrum.io/rpc
- **Chain ID**: 421614

---

## 📊 Performance Optimizations

### 1. **Frontend Optimizations**
- **Rate Limiting**: API calls limited to prevent resource exhaustion
- **Memoization**: React.useMemo for expensive calculations
- **WebSocket Management**: Automatic reconnection with exponential backoff
- **Lazy Loading**: Component-based code splitting

### 2. **Backend Optimizations**
- **Database Indexing**: Optimized queries with proper indexes
- **Connection Pooling**: Efficient database connection management
- **Caching**: Redis caching for frequently accessed data
- **Batch Operations**: Bulk database operations where possible

### 3. **Smart Contract Optimizations**
- **Gas Optimization**: Efficient storage patterns
- **Batch Processing**: Multiple operations in single transaction
- **Event Logging**: Comprehensive event emission for off-chain indexing

---

## 🧪 Testing Strategy

### 1. **Smart Contract Tests**
```typescript
describe("LiveLedger", function () {
  it("Should create a stream successfully", async function () {
    const tx = await liveLedger.createStream(
      recipient.address,
      ethers.utils.parseUnits("100", 6),
      startTime,
      endTime,
      5
    );
    
    expect(tx).to.emit(liveLedger, "StreamCreated");
  });
  
  it("Should allow withdrawal of available amount", async function () {
    // Fast forward time
    await ethers.provider.send("evm_increaseTime", [3600]); // 1 hour
    
    const availableBefore = await liveLedger.getAvailableAmount(0);
    await liveLedger.connect(recipient).withdraw(0);
    
    expect(availableBefore).to.be.gt(0);
  });
});
```

### 2. **Backend API Tests**
```typescript
describe("Stream API", () => {
  it("should create a new stream", async () => {
    const response = await request(app)
      .post("/api/streams")
      .set("Authorization", `Bearer ${token}`)
      .send(streamData)
      .expect(201);
      
    expect(response.body.success).toBe(true);
  });
});
```

### 3. **Frontend Component Tests**
```typescript
describe("Recipient Dashboard", () => {
  it("should display stream information", () => {
    render(<RecipientDashboard />);
    expect(screen.getByText("Incoming Payment Streams")).toBeInTheDocument();
  });
});
```

---

## 🎯 Key Achievements & Features

### ✅ **Core Functionality**
1. **Real-time Payment Streaming**: Continuous payment flows with per-second accuracy
2. **Instant Withdrawals**: Recipients can withdraw accumulated funds anytime
3. **Smart Contract Integration**: Fully decentralized with Arbitrum Sepolia
4. **Withdrawal Limits**: Configurable daily withdrawal restrictions
5. **Real-time UI Updates**: Live balance calculations with animations

### ✅ **Advanced Features**
1. **WebSocket Integration**: Real-time data synchronization
2. **Rate Limiting**: Prevents API resource exhaustion
3. **Error Recovery**: Automatic fallback mechanisms
4. **Modern UI/UX**: Glassmorphism design with celebration animations
5. **Comprehensive Logging**: Full audit trail for debugging

### ✅ **Technical Excellence**
1. **TypeScript Throughout**: End-to-end type safety
2. **Comprehensive Error Handling**: User-friendly error messages
3. **Performance Optimization**: Efficient queries and calculations
4. **Security Best Practices**: Authentication, validation, and protection
5. **Scalable Architecture**: Modular design for easy expansion

---

## 🚀 Future Enhancements

### 1. **Advanced Features**
- **Multi-token Support**: Support for various ERC-20 tokens
- **Stream Templates**: Pre-configured stream templates
- **Automated Streams**: Recurring payment automation
- **Mobile App**: React Native mobile application

### 2. **Scaling Improvements**
- **Layer 2 Integration**: Additional L2 networks
- **Database Sharding**: Horizontal scaling for large datasets
- **CDN Integration**: Global content delivery
- **Microservices**: Split backend into microservices

### 3. **User Experience**
- **Dashboard Analytics**: Advanced analytics and reporting
- **Notification System**: Email/SMS/Push notifications
- **Stream Scheduling**: Advanced scheduling options
- **Bulk Operations**: Batch stream creation and management

---

## 📞 Support & Maintenance

### Development Team Contacts
- **Frontend Lead**: Next.js & React expertise
- **Backend Lead**: Node.js & Database optimization
- **Smart Contract Lead**: Solidity & Security auditing
- **DevOps Lead**: Deployment & Infrastructure

### Documentation Links
- **API Documentation**: `/docs/api`
- **Smart Contract ABI**: `/contracts/abi`
- **Frontend Components**: `/docs/components`
- **Deployment Guide**: `/docs/deployment`

---

*This documentation represents the complete LiveLedger system as implemented, providing a comprehensive guide for developers, auditors, and stakeholders to understand the full architecture and capabilities of the platform.*