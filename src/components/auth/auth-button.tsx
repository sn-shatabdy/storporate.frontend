import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface AuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  icon?: ReactNode;
}

/**
 * The full-width `accent`-filled primary CTA used across every auth screen
 * ("Continue with email," "Verify code," "Continue as {type}"). A dedicated
 * component rather than the shared shadcn `Button` because these screens use
 * the approved auth accent color (`--auth-accent`), not the app's default
 * primary token.
 */
export function AuthButton({ loading, icon, children, disabled, className, ...props }: AuthButtonProps) {
  return (
    <button
      type="submit"
      {...props}
      disabled={disabled || loading}
      className={
        "font-heading-auth flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[15px] font-bold text-[var(--auth-accent-text)] transition-opacity outline-none focus-visible:ring-4 focus-visible:ring-[var(--auth-accent)]/40 disabled:cursor-not-allowed disabled:opacity-60" +
        (className ? ` ${className}` : "")
      }
      style={{ backgroundColor: "var(--auth-accent)" }}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
