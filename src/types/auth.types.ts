export interface INonceRequest {
  walletAddress: string;
}

export interface INonceResponse {
  nonce: string;
  expiresAt: Date;
}

export interface IWalletAuthRequest {
  walletAddress: string;
  signature: string;
  nonce: string;
}

export interface IWalletAuthResponse {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    walletAddress: string;
    email?: string;
    name?: string;
  };
}

export interface IJwtPayload {
  userId: string;
  walletAddress: string;
}

export interface IAuthUser {
  id: string;
  walletAddress: string;
  email?: string;
  name?: string;
}