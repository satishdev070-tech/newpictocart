"use client";

import dynamic from "next/dynamic";

/**
 * The builder canvas bridge, loaded only when the store layout renders it (draft preview inside the
 * site builder). A static import put its theme schemas (zod) into every shopper's first-load JS.
 * It draws nothing until the builder frames the page, so it needs no server render.
 */
export const LazyCanvasBridge = dynamic(() => import("./canvas-bridge").then((m) => m.CanvasBridge), { ssr: false });
