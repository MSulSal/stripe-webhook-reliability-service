import type { NextFunction, Request, RequestHandler, Response } from "express";

export const asyncRoute =
  (handler: RequestHandler) =>
  (request: Request, response: Response, next: NextFunction): void => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};
