import { DemoCard } from "@/components/gallery/DemoCard";
import { DEMOS } from "@/lib/demos";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-bg px-6 py-10 text-text">
      <div className="mx-auto max-w-[1200px]">
        <header className="mb-10">
          <h1 className="text-2xl font-bold">3D Edu Platform — Demo Gallery</h1>
          <p className="mt-2 text-sm text-text-muted">
            Every embeddable demo in this project. Each one is a standalone page meant to be dropped into an iframe
            elsewhere - click &quot;Embed&quot; under a demo to copy ready-to-paste HTML for it.
          </p>
        </header>

        <div className="flex flex-col gap-10">
          {DEMOS.map((demo) => (
            <DemoCard key={demo.slug} {...demo} />
          ))}
        </div>
      </div>
    </main>
  );
}
