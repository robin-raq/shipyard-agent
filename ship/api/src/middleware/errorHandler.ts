import { Request, Response, NextFunction } from "express";

export interface ApiError extends Error {
  status?: number;
}

export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const status = err.status || 500;
  const message = err.message || "Internal server error";

  res.status(status).json({
    error: true,
    message,
    status,
  });
}
