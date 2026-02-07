"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Series } from "@/lib/dicom/types";

interface TopogramPanelProps {
  series: Series;
  currentSlicePosition: number[] | null;
  axialSlicePositions: (number[] | null)[] | null;
  onJumpToSlice: (index: number) => void;
}

export default function TopogramPanel({
  series,
  currentSlicePosition,
  axialSlicePositions,
  onJumpToSlice,
}: TopogramPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderingEngineRef = useRef<unknown>(null);
  const viewportRef = useRef<unknown>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const viewportId = "topogram-viewport";

  // Set up the topogram viewport
  useEffect(() => {
    if (!containerRef.current) return;

    let destroyed = false;

    const setup = async () => {
      // Cornerstone's VTK pipeline requires WebGL2.
      const probeCanvas = document.createElement("canvas");
      const webgl2 = probeCanvas.getContext("webgl2");
      if (!webgl2) {
        return;
      }

      const cs = await import("@cornerstonejs/core");
      const { initCornerstone } = await import("@/lib/cornerstone/init");
      const { getImageId } = await import("@/lib/cornerstone/custom-image-loader");

      await initCornerstone();

      if (destroyed || !containerRef.current) return;

      const imageIds = series.instances.map((inst) => getImageId(inst.fileKey));
      if (imageIds.length === 0) return;

      // Clean up previous
      if (renderingEngineRef.current) {
        try {
          (renderingEngineRef.current as { destroy: () => void }).destroy();
        } catch { /* ignore */ }
      }

      const engineId = "topogramEngine";
      const renderingEngine = new cs.RenderingEngine(engineId);
      renderingEngineRef.current = renderingEngine;

      renderingEngine.enableElement({
        viewportId,
        type: cs.Enums.ViewportType.STACK,
        element: containerRef.current,
      });

      const viewport = renderingEngine.getViewport(viewportId) as InstanceType<typeof cs.StackViewport>;
      viewportRef.current = viewport;

      // NOT added to any tool group — no W/L, Pan, Zoom interaction

      await viewport.setStack(imageIds, 0);

      // Preload the single image
      await (cs.imageLoader as unknown as { loadAndCacheImage: (id: string) => Promise<unknown> })
        .loadAndCacheImage(imageIds[0]);

      if (destroyed) return;

      // Fit image to panel width
      viewport.resetCamera();
      viewport.render();
    };

    void setup().catch((error) => {
      // Keep this concise; VTK may dump full shader source on failures.
      console.warn("Topogram initialization failed.", error);
    });

    return () => {
      destroyed = true;
      if (renderingEngineRef.current) {
        try {
          (renderingEngineRef.current as { destroy: () => void }).destroy();
        } catch { /* ignore */ }
        renderingEngineRef.current = null;
        viewportRef.current = null;
      }
    };
  }, [series]);

  // Update line position when slice position changes
  useEffect(() => {
    if (!currentSlicePosition || !viewportRef.current || !lineRef.current || !containerRef.current) {
      if (lineRef.current) lineRef.current.style.display = "none";
      return;
    }

    const updateLine = () => {
      const viewport = viewportRef.current as {
        worldToCanvas: (point: [number, number, number]) => [number, number];
      };
      if (!viewport) return;

      try {
        // worldToCanvas expects a Point3 [x, y, z]
        const worldPoint: [number, number, number] = [
          currentSlicePosition[0],
          currentSlicePosition[1],
          currentSlicePosition[2],
        ];
        const canvasPoint = viewport.worldToCanvas(worldPoint);

        if (lineRef.current && containerRef.current) {
          const containerHeight = containerRef.current.clientHeight;
          const y = canvasPoint[1];

          if (y >= 0 && y <= containerHeight) {
            lineRef.current.style.display = "block";
            lineRef.current.style.top = `${y}px`;
          } else {
            lineRef.current.style.display = "none";
          }
        }
      } catch {
        if (lineRef.current) lineRef.current.style.display = "none";
      }
    };

    updateLine();
  }, [currentSlicePosition]);

  // ResizeObserver to re-fit image and recalculate line on container resize
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      if (!viewportRef.current || !containerRef.current) return;

      const onResize = () => {
        const viewport = viewportRef.current as {
          resetCamera: () => void;
          render: () => void;
          worldToCanvas: (point: [number, number, number]) => [number, number];
        };
        if (!viewport) return;

        // Resize canvas and re-fit image
        if (renderingEngineRef.current) {
          (renderingEngineRef.current as { resize: () => void }).resize();
        }
        viewport.resetCamera();
        viewport.render();

        // Update line position if we have one
        if (currentSlicePosition && lineRef.current && containerRef.current) {
          try {
            const worldPoint: [number, number, number] = [
              currentSlicePosition[0],
              currentSlicePosition[1],
              currentSlicePosition[2],
            ];
            const canvasPoint = viewport.worldToCanvas(worldPoint);
            const containerHeight = containerRef.current.clientHeight;
            const y = canvasPoint[1];
            if (y >= 0 && y <= containerHeight) {
              lineRef.current.style.display = "block";
              lineRef.current.style.top = `${y}px`;
            } else {
              lineRef.current.style.display = "none";
            }
          } catch { /* ignore */ }
        }
      };

      onResize();
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [currentSlicePosition]);

  // Click handler: click on topogram to jump to slice
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!viewportRef.current || !axialSlicePositions || !containerRef.current) return;

      const viewport = viewportRef.current as {
        canvasToWorld: (point: [number, number]) => [number, number, number];
      };

      const rect = containerRef.current.getBoundingClientRect();
      const canvasX = rect.width / 2;
      const canvasY = e.clientY - rect.top;

      try {
        const worldPoint = viewport.canvasToWorld([canvasX, canvasY]);
        const clickZ = worldPoint[2];

        // Find nearest axial slice by Z distance
        let bestIndex = -1;
        let bestDist = Infinity;
        for (let i = 0; i < axialSlicePositions.length; i++) {
          const pos = axialSlicePositions[i];
          if (!pos) continue;
          const dist = Math.abs(pos[2] - clickZ);
          if (dist < bestDist) {
            bestDist = dist;
            bestIndex = i;
          }
        }

        if (bestIndex >= 0) {
          onJumpToSlice(bestIndex);
        }
      } catch {
        // ignore conversion errors
      }
    },
    [axialSlicePositions, onJumpToSlice]
  );

  return (
    <div
      className="relative h-full w-full bg-black cursor-pointer"
      onClick={handleClick}
    >
      <div
        ref={containerRef}
        className="h-full w-full"
        onContextMenu={(e) => e.preventDefault()}
      />
      {/* Position line overlay */}
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
