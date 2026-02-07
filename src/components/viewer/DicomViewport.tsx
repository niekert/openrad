"use client";

import { useEffect, useRef, useState } from "react";
import type { ViewerSessionController } from "@/lib/viewer/runtime/viewer-session-controller";
import type { RuntimeViewportId } from "@/lib/cornerstone/runtime";

interface DicomViewportProps {
  viewportId: RuntimeViewportId;
  session: ViewerSessionController;
  jumpToSliceIndex?: number | null;
}

export default function DicomViewport({
  viewportId,
  session,
  jumpToSliceIndex,
}: DicomViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    let cancelled = false;

    const mount = async () => {
      setLoading(true);
      await session.registerViewportMount(viewportId, element);
      if (!cancelled) {
        setLoading(false);
      }
    };

    void mount();

    return () => {
      cancelled = true;
      session.unregisterViewportMount(viewportId);
    };
  }, [session, viewportId]);

  useEffect(() => {
    if (jumpToSliceIndex == null) {
      return;
    }

    void session.jumpToSlice(viewportId, jumpToSliceIndex);
  }, [jumpToSliceIndex, session, viewportId]);

  return (
    <div className="relative flex-1 bg-black">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      )}
      <div
        ref={containerRef}
        className="h-full w-full"
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
