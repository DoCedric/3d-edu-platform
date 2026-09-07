import { HTMLAttributes, ReactNode } from "react";

type BadgeVariant = "default" | "accent";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-bg-elevated text-text-muted border border-border",
  accent: "bg-accent text-accent-foreground",
};

export function Badge({
  children,
  variant = "default",
  className = "",
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
