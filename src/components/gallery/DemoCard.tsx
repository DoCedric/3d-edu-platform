"use client";

import { useEffect, useRef, useState } from "react";

interface DemoCardProps {
  slug: string;
  title: string;
  description: string;
}

/** One demo's section: title, a live (but lazily-mounted) preview iframe,
 * and an "Embed" button that copies a ready-to-paste iframe snippet pointed
 * at this demo's absolute URL. Lazy mounting matters here specifically
 * because the gallery stacks every demo on one page - mounting all of their
 * WebGL canvases at once would be wasteful and could hit a browser's
 * concurrent-context limit. */
export function DemoCard({ slug, title, description }: DemoCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleEmbed = async () => {
    const url = `${window.location.origin}/embed/${slug}`;
    const snippet = `<iframe src="${url}" width="800" height="600" style="border: none;" loading="lazy" allowfullscreen></iframe>`;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable (insecure context, permissions, etc.) - fail silently.
    }
  };

  return (
    <section className="border-t border-border pt-8 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold text-text">{title}</h2>
        <a href={`/embed/${slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-text-muted underline-offset-2 hover:text-text hover:underline">
          Open in new tab ↗
        </a>
      </div>
      <p className="mt-1 text-sm text-text-muted">{description}</p>

      <div ref={containerRef} className="mt-4 h-[480px] w-full overflow-hidden rounded-md border border-border bg-bg-elevated">
        {visible ? (
          <iframe src={`/embed/${slug}`} title={title} className="h-full w-full" style={{ border: "none" }} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-text-muted">Loading preview…</div>
        )}
      </div>

      <button
        onClick={handleEmbed}
        className="mt-3 rounded-md border border-border bg-bg-elevated px-4 py-2 text-sm text-text transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        {copied ? "Copied!" : "Embed"}
      </button>
    </section>
  );
}
