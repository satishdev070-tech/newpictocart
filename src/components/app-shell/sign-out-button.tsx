"use client";

import { useFormStatus } from "react-dom";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/features/auth/actions";
import { cn } from "@/lib/cn";

type SignOutVariant = "sidebar" | "menu";

function SignOutSubmit({
  variant,
  label,
  pendingLabel,
}: {
  variant: SignOutVariant;
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  const text = pending ? pendingLabel : label;

  if (variant === "sidebar") {
    return (
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-small text-error transition-colors hover:bg-error/10 disabled:pointer-events-none disabled:opacity-60"
      >
        <LogOut aria-hidden className="size-[18px]" strokeWidth={1.75} />
        {text}
      </button>
    );
  }

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-small text-foreground hover:bg-surface-secondary disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-4 [&_svg]:text-muted"
    >
      <LogOut aria-hidden /> {text}
    </button>
  );
}

/** Shared sign-out control with pending feedback for seller/admin shells. */
export function SignOutButton({
  variant = "sidebar",
  label = "Sign out",
  pendingLabel = "Signing out…",
  className,
}: {
  variant?: SignOutVariant;
  label?: string;
  pendingLabel?: string;
  className?: string;
}) {
  return (
    <form action={signOutAction} className={cn(className)}>
      <SignOutSubmit variant={variant} label={label} pendingLabel={pendingLabel} />
    </form>
  );
}
