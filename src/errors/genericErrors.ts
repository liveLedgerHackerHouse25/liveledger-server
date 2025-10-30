export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InsufficientBalanceError extends AppError {
  constructor(requested: string, available: string, token: string) {
    super(
      `Insufficient balance. Requested: ${requested}, Available: ${available} for token ${token}`,
      400
    );
  }
}

export class StreamNotFoundError extends AppError {
  constructor(streamId: string) {
    super(`Stream not found: ${streamId}`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class BlockchainError extends AppError {
  constructor(message: string, originalError?: any) {
    super(`Blockchain error: ${message}`, 500);
    if (originalError) {
      this.stack = originalError.stack;
    }
  }
}

export class TransactionFailedError extends BlockchainError {
  constructor(transactionHash: string) {
    super(`Transaction failed: ${transactionHash}`);
  }
}

export class InsufficientEscrowBalanceError extends BlockchainError {
  constructor(streamId: string, requested: string, available: string) {
    super(
      `Insufficient escrow balance for stream ${streamId}. Requested: ${requested}, Available: ${available}`
    );
  }
}
