import { tool } from "ai";
import { z } from "zod/v4";

export const viewerTools = {
  navigate_to_slice: tool({
    description:
      "Navigate the primary viewport to a specific slice index. Use this to examine different anatomical regions.",
    inputSchema: z.object({
      sliceIndex: z
        .number()
        .int()
        .describe("Zero-based slice index to navigate to"),
    }),
  }),

  apply_window_preset: tool({
    description:
      "Apply a window/level preset to optimize visualization for specific tissue types.",
    inputSchema: z.object({
      preset: z
        .enum([
          "Soft Tissue",
          "Lung",
          "Bone",
          "Mediastinum",
          "Abdomen",
          "Brain",
          "Liver",
        ])
        .describe("The window preset to apply"),
    }),
  }),

  switch_series: tool({
    description:
      "Switch the primary viewport to a different series (e.g. from soft tissue to lung kernel reconstruction).",
    inputSchema: z.object({
      seriesInstanceUID: z
        .string()
        .describe("The Series Instance UID to switch to"),
    }),
  }),

  compare_with_prior: tool({
    description:
      "Open side-by-side comparison with a prior study's series. This opens the compare panel with the specified series.",
    inputSchema: z.object({
      compareSeriesUID: z
        .string()
        .describe(
          "The Series Instance UID of the prior study series to compare with"
        ),
    }),
  }),

  close_comparison: tool({
    description: "Close the comparison panel and return to single viewport view.",
    inputSchema: z.object({}),
  }),

  capture_current_view: tool({
    description:
      "Request a fresh screenshot of the current viewport state for analysis. Use this after navigating or changing presets to see the updated view.",
    inputSchema: z.object({
      viewport: z
        .enum(["primary", "compare", "all"])
        .optional()
        .default("primary")
        .describe("Which viewport to capture"),
    }),
  }),
};

export type ViewerToolName = keyof typeof viewerTools;
