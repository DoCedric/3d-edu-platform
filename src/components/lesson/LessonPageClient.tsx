"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { LessonLayout } from "@/components/layouts/LessonLayout";
import { Viewport } from "@/components/viewport/Viewport";
import { TheoryShelf } from "@/components/theory/TheoryShelf";
import { MdxContent } from "@/components/theory/MdxContent";
import { ControlsPanel } from "@/components/controls/ControlsPanel";
import { AnnotationSidebar } from "@/components/annotations/AnnotationSidebar";
import { Toolbar } from "@/components/ui/Toolbar";
import { Button } from "@/components/ui/Button";
import { ensurePluginsRegistered } from "@/lib/scenes/register-plugins";
import { getScenePlugin } from "@/lib/scenes/registry";
import { useControlValues } from "@/lib/scenes/useControlValues";
import { useAnnotationSelection } from "@/lib/scenes/useAnnotationSelection";
import { useProgress } from "@/lib/progress/useProgress";
import { LessonProgressControls } from "@/components/progress/LessonProgressControls";

interface AdjacentLesson {
  lessonSlug: string;
  title: string;
}

interface LessonPageClientProps {
  moduleSlug: string;
  lessonSlug: string;
  title: string;
  sceneType: string;
  mdxSource: string;
  breadcrumb: ReactNode;
  prevLesson: AdjacentLesson | null;
  nextLesson: AdjacentLesson | null;
}

export function LessonPageClient({
  moduleSlug,
  lessonSlug,
  title,
  sceneType,
  mdxSource,
  breadcrumb,
  prevLesson,
  nextLesson,
}: LessonPageClientProps) {
  const [ready, setReady] = useState(false);
  const { markViewed } = useProgress(moduleSlug, lessonSlug);

  useEffect(() => {
    ensurePluginsRegistered();
    setReady(true);
  }, []);

  useEffect(() => {
    markViewed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleSlug, lessonSlug]);

  const plugin = ready ? getScenePlugin(sceneType) : undefined;
  const SceneComponent = plugin?.component;
  const { values, setValue } = useControlValues(plugin?.controls);
  const { selectedId, hoveredId, focusToken, select, hover } = useAnnotationSelection(plugin?.id);

  if (!ready) return null;

  const hasControls = !!plugin?.controls && plugin.controls.length > 0;
  const hasAnnotations = !!plugin?.annotations && plugin.annotations.length > 0;

  return (
    <LessonLayout
      shelfChrome={false}
      toolbar={
        <div className="flex items-center justify-between gap-4 w-full min-w-0">
          {breadcrumb}
          <div className="flex items-center gap-2">
            <Toolbar>
              <LessonProgressControls moduleSlug={moduleSlug} lessonSlug={lessonSlug} />
            </Toolbar>
            <Toolbar>
              {prevLesson && (
                <Link href={`/learn/${moduleSlug}/${prevLesson.lessonSlug}`}>
                  <Button size="sm" variant="ghost">
                    ‹ {prevLesson.title}
                  </Button>
                </Link>
              )}
              {nextLesson && (
                <Link href={`/learn/${moduleSlug}/${nextLesson.lessonSlug}`}>
                  <Button size="sm" variant="ghost">
                    {nextLesson.title} ›
                  </Button>
                </Link>
              )}
            </Toolbar>
          </div>
        </div>
      }
      viewport={
        plugin && SceneComponent ? (
          <div className="flex w-full h-full">
            <div className="flex-1 relative min-w-0">
              <Viewport
                annotations={plugin.annotations}
                selectedAnnotationId={selectedId}
                hoveredAnnotationId={hoveredId}
                annotationFocusToken={focusToken}
                onAnnotationSelect={select}
                onAnnotationHover={hover}
              >
                <SceneComponent controlValues={values} />
              </Viewport>
            </div>
            {(hasAnnotations || hasControls) && (
              <div className="w-[280px] shrink-0 border-l border-border bg-bg-elevated overflow-y-auto flex flex-col">
                {hasAnnotations && plugin.annotations && (
                  <AnnotationSidebar
                    annotations={plugin.annotations}
                    selectedId={selectedId}
                    hoveredId={hoveredId}
                    onSelect={select}
                    onHover={hover}
                  />
                )}
                {hasControls && plugin.controls && (
                  <ControlsPanel controls={plugin.controls} values={values} onChange={setValue} />
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-muted text-sm">
            No scene plugin found for sceneType &quot;{sceneType}&quot;
          </div>
        )
      }
      shelf={
        <TheoryShelf title={title}>
          <MdxContent source={mdxSource} />
        </TheoryShelf>
      }
    />
  );
}
