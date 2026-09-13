import { ApiError } from "./errors";

/**
 * Maps a failed `POST /api/auth/otp/verify` (or `/otp/request`) call to one
 * of the approved, plain-language messages from the STOR-61 Phase 4 design.
 * `otp_invalid` covers two distinct backend messages (wrong code vs.
 * expired code, and "no pending code found") that share one `errorCode` —
 * `OtpInvalidException` carries a different `.Message` for each case (see
 * `VerifyOtpHandler`), so the exact message text is what distinguishes them
 * here. The backend never exposes a remaining-attempts count in the error
 * body, so the generic ("try again") wording is used rather than promising a
 * number the UI cannot back up.
 */
export function describeOtpVerifyError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Something went wrong. Try again.";
  }

  switch (error.errorCode) {
    case "otp_invalid":
      if (/expired/i.test(error.message)) {
        return "This code has expired. Request a new one.";
      }
      // Covers both "wrong code" and "no pending code found for this email."
      return "That code doesn't match. Try again.";
    case "otp_locked":
      return "Too many incorrect attempts. This code is locked. Request a new one.";
    case "otp_rate_limit_exceeded":
      return "You've requested too many codes. Wait a few minutes and try again.";
    default:
      return "Something went wrong. Try again.";
  }
}

/** Maps a failed `POST /api/auth/otp/request` (resend) call. */
export function describeOtpRequestError(error: unknown): string {
  if (error instanceof ApiError && error.errorCode === "otp_rate_limit_exceeded") {
    return "You've requested too many codes. Wait a few minutes and try again.";
  }
  return "Could not send a code right now. Try again.";
}

/** Maps a failed `POST /api/auth/google` call to a short, direct message. */
export function describeGoogleLoginError(error: unknown): string {
  if (error instanceof ApiError && error.errorCode === "actor_type_required") {
    return "Choose an account type to finish signing in.";
  }
  return "Google sign-in failed. Try again.";
}
