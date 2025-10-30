import { UserType } from "./auth.types";

export type IUserCreate = {
  walletAddress: string;
  email?: string;
  name?: string;
  type?: UserType;
};

export type IUser = IUserCreate & {
  id: string;
  type: UserType;
  createdAt: Date;
  updatedAt: Date;
};
