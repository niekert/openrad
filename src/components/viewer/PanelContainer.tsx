"use client";

import ResizeHandle from "./ResizeHandle";

interface PanelContainerProps {
  title: string;
  width: number;
  onWidthChange: (width: number) => void;
  children: React.ReactNode;
}

export default function PanelContainer({
  title,
  width,
  onWidthChange,
  children,
}: PanelContainerProps) {
  return (
    <div className="flex h-full flex-shrink-0" style={{ width }}>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center border-b border-border px-3 py-1.5">
          <span className="text-xs font-medium text-muted">{title}</span>
        </div>
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
      <ResizeHandle onResize={onWidthChange} startWidth={width} />
    </div>
  );
}
