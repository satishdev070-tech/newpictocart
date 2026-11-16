"use client";

import { useFormStatus } from "react-dom";

const BUTTON_TONE = {
  /** Google's neutral light button (storefronts, light screens). */
  light:
    "rounded-md border border-[#dadce0] bg-white px-4 py-2.5 text-sm font-medium text-[#3c4043] shadow-sm hover:bg-[#f8f9fa] focus-visible:outline-[#1a73e8]",
  /** Dark secondary pill for the dark auth / onboarding screens (marketing look). */
  dark: "min-h-12 rounded-full border border-mk-line-strong bg-white/[0.03] px-6 text-[15px] font-semibold text-mk-text hover:border-mk-text/40 hover:bg-white/[0.06] focus-visible:outline-mk-accent",
} as const;

/** "Continue with Google" (Google sign-in branding: the multicolour G on a neutral button). */
export function GoogleButton({
  action,
  next,
  className = "",
  label = "Continue with Google",
  tone = "light",
}: {
  action: (fd: FormData) => Promise<void>;
  next?: string;
  className?: string;
  label?: string;
  tone?: keyof typeof BUTTON_TONE;
}) {
  return (
    <form action={action} className={className}>
      <input type="hidden" name="next" value={next ?? ""} />
      <GoogleSubmit label={label} tone={tone} />
    </form>
  );
}

function GoogleSubmit({ label, tone }: { label: string; tone: keyof typeof BUTTON_TONE }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`flex w-full items-center justify-center gap-3 transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-70 ${BUTTON_TONE[tone]}`}
    >
      {pending ? (
        <span className={tone === "dark" ? "size-[18px] animate-spin rounded-full border-2 border-white/20 border-t-white" : "size-[18px] animate-spin rounded-full border-2 border-[#dadce0] border-t-[#3c4043]"} aria-hidden />
      ) : (
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.9 6.2C12.5 13.6 17.8 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
          <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C1 16.6 0 20.2 0 24s1 7.4 2.7 10.8l7.9-6.2z" />
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.2C6.6 42.6 14.6 48 24 48z" />
        </svg>
      )}
      {pending ? "Opening Google…" : label}
    </button>
  );
}

export function OrDivider({ tone = "light" }: { tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <div
      className={dark ? "my-6 flex items-center gap-3 font-mk-mono text-[11px] uppercase tracking-[0.18em] text-mk-dim" : "my-5 flex items-center gap-3 text-xs uppercase tracking-wider opacity-60"}
      role="separator"
    >
      <span className={dark ? "h-px flex-1 bg-mk-line-strong" : "h-px flex-1 bg-current opacity-30"} />
      or
      <span className={dark ? "h-px flex-1 bg-mk-line-strong" : "h-px flex-1 bg-current opacity-30"} />
    </div>
  );
}
