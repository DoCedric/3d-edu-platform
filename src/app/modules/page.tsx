import Link from "next/link";
import { getAllModules } from "@/lib/content/discovery";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LessonSearch } from "@/components/navigation/LessonSearch";

export default function ModulesPage() {
  const modules = getAllModules();

  const allLessons = modules.flatMap((module) =>
    module.lessons.map((lesson) => ({
      moduleSlug: module.slug,
      lessonSlug: lesson.lessonSlug,
      moduleTitle: module.title,
      title: lesson.metadata.title,
      description: lesson.metadata.description,
      tags: lesson.metadata.tags,
      mdxSource: lesson.mdxSource,
    }))
  );

  return (
    <main className="min-h-screen bg-bg p-8 flex flex-col gap-8">
      <div>
        <h1 className="text-text text-2xl font-bold mb-1">Modules</h1>
        <p className="text-text-muted text-sm">
          Browse every module and lesson discovered from the content system.
        </p>
      </div>

      <LessonSearch lessons={allLessons} />

      {modules.length === 0 ? (
        <p className="text-text-muted text-sm">
          No modules found. Add a module folder under <code className="text-accent">content/</code>.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modules.map((module) => (
            <Link key={module.slug} href={`/learn/${module.slug}`}>
              <Card title={module.title} className="h-full hover:border-accent transition-colors">
                <p className="mb-2">{module.description}</p>
                <Badge variant="accent">{module.lessons.length} lessons</Badge>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
