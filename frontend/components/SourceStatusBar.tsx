import type { SourceStatus } from "@/lib/types";
import { sourceLabel } from "@/lib/format";

interface Props {
  sources: SourceStatus[];
}

export default function SourceStatusBar({ sources }: Props) {
  return (
    <div className="statusbar">
      {sources.map((source) => (
        <div
          className={`status ${source.ok ? "status--ok" : "status--fail"}`}
          key={source.source}
          title={source.error || "ok"}
        >
          <span className="status__dot" />
          <span className="status__name">{sourceLabel(source.source)}</span>
          <span className="status__count">{source.count}</span>
        </div>
      ))}
    </div>
  );
}
