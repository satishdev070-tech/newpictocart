"use client";

import { useBuilder } from "../context";
import { PagesPanel } from "./panels/pages-panel";
import { MenusPanel } from "./panels/menus-panel";
import { ThemePanel } from "./panels/theme-panel";
import { EmbedsPanel } from "./panels/embeds-panel";
import { LayersPanel } from "./panels/layers-panel";
import { PopupPanel } from "./panels/popup-panel";
import { SectionPanel } from "./panels/section-panel";
import { InsertPanel } from "./panels/insert-panel";

/** Renders the open left panel. Each panel reads its own state from useBuilder(). */
export function PanelHost() {
  const { panel } = useBuilder();
  if (!panel) return null;
  switch (panel.kind) {
    case "pages":
      return <PagesPanel />;
    case "menus":
      return <MenusPanel />;
    case "theme":
      return <ThemePanel />;
    case "embeds":
      return <EmbedsPanel />;
    case "layers":
      return <LayersPanel />;
    case "popup":
      return <PopupPanel key={panel.popupId} />;
    case "section":
      return <SectionPanel key={`${panel.ref.list}:${panel.ref.sectionId}`} />;
    case "insert":
      return <InsertPanel key={`${panel.list}:${panel.anchorId ?? ""}:${panel.where}:${panel.ai ? 1 : 0}`} />;
  }
}
