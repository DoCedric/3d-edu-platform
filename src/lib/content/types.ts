export interface LessonMetadata {
  title: string;
  description: string;
  tags: string[];
  sceneType: string;
  order: number;
}

export interface Lesson {
  moduleSlug: string;
  lessonSlug: string;
  metadata: LessonMetadata;
  mdxSource: string;
}

export interface Module {
  slug: string;
  title: string;
  description: string;
  lessons: Lesson[];
}
