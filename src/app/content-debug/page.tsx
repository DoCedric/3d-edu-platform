import { getAllModules } from "@/lib/content/discovery";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Panel } from "@/components/ui/Panel";

export default function ContentDebugPage() {
  const modules = getAllModules();

  return (
    <main className="min-h-screen bg-bg p-8 flex flex-col gap-8">
      <div>
        <h1 className="text-text text-2xl font-bold mb-1">Content Debug</h1>
        <p className="text-text-muted text-sm">
          Everything below was discovered automatically from the{" "}
          <code className="text-accent">content/</code> folder. Nothing here is
          hardcoded — add a new module or lesson folder and it will appear on
          reload with no code changes.
        </p>
      </div>

      {modules.length === 0 && (
        <Panel>
          <p className="text-text-muted text-sm">
            No modules found. Check that the <code>content/</code> folder exists
            at the project root and contains at least one module folder.
          </p>
        </Panel>
      )}

      {modules.map((module) => (
        <div key={module.slug} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-text text-lg font-semibold">{module.title}</h2>
            <Badge>{module.slug}</Badge>
            <Badge variant="accent">{module.lessons.length} lessons</Badge>
          </div>
          {module.description && (
            <p className="text-text-muted text-sm">{module.description}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {module.lessons.map((lesson) => (
              <Card key={lesson.lessonSlug} title={lesson.metadata.title}>
                <p className="mb-2">{lesson.metadata.description}</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {lesson.metadata.tags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
                <p className="text-xs">
                  slug: <code>{lesson.lessonSlug}</code> · sceneType:{" "}
                  <code>{lesson.metadata.sceneType}</code> · order:{" "}
                  {lesson.metadata.order}
                </p>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </main>
  );
}
