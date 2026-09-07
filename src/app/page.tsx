"use client";

import { useTheme } from "@/components/theme/ThemeProvider";

export default function Home() {
  const { theme, toggleTheme } = useTheme();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-text">
        Current theme: <strong>{theme}</strong>
      </p>
      <button
        onClick={toggleTheme}
        className="px-4 py-2 rounded-md bg-accent text-accent-foreground"
      >
        Toggle theme
      </button>
    </main>
  );
}