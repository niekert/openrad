import {
  Enums as CoreEnums,
  RenderingEngine,
  imageLoader,
  cache,
  init as initCore,
  type Types as CoreTypes,
} from "@cornerstonejs/core";
import {
  Enums as ToolEnums,
  ToolGroupManager,
  PanTool,
  ZoomTool,
  WindowLevelTool,
  StackScrollTool,
  LengthTool,
  ProbeTool,
  addTool,
  init as initTools,
  type Types as ToolTypes,
} from "@cornerstonejs/tools";
import type { Series } from "@/lib/dicom/types";
import { logger } from "@/lib/debug";

const log = logger("runtime");
import type { WindowPreset } from "./presets";
import {
  getImageId,
  getImageMetadata,
  registerFileImageLoader,
} from "./custom-image-loader";

export type ViewerToolName =
  | "WindowLevel"
  | "Pan"
  | "Zoom"
  | "Length"
  | "Probe";
export type RuntimeViewportId = "primary" | "compare";

interface ViewportCallbacks {
  onSliceChange: (
    viewportId: RuntimeViewportId,
    currentIndex: number,
    total: number,
    position: [number, number, number] | null,
  ) => void;
  onWindowChange: (
    viewportId: RuntimeViewportId,
    width: number,
    center: number,
  ) => void;
  onImageInfo: (
    viewportId: RuntimeViewportId,
    width: number,
    height: number,
  ) => void;
  onAxialPositionsReady: (
    viewportId: RuntimeViewportId,
    positions: Array<[number, number, number] | null>,
  ) => void;
}

interface MountedViewport {
  viewportId: RuntimeViewportId;
  element: HTMLDivElement;
  toolGroup: ToolTypes.IToolGroup;
  imageIds: string[];
  currentLoadVersion: number;
  cleanupListeners: () => void;
}

const PRELOAD_CONCURRENCY = 10;

let initialized = false;
let initPromise: Promise<void> | null = null;

async function initCornerstoneRuntime(): Promise<void> {
  if (initialized) {
    return;
  }

  if (!initPromise) {
    initPromise = (async () => {
      await initCore();
      initTools();
      cache.setMaxCacheSize(2 * 1024 * 1024 * 1024);
      registerFileImageLoader();

      addTool(PanTool);
      addTool(ZoomTool);
      addTool(WindowLevelTool);
      addTool(StackScrollTool);
      addTool(LengthTool);
      addTool(ProbeTool);

      initialized = true;
    })();
  }

  await initPromise;
}

function isCustomEvent<T>(event: Event): event is CustomEvent<T> {
  return event instanceof CustomEvent;
}

function getPosition(imageId: string): [number, number, number] | null {
  const metadata = getImageMetadata(imageId);
  if (!metadata) {
    return null;
  }

  const [x, y, z] = metadata.imagePositionPatient;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return null;
  }

  return [x, y, z];
}

function applyToolToGroup(
  toolGroup: ToolTypes.IToolGroup,
  activeTool: ViewerToolName,
): void {
  const toolNames: ViewerToolName[] = [
    "WindowLevel",
    "Pan",
    "Zoom",
    "Length",
    "Probe",
  ];
  for (const toolName of toolNames) {
    if (toolName === activeTool) {
      toolGroup.setToolActive(toolName, {
        bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }],
      });
    } else if (toolName === "Length" || toolName === "Probe") {
      toolGroup.setToolEnabled(toolName);
    } else {
      toolGroup.setToolPassive(toolName);
    }
  }
}

