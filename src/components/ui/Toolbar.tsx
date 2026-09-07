import { HTMLAttributes, ReactNode } from "react";

interface ToolbarProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Toolbar({ children, className = "", ...props }: ToolbarProps) {
  return (
    <div
      className={`flex items-center gap-2 bg-bg-elevated border border-border rounded-md px-2 py-1.5 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
