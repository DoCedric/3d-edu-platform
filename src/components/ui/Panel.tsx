import { HTMLAttributes, ReactNode } from "react";

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Panel({ children, className = "", ...props }: PanelProps) {
  return (
    <div
      className={`bg-bg-elevated border border-border rounded-lg p-4 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
