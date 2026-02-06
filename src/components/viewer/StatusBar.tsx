"use client";

interface StatusBarProps {
  currentSlice: number;
  totalSlices: number;
  windowWidth: number;
  windowCenter: number;
  imageWidth: number;
  imageHeight: number;
}

export default function StatusBar({
  currentSlice,
  totalSlices,
  windowWidth,
  windowCenter,
  imageWidth,
  imageHeight,
}: StatusBarProps) {
  return (
    <div className="flex items-center gap-4 border-t border-border px-4 py-1.5 text-xs font-mono text-muted">
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald animate-pulse" />
        <span>
          {currentSlice}/{totalSlices}
        </span>
      </div>
      <div className="h-3 w-px bg-border" />
      <span>
        WW {Math.round(windowWidth)} · WC {Math.round(windowCenter)}
      </span>
      <div className="h-3 w-px bg-border" />
      <span>
        {imageWidth}×{imageHeight}
      </span>
    </div>
  );
}
