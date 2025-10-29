import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/genericErrors';

export interface ErrorResponse {
  success: boolean;
  error: {
    message: string;
    statusCode: number;
    isOperational: boolean;
    stack?: string;
  };
}

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let isOperational = false;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    isOperational = error.isOperational;
  }

  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      message,
      statusCode,
      isOperational,
    },
  };

  // Add stack trace in development mode
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = error.stack;
  }

  console.error('Error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.status(statusCode).json(errorResponse);
};

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  errorHandler(error, req, res, next);
};

export const asyncErrorHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};