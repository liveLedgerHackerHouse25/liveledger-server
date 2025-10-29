import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { ValidationError } from '../errors/genericErrors';

/**
 * Middleware to handle validation errors from express-validator
 */
export const validateRequest = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    // Check for errors
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      // Extract error messages
      const errorMessages = errors.array().map(error => error.msg);

      // Create validation error with all messages
      const validationError = new ValidationError(
        `Validation failed: ${errorMessages.join(', ')}`
      );

      return next(validationError);
    }

    next();
  };
};

/**
 * Middleware to validate that the request body is not empty
 */
export const validateBodyNotEmpty = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new ValidationError('Request body cannot be empty'));
  }
  next();
};