"use client";

import { useCallback, useRef } from "react";

interface ResizeHandleProps {
  onResize: (newWidth: number) => void;
  startWidth: number;
}

export default function ResizeHandle({ onResize, startWidth }: ResizeHandleProps) {
  const startXRef = useRef(0);
  const startWidthRef = useRef(startWidth);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startXRef.current = e.clientX;
      startWidthRef.current = startWidth;

      const handleMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startXRef.current;
        const newWidth = Math.max(120, Math.min(600, startWidthRef.current + delta));
        onResize(newWidth);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [onResize, startWidth]
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className="group relative flex-shrink-0 cursor-col-resize"
      style={{ width: 4 }}
    >
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border group-hover:bg-accent transition-colors" />
    </div>
  );
}
