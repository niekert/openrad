import type { ViewerSessionController } from "@/lib/viewer/runtime/viewer-session-controller";
import { CT_PRESETS } from "@/lib/cornerstone/presets";

interface ToolResult {
  success: boolean;
  description: string;
  [key: string]: unknown;
}

interface ToolExecutionContext {
  userPrompt?: string;
  recentActions?: string[];
}

type ToolCallInput =
  | { toolName: "navigate_to_slice"; args: { sliceIndex: number } }
  | { toolName: "apply_window_preset"; args: { preset: string } }
  | { toolName: "switch_series"; args: { seriesInstanceUID: string } }
  | { toolName: "compare_with_prior"; args: { compareSeriesUID: string } }
  | { toolName: "close_comparison"; args: Record<string, never> }
  | { toolName: "capture_current_view"; args: { viewport?: string } };

function waitForRender(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

async function analyzeCapturedScreenshots(
  screenshots: Record<string, string>,
  context?: ToolExecutionContext,
): Promise<string | null> {
  try {
    const response = await fetch("/api/screenshot-analysis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        screenshots,
        userPrompt: context?.userPrompt ?? "",
        recentActions: context?.recentActions ?? [],
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { summary?: string };
    if (typeof payload.summary === "string" && payload.summary.trim().length > 0) {
      return payload.summary.trim();
    }
    return null;
  } catch {
    return null;
  }
}

export async function executeViewerToolCall(
  session: ViewerSessionController,
  toolCall: ToolCallInput,
  context?: ToolExecutionContext,
): Promise<ToolResult> {
  switch (toolCall.toolName) {
    case "navigate_to_slice": {
      const { sliceIndex } = toolCall.args;
      await session.jumpToSlice("primary", sliceIndex);
      await waitForRender();
      return {
        success: true,
        description: `Navigated to slice ${sliceIndex + 1}`,
        sliceIndex,
      };
    }

    case "apply_window_preset": {
      const { preset: presetName } = toolCall.args;
      const preset = CT_PRESETS.find((p) => p.name === presetName);
      if (!preset) {
        return {
          success: false,
          description: `Unknown preset: ${presetName}`,
        };
      }
      session.applyPreset(preset);
      await waitForRender();
      return {
        success: true,
        description: `Applied ${preset.name} preset (WW:${preset.windowWidth} WC:${preset.windowCenter})`,
        windowWidth: preset.windowWidth,
        windowCenter: preset.windowCenter,
      };
    }

    case "switch_series": {
      const { seriesInstanceUID } = toolCall.args;
      session.selectActiveSeries(seriesInstanceUID);
      await waitForRender();
      return {
        success: true,
        description: `Switched to series ${seriesInstanceUID}`,
        seriesInstanceUID,
      };
    }

    case "compare_with_prior": {
      const { compareSeriesUID } = toolCall.args;
      const panels = session.captureViewerSnapshot().panelsOpen;
      if (!panels.includes("compare")) {
        session.togglePanel("compare");
      }
      session.selectCompareSeries(compareSeriesUID);
      await waitForRender();
      return {
        success: true,
        description: `Opened comparison with series ${compareSeriesUID}`,
        compareSeriesUID,
      };
    }

    case "close_comparison": {
      const snapshot = session.captureViewerSnapshot();
      if (snapshot.panelsOpen.includes("compare")) {
        session.togglePanel("compare");
      }
      session.selectCompareSeries(null);
      await waitForRender();
      return {
        success: true,
        description: "Closed comparison panel",
      };
    }

    case "capture_current_view": {
      await waitForRender();
      const screenshots = session.captureAllScreenshots();
      const viewport = toolCall.args.viewport ?? "primary";
      const selectedScreenshots =
        viewport === "all"
          ? screenshots
          : screenshots[viewport]
            ? { [viewport]: screenshots[viewport] }
            : {};
      const capturedCount =
        viewport === "all"
          ? Object.keys(screenshots).length
          : screenshots[viewport]
            ? 1
            : 0;
      const analysisSummary = await analyzeCapturedScreenshots(
        selectedScreenshots,
        context,
      );
      return {
        success: true,
        description: analysisSummary
          ? `Captured ${capturedCount} viewport screenshot(s). Image analysis: ${analysisSummary}`
          : `Captured ${capturedCount} viewport screenshot(s). The screenshots will be provided in the next message.`,
        viewportsCaptured: Object.keys(screenshots),
        analysisSummary,
      };
    }

    default:
      return {
        success: false,
        description: `Unknown tool: ${(toolCall as { toolName: string }).toolName}`,
      };
  }
}
