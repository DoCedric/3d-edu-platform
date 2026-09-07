import { HTMLAttributes, ReactNode } from "react";

interface FloatingPanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function FloatingPanel({ children, className = "", ...props }: FloatingPanelProps) {
  return (
    <div
      className={`bg-bg-elevated border border-border rounded-lg shadow-lg p-3 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
