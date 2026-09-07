"use client";

import { useState } from "react";
import { LessonLayout } from "@/components/layouts/LessonLayout";
import { FullscreenLayout } from "@/components/layouts/FullscreenLayout";
import { ComparisonLayout } from "@/components/layouts/ComparisonLayout";
import { ReferenceLayout } from "@/components/layouts/ReferenceLayout";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { Card } from "@/components/ui/Card";
import { Toolbar } from "@/components/ui/Toolbar";
import { Badge } from "@/components/ui/Badge";

type LayoutKey = "lesson" | "fullscreen" | "comparison" | "reference";

const PlaceholderViewport = ({ label }: { label: string }) => (
  <div className="w-full h-full flex items-center justify-center bg-bg-elevated">
    <p className="text-text-muted text-sm">{label}</p>
  </div>
);

export default function LayoutsDemoPage() {
  const [active, setActive] = useState<LayoutKey>("lesson");

  const tabs: { key: LayoutKey; label: string }[] = [
    { key: "lesson", label: "Lesson Layout" },
    { key: "fullscreen", label: "Fullscreen Layout" },
    { key: "comparison", label: "Comparison Layout" },
    { key: "reference", label: "Reference Layout" },
  ];

  return (
    <div className="min-h-screen bg-bg">
      <div className="flex gap-2 p-4 border-b border-border bg-bg-elevated relative z-10">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            variant={active === tab.key ? "primary" : "secondary"}
            size="sm"
            onClick={() => setActive(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {active === "lesson" && (
        <div className="h-[calc(100vh-64px)]">
          <LessonLayout
            toolbar={
              <Toolbar>
                <Button size="sm" variant="ghost">Reset</Button>
                <Button size="sm" variant="ghost">Fullscreen</Button>
                <Badge>sceneType: lighting</Badge>
              </Toolbar>
            }
            viewport={<PlaceholderViewport label="Viewport area (scene renders here)" />}
            shelf={
              <div className="p-4">
                <h3 className="text-text font-semibold mb-2">Theory Shelf</h3>
                <p className="text-text-muted text-sm">
                  Placeholder theory content would render here via MDX.
                </p>
              </div>
            }
          />
        </div>
      )}

      {active === "fullscreen" && (
        <div className="h-[calc(100vh-64px)] relative">
          <FullscreenLayout
            overlay={
              <div className="absolute top-4 left-4 pointer-events-auto">
                <Badge variant="accent">Fullscreen overlay badge</Badge>
              </div>
            }
          >
            <PlaceholderViewport label="Fullscreen scene (edge-to-edge)" />
          </FullscreenLayout>
        </div>
      )}

      {active === "comparison" && (
        <div className="h-[calc(100vh-64px)]">
          <ComparisonLayout
            left={<PlaceholderViewport label="Left pane (before)" />}
            right={<PlaceholderViewport label="Right pane (after)" />}
          />
        </div>
      )}

      {active === "reference" && (
        <ReferenceLayout
          sidebar={
            <div className="flex flex-col gap-2">
              <p className="text-text text-sm font-medium">Contents</p>
              <p className="text-text-muted text-sm">Introduction</p>
              <p className="text-text-muted text-sm">Core Concepts</p>
              <p className="text-text-muted text-sm">Further Reading</p>
            </div>
          }
        >
          <Card title="Reference Layout">
            This is a single-column reading layout with an optional sidebar,
            intended for documentation or reference-style pages rather than
            interactive scenes.
          </Card>
          <div className="mt-4">
            <Panel>
              <p className="text-text-muted text-sm">
                Additional reference content can live in Panels like this one.
              </p>
            </Panel>
          </div>
        </ReferenceLayout>
      )}
    </div>
  );
}
