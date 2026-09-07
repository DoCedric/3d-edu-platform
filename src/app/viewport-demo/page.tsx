"use client";

import { Viewport } from "@/components/viewport/Viewport";
import { TestSphere } from "@/components/viewport/TestSphere";

export default function ViewportDemoPage() {
  return (
    <div className="w-screen h-screen">
      <Viewport>
        <TestSphere />
      </Viewport>
    </div>
  );
}
