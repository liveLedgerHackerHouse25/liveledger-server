# LiveLedger Backend API Documentation

## Overview

LiveLedger is a blockchain-based payment streaming platform that enables real-time, continuous payments between users. This backend API provides comprehensive endpoints for user authentication, payment stream management, and dashboard analytics.

## Technology Stack

- **Framework**: Node.js with Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT (JSON Web Tokens) with Ethereum wallet-based authentication
- **Blockchain**: Arbitrum network integration
- **Documentation**: Swagger/OpenAPI 3.0

## Base URL

```
http://localhost:3000
```

## Authentication

LiveLedger uses Ethereum wallet-based authentication. Users authenticate by signing a nonce with their wallet.

### Authentication Flow

1. **Generate Nonce**: Request a nonce for wallet authentication
2. **Sign Message**: Sign the nonce with your Ethereum wallet
3. **Authenticate**: Send the signature to get JWT tokens
4. **Use Token**: Include the JWT token in subsequent requests

### JWT Token Format

Include the JWT token in the `Authorization` header:
```
Authorization: Bearer <your-jwt-token>
```

## API Endpoints

### Authentication Endpoints

#### Generate Nonce
```http
POST /api/auth/nonce
```
Generate a nonce for wallet authentication.

**Request Body:**
```json
{
  "walletAddress": "0x1234567890123456789012345678901234567890"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "nonce": "a1b2c3d4e5f6...",
    "expiresAt": "2024-01-01T12:00:00.000Z"
  }
}
```

#### Authenticate Wallet
```http
POST /api/auth/wallet
```
Authenticate using wallet signature.

**Request Body:**
```json
{
  "walletAddress": "0x1234567890123456789012345678901234567890",
  "signature": "0x...",
  "nonce": "a1b2c3d4e5f6..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user-id",
      "walletAddress": "0x1234567890123456789012345678901234567890",
      "email": "user@example.com",
      "name": "John Doe"
    }
  }
}
```

#### Get Current User
```http
GET /api/auth/me
```
Get current authenticated user information.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

### User Management Endpoints

#### Get User Profile
```http
GET /api/users/profile
```
Get current user's profile.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

#### Update User Profile
```http
PUT /api/users/profile
```
Update current user's profile.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "name": "John Doe"
}
```

#### Get User by Wallet Address
```http
GET /api/users/wallet/:walletAddress
```
Get user information by wallet address.

**Parameters:**
- `walletAddress` (path): Ethereum wallet address

#### Get User Statistics
```http
GET /api/users/stats
```
Get statistics for the current user.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

#### Refresh Token
```http
POST /api/users/refresh-token
```
Refresh JWT token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Generate Refresh Token
```http
POST /api/users/generate-refresh-token
```
Generate a new refresh token.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

### Stream Management Endpoints

#### Create Stream
```http
POST /api/streams
```
Create a new payment stream.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "recipientAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb9",
  "tokenAddress": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "flowRate": "0.001",
  "totalAmount": "100"
}
```

#### Get Stream
```http
GET /api/streams/:id
```
Get stream details by ID.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Parameters:**
- `id` (path): Stream ID

#### Get User Streams
```http
GET /api/streams
```
Get all streams for the current user.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

#### Confirm Stream
```http
POST /api/streams/:id/confirm
```
Confirm a stream (escrow deposit).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

#### Get Claimable Amount
```http
GET /api/streams/:id/claimable
```
Get claimable amount for a stream.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

#### Withdraw from Stream
```http
POST /api/streams/:id/withdraw
```
Withdraw from a stream.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

#### Cancel Stream
```http
POST /api/streams/:id/cancel
```
Cancel a stream.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

### Dashboard Endpoints

#### Get Payer Dashboard
```http
GET /api/dashboard/payer/:address
```
Get dashboard data for a payer.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

#### Get Recipient Dashboard
```http
GET /api/dashboard/recipient/:address
```
Get dashboard data for a recipient.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

#### Get Active Streams Analytics
```http
GET /api/analytics/streams/active
```
Get analytics for active streams.

#### Get Daily Volume Analytics
```http
GET /api/analytics/volume/daily
```
Get daily volume analytics.

#### Get Real-time Balances
```http
GET /api/dashboard/streams/:streamIds/balances
```
Get real-time balances for multiple streams.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Parameters:**
- `streamIds` (path): Comma-separated stream IDs

