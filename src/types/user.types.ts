export type IUserCreate = {
  walletAddress: string;
  email?: string;
  name?: string;
};

export type IUser = IUserCreate & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};