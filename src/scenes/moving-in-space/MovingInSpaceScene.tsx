"use client";

import { useEffect, useRef, useState } from "react";
import { AxisGizmo } from "@/components/scene-kit/AxisGizmo";
import { DraggableObject } from "@/components/scene-kit/DraggableObject";
import { TargetGhost } from "@/components/scene-kit/TargetGhost";
import { Label3D } from "@/components/scene-kit/Label3D";
import { useTargetMatch } from "@/components/scene-kit/useTargetMatch";
import { SceneControlValues } from "@/lib/scenes/types";

interface MovingInSpaceSceneProps {
  controlValues?: SceneControlValues;
  onControlEvent?: (id: string) => void;
}

const ORIGIN: [number, number, number] = [0, 0, 0];
const TARGET_POSITION: [number, number, number] = [2, 0, 0];

export function MovingInSpaceScene({ controlValues = {}, onControlEvent }: MovingInSpaceSceneProps) {
  const [position, setPosition] = useState<[number, number, number]>(ORIGIN);

  const solved = useTargetMatch(position, TARGET_POSITION, 0.001, () => onControlEvent?.("solved"));

  // A "reset" button (declared via the Controls Framework) pushes a fresh
  // timestamp into controlValues.resetSignal; react to it changing rather
  // than to any specific value.
  const resetSignal = controlValues.resetSignal;
  const lastResetSignal = useRef(resetSignal);
  useEffect(() => {
    if (resetSignal !== undefined && resetSignal !== lastResetSignal.current) {
      lastResetSignal.current = resetSignal;
      setPosition(ORIGIN);
    }
  }, [resetSignal]);

  return (
    <>
      <AxisGizmo length={2.8} />

      <TargetGhost position={TARGET_POSITION}>
        <mesh>
          <boxGeometry args={[0.9, 0.9, 0.9]} />
          <meshBasicMaterial color="#30a46c" wireframe transparent opacity={0.6} />
        </mesh>
      </TargetGhost>

      <DraggableObject position={position} onPositionChange={setPosition} axis="x" gridSize={1}>
        <mesh>
          <boxGeometry args={[0.9, 0.9, 0.9]} />
          <meshStandardMaterial color={solved ? "#30a46c" : "#4f8ef7"} />
        </mesh>
      </DraggableObject>

      {solved && (
        <Label3D text="Target reached!" color="#30a46c" position={[position[0], position[1] + 1, position[2]]} />
      )}
    </>
  );
}
