import { GoogleLogo } from "@/components/auth/google-logo";

interface GoogleButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

/**
 * White background, dark text, 1.5px border — per Google's own sign-in
 * button brand guidelines (a colored button is not the correct style).
 */
export function GoogleButton({ onClick, disabled }: GoogleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-3 rounded-xl border-[1.5px] bg-white px-4 py-3 text-[15px] font-medium text-[#3c4043] transition-colors outline-none hover:bg-[#f8f8f8] focus-visible:ring-4 focus-visible:ring-[var(--auth-accent)]/25 disabled:cursor-not-allowed disabled:opacity-60"
      style={{ borderColor: "var(--auth-border)" }}
    >
      <GoogleLogo className="size-5" />
      Continue with Google
    </button>
  );
}
