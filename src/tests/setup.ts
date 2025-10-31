// Setup file for Jest tests

// Jest will automatically mock ethers from src/tests/__mocks__/ethers.ts

// Set default environment variables
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";
process.env.ARBITRUM_RPC_URL = "https://sepolia-rollup.arbitrum.io/rpc";
process.env.LIVE_LEDGER_CONTRACT_ADDRESS =
  "0xD454CCAE2E500ae984149Fa4CeC6E78f0145fD56";
