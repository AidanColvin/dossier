import type { PipelineRecord } from "@/lib/types";
import { formatDate, recordChips, sourceLabel } from "@/lib/format";

interface Props {
  record: PipelineRecord;
}

export default function RecordCard({ record }: Props) {
  const chips = recordChips(record);
  return (
    <article className="record">
      <header className="record__head">
        <span className="record__source">{sourceLabel(record.source)}</span>
        {record.verified ? (
          <span className="badge badge--ok">verified</span>
        ) : (
          <span className="badge badge--warn">unverified</span>
        )}
      </header>

      <a className="record__title" href={record.url} target="_blank" rel="noreferrer">
        {record.title || record.native_id}
      </a>

      <div className="record__meta">
        <span>{formatDate(record.date)}</span>
        {chips.map((chip) => (
          <span className="tag" key={chip}>
            {chip}
          </span>
        ))}
      </div>
    </article>
  );
}
