"use client";

import { CT_PRESETS, type WindowPreset } from "@/lib/cornerstone/presets";
import { useState } from "react";

export type ToolName = "WindowLevel" | "Pan" | "Zoom" | "Length" | "Probe";

interface ToolbarProps {
  activeTool: ToolName;
  onToolChange: (tool: ToolName) => void;
  onPresetChange: (preset: WindowPreset) => void;
  activePreset: string;
}

const tools: { name: ToolName; label: string; icon: React.ReactNode }[] = [
  {
    name: "WindowLevel",
    label: "W/L",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a10 10 0 010 20" fill="currentColor" opacity="0.3" />
      </svg>
    ),
  },
  {
    name: "Pan",
    label: "Pan",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
      </svg>
    ),
  },
  {
    name: "Zoom",
    label: "Zoom",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
        <line x1="11" y1="8" x2="11" y2="14" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    ),
  },
  {
    name: "Length",
    label: "Measure",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 2l20 20M6 2v4M2 6h4M18 22v-4M22 18h-4" />
      </svg>
    ),
  },
];

export default function Toolbar({
  activeTool,
  onToolChange,
  onPresetChange,
  activePreset,
}: ToolbarProps) {
  const [presetsOpen, setPresetsOpen] = useState(false);

  return (
    <div className="flex items-center gap-1 border-b border-border px-3 py-1.5">
      {/* Tools */}
      <div className="flex items-center gap-1">
        {tools.map((tool) => (
          <button
            key={tool.name}
            onClick={() => onToolChange(tool.name)}
            title={tool.label}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
              activeTool === tool.name
                ? "bg-accent-dim text-accent glow-green-sm"
                : "text-muted hover:text-foreground hover:bg-surface"
            }`}
          >
            {tool.icon}
            <span className="hidden sm:inline">{tool.label}</span>
          </button>
        ))}
      </div>

      <div className="mx-2 h-5 w-px bg-border" />

      {/* Presets dropdown */}
      <div className="relative">
        <button
          onClick={() => setPresetsOpen(!presetsOpen)}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:text-foreground hover:bg-surface transition-all"
        >
          {activePreset}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3 5l3 3 3-3" />
          </svg>
        </button>

        {presetsOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setPresetsOpen(false)}
            />
            <div className="absolute top-full left-0 z-20 mt-1 w-48 rounded-xl glass p-1 shadow-2xl">
              {CT_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => {
                    onPresetChange(preset);
                    setPresetsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                    activePreset === preset.name
                      ? "bg-accent-dim text-accent"
                      : "text-muted hover:text-foreground hover:bg-surface"
                  }`}
                >
                  <span>{preset.name}</span>
                  {preset.shortcut && (
                    <span className="font-mono text-xs opacity-40">
                      {preset.shortcut}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