function createToolGroup(
  toolGroupId: string,
  activeTool: ViewerToolName,
): ToolTypes.IToolGroup {
  const existing = ToolGroupManager.getToolGroup(toolGroupId);
  if (existing) {
    ToolGroupManager.destroyToolGroup(toolGroupId);
  }

  const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
  if (!toolGroup) {
    throw new Error(`Failed to create tool group: ${toolGroupId}`);
  }

  toolGroup.addTool(WindowLevelTool.toolName);
  toolGroup.addTool(PanTool.toolName);
  toolGroup.addTool(ZoomTool.toolName);
  toolGroup.addTool(StackScrollTool.toolName);
  toolGroup.addTool(LengthTool.toolName);
  toolGroup.addTool(ProbeTool.toolName);

  toolGroup.setToolActive(WindowLevelTool.toolName, {
    bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }],
  });
  toolGroup.setToolActive(PanTool.toolName, {
    bindings: [{ mouseButton: ToolEnums.MouseBindings.Auxiliary }],
  });
  toolGroup.setToolActive(ZoomTool.toolName, {
    bindings: [{ mouseButton: ToolEnums.MouseBindings.Secondary }],
  });
  toolGroup.setToolEnabled(StackScrollTool.toolName);

  applyToolToGroup(toolGroup, activeTool);
  return toolGroup;
}

export class CornerstoneViewportRuntime {
  private renderingEngine: RenderingEngine | null = null;
  private readonly renderingEngineId: string;
  private readonly sessionId: string;
  private readonly callbacks: ViewportCallbacks;
  private readonly mounted = new Map<RuntimeViewportId, MountedViewport>();
  private activeTool: ViewerToolName = "WindowLevel";

  constructor(sessionId: string, callbacks: ViewportCallbacks) {
    this.sessionId = sessionId;
    this.callbacks = callbacks;
    this.renderingEngineId = `ct-engine-${sessionId}`;
    log.debug("constructor", { sessionId });
  }

  private getEngine(): RenderingEngine {
    if (!this.renderingEngine) {
      log.debug("creating RenderingEngine", this.renderingEngineId);
      this.renderingEngine = new RenderingEngine(this.renderingEngineId);
    }
    return this.renderingEngine;
  }

  dispose(): void {
    log.debug("dispose", { engineId: this.renderingEngineId, mountedViewports: [...this.mounted.keys()] });
    for (const viewportId of this.mounted.keys()) {
      this.unregisterViewport(viewportId);
    }
    this.renderingEngine?.destroy();
    this.renderingEngine = null;
  }

  async registerViewport(
    viewportId: RuntimeViewportId,
    element: HTMLDivElement,
  ): Promise<void> {
    await initCornerstoneRuntime();
    log.debug("registerViewport", viewportId);
    if (this.mounted.has(viewportId)) {
      this.unregisterViewport(viewportId);
    }

    this.getEngine().enableElement({
      viewportId,
      element,
      type: CoreEnums.ViewportType.STACK,
    });

    const toolGroupId = `${this.sessionId}-${viewportId}-tools`;
    const toolGroup = createToolGroup(toolGroupId, this.activeTool);
    toolGroup.addViewport(viewportId, this.renderingEngineId);

    const stackViewport = this.getEngine().getStackViewport(viewportId);

    const onStackNewImage: EventListener = (event) => {
      if (
        !isCustomEvent<CoreTypes.EventTypes.StackNewImageEventDetail>(event)
      ) {
        return;
      }

      const detail = event.detail;
      const imageId = detail.imageId;
      const total = stackViewport.getImageIds().length;
      this.callbacks.onSliceChange(
        viewportId,
        detail.imageIdIndex,
        total,
        getPosition(imageId),
      );
    };

    const onRendered: EventListener = () => {
      const props = stackViewport.getProperties();
      const voiRange = props.voiRange;
      if (!voiRange) {
        return;
      }

      const width = voiRange.upper - voiRange.lower;
      const center = (voiRange.upper + voiRange.lower) / 2;
      this.callbacks.onWindowChange(viewportId, width, center);
    };

    const onNewImageSet: EventListener = (event) => {
      if (
        !isCustomEvent<CoreTypes.EventTypes.StackViewportNewStackEventDetail>(
          event,
        )
      ) {
        return;
      }

      const detail = event.detail;
      const imageId = detail.imageIds[detail.currentImageIdIndex];
      this.callbacks.onSliceChange(
        viewportId,
        detail.currentImageIdIndex,
        detail.imageIds.length,
        imageId ? getPosition(imageId) : null,
      );

      const imageData = stackViewport.getImageData();
      const dimensions = imageData.dimensions;
      this.callbacks.onImageInfo(viewportId, dimensions[0], dimensions[1]);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();

      const delta = event.deltaY > 0 ? 1 : -1;
      stackViewport.scroll(delta);

      const currentIndex = stackViewport.getCurrentImageIdIndex();
      const imageIds = stackViewport.getImageIds();
      const imageId = imageIds[currentIndex];
      this.callbacks.onSliceChange(
        viewportId,
        currentIndex,
        imageIds.length,
        imageId ? getPosition(imageId) : null,
      );
    };

    element.addEventListener(CoreEnums.Events.STACK_NEW_IMAGE, onStackNewImage);
    element.addEventListener(CoreEnums.Events.IMAGE_RENDERED, onRendered);
    element.addEventListener(
      CoreEnums.Events.VIEWPORT_NEW_IMAGE_SET,
      onNewImageSet,
    );
    element.addEventListener("wheel", onWheel, { passive: false });

    this.mounted.set(viewportId, {
      viewportId,
      element,
      toolGroup,
      imageIds: [],
      currentLoadVersion: 0,
      cleanupListeners: () => {
        element.removeEventListener(
          CoreEnums.Events.STACK_NEW_IMAGE,
          onStackNewImage,
        );
        element.removeEventListener(
          CoreEnums.Events.IMAGE_RENDERED,
          onRendered,
        );
        element.removeEventListener(
          CoreEnums.Events.VIEWPORT_NEW_IMAGE_SET,
          onNewImageSet,
        );
        element.removeEventListener("wheel", onWheel);
      },
    });
  }

