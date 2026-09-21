"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { AlertTriangle, ArrowRight, ChevronLeft, Clock, Mail } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { AuthButton } from "@/components/auth/auth-button";
import { GoogleButton } from "@/components/auth/google-button";
import { EMPTY_CODE, isOtpCodeComplete, OtpBoxes } from "@/components/auth/otp-boxes";
import { ActorTypeCard, ACTOR_TYPE_META } from "@/components/auth/actor-type-card";
import { ACTOR_TYPES, type ActorType, googleLogin, requestOtp, verifyOtp } from "@/lib/api/auth";
import { describeOtpRequestError, describeOtpVerifyError } from "@/lib/api/auth-errors";
import { ApiError } from "@/lib/api/errors";

const RESEND_WINDOW_SECONDS = 60;
// STOR-43 Phase 4 — Organizations land on the new talent-search page
// right after sign-in. Every other actor type (Students in particular)
// keeps the original /account landing. The landing is decided per
// successful AuthResult by `landingRouteForActorType` below.
const DEFAULT_LANDING_ROUTE = "/account";
const ORGANIZATION_LANDING_ROUTE = "/employer/search";
// STOR-69 — Clubs land on their profile builder.
const CLUB_LANDING_ROUTE = "/club/profile";

type Step = "email" | "code" | "actorType";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Map a verified/finalized AuthResult's `actorType` to the page the
 *  user lands on after sign-in. Organizations go straight to the new
 *  talent-search surface so the empty-state example chips greet them
 *  on first sign-in; everyone else (Students most importantly) keeps
 *  the existing /account landing. Unknown / future actor types fall
 *  through to /account so we never accidentally bounce a brand-new
 *  user out of the app. */
function landingRouteForActorType(actorType: string): string {
  if (actorType === "Organization") return ORGANIZATION_LANDING_ROUTE;
  if (actorType === "Club") return CLUB_LANDING_ROUTE;
  return DEFAULT_LANDING_ROUTE;
}

