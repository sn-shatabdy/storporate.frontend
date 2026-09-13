/**
 * Error shape returned by the backend's global exception handler:
 * `{ errorCode, message }` (see Storporate.Api.Errors.GlobalExceptionHandler).
 */
export class ApiError extends Error {
  errorCode: string;
  status: number;

  constructor(errorCode: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.errorCode = errorCode;
    this.status = status;
  }
}

/**
 * Thrown when a required `NEXT_PUBLIC_*` environment variable is missing at
 * request time, instead of letting `fetch` fail on an `undefined`/empty URL.
 */
export class MissingEnvVarError extends Error {
  constructor(varName: string) {
    super(
      `Environment variable ${varName} is not set. Cannot make API requests.`,
    );
    this.name = "MissingEnvVarError";
  }
}
