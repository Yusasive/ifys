export interface ApiFieldError {
  message: string;
  // Stable identifier from the backend (e.g. "SOLD_OUT"); branch on this
  // rather than on message text.
  code?: string;
  fieldErrors?: Record<string, string>;
  // Present on server errors — quote it when reporting a problem.
  requestId?: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiFieldError,
  ) {
    super(body.message);
  }

  get code() {
    return this.body.code;
  }

  get fieldErrors() {
    return this.body.fieldErrors;
  }
}

/** Every API wrapper funnels failed responses through here. */
export async function throwApiError(res: Response): Promise<never> {
  const body = (await res.json().catch(() => null)) as ApiFieldError | null;
  throw new ApiError(res.status, body?.message ? body : { message: res.statusText || "Request failed" });
}

/**
 * Turns any thrown value into text a user can act on: the server's message
 * plus each field-level problem when it sent them. Network failures (fetch
 * throws a TypeError) get their own wording.
 */
export function describeError(
  err: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (err instanceof TypeError) {
    return "Can't reach the server. Check your connection and try again.";
  }
  if (!(err instanceof ApiError)) return fallback;
  const { message, fieldErrors, requestId } = err.body;
  const details = fieldErrors ? Object.values(fieldErrors) : [];
  const text = details.length === 0 ? message || fallback : `${message}: ${details.join("; ")}`;
  return err.status >= 500 && requestId ? `${text} (ref: ${requestId.slice(0, 8)})` : text;
}
