"use client";

import { useEffect } from "react";

function isBlockedShortcut(event: KeyboardEvent): boolean {
  const key = event.key.toLowerCase();

  if (key === "f12") return true;

  if (event.ctrlKey || event.metaKey) {
    if (key === "u") return true;
    if (key === "s") return true;
    if (event.shiftKey && (key === "i" || key === "j" || key === "c")) return true;
  }

  if (event.metaKey && event.altKey && (key === "i" || key === "j" || key === "c")) {
    return true;
  }

  return false;
}

export default function DisableInspect() {
  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isBlockedShortcut(event)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const onDragStart = (event: DragEvent) => {
      event.preventDefault();
    };

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("dragstart", onDragStart);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("dragstart", onDragStart);
    };
  }, []);

  return null;
}