  unregisterViewport(viewportId: RuntimeViewportId): void {
    const mounted = this.mounted.get(viewportId);
    if (!mounted) {
      return;
    }

    mounted.cleanupListeners();
    this.getEngine().disableElement(viewportId);
    ToolGroupManager.destroyToolGroup(mounted.toolGroup.id);
    this.mounted.delete(viewportId);
  }

  async setSeries(
    viewportId: RuntimeViewportId,
    series: Series | null,
  ): Promise<void> {
    const mounted = this.mounted.get(viewportId);
    if (!mounted) {
      return;
    }

    mounted.currentLoadVersion += 1;
    const loadVersion = mounted.currentLoadVersion;

    if (!series) {
      mounted.imageIds = [];
      return;
    }

    const imageIds = series.instances.map((instance) =>
      getImageId(instance.fileKey, this.sessionId),
    );
    mounted.imageIds = imageIds;

    const stackViewport = this.getEngine().getStackViewport(viewportId);
    if (imageIds.length === 0) {
      return;
    }

    await stackViewport.setStack(imageIds, 0);
    if (!this.isLatestLoad(viewportId, loadVersion)) {
      return;
    }

    const imageData = stackViewport.getImageData();
    const dimensions = imageData.dimensions;
    this.callbacks.onImageInfo(viewportId, dimensions[0], dimensions[1]);

    const firstPosition = getPosition(imageIds[0]);
    this.callbacks.onSliceChange(viewportId, 0, imageIds.length, firstPosition);

    const positions = imageIds.map((imageId) => getPosition(imageId));
    this.callbacks.onAxialPositionsReady(viewportId, positions);

    void this.preloadSeriesImages(viewportId, loadVersion, imageIds);
  }

  setTool(tool: ViewerToolName): void {
    this.activeTool = tool;
    for (const mounted of this.mounted.values()) {
      applyToolToGroup(mounted.toolGroup, tool);
    }
  }

  applyPreset(preset: WindowPreset): void {
    this.setWindowAll(preset.windowWidth, preset.windowCenter);
  }

  setWindowAll(width: number, center: number): void {
    for (const viewportId of this.mounted.keys()) {
      this.setWindow(viewportId, width, center);
    }
  }

