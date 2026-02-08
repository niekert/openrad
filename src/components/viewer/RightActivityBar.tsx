"use client";

interface PanelDef {
  id: string;
  title: string;
  icon: React.ReactNode;
  available: boolean;
}

interface RightActivityBarProps {
  panels: PanelDef[];
  activePanelIds: ReadonlySet<string>;
  onPanelToggle: (panelId: string) => void;
}

export default function RightActivityBar({
  panels,
  activePanelIds,
  onPanelToggle,
}: RightActivityBarProps) {
  const visiblePanels = panels.filter((p) => p.available);

  if (visiblePanels.length === 0) return null;

  return (
    <div className="flex h-full w-10 flex-shrink-0 flex-col items-center gap-2.5 border-l border-border pt-2">
      {visiblePanels.map((panel) => {
        const isActive = activePanelIds.has(panel.id);
        return (
          <button
            key={panel.id}
            onClick={() => onPanelToggle(panel.id)}
            title={panel.title}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all ${
              isActive
                ? "bg-accent-dim text-accent shadow-[0_0_6px_rgba(0,255,65,0.14)]"
                : "text-muted hover:text-foreground hover:bg-surface-bright"
            }`}
          >
            {panel.icon}
          </button>
        );
      })}
    </div>
  );
}
