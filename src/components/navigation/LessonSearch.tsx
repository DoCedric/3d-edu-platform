"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";

export interface SearchableLesson {
  moduleSlug: string;
  lessonSlug: string;
  moduleTitle: string;
  title: string;
  description: string;
  tags: string[];
  mdxSource: string;
}

interface LessonSearchProps {
  lessons: SearchableLesson[];
}

export function LessonSearch({ lessons }: LessonSearchProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return lessons.filter((lesson) => {
      const haystack = [lesson.title, lesson.description, lesson.moduleTitle, ...lesson.tags, lesson.mdxSource]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query, lessons]);

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search lessons by title, tag, or description…"
        className="w-full bg-bg-elevated border border-border rounded-md text-text text-sm px-3 py-2 placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
      />

      {query.trim() && (
        <div className="flex flex-col gap-2">
          {results.length === 0 ? (
            <p className="text-text-muted text-sm">No lessons match &quot;{query}&quot;.</p>
          ) : (
            results.map((lesson) => (
              <Link
                key={`${lesson.moduleSlug}/${lesson.lessonSlug}`}
                href={`/learn/${lesson.moduleSlug}/${lesson.lessonSlug}`}
                className="flex flex-col gap-1 rounded-md border border-border bg-bg-elevated px-3 py-2 hover:border-accent transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-text text-sm font-medium">{lesson.title}</span>
                  <Badge>{lesson.moduleTitle}</Badge>
                </div>
                {lesson.description && <p className="text-text-muted text-xs">{lesson.description}</p>}
                {lesson.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {lesson.tags.map((tag) => (
                      <Badge key={tag} variant="accent">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
