"use client";

interface PanelDef {
  id: string;
  title: string;
  icon: React.ReactNode;
  available: boolean;
}

interface PanelActivityBarProps {
  panels: PanelDef[];
  activePanelId: string | null;
  onPanelToggle: (panelId: string) => void;
}

export default function PanelActivityBar({
  panels,
  activePanelId,
  onPanelToggle,
}: PanelActivityBarProps) {
  const visiblePanels = panels.filter((p) => p.available);

  if (visiblePanels.length === 0) return null;

  return (
    <div className="flex h-full w-10 flex-shrink-0 flex-col items-center gap-1 border-r border-border pt-2">
      {visiblePanels.map((panel) => {
        const isActive = activePanelId === panel.id;
        return (
          <button
            key={panel.id}
            onClick={() => onPanelToggle(panel.id)}
            title={panel.title}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all ${
              isActive
                ? "bg-accent-dim text-accent glow-green-sm"
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
