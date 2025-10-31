export const ethers = {
  providers: {
    JsonRpcProvider: jest.fn(() => ({
      getNetwork: jest.fn().mockResolvedValue({ chainId: 421614 }),
      getGasPrice: jest.fn().mockResolvedValue({ toString: () => "100000000" }),
      estimateGas: jest.fn().mockResolvedValue({ toString: () => "300000" }),
      getTransactionReceipt: jest.fn(),
      getBlock: jest.fn().mockResolvedValue({ timestamp: 1234567890 }),
    })),
  },
  Contract: jest.fn(() => ({
    interface: {
      encodeFunctionData: jest.fn(),
    },
    getStream: jest.fn(),
    getClaimable: jest.fn(),
    on: jest.fn(),
  })),
  utils: {
    isAddress: jest.fn((address: string) => {
      // Only return true for valid-looking addresses
      return address.startsWith("0x") && address.length === 42 && /^0x[a-fA-F0-9]{40}$/.test(address);
    }),
    parseUnits: jest.fn((value: string) => ({
      eq: jest.fn((other: any) => value === other.toString()),
      mul: jest.fn((other: any) => ({
        toString: () => (parseInt(value) * parseInt(other.toString())).toString(),
        eq: jest.fn((expected: any) => {
          const result = parseInt(value) * parseInt(other.toString());
          return result.toString() === expected.toString();
        })
      }))
    })),
    formatUnits: jest.fn((value: any, decimals: number) => (parseInt(value) / Math.pow(10, decimals)).toString()),
    getAddress: jest.fn((address: string) => address.toLowerCase()),
    hexlify: jest.fn((bytes: any) => '0x' + Array.from(bytes).map((b: any) => b.toString(16).padStart(2, '0')).join('')),
    randomBytes: jest.fn((length: number) => {
      const bytes = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
      return bytes;
    }),
    verifyMessage: jest.fn((message: string, signature: string) => {
      // In a real implementation, this would recover the address from the signature
      // For testing, we'll return the address that was stored when signing
      return (global as any).lastSigningAddress || '0x1234567890123456789012345678901234567890';
    }),
  },
  BigNumber: {
    from: jest.fn((value: string) => ({ toString: () => value })),
  },
  Wallet: {
    createRandom: jest.fn(() => {
      const address = '0x' + Array.from({length: 40}, () => Math.floor(Math.random() * 16).toString(16)).join('');
      return {
        address,
        signMessage: jest.fn(async (message: string) => {
          // Store the address that was used to sign so verifyMessage can return it
          (global as any).lastSigningAddress = address;
          // Generate a proper 130-character hex signature (without 0x prefix)
          return Array.from({length: 130}, () => Math.floor(Math.random() * 16).toString(16)).join('');
        }),
      };
    }),
  },
};
