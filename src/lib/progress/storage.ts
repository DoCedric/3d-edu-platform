export interface LessonProgress {
  viewed: boolean;
  completed: boolean;
  bookmarked: boolean;
}

export const DEFAULT_PROGRESS: LessonProgress = {
  viewed: false,
  completed: false,
  bookmarked: false,
};

/** Fired on `window` whenever any lesson's progress is written, so other
 * mounted components (e.g. a badge on the module overview page) can refresh
 * without waiting for a `storage` event, which only fires in *other* tabs. */
export const PROGRESS_EVENT = "edu-progress-updated";

const STORAGE_KEY = "3d-edu-platform:progress:v1";

type ProgressStore = Record<string, LessonProgress>;

function getLessonKey(moduleSlug: string, lessonSlug: string): string {
  return `${moduleSlug}/${lessonSlug}`;
}

function readStore(): ProgressStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: ProgressStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) - fail silently
  }
}

export function getLessonProgress(moduleSlug: string, lessonSlug: string): LessonProgress {
  const store = readStore();
  return store[getLessonKey(moduleSlug, lessonSlug)] ?? DEFAULT_PROGRESS;
}

export function setLessonProgress(
  moduleSlug: string,
  lessonSlug: string,
  patch: Partial<LessonProgress>
): LessonProgress {
  const store = readStore();
  const key = getLessonKey(moduleSlug, lessonSlug);
  const updated: LessonProgress = { ...DEFAULT_PROGRESS, ...store[key], ...patch };
  store[key] = updated;
  writeStore(store);
  return updated;
}
