import * as React from "react";
import { PortalHost } from "@rn-primitives/portal";
import { Notification } from "./Notification";
import { StatusBar } from "./StatusBar";

export interface UIProviderProps {
  children: React.ReactNode;
  /**
   * Mount the package notification renderer for globalUIStore feedback.
   *
   * @default true
   */
  notification?: boolean;
  /**
   * Mount the default @rn-primitives portal host used by package overlays.
   *
   * @default true
   */
  portalHost?: boolean;
  /**
   * Mount the package status bar renderer.
   *
   * @default true
   */
  statusBar?: boolean;
}

export function UIProvider({
  children,
  notification = true,
  portalHost = true,
  statusBar = true,
}: UIProviderProps) {
  return (
    <>
      {children}
      {notification ? <Notification /> : null}
      {portalHost ? <PortalHost /> : null}
      {statusBar ? <StatusBar /> : null}
    </>
  );
}
