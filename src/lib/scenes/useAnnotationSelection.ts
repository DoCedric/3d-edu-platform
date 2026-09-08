import { useEffect, useState } from "react";

export function useAnnotationSelection(resetKey?: string) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusToken, setFocusToken] = useState(0);

  useEffect(() => {
    setSelectedId(null);
    setHoveredId(null);
  }, [resetKey]);

  const select = (id: string | null) => {
    setSelectedId(id);
    if (id !== null) setFocusToken((token) => token + 1);
  };

  return {
    selectedId,
    hoveredId,
    focusToken,
    select,
    hover: setHoveredId,
  };
}
