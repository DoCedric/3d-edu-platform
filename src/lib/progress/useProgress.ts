"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_PROGRESS,
  getLessonProgress,
  LessonProgress,
  PROGRESS_EVENT,
  setLessonProgress,
} from "./storage";

/** Generic, localStorage-backed progress tracking for a single lesson.
 * Not tied to any specific lesson/module - any page can call this with a
 * moduleSlug/lessonSlug pair. */
export function useProgress(moduleSlug: string, lessonSlug: string) {
  const [progress, setProgress] = useState<LessonProgress>(DEFAULT_PROGRESS);

  const refresh = useCallback(() => {
    setProgress(getLessonProgress(moduleSlug, lessonSlug));
  }, [moduleSlug, lessonSlug]);

  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener(PROGRESS_EVENT, refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(PROGRESS_EVENT, refresh);
    };
  }, [refresh]);

  const applyPatch = useCallback(
    (patch: Partial<LessonProgress>) => {
      const updated = setLessonProgress(moduleSlug, lessonSlug, patch);
      setProgress(updated);
      window.dispatchEvent(new Event(PROGRESS_EVENT));
    },
    [moduleSlug, lessonSlug]
  );

  const markViewed = useCallback(() => applyPatch({ viewed: true }), [applyPatch]);
  const setCompleted = useCallback((completed: boolean) => applyPatch({ completed }), [applyPatch]);
  const toggleBookmark = useCallback(() => {
    applyPatch({ bookmarked: !getLessonProgress(moduleSlug, lessonSlug).bookmarked });
  }, [applyPatch, moduleSlug, lessonSlug]);

  return { progress, markViewed, setCompleted, toggleBookmark };
}
