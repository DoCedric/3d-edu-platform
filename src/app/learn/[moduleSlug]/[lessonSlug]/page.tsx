import { notFound } from "next/navigation";
import { getModule } from "@/lib/content/discovery";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { LessonPageClient } from "@/components/lesson/LessonPageClient";

export default async function LessonPage(props: PageProps<"/learn/[moduleSlug]/[lessonSlug]">) {
  const { moduleSlug, lessonSlug } = await props.params;
  const moduleData = getModule(moduleSlug);
  if (!moduleData) notFound();

  const index = moduleData.lessons.findIndex((l) => l.lessonSlug === lessonSlug);
  if (index === -1) notFound();

  const lesson = moduleData.lessons[index];
  const prevLesson = index > 0 ? moduleData.lessons[index - 1] : null;
  const nextLesson = index < moduleData.lessons.length - 1 ? moduleData.lessons[index + 1] : null;

  const breadcrumb = (
    <Breadcrumbs
      items={[
        { label: "Modules", href: "/modules" },
        { label: moduleData.title, href: `/learn/${moduleData.slug}` },
        { label: lesson.metadata.title },
      ]}
    />
  );

  return (
    <div className="h-screen">
      <LessonPageClient
        moduleSlug={moduleData.slug}
        lessonSlug={lesson.lessonSlug}
        title={lesson.metadata.title}
        sceneType={lesson.metadata.sceneType}
        mdxSource={lesson.mdxSource}
        breadcrumb={breadcrumb}
        prevLesson={prevLesson ? { lessonSlug: prevLesson.lessonSlug, title: prevLesson.metadata.title } : null}
        nextLesson={nextLesson ? { lessonSlug: nextLesson.lessonSlug, title: nextLesson.metadata.title } : null}
      />
    </div>
  );
}
