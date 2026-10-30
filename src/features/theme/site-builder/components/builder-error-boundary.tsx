"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

type Props = { children: ReactNode };
type State = { error: Error | null };

function BuilderCrashFallback({ onRetry }: { onRetry: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background p-6">
      <ErrorState
        title="Theme editor couldn't load — live store unchanged"
        description="A panel crashed. Your live store is unchanged. Try again, or reload the editor."
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

/**
 * Client boundary around SiteBuilder so a panel/canvas crash stays on the theme
 * route instead of bubbling to the generic dashboard pink error screen.
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
    return <BuilderCrashFallback onRetry={this.recover} />;
  }
}
