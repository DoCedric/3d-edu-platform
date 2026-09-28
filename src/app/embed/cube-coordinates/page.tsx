"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { CubeCoordinatesScene } from "@/scenes/cube-coordinates/CubeCoordinatesScene";

export default function CubeCoordinatesEmbedPage() {
  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-[#111a18] text-[#edf4ef]">
      <Canvas camera={{ position: [7, 6, 8], fov: 48 }}>
        <color attach="background" args={["#111a18"]} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 7, 6]} intensity={1.4} />
        <directionalLight position={[-4, 2, -5]} intensity={0.45} color="#7fcfc0" />
        <CubeCoordinatesScene />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
      </Canvas>

      <header className="pointer-events-none absolute left-4 right-4 top-4 flex items-start justify-between gap-3 sm:left-6 sm:right-6 sm:top-6">
        <div className="max-w-[48vw] sm:max-w-[280px]">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#91a79c]">
            Spatial coordinates
          </p>
          <h1 className="text-lg font-semibold leading-tight sm:text-2xl">Cube vertices</h1>
          <p className="mt-1 text-xs leading-snug text-[#aebdb5] sm:text-sm">
            Local coordinates stay fixed as the cube moves through world space.
          </p>
        </div>

        <aside aria-label="Coordinate color legend" className="shrink-0 rounded-sm border border-white/10 bg-[#18231f]/90 px-3 py-2 shadow-lg backdrop-blur">
          <div className="flex items-center gap-2 text-[11px] sm:text-xs">
            <span className="h-2 w-2 rounded-full bg-[#58d6c2]" />
            <span>Object space</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] sm:text-xs">
            <span className="h-2 w-2 rounded-full bg-[#ffb65c]" />
            <span>World space</span>
          </div>
        </aside>
      </header>

      <div className="pointer-events-none absolute bottom-4 left-4 rounded-sm border border-white/10 bg-[#18231f]/90 px-3 py-2 text-[11px] text-[#bdcbc3] shadow-lg backdrop-blur sm:bottom-6 sm:left-6 sm:text-xs">
        Drag an axis on the gizmo to move the cube · coordinates update to 2 decimals
      </div>
    </main>
  );
}