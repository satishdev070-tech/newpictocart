"use client";

import { PanelRouteError, type RouteErrorProps } from "@/components/app-shell/route-error";

export default function DashboardError({ error, retry, reset }: RouteErrorProps) {
  return <PanelRouteError error={error} retry={retry} reset={reset} logMsg="dashboard.route_error" />;
}
