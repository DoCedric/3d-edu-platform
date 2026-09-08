"use client";

import { useProgress } from "@/lib/progress/useProgress";
import { Badge } from "@/components/ui/Badge";

interface ProgressBadgesProps {
  moduleSlug: string;
  lessonSlug: string;
}

export function ProgressBadges({ moduleSlug, lessonSlug }: ProgressBadgesProps) {
  const { progress } = useProgress(moduleSlug, lessonSlug);

  if (!progress.viewed && !progress.completed && !progress.bookmarked) return null;

  return (
    <div className="flex gap-1.5">
      {progress.completed ? <Badge variant="accent">Completed</Badge> : progress.viewed ? <Badge>Viewed</Badge> : null}
      {progress.bookmarked && <Badge>★ Bookmarked</Badge>}
    </div>
  );
}