async function establishSession(auth: {
  userId: string;
  email: string;
  actorType: string;
  verificationStatus: string;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}) {
  const result = await signIn("backend-session", {
    ...auth,
    redirect: false,
  });
  if (result?.error) {
    throw new Error("Could not finish signing in. Try again.");
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [code, setCode] = useState(EMPTY_CODE);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(RESEND_WINDOW_SECONDS);
  const [selectedActorType, setSelectedActorType] = useState<ActorType | null>(null);
  const [isGoogleFlow, setIsGoogleFlow] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  const handledGoogleGap = useRef(false);
  const actorCardRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // A brand-new Google account: the jwt callback already validated the ID
  // token and is waiting on an account-type choice (see options.ts).
  useEffect(() => {
    if (session?.error === "ActorTypeRequired" && session.pendingGoogleIdToken && !handledGoogleGap.current) {
      handledGoogleGap.current = true;
      setIsGoogleFlow(true);
      setStep("actorType");
    }
  }, [session]);

  useEffect(() => {
    if (step !== "code" || resendSecondsLeft <= 0) return;
    const timer = setInterval(() => {
      setResendSecondsLeft((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [step, resendSecondsLeft]);

  async function handleEmailSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isValidEmail(email)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailError(null);
    setIsSubmitting(true);
    try {
      await requestOtp(email);
      setCode(EMPTY_CODE);
      setCodeError(null);
      setResendSecondsLeft(RESEND_WINDOW_SECONDS);
      setStep("code");
    } catch (error) {
      setEmailError(describeOtpRequestError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (resendSecondsLeft > 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await requestOtp(email);
      setCode(EMPTY_CODE);
      setCodeError(null);
      setResendSecondsLeft(RESEND_WINDOW_SECONDS);
    } catch (error) {
      setCodeError(describeOtpRequestError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCodeSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isOtpCodeComplete(code)) {
      setCodeError("Enter the 6-digit code.");
      return;
    }
    setCodeError(null);
    setIsSubmitting(true);
    try {
      const result = await verifyOtp({ email, code });
      await establishSession(result);
      router.push(landingRouteForActorType(result.actorType));
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.errorCode === "actor_type_required") {
        setIsGoogleFlow(false);
        setStep("actorType");
        return;
      }
      setCodeError(describeOtpVerifyError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleActorTypeContinue() {
    if (!selectedActorType) return;
    setFinalizeError(null);
    setIsSubmitting(true);
    try {
      let resultActorType: string = selectedActorType;
      if (isGoogleFlow) {
        if (!session?.pendingGoogleIdToken) {
          setFinalizeError("Your Google sign-in expired. Start again.");
          return;
        }
        const result = await googleLogin({ idToken: session.pendingGoogleIdToken, actorType: selectedActorType });
        await establishSession(result);
        resultActorType = result.actorType;
      } else {
        // Resubmits the exact same email + code, now with the chosen actor
        // type — the code is still valid and no attempt was spent on the
        // earlier `actor_type_required` response (see lib/api/auth.ts).
        const result = await verifyOtp({ email, code, actorType: selectedActorType });
        await establishSession(result);
        resultActorType = result.actorType;
      }
      router.push(landingRouteForActorType(resultActorType));
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        setFinalizeError(describeOtpVerifyError(error));
      } else {
        setFinalizeError("Something went wrong. Try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleGoogleClick() {
    void signIn("google", { callbackUrl: "/login" });
  }

  return (
    <AuthShell>
      {step === "email" && (
        <div key="email" className="animate-in fade-in slide-in-from-right-4 duration-300">
          <h1 className="font-heading-auth text-[26px] font-semibold" style={{ color: "var(--auth-text-primary)" }}>
            Continue to Storporate
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: "var(--auth-text-muted)" }}>
            Enter your email. We&apos;ll send a one-time code.
          </p>

          <form onSubmit={handleEmailSubmit} className="mt-7 flex flex-col gap-4">
            <div>
              <div
                className="flex items-center gap-2.5 rounded-xl border px-3.5 py-3 transition-colors focus-within:border-[var(--auth-accent)] focus-within:ring-4 focus-within:ring-[var(--auth-accent)]/20"
                style={{
                  borderColor: emailError ? "#E4A6A3" : "var(--auth-border)",
                  backgroundColor: "var(--auth-card-bg)",
                }}
              >
                <Mail className="size-4.5 shrink-0" style={{ color: "var(--auth-text-muted)" }} />
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@example.com"
                  aria-label="Email address"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full bg-transparent text-[15px] outline-none placeholder:text-[color:var(--auth-text-muted)]"
                  style={{ color: "var(--auth-text-primary)" }}
                />
              </div>
              {emailError && (
                <p className="mt-1.5 text-xs font-medium text-[#B3261E]">{emailError}</p>
              )}
            </div>

            <AuthButton loading={isSubmitting} icon={<ArrowRight className="size-4" />}>
              Continue with email
            </AuthButton>
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1" style={{ backgroundColor: "var(--auth-border)" }} />
            <span className="text-xs font-medium" style={{ color: "var(--auth-text-muted)" }}>
              or
            </span>
            <span className="h-px flex-1" style={{ backgroundColor: "var(--auth-border)" }} />
          </div>

          <GoogleButton onClick={handleGoogleClick} disabled={isSubmitting} />
        </div>
      )}

      {step === "code" && (
        <div key="code" className="animate-in fade-in slide-in-from-right-4 duration-300">
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode(EMPTY_CODE);
              setCodeError(null);
            }}
            className="mb-5 flex items-center gap-1.5 text-sm font-medium outline-none focus-visible:ring-4 focus-visible:ring-[var(--auth-accent)]/25 rounded"
            style={{ color: "var(--auth-text-muted)" }}
          >
            <ChevronLeft className="size-4" />
            {email}
            <span className="ml-1 font-semibold" style={{ color: "var(--auth-accent)" }}>
              Change
            </span>
          </button>

          <h1 className="font-heading-auth text-[26px] font-semibold" style={{ color: "var(--auth-text-primary)" }}>
            Enter your code
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: "var(--auth-text-muted)" }}>
            Check your email for a 6-digit code.
          </p>

          <form onSubmit={handleCodeSubmit} className="mt-7 flex flex-col gap-4">
            <OtpBoxes
              value={code}
              onChange={(next) => {
                // Clear the error state (banner + red boxes) the moment the
                // user starts typing again, per the design spec — an error
                // otherwise sticks around at every subsequent keystroke.
                setCodeError(null);
                setCode(next);
              }}
              hasError={Boolean(codeError)}
              disabled={isSubmitting}
              autoFocus
              label="Verification code"
            />

            {codeError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm font-medium"
                style={{ backgroundColor: "#FDECEC", borderColor: "#F3C6C6", color: "#B3261E" }}
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" style={{ color: "#8C1F17" }} />
                <span>{codeError}</span>
              </div>
            )}

            <AuthButton loading={isSubmitting}>Verify code</AuthButton>

            <div className="flex items-center justify-center gap-1.5 text-sm" style={{ color: "var(--auth-text-muted)" }}>
              <Clock className="size-4" />
              {resendSecondsLeft > 0 ? (
                <span>
                  Didn&apos;t get a code? Resend in{" "}
                  <span className="font-semibold" style={{ color: "var(--auth-text-primary)" }}>
                    0:{resendSecondsLeft.toString().padStart(2, "0")}
                  </span>
                </span>
              ) : (
                <span>
                  Didn&apos;t get a code?{" "}
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isSubmitting}
                    className="font-semibold underline-offset-2 outline-none hover:underline focus-visible:underline"
                    style={{ color: "var(--auth-accent)" }}
                  >
                    Resend
                  </button>
                </span>
              )}
            </div>
          </form>
        </div>
      )}

      {step === "actorType" && (
        <div key="actorType" className="animate-in fade-in slide-in-from-right-4 duration-300">
          <h1 className="font-heading-auth text-center text-[28px] font-semibold" style={{ color: "var(--auth-text-primary)" }}>
            Choose your account type
          </h1>

          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Account type">
            {ACTOR_TYPES.map((type, index) => (
              <ActorTypeCard
                key={type}
                type={type}
                selected={selectedActorType === type}
                onSelect={setSelectedActorType}
                tabStop={selectedActorType === type || (selectedActorType === null && index === 0)}
                innerRef={(el) => {
                  actorCardRefs.current[index] = el;
                }}
                onArrowNav={(direction) => {
                  // Wrap-around navigation: from the last card, ArrowRight
                  // returns to the first; from the first, ArrowLeft goes to
                  // the last. The WAI-ARIA radio-group keyboard pattern
                  // recommends this for short lists.
                  const next = (index + direction + ACTOR_TYPES.length) % ACTOR_TYPES.length;
                  const nextType = ACTOR_TYPES[next];
                  setSelectedActorType(nextType);
                  actorCardRefs.current[next]?.focus();
                }}
              />
            ))}
          </div>

          {finalizeError && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm font-medium"
              style={{ backgroundColor: "#FDECEC", borderColor: "#F3C6C6", color: "#B3261E" }}
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" style={{ color: "#8C1F17" }} />
              <span>{finalizeError}</span>
            </div>
          )}

          <div className="mt-6">
            <AuthButton loading={isSubmitting} disabled={!selectedActorType} onClick={handleActorTypeContinue}>
              {selectedActorType ? `Continue as ${ACTOR_TYPE_META[selectedActorType].title}` : "Continue"}
            </AuthButton>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
