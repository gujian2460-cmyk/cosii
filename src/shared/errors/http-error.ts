import type { ErrorCodeValue } from "./codes.js";
import { ErrorCode } from "./codes.js";
import { getErrorUx } from "./ux-map.js";

/** Non-OK codes only — used for HTTP error responses. */
export type ApiErrorCode = Exclude<ErrorCodeValue, typeof ErrorCode.OK>;

export class HttpError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isHttpError(err: unknown): err is HttpError {
  return err instanceof HttpError;
}

export function toPublicMessage(code: ErrorCodeValue, fallback: string): string {
  const ux = getErrorUx(code);
  return ux?.userTitle ?? fallback;
}

export function internalError(message = "Internal error"): HttpError {
  return new HttpError(500, ErrorCode.INTERNAL_ERROR, message);
}
