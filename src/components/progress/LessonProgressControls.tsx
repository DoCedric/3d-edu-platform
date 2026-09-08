"use client";

import { useProgress } from "@/lib/progress/useProgress";
import { Button } from "@/components/ui/Button";

interface LessonProgressControlsProps {
  moduleSlug: string;
  lessonSlug: string;
}

export function LessonProgressControls({ moduleSlug, lessonSlug }: LessonProgressControlsProps) {
  const { progress, setCompleted, toggleBookmark } = useProgress(moduleSlug, lessonSlug);

  return (
    <>
      <Button size="sm" variant={progress.bookmarked ? "primary" : "ghost"} onClick={toggleBookmark}>
        {progress.bookmarked ? "★ Bookmarked" : "☆ Bookmark"}
      </Button>
      <Button size="sm" variant={progress.completed ? "primary" : "ghost"} onClick={() => setCompleted(!progress.completed)}>
        {progress.completed ? "✓ Completed" : "Mark complete"}
      </Button>
    </>
  );
}
