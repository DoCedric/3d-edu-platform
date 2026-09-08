import { ReactNode } from "react";

/**
 * Page-level structural shell: divides the screen into two fixed panes.
 * For an interactive side-by-side/slider/toggle comparison *widget* with its
 * own controls (usable anywhere, not just as a full-page layout), use
 * `ComparisonFramework` from `@/components/comparison` instead.
 */
interface ComparisonLayoutProps {
  left: ReactNode;
  right: ReactNode;
  direction?: "horizontal" | "vertical";
}

export function ComparisonLayout({
  left,
  right,
  direction = "horizontal",
}: ComparisonLayoutProps) {
  const flexDirection = direction === "horizontal" ? "flex-row" : "flex-col";

  return (
    <div className={`flex ${flexDirection} w-full h-full bg-bg`}>
      <div className="flex-1 relative overflow-hidden border-border border-r last:border-r-0">
        {left}
      </div>
      <div className="flex-1 relative overflow-hidden">{right}</div>
    </div>
  );
}
