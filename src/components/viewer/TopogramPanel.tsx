"use client";

import { useEffect, useRef, useCallback, useId } from "react";
import { imageLoader, type StackViewport } from "@cornerstonejs/core";
import type { Series } from "@/lib/dicom/types";
import { getImageId } from "@/lib/cornerstone/custom-image-loader";
import { logger } from "@/lib/debug";
import type { ViewerSessionController } from "@/lib/viewer/runtime/viewer-session-controller";

const log = logger("topogram");

interface TopogramPanelProps {
  session: ViewerSessionController;
  series: Series;
  currentSlicePosition: [number, number, number] | null;
  axialSlicePositions: ([number, number, number] | null)[] | null;
  onJumpToSlice: (index: number) => void;
}

export default function TopogramPanel({
  session,
  series,
  currentSlicePosition,
  axialSlicePositions,
  onJumpToSlice,
}: TopogramPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<StackViewport | null>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const currentSlicePositionRef = useRef<[number, number, number] | null>(null);
  const stableId = useId().replace(/:/g, "");

  useEffect(() => {
    currentSlicePositionRef.current = currentSlicePosition;
  }, [currentSlicePosition]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let destroyed = false;
    const viewportId = `${stableId}-topogram`;

    const setup = async () => {
      const sessionId = session.getSessionId();
      log.debug("setup start", { seriesUID: series.seriesInstanceUID, instances: series.instances.length });

      await session.registerTopogramViewport(viewportId, container);

      if (destroyed) {
        log.debug("setup aborted — destroyed during init");
        // Don't unregister here: the next mount's registerTopogramViewport
        // will disable-then-enable the same viewport ID, cleaning up safely.
        // Unregistering here would race with mount 2's register in Strict Mode.
        return;
      }

      log.debug("resolved session", { sessionId });
      const imageIds = series.instances.map((inst) => getImageId(inst.fileKey, sessionId));
      if (imageIds.length === 0) {
        log.warn("no image ids");
        return;
      }

      const viewport = session.getTopogramStackViewport(viewportId);
      viewportRef.current = viewport;

      await viewport.setStack(imageIds, 0);
      await imageLoader.loadAndCacheImage(imageIds[0]);

      if (destroyed) {
        return;
      }

      viewport.resetCamera();
      viewport.render();
    };

    void setup().catch((error: unknown) => {
      log.error("setup failed", error);
    });

    return () => {
      log.debug("cleanup");
      destroyed = true;
      viewportRef.current = null;
      session.unregisterTopogramViewport(viewportId);
    };
  }, [series, session, stableId]);

  useEffect(() => {
    const line = lineRef.current;
    const container = containerRef.current;
    const viewport = viewportRef.current;

    if (!currentSlicePosition || !line || !container || !viewport) {
      if (lineRef.current) {
        lineRef.current.style.display = "none";
      }
      return;
    }

    try {
      const canvasPoint = viewport.worldToCanvas(currentSlicePosition);
      const y = canvasPoint[1];
      const containerHeight = container.clientHeight;

      if (y >= 0 && y <= containerHeight) {
        line.style.display = "block";
        line.style.top = `${y}px`;
      } else {
        line.style.display = "none";
      }
    } catch {
      line.style.display = "none";
    }
  }, [currentSlicePosition]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const observer = new ResizeObserver(() => {
      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }

      session.resizeViewports();
      viewport.resetCamera();
      viewport.render();

      const latestSlicePosition = currentSlicePositionRef.current;
      if (!latestSlicePosition || !lineRef.current) {
        return;
      }

      try {
        const canvasPoint = viewport.worldToCanvas(latestSlicePosition);
        const y = canvasPoint[1];
        if (y >= 0 && y <= container.clientHeight) {
          lineRef.current.style.display = "block";
          lineRef.current.style.top = `${y}px`;
        } else {
          lineRef.current.style.display = "none";
        }
      } catch {
        lineRef.current.style.display = "none";
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [session]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const viewport = viewportRef.current;
      const container = containerRef.current;
      if (!viewport || !container || !axialSlicePositions) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const canvasPoint: [number, number] = [rect.width / 2, e.clientY - rect.top];

      try {
        const worldPoint = viewport.canvasToWorld(canvasPoint);
        const clickZ = worldPoint[2];

        let bestIndex = -1;
        let bestDistance = Infinity;

        for (let i = 0; i < axialSlicePositions.length; i++) {
          const position = axialSlicePositions[i];
          if (!position) {
            continue;
          }

          const distance = Math.abs(position[2] - clickZ);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = i;
          }
        }

        if (bestIndex >= 0) {
          onJumpToSlice(bestIndex);
        }
      } catch {
        // Ignore conversion errors.
      }
    },
    [axialSlicePositions, onJumpToSlice]
  );

  return (
    <div className="relative h-full w-full bg-black cursor-pointer" onClick={handleClick}>
      <div ref={containerRef} className="h-full w-full" onContextMenu={(e) => e.preventDefault()} />
      <div
        ref={lineRef}
        className="pointer-events-none absolute left-0 right-0"
        style={{
          display: "none",
          height: 2,
          background: "var(--color-accent, #38bdf8)",
          boxShadow: "0 0 6px 1px var(--color-accent, #38bdf8)",
        }}
      />
    </div>
  );
}
