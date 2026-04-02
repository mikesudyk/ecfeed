import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public error: string,
    message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFound(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, "not_found", "The requested resource was not found"));
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error("Error:", err);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.error,
      message: err.message,
      statusCode: err.statusCode,
    });
    return;
  }

  res.status(500).json({
    error: "internal_error",
    message: process.env.NODE_ENV === "production" ? "Something went wrong" : err.message,
    statusCode: 500,
  });
}