  setWindow(
    viewportId: RuntimeViewportId,
    width: number,
    center: number,
  ): void {
    if (!this.mounted.has(viewportId)) {
      return;
    }

    const viewport = this.getEngine().getStackViewport(viewportId);
    viewport.setProperties({
      voiRange: {
        lower: center - width / 2,
        upper: center + width / 2,
      },
    });
    viewport.render();
  }

  scroll(viewportId: RuntimeViewportId, delta: number): void {
    if (!this.mounted.has(viewportId)) return;

    const stackViewport = this.getEngine().getStackViewport(viewportId);
    stackViewport.scroll(delta);

    const currentIndex = stackViewport.getCurrentImageIdIndex();
    const imageIds = stackViewport.getImageIds();
    const imageId = imageIds[currentIndex];
    this.callbacks.onSliceChange(
      viewportId,
      currentIndex,
      imageIds.length,
      imageId ? getPosition(imageId) : null,
    );
  }

  async jumpToSlice(
    viewportId: RuntimeViewportId,
    index: number,
  ): Promise<void> {
    if (!this.mounted.has(viewportId)) {
      return;
    }

    const viewport = this.getEngine().getStackViewport(viewportId);
    await viewport.setImageIdIndex(index);
  }

  hasMountedViewport(viewportId: RuntimeViewportId): boolean {
    return this.mounted.has(viewportId);
  }

  captureScreenshot(viewportId: RuntimeViewportId): string | null {
    const mounted = this.mounted.get(viewportId);
    if (!mounted) return null;
    const canvas = mounted.element.querySelector("canvas");
    if (!canvas) return null;
    return canvas.toDataURL("image/jpeg", 0.85);
  }

  async enableTopogramViewport(
    viewportId: string,
    element: HTMLDivElement,
  ): Promise<void> {
    await initCornerstoneRuntime();
    // Disable first to handle re-registration (e.g., React Strict Mode
    // double-mount where a stale async setup left a viewport enabled).
    this.disableTopogramViewport(viewportId);
    this.getEngine().enableElement({
      viewportId,
      type: CoreEnums.ViewportType.STACK,
      element,
    });
  }

  disableTopogramViewport(viewportId: string): void {
    if (!this.renderingEngine) {
      return;
    }
    try {
      this.renderingEngine.disableElement(viewportId);
    } catch {
      // viewport may already be disabled
    }
  }

  getTopogramStackViewport(viewportId: string) {
    return this.getEngine().getStackViewport(viewportId);
  }

  resizeViewports(): void {
    this.renderingEngine?.resize();
  }

  private isLatestLoad(viewportId: RuntimeViewportId, loadVersion: number): boolean {
    const mounted = this.mounted.get(viewportId);
    return !!mounted && mounted.currentLoadVersion === loadVersion;
  }

  private async preloadSeriesImages(
    viewportId: RuntimeViewportId,
    loadVersion: number,
    imageIds: string[],
  ): Promise<void> {
    let nextIndex = 0;

    const worker = async () => {
      while (true) {
        if (!this.isLatestLoad(viewportId, loadVersion)) {
          return;
        }

        const index = nextIndex;
        nextIndex += 1;
        if (index >= imageIds.length) {
          return;
        }

        const imageId = imageIds[index];
        try {
          await imageLoader.loadAndCacheImage(imageId);
        } catch (error: unknown) {
          log.warn("preload failed", {
            viewportId,
            imageId,
            error: error instanceof Error ? error.message : "unknown",
          });
        }
      }
    };

    const workerCount = Math.min(PRELOAD_CONCURRENCY, imageIds.length);
    const workers = Array.from({ length: workerCount }, () => worker());
    await Promise.all(workers);

    if (!this.isLatestLoad(viewportId, loadVersion)) {
      return;
    }

    const positions = imageIds.map((imageId) => getPosition(imageId));
    this.callbacks.onAxialPositionsReady(viewportId, positions);
  }
}
