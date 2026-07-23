"use client";

// the one save button every engine shares. saving never navigates; the
// label flips to confirm, then the projects page lists the bundle.

import { useState } from "react";
import { saveProject, type ProjectBundle } from "@/lib/projects";

export function SaveToProject({
  bundle,
}: {
  bundle: Omit<ProjectBundle, "id" | "savedAt">;
}) {
  const [saved, setSaved] = useState(false);
  return (
    <button
      type="button"
      className="chip"
      disabled={saved}
      onClick={() => {
        saveProject(bundle);
        setSaved(true);
      }}
    >
      {saved ? "Saved to projects" : "Save to projects"}
    </button>
  );
}
