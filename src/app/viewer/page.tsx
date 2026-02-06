"use client";

import dynamic from "next/dynamic";

const ViewerApp = dynamic(() => import("@/components/viewer/ViewerApp"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <span className="text-sm text-muted">Loading viewer...</span>
      </div>
    </div>
  ),
});

export default function ViewerPage() {
  return <ViewerApp />;
}
