import {
  SPEND_NOT_ALLOWED_MESSAGE,
  SPEND_NOT_ALLOWED_REASON,
} from "@/server/auth/spendFunctions";
import { isErrorCode, type ErrorCode } from "@/shared/error-codes";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
    public readonly details?: Record<string, string>,
  ) {
    super(message ?? code);
    this.name = "AppError";
  }
}

export function asAppError(error: unknown): AppError | null {
  if (error instanceof AppError) return error;
  if (error instanceof Error && isErrorCode(error.message)) {
    return new AppError(error.message, error.message);
  }
  return null;
}

// The client only ever receives the bare code. Server messages can carry
// internal detail, so the client maps each code to its own copy and the full
// message stays in the server logs.
//
// One exception: the spend gate's own constant copy. It carries no internal
// detail and the client cannot tell it from a bare FORBIDDEN otherwise.
export function toClientError(error: unknown): Error {
  const appError = asAppError(error);
  if (
    appError?.code === "FORBIDDEN" &&
    appError.details?.reason === SPEND_NOT_ALLOWED_REASON
  ) {
    return new Error(SPEND_NOT_ALLOWED_MESSAGE);
  }
  return new Error(appError?.code ?? "INTERNAL_ERROR");
}
