import { Request, Response, NextFunction } from 'express';

/**
 * Error Handling Middleware for Whistle App
 * Provides consistent error responses and logging
 */

interface AppError extends Error {
  status?: number;
  isOperational?: boolean;
}

/**
 * Custom error class for application errors
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly isOperational: boolean;

  constructor(message: string, status: number = 500, isOperational: boolean = true) {
    super(message);
    this.status = status;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { status = 500, message } = err;
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Log error details
  console.error(`[${new Date().toISOString()}] Error ${status}: ${message}`);
  if (isDevelopment) {
    console.error('Stack trace:', err.stack);
  }

  // Don't expose internal errors in production
  const errorMessage = status === 500 && !isDevelopment 
    ? 'Internal server error' 
    : message;

  res.status(status).json({
    success: false,
    error: errorMessage,
    ...(isDevelopment && { 
      stack: err.stack,
      timestamp: new Date().toISOString(),
      path: req.originalUrl
    })
  });
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
};

/**
 * Async error wrapper to catch async function errors
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation error handler
 */
export const validationError = (message: string) => {
  return new ApiError(message, 400);
};

/**
 * Authentication error handler
 */
export const authenticationError = (message: string = 'Authentication required') => {
  return new ApiError(message, 401);
};

/**
 * Authorization error handler
 */
export const authorizationError = (message: string = 'Insufficient permissions') => {
  return new ApiError(message, 403);
};

/**
 * Not found error handler
 */
export const notFoundError = (resource: string = 'Resource') => {
  return new ApiError(`${resource} not found`, 404);
};