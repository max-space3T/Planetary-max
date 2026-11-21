import React, { type ReactNode } from "react";

export interface PortalOS1LayoutProps {
  children?: ReactNode;
  title?: string;
  activeScopeKey?: string;
  headerSlot?: ReactNode;
  inspectorSlot?: ReactNode;
}

export function PortalOS1Layout({
  children,
  title,
  activeScopeKey,
  headerSlot,
  inspectorSlot,
}: PortalOS1LayoutProps) {
  return (
    <div data-portal-shell="portal-os1" data-scope-key={activeScopeKey}>
      {headerSlot ?? (title ? <header>{title}</header> : null)}
      <main>{children}</main>
      {inspectorSlot ? <aside>{inspectorSlot}</aside> : null}
    </div>
  );
}
