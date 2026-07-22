"use client";

// A slide-over that shows the "how it works" content on any page, opened from
// the info icon in the header. Renders the same component the full page uses,
// with a link to the permalink at the bottom.

import { useEffect } from "react";
import { HowItWorksContent } from "@/components/shared/HowItWorksContent";

/** Takes an open flag and a close handler. Returns the info panel. */
export function InfoSlideOver({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="slideover" role="dialog" aria-modal="true" aria-label="How it works">
      <button className="slideover__scrim" aria-label="Close" onClick={onClose} />
      <div className="slideover__panel">
        <div className="slideover__head">
          <span />
          <button type="button" className="btn btn--sm" onClick={onClose}>
            Close
          </button>
        </div>
        <HowItWorksContent showPermalink />
      </div>
    </div>
  );
}
