"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export type BuilderBoundaryVariant = "page" | "region";

type Props = {
  children: ReactNode;
  /**
   * `page` — full-editor fallback (outer last resort).
   * `region` — compact in-place fallback for PanelHost / CanvasFrame so TopBar stays up.
   */
  variant?: BuilderBoundaryVariant;
  /** Region label for compact copy (`panel` | `preview`). Ignored for `page`. */
  label?: "panel" | "preview";
};

type State = { error: Error | null };

/** True when the thrown value looks like a fetch / connectivity failure (not a render bug). */
export function isBuilderNetworkError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("err_timed_out") ||
    msg.includes("econnreset") ||
    msg.includes("load failed")
  );
}

function pageCopy(error: Error | null): { title: string; description: string } {
  if (error && isBuilderNetworkError(error)) {
    return {
      title: "Couldn't reach the server — draft may be unsaved",
      description: "A connection problem interrupted the theme editor. Your live store is unchanged. Check your connection and try again.",
    };
  }
  return {
    title: "Theme editor couldn't load — live store unchanged",
    description: "A panel crashed. Your live store is unchanged. Try again, or reload the editor.",
  };
}

function regionCopy(label: "panel" | "preview", error: Error | null): { title: string; description: string } {
  if (error && isBuilderNetworkError(error)) {
    return {
      title: "Couldn't reach the server",
      description: "Draft may be unsaved. Check your connection and try again.",
    };
  }
  if (label === "preview") {
    return {
      title: "Preview crashed",
      description: "Your live store is unchanged. Try again.",
    };
  }
  return {
    title: "This panel crashed",
    description: "Your live store is unchanged. Try again.",
  };
}

function BuilderCrashFallback({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  const router = useRouter();
  const copy = pageCopy(error);
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background p-6">
      <ErrorState
        title={copy.title}
        description={copy.description}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={onRetry}>
              Try again
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                router.push("/dashboard/theme");
                router.refresh();
              }}
            >
              Reload editor
            </Button>
          </div>
        }
      />
    </div>
  );
}

function RegionCrashFallback({ label, error, onRetry }: { label: "panel" | "preview"; error: Error | null; onRetry: () => void }) {
  const copy = regionCopy(label, error);
  return (
    <div role="alert" className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-3 bg-surface p-4 text-center">
      <p className="text-small font-semibold text-error">{copy.title}</p>
      <p className="max-w-xs text-xs text-muted">{copy.description}</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/**
 * Client boundary around SiteBuilder (or a region of it) so a panel/canvas crash stays on the
 * theme route instead of bubbling to the generic dashboard pink error screen.
 */
export class BuilderErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "dashboard.theme.builder_crash",
        variant: this.props.variant ?? "page",
        label: this.props.label ?? null,
        network: isBuilderNetworkError(error),
        message: error.message,
        componentStack: info.componentStack?.slice(0, 500) ?? null,
        time: new Date().toISOString(),
      }),
    );
  }

  private recover = () => {
    this.setState({ error: null });
  };

  override render() {
    if (!this.state.error) return this.props.children;
    const variant = this.props.variant ?? "page";
    if (variant === "region") {
      return <RegionCrashFallback label={this.props.label ?? "panel"} error={this.state.error} onRetry={this.recover} />;
    }
    return <BuilderCrashFallback error={this.state.error} onRetry={this.recover} />;
  }
}
