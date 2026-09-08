import { ReactNode } from "react";

interface LessonLayoutProps {
  toolbar?: ReactNode;
  viewport: ReactNode;
  shelf?: ReactNode;
  /**
   * When true (default), the layout wraps `shelf` in a fixed-width docked
   * column. Set to false to hand a self-managing shelf (e.g. one that
   * animates its own width/open state) full control over its own sizing
   * and chrome.
   */
  shelfChrome?: boolean;
}

export function LessonLayout({ toolbar, viewport, shelf, shelfChrome = true }: LessonLayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-bg">
      {toolbar && (
        <div className="border-b border-border px-4 py-2">{toolbar}</div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative overflow-hidden min-w-0">{viewport}</div>
        {shelf &&
          (shelfChrome ? (
            <div className="w-[320px] shrink-0 border-l border-border bg-bg-elevated overflow-y-auto">
              {shelf}
            </div>
          ) : (
            shelf
          ))}
      </div>
    </div>
  );
}