#### Get Completion Alerts
```http
GET /api/dashboard/alerts/completions
```
Get stream completion alerts.

#### Get Withdrawal Alerts
```http
GET /api/dashboard/alerts/withdrawals
```
Get withdrawal limit alerts.

### Health Check

#### Health Status
```http
GET /health
```
Check API health status.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "environment": "development"
}
```

## Data Models

### User Model
```typescript
{
  id: string;
  walletAddress: string;
  email?: string;
  name?: string;
  type: "PAYER" | "RECIPIENT";
  createdAt: Date;
  updatedAt: Date;
}
```

### Stream Model
```typescript
{
  id: string;
  payerId: string;
  recipientId: string;
  tokenAddress: string;
  flowRate: string; // BigNumber as string
  totalAmount: string; // BigNumber as string
  withdrawnAmount: string; // BigNumber as string
  status: "PENDING" | "ACTIVE" | "PAUSED" | "STOPPED" | "COMPLETED";
  escrowConfirmed: boolean;
  startTime: Date;
  endTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Transaction Model
```typescript
{
  id: string;
  streamId?: string;
  type: "ESCROW_DEPOSIT" | "STREAM_START" | "STREAM_STOP" | "WITHDRAWAL" | "DEPOSIT";
  amount: string; // BigNumber as string
  txHash?: string;
  status: "PENDING" | "CONFIRMED" | "FAILED";
  fromAddress: string;
  toAddress: string;
  createdAt: Date;
  completedAt?: Date;
}
```

## Error Responses

All error responses follow this format:
```json
{
  "success": false,
  "error": {
    "message": "Error message",
    "code": "ERROR_CODE",
    "statusCode": 400
  }
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `404`: Not Found
- `409`: Conflict
- `500`: Internal Server Error

## Environment Variables

Required environment variables for development:
```bash
DATABASE_URL="postgresql://username:password@localhost:5432/liveledger"
JWT_SECRET="your-jwt-secret"
JWT_EXPIRES_IN="7d"
NODE_ENV="development"
ARBITRUM_RPC_URL="https://goerli-rollup.arbitrum.io/rpc"
ESCROW_CONTRACT_ADDRESS="0x..."
ESCROW_SIGNER_PRIVATE_KEY="your-private-key"
LIVE_LEDGER_CONTRACT_ADDRESS="0x..."
```

## Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up database:**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Access Swagger documentation:**
   ```
   http://localhost:3000/api-docs
   ```

## Testing

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Run tests with coverage:
```bash
npm run test:coverage
```

## API Documentation

Interactive API documentation is available via Swagger UI at:
```
http://localhost:3000/api-docs
```

## WebSocket Support

The backend supports WebSocket connections for real-time updates. Connect to:
```
ws://localhost:3000
```

## Security Considerations

1. **Authentication**: Always include JWT tokens in the Authorization header for protected endpoints
2. **Wallet Validation**: Wallet addresses are validated for proper Ethereum address format
3. **Rate Limiting**: Implement rate limiting on the frontend to prevent abuse
4. **HTTPS**: Use HTTPS in production to secure data transmission
5. **Input Validation**: All inputs are validated on the backend, but validate on the frontend too

## Common Integration Patterns

### 1. User Authentication Flow
```javascript
// 1. Generate nonce
const nonceResponse = await fetch('/api/auth/nonce', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ walletAddress })
});

// 2. Sign nonce with wallet
const { nonce } = await nonceResponse.json();
const signature = await signMessage(nonce);

// 3. Authenticate
const authResponse = await fetch('/api/auth/wallet', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ walletAddress, signature, nonce })
});

// 4. Store tokens
const { token, refreshToken } = await authResponse.json();
localStorage.setItem('token', token);
localStorage.setItem('refreshToken', refreshToken);
```

### 2. Making Authenticated Requests
```javascript
const token = localStorage.getItem('token');

const response = await fetch('/api/streams', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

### 3. Token Refresh
```javascript
const refreshToken = localStorage.getItem('refreshToken');

const response = await fetch('/api/users/refresh-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refreshToken })
});

const { token } = await response.json();
localStorage.setItem('token', token);
```

## Support

For issues or questions regarding the API, please check the Swagger documentation at `/api-docs` or contact the backend team.