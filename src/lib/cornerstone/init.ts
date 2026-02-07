import * as cornerstone from "@cornerstonejs/core";
import * as cornerstoneTools from "@cornerstonejs/tools";
import { registerFileImageLoader } from "./custom-image-loader";

const {
  PanTool,
  ZoomTool,
  WindowLevelTool,
  StackScrollTool,
  LengthTool,
  ProbeTool,
  ToolGroupManager,
} = cornerstoneTools;

let initialized = false;

export async function initCornerstone(): Promise<void> {
  if (initialized) return;

  await cornerstone.init();
  cornerstoneTools.init();

  // Increase cache to 2GB so full CT stacks fit in memory
  cornerstone.cache.setMaxCacheSize(2 * 1024 * 1024 * 1024);

  registerFileImageLoader();

  cornerstoneTools.addTool(PanTool);
  cornerstoneTools.addTool(ZoomTool);
  cornerstoneTools.addTool(WindowLevelTool);
  cornerstoneTools.addTool(StackScrollTool);
  cornerstoneTools.addTool(LengthTool);
  cornerstoneTools.addTool(ProbeTool);

  initialized = true;
}

export function createToolGroup(toolGroupId: string): cornerstoneTools.Types.IToolGroup | undefined {
  const existing = ToolGroupManager.getToolGroup(toolGroupId);
  if (existing) {
    ToolGroupManager.destroyToolGroup(toolGroupId);
  }

  const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
  if (!toolGroup) return undefined;

  toolGroup.addTool(WindowLevelTool.toolName);
  toolGroup.addTool(PanTool.toolName);
  toolGroup.addTool(ZoomTool.toolName);
  toolGroup.addTool(StackScrollTool.toolName);
  toolGroup.addTool(LengthTool.toolName);
  toolGroup.addTool(ProbeTool.toolName);

  toolGroup.setToolActive(WindowLevelTool.toolName, {
    bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Primary }],
  });
  toolGroup.setToolActive(PanTool.toolName, {
    bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Auxiliary }],
  });
  toolGroup.setToolActive(ZoomTool.toolName, {
    bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Secondary }],
  });
  toolGroup.setToolEnabled(StackScrollTool.toolName);

  return toolGroup;
}

export function destroyToolGroup(toolGroupId: string): void {
  const existing = ToolGroupManager.getToolGroup(toolGroupId);
  if (existing) {
    ToolGroupManager.destroyToolGroup(toolGroupId);
  }
}
