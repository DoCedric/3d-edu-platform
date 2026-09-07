import { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  title?: string;
}

export function Card({ children, title, className = "", ...props }: CardProps) {
  return (
    <div
      className={`bg-bg-elevated border border-border rounded-lg p-4 shadow-sm ${className}`}
      {...props}
    >
      {title && <h3 className="text-text font-semibold mb-2">{title}</h3>}
      <div className="text-text-muted text-sm">{children}</div>
    </div>
  );
}
