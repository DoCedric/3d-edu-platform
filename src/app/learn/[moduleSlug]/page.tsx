import Link from "next/link";
import { notFound } from "next/navigation";
import { getModule } from "@/lib/content/discovery";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBadges } from "@/components/progress/ProgressBadges";

export default async function ModulePage(props: PageProps<"/learn/[moduleSlug]">) {
  const { moduleSlug } = await props.params;
  const moduleData = getModule(moduleSlug);

  if (!moduleData) notFound();

  return (
    <main className="min-h-screen bg-bg p-8 flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Modules", href: "/modules" }, { label: moduleData.title }]} />

      <div>
        <h1 className="text-text text-2xl font-bold mb-1">{moduleData.title}</h1>
        {moduleData.description && <p className="text-text-muted text-sm">{moduleData.description}</p>}
      </div>

      {moduleData.lessons.length === 0 ? (
        <p className="text-text-muted text-sm">This module has no lessons yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {moduleData.lessons.map((lesson, index) => (
            <Link key={lesson.lessonSlug} href={`/learn/${moduleData.slug}/${lesson.lessonSlug}`}>
              <Card className="hover:border-accent transition-colors">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <div className="flex items-center gap-3">
                    <Badge>{index + 1}</Badge>
                    <span className="text-text font-medium">{lesson.metadata.title}</span>
                  </div>
                  <ProgressBadges moduleSlug={moduleData.slug} lessonSlug={lesson.lessonSlug} />
                </div>
                <p>{lesson.metadata.description}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
