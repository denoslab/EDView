import { useEffect, useRef, useState } from "react";
import { loadReplayFromFile } from "@/replay/loadReplay";
import type { ReplayFile } from "@/replay/types";

/**
 * Full-viewport drag-drop target for replay JSON files.
 *
 * The overlay uses `pointer-events: none` when not actively dragging so it
 * never blocks clicks on the underlying UI. Window-level drag listeners track
 * whether a file is being dragged over the page; once detected, the overlay
 * visually highlights and the `drop` handler takes over.
 */
export function ReplayDropZone({
  onLoaded,
  onError,
}: {
  onLoaded: (replay: ReplayFile) => void;
  onError: (e: unknown) => void;
}) {
  const [hover, setHover] = useState(false);
  const dragCountRef = useRef(0); // track nested dragenter/dragleave pairs

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      dragCountRef.current += 1;
      setHover(true);
    };

    const onDragLeave = (_e: DragEvent) => {
      dragCountRef.current = Math.max(0, dragCountRef.current - 1);
      if (dragCountRef.current === 0) setHover(false);
    };

    const onDragOver = (e: DragEvent) => {
      // Prevent default so the browser doesn't navigate away on drop.
      e.preventDefault();
    };

    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      dragCountRef.current = 0;
      setHover(false);
      const file = e.dataTransfer?.files[0];
      if (!file) return;
      try {
        const replay = await loadReplayFromFile(file);
        onLoaded(replay);
      } catch (err) {
        onError(err);
      }
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);

    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [onLoaded, onError]);

  if (!hover) return null;
  console.log("dropped")
  return (
    <div
      data-testid="replay-dropzone"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        background: "rgba(45,108,223,0.18)",
        border: "3px dashed #2D6CDF",
        zIndex: 10,
      }}
    />
  );
}
