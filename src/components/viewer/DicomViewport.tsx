"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { Series } from "@/lib/dicom/types";
import type { WindowPreset } from "@/lib/cornerstone/presets";
import type { ToolName } from "./Toolbar";

interface DicomViewportProps {
  viewportKey: string;
  series: Series;
  activeTool: ToolName;
  activePreset: WindowPreset | null;
  onSliceChange: (current: number, total: number, position: number[] | null) => void;
  onWindowChange: (ww: number, wc: number) => void;
  onImageInfo: (width: number, height: number) => void;
  onSliceIndexChange?: (index: number, total: number, position: number[] | null) => void;
  onAxialPositionsReady?: (positions: (number[] | null)[]) => void;
  jumpToSliceIndex?: number | null;
  forcedWindow?: { width: number; center: number } | null;
}

export default function DicomViewport({
  viewportKey,
  series,
  activeTool,
  activePreset,
  onSliceChange,
  onWindowChange,
  onImageInfo,
  onSliceIndexChange,
  onAxialPositionsReady,
  jumpToSliceIndex,
  forcedWindow,
}: DicomViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceIdRef = useRef<string>(
    `${viewportKey}-${Math.random().toString(36).slice(2, 8)}`
  );
  const viewportIdRef = useRef<string>(`ct-viewport-${instanceIdRef.current}`);
  const renderingEngineRef = useRef<unknown>(null);
  const toolGroupIdRef = useRef<string>(`ctViewerToolGroup-${instanceIdRef.current}`);
  const [loading, setLoading] = useState(true);
  const currentIndexRef = useRef(0);
  const imageIdsRef = useRef<string[]>([]);

  // Store callbacks in refs to avoid re-running effects
  const onSliceChangeRef = useRef(onSliceChange);
  const onWindowChangeRef = useRef(onWindowChange);
  const onImageInfoRef = useRef(onImageInfo);
  const onSliceIndexChangeRef = useRef(onSliceIndexChange);
  const onAxialPositionsReadyRef = useRef(onAxialPositionsReady);
  onSliceChangeRef.current = onSliceChange;
  onWindowChangeRef.current = onWindowChange;
  onImageInfoRef.current = onImageInfo;
  onSliceIndexChangeRef.current = onSliceIndexChange;
  onAxialPositionsReadyRef.current = onAxialPositionsReady;

  // Helper: get position for current slice
  const getPositionForIndex = useCallback(async (index: number): Promise<number[] | null> => {
    const { getImageMetadata } = await import("@/lib/cornerstone/custom-image-loader");
    const imageId = imageIdsRef.current[index];
    if (!imageId) return null;
    const meta = getImageMetadata(imageId);
    return (meta?.imagePositionPatient as number[] | undefined) || null;
  }, []);

  const setupViewport = useCallback(async () => {
    if (!containerRef.current) return;
    setLoading(true);

    const cs = await import("@cornerstonejs/core");
    const { initCornerstone, createToolGroup } = await import(
      "@/lib/cornerstone/init"
    );
    const { getImageId } = await import(
      "@/lib/cornerstone/custom-image-loader"
    );

    await initCornerstone();

    const imageIds = series.instances.map((inst) => getImageId(inst.fileKey));
    imageIdsRef.current = imageIds;
    console.log(`[OpenRad] Setting up viewport with ${imageIds.length} images`);
    console.log(`[OpenRad] First imageId: ${imageIds[0]}`);
    if (imageIds.length === 0) return;

    // Clean up previous engine
    if (renderingEngineRef.current) {
      try {
        (renderingEngineRef.current as { destroy: () => void }).destroy();
      } catch {
        // ignore
      }
    }

    const engineId = `ctEngine-${instanceIdRef.current}`;
    const renderingEngine = new cs.RenderingEngine(engineId);
    renderingEngineRef.current = renderingEngine;

    const viewportInput = {
      viewportId: viewportIdRef.current,
      type: cs.Enums.ViewportType.STACK,
      element: containerRef.current,
    };

    renderingEngine.enableElement(viewportInput);

    const viewport = renderingEngine.getViewport(
      viewportIdRef.current
    ) as InstanceType<typeof cs.StackViewport>;

    // Set up tool group
    const toolGroup = createToolGroup(toolGroupIdRef.current);
    if (toolGroup) {
      toolGroup.addViewport(viewportIdRef.current, engineId);
    }

    console.log("[OpenRad] Calling viewport.setStack...");
    try {
      await viewport.setStack(imageIds, 0);
      console.log("[OpenRad] setStack completed successfully");
    } catch (err) {
      console.error("[OpenRad] setStack failed:", err);
    }
    currentIndexRef.current = 0;

    // Get image info
    const imageData = viewport.getImageData();
    console.log("[OpenRad] imageData:", imageData);
    if (imageData?.dimensions) {
      onImageInfoRef.current(imageData.dimensions[0], imageData.dimensions[1]);
    }

    // Report initial slice with position
    const initialPos = await getPositionForIndex(0);
    onSliceChangeRef.current(1, imageIds.length, initialPos);
    onSliceIndexChangeRef.current?.(0, imageIds.length, initialPos);

    // Listen for errors
    const element = containerRef.current;
    element.addEventListener(cs.Enums.Events.IMAGE_LOAD_ERROR, (e: Event) => {
      console.error("[OpenRad] IMAGE_LOAD_ERROR:", (e as CustomEvent).detail);
    });

    // Listen for image rendered to update WW/WC
    const handleImageRendered = () => {
      const props = viewport.getProperties();
      if (props.voiRange) {
        const ww = props.voiRange.upper - props.voiRange.lower;
        const wc = (props.voiRange.upper + props.voiRange.lower) / 2;
        onWindowChangeRef.current(ww, wc);
      }
    };

    element.addEventListener(
      cs.Enums.Events.IMAGE_RENDERED,
      handleImageRendered
    );

    // Mouse wheel scrolling — query Cornerstone for actual index
    const handleWheel = async (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1 : -1;
      const vp = viewport as unknown as {
        scroll: (delta: number) => void;
        getCurrentImageIdIndex: () => number;
        getImageIds: () => string[];
      };
      const before = vp.getCurrentImageIdIndex();
      vp.scroll(delta);
      const after = vp.getCurrentImageIdIndex();
      console.log(`[OpenRad wheel] deltaY=${e.deltaY} delta=${delta} before=${before} after=${after}`);
      currentIndexRef.current = after;
      const pos = await getPositionForIndex(after);
      onSliceChangeRef.current(after + 1, imageIds.length, pos);
      onSliceIndexChangeRef.current?.(after, imageIds.length, pos);
    };

    element.addEventListener("wheel", handleWheel, { passive: false });

    // Preload all images in background for smooth scrolling
    const preloadAborted = { current: false };
    const preloadStack = async () => {
      const { getImageMetadata } = await import("@/lib/cornerstone/custom-image-loader");
      const batchSize = 20;
      for (let i = 0; i < imageIds.length; i += batchSize) {
        if (preloadAborted.current) break;
        const batch = imageIds.slice(i, Math.min(i + batchSize, imageIds.length));
        await Promise.allSettled(
          batch.map((id) =>
            (cs.imageLoader as unknown as { loadAndCacheImage: (id: string) => Promise<unknown> })
              .loadAndCacheImage(id)
          )
        );
        // Yield to keep UI responsive
        await new Promise((r) => setTimeout(r, 0));
      }
      if (!preloadAborted.current) {
        console.log(`[OpenRad] Preloaded all ${imageIds.length} images`);
        // Report all positions after preload completes
        if (onAxialPositionsReadyRef.current) {
          const positions = imageIds.map((id) => {
            const meta = getImageMetadata(id);
            return (meta?.imagePositionPatient as number[] | undefined) || null;
          });
          onAxialPositionsReadyRef.current(positions);
        }
      }
    };
    preloadStack();

    setLoading(false);

    return () => {
      preloadAborted.current = true;
      element.removeEventListener(
        cs.Enums.Events.IMAGE_RENDERED,
        handleImageRendered
      );
      element.removeEventListener("wheel", handleWheel);
    };
  }, [series, getPositionForIndex]);

  useEffect(() => {
    const toolGroupId = toolGroupIdRef.current;
    let cleanup: (() => void) | undefined;
    setupViewport().then((fn) => {
      cleanup = fn;
    });

    return () => {
      cleanup?.();
      if (renderingEngineRef.current) {
        try {
          (renderingEngineRef.current as { destroy: () => void }).destroy();
        } catch {
          // ignore
        }
        renderingEngineRef.current = null;
      }
      import("@/lib/cornerstone/init").then(({ destroyToolGroup }) => {
        destroyToolGroup(toolGroupId);
      });
    };
  }, [setupViewport]);

  // Jump to slice when jumpToSliceIndex changes
  useEffect(() => {
    if (jumpToSliceIndex == null || !renderingEngineRef.current) return;

    const jump = async () => {
      const engine = renderingEngineRef.current as {
        getViewport: (id: string) => unknown;
      };
      const viewport = engine.getViewport(viewportIdRef.current) as unknown as {
        setImageIdIndex: (index: number) => Promise<void>;
        getCurrentImageIdIndex: () => number;
        getImageIds: () => string[];
      };
      if (!viewport) return;

      await viewport.setImageIdIndex(jumpToSliceIndex);
      currentIndexRef.current = jumpToSliceIndex;
      const pos = await getPositionForIndex(jumpToSliceIndex);
      const total = imageIdsRef.current.length;
      onSliceChangeRef.current(jumpToSliceIndex + 1, total, pos);
      onSliceIndexChangeRef.current?.(jumpToSliceIndex, total, pos);
    };
    jump();
  }, [jumpToSliceIndex, getPositionForIndex]);

  // Update active tool
  useEffect(() => {
    const updateTool = async () => {
      const csTools = await import("@cornerstonejs/tools");
      const toolGroup = csTools.ToolGroupManager.getToolGroup(toolGroupIdRef.current);
      if (!toolGroup) return;

      const toolNames = [
        "WindowLevel",
        "Pan",
        "Zoom",
        "Length",
        "Probe",
      ];
      for (const t of toolNames) {
        if (t === activeTool) {
          toolGroup.setToolActive(t, {
            bindings: [
              { mouseButton: csTools.Enums.MouseBindings.Primary },
            ],
          });
        } else if (t === "Length" || t === "Probe") {
          toolGroup.setToolEnabled(t);
        } else {
          toolGroup.setToolPassive(t);
        }
      }
    };
    updateTool();
  }, [activeTool]);

  // Apply preset
  useEffect(() => {
    if (!activePreset || !renderingEngineRef.current) return;

    const applyPreset = () => {
      const engine = renderingEngineRef.current as {
        getViewport: (id: string) => unknown;
      };
      const viewport = engine.getViewport(viewportIdRef.current) as unknown as {
        setProperties: (props: Record<string, unknown>) => void;
        render: () => void;
      };
      if (!viewport) return;

      const lower = activePreset.windowCenter - activePreset.windowWidth / 2;
      const upper = activePreset.windowCenter + activePreset.windowWidth / 2;
      viewport.setProperties({
        voiRange: { lower, upper },
      });
      viewport.render();
      onWindowChangeRef.current(activePreset.windowWidth, activePreset.windowCenter);
    };
    applyPreset();
  }, [activePreset]);

  // Apply forced WW/WC when externally synced
  useEffect(() => {
    if (!forcedWindow || !renderingEngineRef.current) return;

    const applyWindow = () => {
      const engine = renderingEngineRef.current as {
        getViewport: (id: string) => unknown;
      };
      const viewport = engine.getViewport(viewportIdRef.current) as unknown as {
        setProperties: (props: Record<string, unknown>) => void;
        render: () => void;
      };
      if (!viewport) return;

      const lower = forcedWindow.center - forcedWindow.width / 2;
      const upper = forcedWindow.center + forcedWindow.width / 2;
      viewport.setProperties({
        voiRange: { lower, upper },
      });
      viewport.render();
    };

    applyWindow();
  }, [forcedWindow]);

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
