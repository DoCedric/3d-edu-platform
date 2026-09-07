"use client";

import { useTheme } from "@/components/theme/ThemeProvider";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Accordion } from "@/components/ui/Accordion";
import { FloatingPanel } from "@/components/ui/FloatingPanel";
import { Toolbar } from "@/components/ui/Toolbar";

export default function DesignSystemPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <main className="min-h-screen bg-bg p-8 flex flex-col gap-10">
      <div className="flex items-center justify-between">
        <h1 className="text-text text-2xl font-bold">Design System</h1>
        <Button variant="secondary" onClick={toggleTheme}>
          Toggle theme (currently {theme})
        </Button>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-text-muted text-sm uppercase tracking-wide">Buttons</h2>
        <div className="flex gap-3 flex-wrap items-center">
          <Button variant="primary" size="sm">Primary sm</Button>
          <Button variant="primary" size="md">Primary md</Button>
          <Button variant="primary" size="lg">Primary lg</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-text-muted text-sm uppercase tracking-wide">Badges</h2>
        <div className="flex gap-3 items-center">
          <Badge>Default</Badge>
          <Badge variant="accent">Accent</Badge>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-text-muted text-sm uppercase tracking-wide">Panel</h2>
        <Panel>
          <p className="text-text">This is a Panel. Generic container with border and background.</p>
        </Panel>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-text-muted text-sm uppercase tracking-wide">Card</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card title="Lighting Scene">
            Explore how point lights, ambient light, and shadows interact.
          </Card>
          <Card title="Camera Scene">
            Learn about perspective vs orthographic projection.
          </Card>
          <Card title="Comparison Scene">
            Compare two materials side by side with a slider.
          </Card>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-text-muted text-sm uppercase tracking-wide">Accordion</h2>
        <div className="flex flex-col gap-2 max-w-md">
          <Accordion title="What is a scene plugin?">
            A scene plugin is a self-contained component that implements a specific
            interactive visualization, registered under a sceneType id.
          </Accordion>
          <Accordion title="How does theming work?" defaultOpen>
            All components use CSS variable-backed Tailwind tokens, so toggling the
            `dark` class on the html element re-themes everything at once.
          </Accordion>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-text-muted text-sm uppercase tracking-wide">Toolbar</h2>
        <Toolbar>
          <Button size="sm" variant="ghost">Reset</Button>
          <Button size="sm" variant="ghost">Fullscreen</Button>
          <Button size="sm" variant="ghost">Screenshot</Button>
        </Toolbar>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-text-muted text-sm uppercase tracking-wide">Floating Panel</h2>
        <div className="relative h-32 bg-bg-elevated rounded-md">
          <FloatingPanel className="absolute top-4 left-4">
            <p className="text-text text-sm">I float above scene content.</p>
          </FloatingPanel>
        </div>
      </section>
    </main>
  );
}
