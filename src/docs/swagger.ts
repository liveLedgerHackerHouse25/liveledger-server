// src/utils/swagger.ts
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Application, Express } from "express";

// Swagger definition
const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "LiveLedger API",
    version: "1.0.0",
    description: `
# LiveLedger - Real-time Streaming Payments Platform

## Overview
Build a real-time streaming payments platform where users can create payment streams and recipients can watch their balances grow in real-time, with hybrid off-chain/on-chain settlement for gas efficiency.

## Core Features
- **Hybrid Architecture**: Off-chain balance simulation + On-chain escrow settlement
- **Real-time Updates**: WebSocket connections for live balance tracking
- **Wallet Authentication**: SIWE (Sign-In with Ethereum) integration
- **Arbitrum Integration**: Low gas cost blockchain operations
- **Stream Management**: Create, pause, stop, and monitor payment streams

## Authentication
All endpoints (except auth endpoints) require JWT token authentication using SIWE.
Include the token in the Authorization header as: \`Bearer <your-token>\`

## WebSocket
Connect to \`/ws\` for real-time balance and stream updates.
    `,
    contact: {
      name: "LiveLedger Support",
      email: "support@liveledger.com",
    },
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT",
    },
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Development Server",
    },
    {
      url: "https://api.liveledger.com",
      description: "Production Server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT token obtained from SIWE authentication",
      },
    },
    schemas: {
      // User Schemas
      User: {
        type: "object",
        required: ["id", "walletAddress", "createdAt"],
        properties: {
          id: {
            type: "string",
            description: "Unique user identifier",
          },
          walletAddress: {
            type: "string",
            description: "Ethereum wallet address",
            example: "0x742E4C3B6B439E13a4F8d4A4F4B8f6C8A2B3C1D9",
          },
          email: {
            type: "string",
            format: "email",
            description: "User email address (optional)",
          },
          name: {
            type: "string",
            description: "User display name (optional)",
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
          },
        },
      },

      // Stream Schemas
      StreamCreate: {
        type: "object",
        required: [
          "recipientAddress",
          "tokenAddress",
          "flowRate",
          "totalAmount",
        ],
        properties: {
          recipientAddress: {
            type: "string",
            description: "Recipient Ethereum address",
            example: "0x852E4C3B6B439E13a4F8d4A4F4B8f6C8A2B3C1D9",
          },
          tokenAddress: {
            type: "string",
            description: "ERC20 token contract address",
            example: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          },
          flowRate: {
            type: "string",
            description: "Amount per second to stream",
            example: "0.000001",
          },
          totalAmount: {
            type: "string",
            description: "Total amount to escrow for the stream",
            example: "100.0",
          },
        },
      },

      Stream: {
        allOf: [
          { $ref: "#/components/schemas/StreamCreate" },
          {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "Unique stream identifier",
              },
              payerId: {
                type: "string",
                description: "Payer user ID",
              },
              recipientId: {
                type: "string",
                description: "Recipient user ID",
              },
              status: {
                type: "string",
                enum: ["PENDING", "ACTIVE", "PAUSED", "STOPPED", "COMPLETED"],
                description: "Current stream status",
              },
              withdrawnAmount: {
                type: "string",
                description: "Total amount withdrawn from stream",
              },
              startTime: {
                type: "string",
                format: "date-time",
              },
              endTime: {
                type: "string",
                format: "date-time",
              },
              escrowConfirmed: {
                type: "boolean",
                description: "Whether escrow deposit is confirmed on-chain",
              },
              currentBalance: {
                type: "string",
                description: "Current accrued balance (off-chain calculation)",
              },
            },
          },
        ],
      },

      // Authentication Schemas
      AuthNonce: {
        type: "object",
        properties: {
          nonce: {
            type: "string",
            description: "One-time nonce for SIWE authentication",
          },
          expiresAt: {
            type: "string",
            format: "date-time",
          },
        },
      },

      AuthVerify: {
        type: "object",
        required: ["message", "signature"],
        properties: {
          message: {
            type: "string",
            description: "SIWE message that was signed",
          },
          signature: {
            type: "string",
            description: "Signature of the SIWE message",
          },
        },
      },

      AuthResponse: {
        type: "object",
        properties: {
          accessToken: {
            type: "string",
            description: "JWT access token",
          },
          user: {
            $ref: "#/components/schemas/User",
          },
        },
      },

      // Withdrawal Schemas
      WithdrawalRequest: {
        type: "object",
        required: ["streamId", "amount"],
        properties: {
          streamId: {
            type: "string",
            description: "Stream ID to withdraw from",
          },
          amount: {
            type: "string",
            description: "Amount to withdraw",
          },
        },
      },

      WithdrawalResponse: {
        type: "object",
        properties: {
          transactionHash: {
            type: "string",
            description: "Blockchain transaction hash",
          },
          amount: {
            type: "string",
          },
          streamId: {
            type: "string",
          },
          status: {
            type: "string",
            enum: ["PENDING", "CONFIRMED", "FAILED"],
          },
        },
      },

      // Dashboard Schemas
      DashboardSummary: {
        type: "object",
        properties: {
          totalStreams: {
            type: "number",
          },
          activeStreams: {
            type: "number",
          },
          totalEarned: {
            type: "string",
          },
          availableBalance: {
            type: "string",
          },
          pendingWithdrawals: {
            type: "string",
          },
        },
      },

      // Error Schemas
      Error: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: false,
          },
          error: {
            type: "string",
            description: "Error message",
          },
          code: {
            type: "string",
            description: "Error code",
          },
          details: {
            type: "object",
            description: "Additional error details",
          },
        },
      },

      // Transaction Schemas
      Transaction: {
        type: "object",
        properties: {
          id: {
            type: "string",
          },
          type: {
            type: "string",
            enum: ["STREAM_START", "STREAM_STOP", "WITHDRAWAL", "DEPOSIT"],
          },
          amount: {
            type: "string",
          },
          transactionHash: {
            type: "string",
          },
          status: {
            type: "string",
            enum: ["PENDING", "CONFIRMED", "FAILED"],
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
    },
    responses: {
      UnauthorizedError: {
        description: "Authentication token is missing or invalid",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
            example: {
              success: false,
              error: "Authentication required",
              code: "UNAUTHORIZED",
            },
          },
        },
      },
      ValidationError: {
        description: "Request validation failed",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
            example: {
              success: false,
              error: "Validation failed",
              code: "VALIDATION_ERROR",
              details: {
                recipientAddress: "Valid Ethereum address required",
              },
            },
          },
        },
      },
      NotFoundError: {
        description: "Resource not found",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
            example: {
              success: false,
              error: "Stream not found: stream_123",
              code: "NOT_FOUND",
            },
          },
        },
      },
      InsufficientBalanceError: {
        description: "Insufficient balance for operation",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
            example: {
              success: false,
              error:
                "Insufficient balance. Requested: 50, Available: 30 for token 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
              code: "INSUFFICIENT_BALANCE",
            },
          },
        },
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
  tags: [
    {
      name: "Authentication",
      description: "SIWE (Sign-In with Ethereum) authentication endpoints",
    },
    {
      name: "Streams",
      description: "Payment stream management",
    },
    {
      name: "Withdrawals",
      description: "Balance withdrawal operations",
    },
    {
      name: "Dashboard",
      description: "User dashboard and analytics",
    },
    {
      name: "WebSocket",
      description: "Real-time WebSocket connections",
    },
  ],
};

// Options for swagger-jsdoc
const options: swaggerJsdoc.Options = {
  swaggerDefinition,
  apis: ["./src/routes/*.ts", "./src/controllers/*.ts", "./src/types/*.ts"],
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJsdoc(options);

// Swagger UI options
const swaggerUiOptions = {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info .base-url { font-size: 12px }
    .swagger-ui .model-box-control:focus, .swagger-ui .models-control:focus, .swagger-ui .opblock-summary-control:focus {
      outline: 2px solid #10b981;
    }
  `,
  customSiteTitle: "LiveLedger API Documentation",
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
  },
};

export const setupSwagger = (app: Application): void => {
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, swaggerUiOptions)
  );

  // JSON endpoint for swagger spec
  app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });
};

export { swaggerSpec, swaggerUi };
