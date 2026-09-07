import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { Lesson, LessonMetadata, Module } from "./types";

const CONTENT_ROOT = path.join(process.cwd(), "content");

function readLesson(moduleSlug: string, lessonSlug: string): Lesson | null {
  const lessonDir = path.join(CONTENT_ROOT, moduleSlug, lessonSlug);
  const mdxPath = path.join(lessonDir, "lesson.mdx");

  if (!fs.existsSync(mdxPath)) return null;

  const raw = fs.readFileSync(mdxPath, "utf-8");
  const { data, content } = matter(raw);

  const metadata: LessonMetadata = {
    title: data.title ?? lessonSlug,
    description: data.description ?? "",
    tags: data.tags ?? [],
    sceneType: data.sceneType ?? "empty",
    order: data.order ?? 0,
  };

  return {
    moduleSlug,
    lessonSlug,
    metadata,
    mdxSource: content,
  };
}

export function getAllModules(): Module[] {
  if (!fs.existsSync(CONTENT_ROOT)) return [];

  const moduleSlugs = fs
    .readdirSync(CONTENT_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const modules: Module[] = moduleSlugs.map((moduleSlug) => {
    const moduleDir = path.join(CONTENT_ROOT, moduleSlug);
    const lessonSlugs = fs
      .readdirSync(moduleDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    const lessons = lessonSlugs
      .map((lessonSlug) => readLesson(moduleSlug, lessonSlug))
      .filter((lesson): lesson is Lesson => lesson !== null)
      .sort((a, b) => a.metadata.order - b.metadata.order);

    let moduleMeta = { title: moduleSlug, description: "" };
    const moduleMetaPath = path.join(moduleDir, "module.json");
    if (fs.existsSync(moduleMetaPath)) {
      moduleMeta = JSON.parse(fs.readFileSync(moduleMetaPath, "utf-8"));
    }

    return {
      slug: moduleSlug,
      title: moduleMeta.title,
      description: moduleMeta.description,
      lessons,
    };
  });

  return modules;
}

export function getModule(moduleSlug: string): Module | undefined {
  return getAllModules().find((m) => m.slug === moduleSlug);
}

export function getLesson(moduleSlug: string, lessonSlug: string): Lesson | null {
  return readLesson(moduleSlug, lessonSlug);
}
