import { ReactNode } from "react";

interface LessonLayoutProps {
  toolbar?: ReactNode;
  viewport: ReactNode;
  shelf?: ReactNode;
}

export function LessonLayout({ toolbar, viewport, shelf }: LessonLayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-bg">
      {toolbar && (
        <div className="border-b border-border px-4 py-2">{toolbar}</div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative overflow-hidden">{viewport}</div>
        {shelf && (
          <div className="w-[320px] shrink-0 border-l border-border bg-bg-elevated overflow-y-auto">
            {shelf}
          </div>
        )}
      </div>
    </div>
  );
}
