import type { ErrorCodeValue } from "../errors/codes.js";
import { ErrorCode } from "../errors/codes.js";
import { getErrorUx } from "../errors/ux-map.js";

export type SuccessEnvelope<T> = {
  code: typeof ErrorCode.OK;
  message: string;
  data: T;
  trace_id: string;
};

export type ErrorEnvelope = {
  code: Exclude<ErrorCodeValue, typeof ErrorCode.OK>;
  message: string;
  data: null;
  trace_id: string;
  error?: {
    details?: unknown;
    user_title?: string;
    primary_action?: string;
    retry_policy?: string;
  };
};

export function ok<T>(traceId: string, data: T, message = "success"): SuccessEnvelope<T> {
  return {
    code: ErrorCode.OK,
    message,
    data,
    trace_id: traceId,
  };
}

export function fail(
  traceId: string,
  code: Exclude<ErrorCodeValue, typeof ErrorCode.OK>,
  message: string,
  details?: unknown,
): ErrorEnvelope {
  const ux = getErrorUx(code);
  return {
    code,
    message,
    data: null,
    trace_id: traceId,
    error: {
      details,
      user_title: ux?.userTitle,
      primary_action: ux?.primaryAction,
      retry_policy: ux?.retryPolicy,
    },
  };
}
