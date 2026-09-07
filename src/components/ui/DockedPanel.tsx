import { HTMLAttributes, ReactNode } from "react";

type DockSide = "left" | "right";

interface DockedPanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  side?: DockSide;
  width?: string;
}

export function DockedPanel({
  children,
  side = "right",
  width = "320px",
  className = "",
  ...props
}: DockedPanelProps) {
  const sideClass = side === "left" ? "left-0 border-r" : "right-0 border-l";

  return (
    <div
      style={{ width }}
      className={`fixed top-0 ${sideClass} h-full bg-bg-elevated border-border overflow-y-auto ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
