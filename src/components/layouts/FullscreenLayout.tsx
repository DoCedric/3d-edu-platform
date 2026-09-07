import { ReactNode } from "react";

interface FullscreenLayoutProps {
  children: ReactNode;
  overlay?: ReactNode;
}

export function FullscreenLayout({ children, overlay }: FullscreenLayoutProps) {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg">
      {children}
      {overlay && <div className="absolute inset-0 pointer-events-none">{overlay}</div>}
    </div>
  );
}
