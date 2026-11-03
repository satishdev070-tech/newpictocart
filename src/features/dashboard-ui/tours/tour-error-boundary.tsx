"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

/**
 * Keeps a tour overlay crash from taking down the seller/admin shell. Tours are progressive
 * enhancement — a measure/scroll loop must never blank the page under them.
 */
export class TourErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "dashboard.tour_crash",
        message: error.message,
        componentStack: info.componentStack?.slice(0, 500) ?? null,
        time: new Date().toISOString(),
      }),
    );
  }

  override render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
