import { ReactNode } from "react";

interface ReferenceLayoutProps {
  children: ReactNode;
  sidebar?: ReactNode;
}

export function ReferenceLayout({ children, sidebar }: ReferenceLayoutProps) {
  return (
    <div className="flex min-h-screen bg-bg">
      {sidebar && (
        <aside className="w-[240px] shrink-0 border-r border-border bg-bg-elevated p-4">
          {sidebar}
        </aside>
      )}
      <main className="flex-1 max-w-3xl mx-auto px-6 py-10 text-text">
        {children}
      </main>
    </div>
  );
}
